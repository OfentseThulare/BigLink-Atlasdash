create type public.dispute_status as enum ('open', 'under_review', 'resolution_pending', 'resolved', 'rejected');
create type public.statement_status as enum (
  'open',
  'proposed',
  'approved',
  'locked',
  'payment_submitted',
  'settled',
  'voided'
);
create type public.settlement_status as enum ('awaiting_payment', 'payment_submitted', 'settled', 'rejected');
create type public.notification_kind as enum (
  'approval_requested',
  'approved',
  'rejected',
  'dispute_opened',
  'dispute_updated',
  'due_date_approaching',
  'monthly_close_ready',
  'statement_proposed',
  'payment_submitted',
  'receipt_confirmed',
  'integration_failed'
);
create type public.integration_event_status as enum ('received', 'processing', 'processed', 'failed', 'ignored_duplicate');

create table public.disputes (
  id uuid primary key default extensions.gen_random_uuid(),
  ledger_entry_id uuid not null references public.ledger_entries(id) on delete restrict,
  opened_by_company_id uuid not null references public.companies(id) on delete restrict,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 2000),
  status public.dispute_status not null default 'open',
  proposed_resolution text,
  resolution_adjustment_entry_id uuid references public.ledger_entries(id) on delete restrict,
  resolved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index disputes_one_open_per_entry
  on public.disputes (ledger_entry_id)
  where status in ('open', 'under_review', 'resolution_pending');
create index disputes_status_idx on public.disputes (status, created_at desc);

create table public.dispute_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index dispute_messages_dispute_idx on public.dispute_messages (dispute_id, created_at);

create table public.monthly_statements (
  id uuid primary key default extensions.gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  opening_net_atlas_receivable_cents bigint not null default 0,
  big_link_owes_atlas_cents bigint not null default 0 check (big_link_owes_atlas_cents >= 0),
  atlas_owes_big_link_cents bigint not null default 0 check (atlas_owes_big_link_cents >= 0),
  closing_net_atlas_receivable_cents bigint not null default 0,
  payer_company_id uuid references public.companies(id) on delete restrict,
  receiver_company_id uuid references public.companies(id) on delete restrict,
  settlement_amount_cents bigint not null default 0 check (settlement_amount_cents >= 0),
  due_on date,
  status public.statement_status not null default 'open',
  proposed_by uuid references public.profiles(id) on delete restrict,
  proposed_at timestamptz,
  locked_at timestamptz,
  settled_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_start, period_end),
  check (period_end >= period_start),
  check (
    (settlement_amount_cents = 0 and payer_company_id is null and receiver_company_id is null)
    or (settlement_amount_cents > 0 and payer_company_id is not null
      and receiver_company_id is not null and payer_company_id <> receiver_company_id)
  )
);

create table public.statement_items (
  id uuid primary key default extensions.gen_random_uuid(),
  statement_id uuid not null references public.monthly_statements(id) on delete restrict,
  ledger_entry_id uuid not null unique references public.ledger_entries(id) on delete restrict,
  debtor_company_id uuid not null references public.companies(id) on delete restrict,
  creditor_company_id uuid not null references public.companies(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  entry_type public.ledger_entry_type not null,
  reference text not null,
  description text not null,
  occurred_on date not null,
  created_at timestamptz not null default now(),
  unique (statement_id, ledger_entry_id),
  check (debtor_company_id <> creditor_company_id)
);

create index statement_items_statement_idx on public.statement_items (statement_id, occurred_on, reference);

create table public.settlements (
  id uuid primary key default extensions.gen_random_uuid(),
  statement_id uuid not null unique references public.monthly_statements(id) on delete restrict,
  payer_company_id uuid not null references public.companies(id) on delete restrict,
  receiver_company_id uuid not null references public.companies(id) on delete restrict,
  amount_cents bigint not null check (amount_cents >= 0),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  due_on date not null,
  status public.settlement_status not null default 'awaiting_payment',
  payment_date date,
  payment_reference text,
  proof_document_id uuid references public.documents(id) on delete restrict,
  submitted_by uuid references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payer_company_id <> receiver_company_id),
  check (
    (
      status = 'awaiting_payment'
      and payment_date is null
      and payment_reference is null
      and proof_document_id is null
      and submitted_by is null
      and submitted_at is null
      and confirmed_by is null
      and confirmed_at is null
    )
    or
    (
      status in ('payment_submitted', 'settled', 'rejected')
      and payment_date is not null
      and payment_reference is not null
      and char_length(payment_reference) between 2 and 120
      and proof_document_id is not null
      and submitted_by is not null
      and submitted_at is not null
    )
  ),
  check (
    (status in ('settled', 'rejected') and confirmed_by is not null and confirmed_at is not null)
    or status not in ('settled', 'rejected')
  )
);

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(body) between 2 and 1000),
  subject_type text,
  subject_id uuid,
  read_at timestamptz,
  email_delivery_id text,
  email_sent_at timestamptz,
  email_failed_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, read_at, created_at desc);

create table public.integration_events (
  id uuid primary key default extensions.gen_random_uuid(),
  integration text not null check (integration = 'atlas_dash'),
  event_id text not null,
  event_type text not null,
  source_record_id text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  status public.integration_event_status not null default 'received',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (integration, event_id)
);

create index integration_events_status_idx on public.integration_events (status, received_at);

create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_company_id uuid references public.companies(id) on delete set null,
  action text not null,
  subject_type text not null,
  subject_id uuid,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_events_subject_idx on public.audit_events (subject_type, subject_id, created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_profile_id, created_at desc);

create trigger disputes_set_updated_at
before update on public.disputes
for each row execute function public.set_updated_at();

create trigger monthly_statements_set_updated_at
before update on public.monthly_statements
for each row execute function public.set_updated_at();

create trigger settlements_set_updated_at
before update on public.settlements
for each row execute function public.set_updated_at();

create trigger integration_events_set_updated_at
before update on public.integration_events
for each row execute function public.set_updated_at();

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Audit events are immutable';
end;
$$;

create trigger audit_events_prevent_update_delete
before update or delete on public.audit_events
for each row execute function public.prevent_audit_mutation();

create or replace function public.guard_locked_statement_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.allow_statement_mutation', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' and old.status in ('locked', 'payment_submitted', 'settled') then
    raise exception 'Locked statements cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and old.status in ('locked', 'payment_submitted', 'settled') then
    raise exception 'Locked statements can only change through controlled settlement functions';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger monthly_statements_guard_locked_mutation
before update or delete on public.monthly_statements
for each row execute function public.guard_locked_statement_mutation();

create trigger statement_items_prevent_delete
before delete on public.statement_items
for each row execute function public.prevent_financial_record_delete();
