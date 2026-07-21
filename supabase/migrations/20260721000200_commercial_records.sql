create type public.approval_subject_type as enum (
  'referral',
  'referral_termination',
  'commission_agreement',
  'ledger_adjustment',
  'dispute_resolution',
  'monthly_statement',
  'opening_balance'
);
create type public.approval_decision as enum ('approved', 'rejected');
create type public.referral_status as enum (
  'draft',
  'awaiting_approval',
  'approved',
  'rejected',
  'termination_pending',
  'ended'
);
create type public.deal_status as enum ('draft', 'awaiting_approval', 'approved', 'rejected', 'closed');
create type public.commission_kind as enum ('referral_percentage', 'fixed', 'percentage');
create type public.commission_status as enum (
  'draft',
  'awaiting_approval',
  'approved',
  'rejected',
  'pending_trigger',
  'partially_payable',
  'payable',
  'settled'
);
create type public.invoice_source_system as enum ('atlas_dash', 'portal');
create type public.invoice_kind as enum (
  'direct_service_obligation',
  'referral_commission_source',
  'variable_commission_source'
);
create type public.source_invoice_status as enum ('draft', 'issued', 'partially_paid', 'paid', 'credited', 'void');
create type public.payment_status as enum ('recorded', 'disputed', 'corrected');
create type public.document_kind as enum (
  'source_invoice',
  'deal_terms',
  'payment_confirmation',
  'dispute_evidence',
  'statement',
  'settlement_proof',
  'other'
);

create table public.referrals (
  id uuid primary key default extensions.gen_random_uuid(),
  referred_by_company_id uuid not null references public.companies(id) on delete restrict,
  beneficiary_company_id uuid not null references public.companies(id) on delete restrict,
  client_name text not null check (char_length(client_name) between 2 and 160),
  client_email text,
  client_registration_number text,
  atlas_client_source_id text,
  relationship_notes text,
  commission_rate_basis_points integer not null default 1000
    check (commission_rate_basis_points = 1000),
  status public.referral_status not null default 'draft',
  starts_on date,
  ends_on date,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  approved_at timestamptz,
  ended_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referred_by_company_id <> beneficiary_company_id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create unique index referrals_atlas_client_unique
  on public.referrals (atlas_client_source_id)
  where atlas_client_source_id is not null and status in ('approved', 'termination_pending');
create index referrals_status_idx on public.referrals (status, created_at desc);

create table public.deals (
  id uuid primary key default extensions.gen_random_uuid(),
  reporting_company_id uuid not null references public.companies(id) on delete restrict,
  customer_name text not null check (char_length(customer_name) between 2 and 160),
  title text not null check (char_length(title) between 2 and 180),
  description text,
  closed_on date not null,
  deal_value_cents bigint not null check (deal_value_cents > 0),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  status public.deal_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_company_status_idx on public.deals (reporting_company_id, status, closed_on desc);

create table public.commission_agreements (
  id uuid primary key default extensions.gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete restrict,
  debtor_company_id uuid not null references public.companies(id) on delete restrict,
  creditor_company_id uuid not null references public.companies(id) on delete restrict,
  kind public.commission_kind not null,
  fixed_amount_cents bigint,
  rate_basis_points integer,
  calculation_basis_description text,
  status public.commission_status not null default 'draft',
  proposed_by uuid not null references public.profiles(id) on delete restrict,
  proposed_at timestamptz,
  approved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (debtor_company_id <> creditor_company_id),
  check (
    (kind = 'fixed' and fixed_amount_cents > 0 and rate_basis_points is null)
    or
    (kind in ('percentage', 'referral_percentage') and fixed_amount_cents is null
      and rate_basis_points between 1 and 10000)
  )
);

create index commission_agreements_status_idx on public.commission_agreements (status, created_at desc);

create table public.source_invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  source_system public.invoice_source_system not null,
  source_id text not null,
  invoice_number text not null check (char_length(invoice_number) between 1 and 80),
  kind public.invoice_kind not null,
  issuer_company_id uuid not null references public.companies(id) on delete restrict,
  bill_to_company_id uuid references public.companies(id) on delete restrict,
  bill_to_name text not null check (char_length(bill_to_name) between 2 and 160),
  referral_id uuid references public.referrals(id) on delete restrict,
  deal_id uuid references public.deals(id) on delete restrict,
  issue_date date not null,
  due_date date,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  vat_cents bigint not null default 0 check (vat_cents >= 0),
  total_including_vat_cents bigint not null check (total_including_vat_cents > 0),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  status public.source_invoice_status not null default 'issued',
  source_updated_at timestamptz,
  synced_at timestamptz,
  raw_source jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, source_id),
  check (total_including_vat_cents = subtotal_cents + vat_cents),
  check (due_date is null or due_date >= issue_date),
  check (
    (kind = 'direct_service_obligation' and bill_to_company_id is not null)
    or (kind = 'referral_commission_source' and referral_id is not null)
    or (kind = 'variable_commission_source' and deal_id is not null)
  )
);

create index source_invoices_kind_status_idx on public.source_invoices (kind, status, issue_date desc);
create index source_invoices_referral_idx on public.source_invoices (referral_id) where referral_id is not null;
create index source_invoices_deal_idx on public.source_invoices (deal_id) where deal_id is not null;

create table public.source_invoice_items (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_id uuid not null references public.source_invoices(id) on delete cascade,
  position integer not null check (position >= 0),
  description text not null check (char_length(description) between 1 and 500),
  quantity numeric(12, 4) not null default 1 check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  line_total_cents bigint not null check (line_total_cents >= 0),
  created_at timestamptz not null default now(),
  unique (invoice_id, position)
);

create table public.invoice_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_id uuid not null references public.source_invoices(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  paid_on date not null,
  reference text,
  status public.payment_status not null default 'recorded',
  declared_by uuid not null references public.profiles(id) on delete restrict,
  declared_at timestamptz not null default now(),
  corrected_by_payment_id uuid references public.invoice_payments(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index invoice_payments_invoice_idx on public.invoice_payments (invoice_id, paid_on, created_at);

create table public.commission_entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  agreement_id uuid references public.commission_agreements(id) on delete restrict,
  referral_id uuid references public.referrals(id) on delete restrict,
  source_invoice_id uuid not null unique references public.source_invoices(id) on delete restrict,
  debtor_company_id uuid not null references public.companies(id) on delete restrict,
  creditor_company_id uuid not null references public.companies(id) on delete restrict,
  kind public.commission_kind not null,
  rate_basis_points integer,
  calculation_basis_cents bigint not null check (calculation_basis_cents > 0),
  total_entitlement_cents bigint not null check (total_entitlement_cents > 0),
  released_cents bigint not null default 0 check (released_cents >= 0),
  status public.commission_status not null default 'pending_trigger',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (debtor_company_id <> creditor_company_id),
  check (released_cents <= total_entitlement_cents),
  check (
    (kind = 'referral_percentage' and referral_id is not null and agreement_id is null
      and rate_basis_points = 1000)
    or (kind in ('fixed', 'percentage') and agreement_id is not null and referral_id is null)
  )
);

create index commission_entitlements_status_idx on public.commission_entitlements (status, created_at desc);

create table public.approvals (
  id uuid primary key default extensions.gen_random_uuid(),
  subject_type public.approval_subject_type not null,
  subject_id uuid not null,
  company_id uuid not null references public.companies(id) on delete restrict,
  decision public.approval_decision not null,
  comment text,
  decided_by uuid not null references public.profiles(id) on delete restrict,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (subject_type, subject_id, company_id)
);

create index approvals_subject_idx on public.approvals (subject_type, subject_id);

create table public.documents (
  id uuid primary key default extensions.gen_random_uuid(),
  subject_type text not null check (char_length(subject_type) between 2 and 80),
  subject_id uuid not null,
  kind public.document_kind not null,
  storage_bucket text not null default 'partnership-documents',
  storage_path text not null unique,
  original_filename text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index documents_subject_idx on public.documents (subject_type, subject_id, created_at);

create trigger referrals_set_updated_at
before update on public.referrals
for each row execute function public.set_updated_at();

create trigger deals_set_updated_at
before update on public.deals
for each row execute function public.set_updated_at();

create trigger commission_agreements_set_updated_at
before update on public.commission_agreements
for each row execute function public.set_updated_at();

create trigger source_invoices_set_updated_at
before update on public.source_invoices
for each row execute function public.set_updated_at();

create trigger commission_entitlements_set_updated_at
before update on public.commission_entitlements
for each row execute function public.set_updated_at();
