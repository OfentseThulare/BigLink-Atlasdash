alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.referrals enable row level security;
alter table public.deals enable row level security;
alter table public.commission_agreements enable row level security;
alter table public.source_invoices enable row level security;
alter table public.source_invoice_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.commission_entitlements enable row level security;
alter table public.approvals enable row level security;
alter table public.documents enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.commission_releases enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;
alter table public.monthly_statements enable row level security;
alter table public.statement_items enable row level security;
alter table public.settlements enable row level security;
alter table public.notifications enable row level security;
alter table public.integration_events enable row level security;
alter table public.audit_events enable row level security;

create policy companies_shared_admin_select
on public.companies
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy profiles_own_select
on public.profiles
for select
to authenticated
using (auth.uid() = auth_user_id);

create policy profiles_shared_admin_select
on public.profiles
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy company_memberships_own_select
on public.company_memberships
for select
to authenticated
using (profile_id = public.current_profile_id());

create policy company_memberships_shared_admin_select
on public.company_memberships
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy invitations_shared_admin_select
on public.invitations
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy referrals_shared_admin_select
on public.referrals
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy deals_shared_admin_select
on public.deals
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy deals_party_insert
on public.deals
for insert
to authenticated
with check (
  public.has_required_mfa()
  and public.is_active_administrator()
  and reporting_company_id = public.current_company_id()
  and created_by = public.current_profile_id()
);

create policy commission_agreements_shared_admin_select
on public.commission_agreements
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy source_invoices_shared_admin_select
on public.source_invoices
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy source_invoices_portal_issuer_insert
on public.source_invoices
for insert
to authenticated
with check (
  public.has_required_mfa()
  and public.is_active_administrator()
  and source_system = 'portal'
  and issuer_company_id = public.current_company_id()
  and (created_by is null or created_by = public.current_profile_id())
);

create policy source_invoice_items_shared_admin_select
on public.source_invoice_items
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy source_invoice_items_issuer_insert
on public.source_invoice_items
for insert
to authenticated
with check (
  public.has_required_mfa()
  and public.is_active_administrator()
  and exists (
    select 1
    from public.source_invoices si
    where si.id = invoice_id
      and si.source_system = 'portal'
      and si.issuer_company_id = public.current_company_id()
  )
);

create policy invoice_payments_shared_admin_select
on public.invoice_payments
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy commission_entitlements_shared_admin_select
on public.commission_entitlements
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy approvals_shared_admin_select
on public.approvals
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy documents_shared_admin_select
on public.documents
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy documents_uploader_insert
on public.documents
for insert
to authenticated
with check (
  public.has_required_mfa()
  and public.is_active_administrator()
  and uploaded_by = public.current_profile_id()
);

create policy ledger_entries_shared_admin_select
on public.ledger_entries
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy commission_releases_shared_admin_select
on public.commission_releases
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy disputes_shared_admin_select
on public.disputes
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy dispute_messages_shared_admin_select
on public.dispute_messages
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy dispute_messages_party_insert
on public.dispute_messages
for insert
to authenticated
with check (
  public.has_required_mfa()
  and public.is_active_administrator()
  and author_id = public.current_profile_id()
  and exists (
    select 1
    from public.disputes d
    join public.ledger_entries le on le.id = d.ledger_entry_id
    where d.id = dispute_id
      and d.status in ('open', 'under_review', 'resolution_pending')
      and public.current_company_id() in (le.debtor_company_id, le.creditor_company_id)
  )
);

create policy monthly_statements_shared_admin_select
on public.monthly_statements
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy statement_items_shared_admin_select
on public.statement_items
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy settlements_shared_admin_select
on public.settlements
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy notifications_own_select
on public.notifications
for select
to authenticated
using (
  public.has_required_mfa()
  and profile_id = public.current_profile_id()
);

create policy notifications_own_update_read_state
on public.notifications
for update
to authenticated
using (
  public.has_required_mfa()
  and profile_id = public.current_profile_id()
)
with check (
  public.has_required_mfa()
  and profile_id = public.current_profile_id()
);

create policy integration_events_shared_admin_select
on public.integration_events
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

create policy audit_events_shared_admin_select
on public.audit_events
for select
to authenticated
using (public.has_required_mfa() and public.is_active_administrator());

grant usage on schema public to authenticated;
grant usage, select on sequence public.ledger_reference_seq to authenticated;

grant select on
  public.companies,
  public.profiles,
  public.company_memberships,
  public.invitations,
  public.referrals,
  public.deals,
  public.commission_agreements,
  public.source_invoices,
  public.source_invoice_items,
  public.invoice_payments,
  public.commission_entitlements,
  public.approvals,
  public.documents,
  public.ledger_entries,
  public.commission_releases,
  public.disputes,
  public.dispute_messages,
  public.monthly_statements,
  public.statement_items,
  public.settlements,
  public.notifications,
  public.integration_events,
  public.audit_events
to authenticated;

grant insert on
  public.deals,
  public.source_invoices,
  public.source_invoice_items,
  public.documents,
  public.dispute_messages
to authenticated;

grant update (read_at) on public.notifications to authenticated;
