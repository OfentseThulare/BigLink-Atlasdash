create type public.ledger_entry_type as enum (
  'opening_balance',
  'service_invoice',
  'referral_commission',
  'variable_commission',
  'credit',
  'adjustment'
);
create type public.ledger_status as enum (
  'draft',
  'awaiting_approval',
  'pending_trigger',
  'payable',
  'included_in_statement',
  'settled',
  'disputed',
  'rejected',
  'voided_by_adjustment',
  'carried_forward'
);

create sequence public.ledger_reference_seq start 1;

create or replace function public.next_ledger_reference()
returns text
language sql
volatile
set search_path = public
as $$
  select 'LED-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.ledger_reference_seq')::text, 6, '0');
$$;

create table public.ledger_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  reference text not null unique default public.next_ledger_reference(),
  entry_type public.ledger_entry_type not null,
  debtor_company_id uuid not null references public.companies(id) on delete restrict,
  creditor_company_id uuid not null references public.companies(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  status public.ledger_status not null default 'draft',
  occurred_on date not null default current_date,
  due_on date,
  description text not null check (char_length(description) between 2 and 500),
  source_invoice_id uuid references public.source_invoices(id) on delete restrict,
  commission_entitlement_id uuid references public.commission_entitlements(id) on delete restrict,
  parent_entry_id uuid references public.ledger_entries(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict,
  posted_at timestamptz,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (debtor_company_id <> creditor_company_id),
  check (due_on is null or due_on >= occurred_on),
  check (
    (entry_type = 'service_invoice' and source_invoice_id is not null)
    or (entry_type in ('referral_commission', 'variable_commission')
      and commission_entitlement_id is not null)
    or (entry_type in ('opening_balance', 'credit', 'adjustment'))
  ),
  check (
    (entry_type = 'adjustment' and parent_entry_id is not null)
    or entry_type <> 'adjustment'
  )
);

create unique index ledger_service_invoice_unique
  on public.ledger_entries (source_invoice_id)
  where entry_type = 'service_invoice';
create index ledger_status_due_idx on public.ledger_entries (status, due_on, occurred_on desc);
create index ledger_direction_idx on public.ledger_entries (debtor_company_id, creditor_company_id, status);
create index ledger_parent_idx on public.ledger_entries (parent_entry_id) where parent_entry_id is not null;

create table public.commission_releases (
  id uuid primary key default extensions.gen_random_uuid(),
  entitlement_id uuid not null references public.commission_entitlements(id) on delete restrict,
  payment_id uuid not null unique references public.invoice_payments(id) on delete restrict,
  ledger_entry_id uuid not null unique references public.ledger_entries(id) on delete restrict,
  cumulative_customer_payment_cents bigint not null check (cumulative_customer_payment_cents > 0),
  released_cents bigint not null check (released_cents > 0),
  created_at timestamptz not null default now()
);

create index commission_releases_entitlement_idx on public.commission_releases (entitlement_id, created_at);

create or replace function public.guard_posted_ledger_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.allow_ledger_mutation', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' and old.posted_at is not null then
    raise exception 'Posted ledger entries cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and old.posted_at is not null then
    raise exception 'Posted ledger entries can only change through controlled financial functions';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger ledger_entries_guard_posted_mutation
before update or delete on public.ledger_entries
for each row execute function public.guard_posted_ledger_mutation();

create trigger ledger_entries_set_updated_at
before update on public.ledger_entries
for each row execute function public.set_updated_at();

create or replace function public.prevent_financial_record_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Financial source records cannot be deleted';
end;
$$;

create trigger source_invoices_prevent_delete
before delete on public.source_invoices
for each row execute function public.prevent_financial_record_delete();

create trigger invoice_payments_prevent_delete
before delete on public.invoice_payments
for each row execute function public.prevent_financial_record_delete();

create trigger commission_entitlements_prevent_delete
before delete on public.commission_entitlements
for each row execute function public.prevent_financial_record_delete();

create trigger commission_releases_prevent_delete
before delete on public.commission_releases
for each row execute function public.prevent_financial_record_delete();
