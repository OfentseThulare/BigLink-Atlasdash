create or replace function public.require_portal_admin()
returns table (profile_id uuid, company_id uuid)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.has_required_mfa() then
    raise exception 'MFA is required';
  end if;

  if not public.is_active_administrator() then
    raise exception 'Active administrator access is required';
  end if;

  return query
    select public.current_profile_id(), public.current_company_id();
end;
$$;

create or replace function public.company_id_by_slug(p_slug public.company_slug)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.companies c
  where c.slug = p_slug;
$$;

create or replace function public.notify_company_admins(
  p_company_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_subject_type text,
  p_subject_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (
    profile_id,
    kind,
    title,
    body,
    subject_type,
    subject_id
  )
  select m.profile_id, p_kind, p_title, p_body, p_subject_type, p_subject_id
  from public.company_memberships m
  where m.company_id = p_company_id
    and m.status = 'active'
    and m.role = 'administrator';
$$;

create or replace function public.write_audit_event(
  p_action text,
  p_subject_type text,
  p_subject_id uuid,
  p_before_data jsonb,
  p_after_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_company_id uuid;
begin
  v_profile_id := public.current_profile_id();
  v_company_id := public.current_company_id();

  insert into public.audit_events (
    actor_profile_id,
    actor_company_id,
    action,
    subject_type,
    subject_id,
    before_data,
    after_data,
    request_id,
    ip_address,
    user_agent
  )
  values (
    v_profile_id,
    v_company_id,
    p_action,
    p_subject_type,
    p_subject_id,
    p_before_data,
    p_after_data,
    nullif(current_setting('request.headers', true)::jsonb ->> 'x-request-id', ''),
    nullif(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '')::inet,
    nullif(current_setting('request.headers', true)::jsonb ->> 'user-agent', '')
  );
exception
  when others then
    insert into public.audit_events (
      actor_profile_id,
      actor_company_id,
      action,
      subject_type,
      subject_id,
      before_data,
      after_data
    )
    values (
      v_profile_id,
      v_company_id,
      p_action,
      p_subject_type,
      p_subject_id,
      p_before_data,
      p_after_data
    );
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_id uuid;
begin
  if tg_op = 'DELETE' then
    v_subject_id := old.id;
    perform public.write_audit_event(
      lower(tg_op),
      tg_table_name,
      v_subject_id,
      to_jsonb(old),
      null
    );
    return old;
  end if;

  v_subject_id := new.id;
  perform public.write_audit_event(
    lower(tg_op),
    tg_table_name,
    v_subject_id,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create or replace function public.round_basis_points(p_amount_cents bigint, p_basis_points integer)
returns bigint
language sql
immutable
set search_path = public
as $$
  select floor(((p_amount_cents::numeric * p_basis_points::numeric) + 5000) / 10000)::bigint;
$$;

create or replace function public.release_commission_for_payment(p_payment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.invoice_payments%rowtype;
  v_invoice public.source_invoices%rowtype;
  v_entitlement public.commission_entitlements%rowtype;
  v_cumulative_paid_cents bigint;
  v_should_release_cents bigint;
  v_delta_cents bigint;
  v_ledger_entry_id uuid;
begin
  select *
  into v_payment
  from public.invoice_payments
  where id = p_payment_id
    and status = 'recorded';

  if not found then
    return null;
  end if;

  select *
  into v_invoice
  from public.source_invoices
  where id = v_payment.invoice_id
  for update;

  select *
  into v_entitlement
  from public.commission_entitlements
  where source_invoice_id = v_invoice.id
  for update;

  if not found then
    return null;
  end if;

  select coalesce(sum(amount_cents), 0)
  into v_cumulative_paid_cents
  from public.invoice_payments
  where invoice_id = v_invoice.id
    and status = 'recorded';

  v_cumulative_paid_cents := least(v_cumulative_paid_cents, v_invoice.total_including_vat_cents);
  v_should_release_cents := floor(
    (
      (v_entitlement.total_entitlement_cents::numeric * v_cumulative_paid_cents::numeric)
      + (v_invoice.total_including_vat_cents::numeric / 2)
    )
    / v_invoice.total_including_vat_cents::numeric
  )::bigint;
  v_delta_cents := v_should_release_cents - v_entitlement.released_cents;

  if v_delta_cents <= 0 then
    return null;
  end if;

  insert into public.ledger_entries (
    entry_type,
    debtor_company_id,
    creditor_company_id,
    amount_cents,
    status,
    occurred_on,
    description,
    source_invoice_id,
    commission_entitlement_id,
    posted_at,
    metadata
  )
  values (
    case
      when v_entitlement.kind = 'referral_percentage' then 'referral_commission'::public.ledger_entry_type
      else 'variable_commission'::public.ledger_entry_type
    end,
    v_entitlement.debtor_company_id,
    v_entitlement.creditor_company_id,
    v_delta_cents,
    'payable',
    v_payment.paid_on,
    'Commission released from customer payment on ' || v_invoice.invoice_number,
    v_invoice.id,
    v_entitlement.id,
    now(),
    jsonb_build_object(
      'payment_id', v_payment.id,
      'cumulative_customer_payment_cents', v_cumulative_paid_cents,
      'invoice_total_cents', v_invoice.total_including_vat_cents
    )
  )
  returning id into v_ledger_entry_id;

  insert into public.commission_releases (
    entitlement_id,
    payment_id,
    ledger_entry_id,
    cumulative_customer_payment_cents,
    released_cents
  )
  values (
    v_entitlement.id,
    v_payment.id,
    v_ledger_entry_id,
    v_cumulative_paid_cents,
    v_delta_cents
  );

  update public.commission_entitlements
  set released_cents = v_should_release_cents,
      status = case
        when v_should_release_cents >= total_entitlement_cents then 'payable'::public.commission_status
        when v_should_release_cents > 0 then 'partially_payable'::public.commission_status
        else status
      end
  where id = v_entitlement.id;

  perform public.notify_company_admins(
    v_entitlement.creditor_company_id,
    'monthly_close_ready',
    'Commission became payable',
    'A commission was released from payment on invoice ' || v_invoice.invoice_number || '.',
    'ledger_entries',
    v_ledger_entry_id
  );

  return v_ledger_entry_id;
end;
$$;

create or replace function public.process_source_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.source_invoices%rowtype;
  v_referral public.referrals%rowtype;
  v_agreement public.commission_agreements%rowtype;
  v_entitlement_id uuid;
  v_latest_payment_id uuid;
  v_total_entitlement_cents bigint;
begin
  select *
  into v_invoice
  from public.source_invoices
  where id = p_invoice_id;

  if not found or v_invoice.status not in ('issued', 'partially_paid', 'paid') then
    return;
  end if;

  if v_invoice.kind = 'direct_service_obligation' then
    insert into public.ledger_entries (
      entry_type,
      debtor_company_id,
      creditor_company_id,
      amount_cents,
      status,
      occurred_on,
      due_on,
      description,
      source_invoice_id,
      created_by,
      posted_at
    )
    values (
      'service_invoice',
      v_invoice.bill_to_company_id,
      v_invoice.issuer_company_id,
      v_invoice.total_including_vat_cents,
      'payable',
      v_invoice.issue_date,
      v_invoice.due_date,
      'Service invoice ' || v_invoice.invoice_number,
      v_invoice.id,
      v_invoice.created_by,
      now()
    )
    on conflict do nothing;
    return;
  end if;

  if v_invoice.kind = 'referral_commission_source' then
    select *
    into v_referral
    from public.referrals
    where id = v_invoice.referral_id
      and status in ('approved', 'termination_pending');

    if not found then
      return;
    end if;

    v_total_entitlement_cents := public.round_basis_points(
      v_invoice.total_including_vat_cents,
      v_referral.commission_rate_basis_points
    );

    insert into public.commission_entitlements (
      referral_id,
      source_invoice_id,
      debtor_company_id,
      creditor_company_id,
      kind,
      rate_basis_points,
      calculation_basis_cents,
      total_entitlement_cents,
      status
    )
    values (
      v_referral.id,
      v_invoice.id,
      v_invoice.issuer_company_id,
      v_referral.referred_by_company_id,
      'referral_percentage',
      v_referral.commission_rate_basis_points,
      v_invoice.total_including_vat_cents,
      v_total_entitlement_cents,
      'pending_trigger'
    )
    on conflict (source_invoice_id) do nothing
    returning id into v_entitlement_id;
  end if;

  if v_invoice.kind = 'variable_commission_source' then
    select *
    into v_agreement
    from public.commission_agreements
    where deal_id = v_invoice.deal_id
      and status = 'approved'
    order by approved_at desc nulls last, created_at desc
    limit 1;

    if not found then
      return;
    end if;

    v_total_entitlement_cents := case
      when v_agreement.kind = 'fixed' then v_agreement.fixed_amount_cents
      else public.round_basis_points(v_invoice.total_including_vat_cents, v_agreement.rate_basis_points)
    end;

    insert into public.commission_entitlements (
      agreement_id,
      source_invoice_id,
      debtor_company_id,
      creditor_company_id,
      kind,
      rate_basis_points,
      calculation_basis_cents,
      total_entitlement_cents,
      status
    )
    values (
      v_agreement.id,
      v_invoice.id,
      v_agreement.debtor_company_id,
      v_agreement.creditor_company_id,
      v_agreement.kind,
      v_agreement.rate_basis_points,
      v_invoice.total_including_vat_cents,
      v_total_entitlement_cents,
      'pending_trigger'
    )
    on conflict (source_invoice_id) do nothing
    returning id into v_entitlement_id;
  end if;

  if v_entitlement_id is not null then
    select id
    into v_latest_payment_id
    from public.invoice_payments
    where invoice_id = v_invoice.id
      and status = 'recorded'
    order by paid_on desc, created_at desc
    limit 1;

    if v_latest_payment_id is not null then
      perform public.release_commission_for_payment(v_latest_payment_id);
    end if;
  end if;
end;
$$;

create or replace function public.source_invoice_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.process_source_invoice(new.id);
  return new;
end;
$$;

create trigger source_invoices_process_after_insert
after insert on public.source_invoices
for each row execute function public.source_invoice_after_insert();

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount_cents bigint,
  p_paid_on date,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_invoice public.source_invoices%rowtype;
  v_total_paid_cents bigint;
  v_payment_id uuid;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  select *
  into v_invoice
  from public.source_invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if v_actor.company_id <> v_invoice.issuer_company_id then
    raise exception 'Only the invoice issuer can record customer payment';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  select coalesce(sum(amount_cents), 0) + p_amount_cents
  into v_total_paid_cents
  from public.invoice_payments
  where invoice_id = p_invoice_id
    and status = 'recorded';

  if v_total_paid_cents > v_invoice.total_including_vat_cents then
    raise exception 'Recorded payments cannot exceed invoice total';
  end if;

  insert into public.invoice_payments (
    invoice_id,
    amount_cents,
    paid_on,
    reference,
    declared_by
  )
  values (
    p_invoice_id,
    p_amount_cents,
    p_paid_on,
    nullif(trim(p_reference), ''),
    v_actor.profile_id
  )
  returning id into v_payment_id;

  update public.source_invoices
  set status = case
        when v_total_paid_cents >= total_including_vat_cents then 'paid'::public.source_invoice_status
        else 'partially_paid'::public.source_invoice_status
      end
  where id = p_invoice_id;

  perform public.release_commission_for_payment(v_payment_id);

  return v_payment_id;
end;
$$;

create or replace function public.submit_referral(
  p_client_name text,
  p_client_email text default null,
  p_client_registration_number text default null,
  p_relationship_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_atlas_company_id uuid;
  v_referral_id uuid;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  v_atlas_company_id := public.company_id_by_slug('atlas');

  if v_actor.company_id = v_atlas_company_id then
    raise exception 'Atlas cannot submit itself as a referral source';
  end if;

  insert into public.referrals (
    referred_by_company_id,
    beneficiary_company_id,
    client_name,
    client_email,
    client_registration_number,
    relationship_notes,
    status,
    submitted_by,
    submitted_at,
    starts_on
  )
  values (
    v_actor.company_id,
    v_atlas_company_id,
    p_client_name,
    nullif(lower(trim(p_client_email)), ''),
    nullif(trim(p_client_registration_number), ''),
    nullif(trim(p_relationship_notes), ''),
    'awaiting_approval',
    v_actor.profile_id,
    now(),
    current_date
  )
  returning id into v_referral_id;

  insert into public.approvals (
    subject_type,
    subject_id,
    company_id,
    decision,
    decided_by
  )
  values (
    'referral',
    v_referral_id,
    v_actor.company_id,
    'approved',
    v_actor.profile_id
  );

  perform public.notify_company_admins(
    v_atlas_company_id,
    'approval_requested',
    'Referral approval requested',
    'A Big Link referral is awaiting Atlas approval.',
    'referrals',
    v_referral_id
  );

  return v_referral_id;
end;
$$;

create or replace function public.decide_referral(
  p_referral_id uuid,
  p_decision public.approval_decision,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_referral public.referrals%rowtype;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  select *
  into v_referral
  from public.referrals
  where id = p_referral_id
  for update;

  if not found then
    raise exception 'Referral not found';
  end if;

  if v_actor.company_id = v_referral.referred_by_company_id then
    raise exception 'The submitting company cannot complete counterparty approval';
  end if;

  insert into public.approvals (
    subject_type,
    subject_id,
    company_id,
    decision,
    comment,
    decided_by
  )
  values (
    'referral',
    p_referral_id,
    v_actor.company_id,
    p_decision,
    nullif(trim(p_comment), ''),
    v_actor.profile_id
  )
  on conflict (subject_type, subject_id, company_id) do update
  set decision = excluded.decision,
      comment = excluded.comment,
      decided_by = excluded.decided_by,
      decided_at = now();

  update public.referrals
  set status = case
        when p_decision = 'approved' then 'approved'::public.referral_status
        else 'rejected'::public.referral_status
      end,
      approved_at = case when p_decision = 'approved' then now() else approved_at end
  where id = p_referral_id;

  if p_decision = 'approved' then
    perform public.process_source_invoice(si.id)
    from public.source_invoices si
    where si.referral_id = p_referral_id;
  end if;
end;
$$;

create or replace function public.propose_variable_commission(
  p_deal_id uuid,
  p_debtor_company_id uuid,
  p_creditor_company_id uuid,
  p_kind public.commission_kind,
  p_fixed_amount_cents bigint,
  p_rate_basis_points integer,
  p_calculation_basis_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_agreement_id uuid;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  if p_kind = 'referral_percentage' then
    raise exception 'Referral commission terms are fixed by partnership agreement';
  end if;

  if v_actor.company_id not in (p_debtor_company_id, p_creditor_company_id) then
    raise exception 'Actor company must be party to the commission';
  end if;

  insert into public.commission_agreements (
    deal_id,
    debtor_company_id,
    creditor_company_id,
    kind,
    fixed_amount_cents,
    rate_basis_points,
    calculation_basis_description,
    status,
    proposed_by,
    proposed_at
  )
  values (
    p_deal_id,
    p_debtor_company_id,
    p_creditor_company_id,
    p_kind,
    p_fixed_amount_cents,
    p_rate_basis_points,
    nullif(trim(p_calculation_basis_description), ''),
    'awaiting_approval',
    v_actor.profile_id,
    now()
  )
  returning id into v_agreement_id;

  insert into public.approvals (
    subject_type,
    subject_id,
    company_id,
    decision,
    decided_by
  )
  values (
    'commission_agreement',
    v_agreement_id,
    v_actor.company_id,
    'approved',
    v_actor.profile_id
  );

  return v_agreement_id;
end;
$$;

create or replace function public.decide_commission_agreement(
  p_agreement_id uuid,
  p_decision public.approval_decision,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_agreement public.commission_agreements%rowtype;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  select *
  into v_agreement
  from public.commission_agreements
  where id = p_agreement_id
  for update;

  if not found then
    raise exception 'Commission agreement not found';
  end if;

  if v_actor.company_id not in (v_agreement.debtor_company_id, v_agreement.creditor_company_id) then
    raise exception 'Actor company is not party to the commission agreement';
  end if;

  insert into public.approvals (
    subject_type,
    subject_id,
    company_id,
    decision,
    comment,
    decided_by
  )
  values (
    'commission_agreement',
    p_agreement_id,
    v_actor.company_id,
    p_decision,
    nullif(trim(p_comment), ''),
    v_actor.profile_id
  )
  on conflict (subject_type, subject_id, company_id) do update
  set decision = excluded.decision,
      comment = excluded.comment,
      decided_by = excluded.decided_by,
      decided_at = now();

  if p_decision = 'rejected' then
    update public.commission_agreements
    set status = 'rejected'
    where id = p_agreement_id;
    return;
  end if;

  if (
    select count(distinct company_id)
    from public.approvals
    where subject_type = 'commission_agreement'
      and subject_id = p_agreement_id
      and decision = 'approved'
  ) >= 2 then
    update public.commission_agreements
    set status = 'approved',
        approved_at = now()
    where id = p_agreement_id;

    perform public.process_source_invoice(si.id)
    from public.source_invoices si
    where si.deal_id = v_agreement.deal_id
      and si.kind = 'variable_commission_source';
  end if;
end;
$$;

create or replace function public.propose_manual_ledger_entry(
  p_entry_type public.ledger_entry_type,
  p_debtor_company_id uuid,
  p_creditor_company_id uuid,
  p_amount_cents bigint,
  p_occurred_on date,
  p_due_on date,
  p_description text,
  p_parent_entry_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_entry_id uuid;
  v_subject_type public.approval_subject_type;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  if p_entry_type not in ('opening_balance', 'credit', 'adjustment') then
    raise exception 'Only opening balances, credits, and adjustments can be proposed manually';
  end if;

  if v_actor.company_id not in (p_debtor_company_id, p_creditor_company_id) then
    raise exception 'Actor company must be party to the ledger entry';
  end if;

  v_subject_type := case
    when p_entry_type = 'opening_balance' then 'opening_balance'::public.approval_subject_type
    else 'ledger_adjustment'::public.approval_subject_type
  end;

  insert into public.ledger_entries (
    entry_type,
    debtor_company_id,
    creditor_company_id,
    amount_cents,
    status,
    occurred_on,
    due_on,
    description,
    parent_entry_id,
    created_by
  )
  values (
    p_entry_type,
    p_debtor_company_id,
    p_creditor_company_id,
    p_amount_cents,
    'awaiting_approval',
    p_occurred_on,
    p_due_on,
    p_description,
    p_parent_entry_id,
    v_actor.profile_id
  )
  returning id into v_entry_id;

  insert into public.approvals (
    subject_type,
    subject_id,
    company_id,
    decision,
    decided_by
  )
  values (
    v_subject_type,
    v_entry_id,
    v_actor.company_id,
    'approved',
    v_actor.profile_id
  );

  return v_entry_id;
end;
$$;

create or replace function public.decide_manual_ledger_entry(
  p_ledger_entry_id uuid,
  p_decision public.approval_decision,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_entry public.ledger_entries%rowtype;
  v_subject_type public.approval_subject_type;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  select *
  into v_entry
  from public.ledger_entries
  where id = p_ledger_entry_id
  for update;

  if not found then
    raise exception 'Ledger entry not found';
  end if;

  if v_entry.entry_type not in ('opening_balance', 'credit', 'adjustment') then
    raise exception 'This ledger entry cannot be manually approved';
  end if;

  if v_actor.company_id not in (v_entry.debtor_company_id, v_entry.creditor_company_id) then
    raise exception 'Actor company must be party to the ledger entry';
  end if;

  v_subject_type := case
    when v_entry.entry_type = 'opening_balance' then 'opening_balance'::public.approval_subject_type
    else 'ledger_adjustment'::public.approval_subject_type
  end;

  insert into public.approvals (
    subject_type,
    subject_id,
    company_id,
    decision,
    comment,
    decided_by
  )
  values (
    v_subject_type,
    p_ledger_entry_id,
    v_actor.company_id,
    p_decision,
    nullif(trim(p_comment), ''),
    v_actor.profile_id
  )
  on conflict (subject_type, subject_id, company_id) do update
  set decision = excluded.decision,
      comment = excluded.comment,
      decided_by = excluded.decided_by,
      decided_at = now();

  if p_decision = 'rejected' then
    update public.ledger_entries
    set status = 'rejected'
    where id = p_ledger_entry_id;
    return;
  end if;

  if (
    select count(distinct company_id)
    from public.approvals
    where subject_type = v_subject_type
      and subject_id = p_ledger_entry_id
      and decision = 'approved'
  ) >= 2 then
    update public.ledger_entries
    set status = 'payable',
        posted_at = coalesce(posted_at, now())
    where id = p_ledger_entry_id;
  end if;
end;
$$;

create or replace function public.open_ledger_dispute(
  p_ledger_entry_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_entry public.ledger_entries%rowtype;
  v_dispute_id uuid;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  select *
  into v_entry
  from public.ledger_entries
  where id = p_ledger_entry_id
  for update;

  if not found then
    raise exception 'Ledger entry not found';
  end if;

  if v_actor.company_id not in (v_entry.debtor_company_id, v_entry.creditor_company_id) then
    raise exception 'Actor company must be party to the ledger entry';
  end if;

  if v_entry.status in ('settled', 'rejected', 'voided_by_adjustment') then
    raise exception 'This ledger entry cannot be disputed';
  end if;

  insert into public.disputes (
    ledger_entry_id,
    opened_by_company_id,
    opened_by,
    reason
  )
  values (
    p_ledger_entry_id,
    v_actor.company_id,
    v_actor.profile_id,
    p_reason
  )
  returning id into v_dispute_id;

  perform set_config('app.allow_ledger_mutation', 'on', true);

  update public.ledger_entries
  set status = 'disputed',
      metadata = metadata || jsonb_build_object('status_before_dispute', v_entry.status)
  where id = p_ledger_entry_id;

  perform public.notify_company_admins(
    case
      when v_actor.company_id = v_entry.debtor_company_id then v_entry.creditor_company_id
      else v_entry.debtor_company_id
    end,
    'dispute_opened',
    'Ledger item disputed',
    'A ledger item has been disputed and is excluded from payable balance.',
    'disputes',
    v_dispute_id
  );

  return v_dispute_id;
end;
$$;

create or replace function public.propose_monthly_statement(
  p_period_start date,
  p_period_end date,
  p_due_on date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_atlas_company_id uuid;
  v_big_link_company_id uuid;
  v_big_owes_atlas_cents bigint;
  v_atlas_owes_big_cents bigint;
  v_opening_net_cents bigint;
  v_closing_net_cents bigint;
  v_statement_id uuid;
  v_payer_company_id uuid;
  v_receiver_company_id uuid;
  v_settlement_amount_cents bigint;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  if p_period_end < p_period_start then
    raise exception 'Statement period end must be on or after start';
  end if;

  v_atlas_company_id := public.company_id_by_slug('atlas');
  v_big_link_company_id := public.company_id_by_slug('big_link');

  select coalesce(closing_net_atlas_receivable_cents, 0)
  into v_opening_net_cents
  from public.monthly_statements
  where period_end < p_period_start
    and status in ('locked', 'payment_submitted', 'settled')
  order by period_end desc
  limit 1;

  v_opening_net_cents := coalesce(v_opening_net_cents, 0);

  select coalesce(sum(amount_cents), 0)
  into v_big_owes_atlas_cents
  from public.ledger_entries
  where debtor_company_id = v_big_link_company_id
    and creditor_company_id = v_atlas_company_id
    and status = 'payable'
    and occurred_on between p_period_start and p_period_end;

  select coalesce(sum(amount_cents), 0)
  into v_atlas_owes_big_cents
  from public.ledger_entries
  where debtor_company_id = v_atlas_company_id
    and creditor_company_id = v_big_link_company_id
    and status = 'payable'
    and occurred_on between p_period_start and p_period_end;

  v_closing_net_cents := v_opening_net_cents + v_big_owes_atlas_cents - v_atlas_owes_big_cents;

  if v_closing_net_cents > 0 then
    v_payer_company_id := v_big_link_company_id;
    v_receiver_company_id := v_atlas_company_id;
    v_settlement_amount_cents := v_closing_net_cents;
  elsif v_closing_net_cents < 0 then
    v_payer_company_id := v_atlas_company_id;
    v_receiver_company_id := v_big_link_company_id;
    v_settlement_amount_cents := abs(v_closing_net_cents);
  else
    v_payer_company_id := null;
    v_receiver_company_id := null;
    v_settlement_amount_cents := 0;
  end if;

  insert into public.monthly_statements (
    period_start,
    period_end,
    opening_net_atlas_receivable_cents,
    big_link_owes_atlas_cents,
    atlas_owes_big_link_cents,
    closing_net_atlas_receivable_cents,
    payer_company_id,
    receiver_company_id,
    settlement_amount_cents,
    due_on,
    status,
    proposed_by,
    proposed_at
  )
  values (
    p_period_start,
    p_period_end,
    v_opening_net_cents,
    v_big_owes_atlas_cents,
    v_atlas_owes_big_cents,
    v_closing_net_cents,
    v_payer_company_id,
    v_receiver_company_id,
    v_settlement_amount_cents,
    p_due_on,
    'proposed',
    v_actor.profile_id,
    now()
  )
  returning id into v_statement_id;

  insert into public.statement_items (
    statement_id,
    ledger_entry_id,
    debtor_company_id,
    creditor_company_id,
    amount_cents,
    entry_type,
    reference,
    description,
    occurred_on
  )
  select
    v_statement_id,
    le.id,
    le.debtor_company_id,
    le.creditor_company_id,
    le.amount_cents,
    le.entry_type,
    le.reference,
    le.description,
    le.occurred_on
  from public.ledger_entries le
  where le.status = 'payable'
    and le.occurred_on between p_period_start and p_period_end;

  perform set_config('app.allow_ledger_mutation', 'on', true);

  update public.ledger_entries
  set status = 'included_in_statement'
  where id in (
    select ledger_entry_id
    from public.statement_items
    where statement_id = v_statement_id
  );

  insert into public.approvals (
    subject_type,
    subject_id,
    company_id,
    decision,
    decided_by
  )
  values (
    'monthly_statement',
    v_statement_id,
    v_actor.company_id,
    'approved',
    v_actor.profile_id
  );

  perform public.notify_company_admins(
    case
      when v_actor.company_id = v_atlas_company_id then v_big_link_company_id
      else v_atlas_company_id
    end,
    'statement_proposed',
    'Monthly statement proposed',
    'A monthly partnership statement is awaiting approval.',
    'monthly_statements',
    v_statement_id
  );

  return v_statement_id;
end;
$$;

create or replace function public.decide_monthly_statement(
  p_statement_id uuid,
  p_decision public.approval_decision,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_statement public.monthly_statements%rowtype;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  select *
  into v_statement
  from public.monthly_statements
  where id = p_statement_id
  for update;

  if not found then
    raise exception 'Statement not found';
  end if;

  if v_statement.status not in ('proposed', 'approved') then
    raise exception 'Statement is not awaiting approval';
  end if;

  insert into public.approvals (
    subject_type,
    subject_id,
    company_id,
    decision,
    comment,
    decided_by
  )
  values (
    'monthly_statement',
    p_statement_id,
    v_actor.company_id,
    p_decision,
    nullif(trim(p_comment), ''),
    v_actor.profile_id
  )
  on conflict (subject_type, subject_id, company_id) do update
  set decision = excluded.decision,
      comment = excluded.comment,
      decided_by = excluded.decided_by,
      decided_at = now();

  if p_decision = 'rejected' then
    perform set_config('app.allow_ledger_mutation', 'on', true);

    update public.ledger_entries
    set status = 'payable'
    where id in (
      select ledger_entry_id
      from public.statement_items
      where statement_id = p_statement_id
    );

    update public.monthly_statements
    set status = 'voided'
    where id = p_statement_id;
    return;
  end if;

  if (
    select count(distinct company_id)
    from public.approvals
    where subject_type = 'monthly_statement'
      and subject_id = p_statement_id
      and decision = 'approved'
  ) < 2 then
    update public.monthly_statements
    set status = 'approved'
    where id = p_statement_id;
    return;
  end if;

  update public.monthly_statements
  set status = case
        when settlement_amount_cents = 0 then 'settled'::public.statement_status
        else 'locked'::public.statement_status
      end,
      locked_at = now(),
      settled_at = case when settlement_amount_cents = 0 then now() else settled_at end
  where id = p_statement_id;

  perform set_config('app.allow_ledger_mutation', 'on', true);

  if v_statement.settlement_amount_cents = 0 then
    update public.ledger_entries
    set status = 'settled'
    where id in (
      select ledger_entry_id
      from public.statement_items
      where statement_id = p_statement_id
    );
  else
    insert into public.settlements (
      statement_id,
      payer_company_id,
      receiver_company_id,
      amount_cents,
      due_on
    )
    values (
      p_statement_id,
      v_statement.payer_company_id,
      v_statement.receiver_company_id,
      v_statement.settlement_amount_cents,
      v_statement.due_on
    );
  end if;
end;
$$;

create or replace function public.submit_settlement_payment(
  p_settlement_id uuid,
  p_payment_date date,
  p_payment_reference text,
  p_proof_document_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_settlement public.settlements%rowtype;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  select *
  into v_settlement
  from public.settlements
  where id = p_settlement_id
  for update;

  if not found then
    raise exception 'Settlement not found';
  end if;

  if v_actor.company_id <> v_settlement.payer_company_id then
    raise exception 'Only the payer can submit payment';
  end if;

  if v_settlement.status <> 'awaiting_payment' then
    raise exception 'Settlement is not awaiting payment';
  end if;

  update public.settlements
  set status = 'payment_submitted',
      payment_date = p_payment_date,
      payment_reference = trim(p_payment_reference),
      proof_document_id = p_proof_document_id,
      submitted_by = v_actor.profile_id,
      submitted_at = now()
  where id = p_settlement_id;

  perform set_config('app.allow_statement_mutation', 'on', true);

  update public.monthly_statements
  set status = 'payment_submitted'
  where id = v_settlement.statement_id;

  perform public.notify_company_admins(
    v_settlement.receiver_company_id,
    'payment_submitted',
    'Settlement payment submitted',
    'The statement payer has submitted settlement payment details.',
    'settlements',
    p_settlement_id
  );
end;
$$;

create or replace function public.confirm_settlement_receipt(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_settlement public.settlements%rowtype;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  select *
  into v_settlement
  from public.settlements
  where id = p_settlement_id
  for update;

  if not found then
    raise exception 'Settlement not found';
  end if;

  if v_actor.company_id <> v_settlement.receiver_company_id then
    raise exception 'Only the receiver can confirm settlement receipt';
  end if;

  if v_settlement.status <> 'payment_submitted' then
    raise exception 'Settlement payment has not been submitted';
  end if;

  update public.settlements
  set status = 'settled',
      confirmed_by = v_actor.profile_id,
      confirmed_at = now()
  where id = p_settlement_id;

  perform set_config('app.allow_statement_mutation', 'on', true);

  update public.monthly_statements
  set status = 'settled',
      settled_at = now()
  where id = v_settlement.statement_id;

  perform set_config('app.allow_ledger_mutation', 'on', true);

  update public.ledger_entries
  set status = 'settled'
  where id in (
    select ledger_entry_id
    from public.statement_items
    where statement_id = v_settlement.statement_id
  );
end;
$$;

create trigger referrals_audit
after insert or update or delete on public.referrals
for each row execute function public.audit_row_change();

create trigger deals_audit
after insert or update or delete on public.deals
for each row execute function public.audit_row_change();

create trigger commission_agreements_audit
after insert or update or delete on public.commission_agreements
for each row execute function public.audit_row_change();

create trigger source_invoices_audit
after insert or update or delete on public.source_invoices
for each row execute function public.audit_row_change();

create trigger invoice_payments_audit
after insert or update or delete on public.invoice_payments
for each row execute function public.audit_row_change();

create trigger commission_entitlements_audit
after insert or update or delete on public.commission_entitlements
for each row execute function public.audit_row_change();

create trigger approvals_audit
after insert or update or delete on public.approvals
for each row execute function public.audit_row_change();

create trigger documents_audit
after insert or update or delete on public.documents
for each row execute function public.audit_row_change();

create trigger ledger_entries_audit
after insert or update or delete on public.ledger_entries
for each row execute function public.audit_row_change();

create trigger commission_releases_audit
after insert or update or delete on public.commission_releases
for each row execute function public.audit_row_change();

create trigger disputes_audit
after insert or update or delete on public.disputes
for each row execute function public.audit_row_change();

create trigger dispute_messages_audit
after insert or update or delete on public.dispute_messages
for each row execute function public.audit_row_change();

create trigger monthly_statements_audit
after insert or update or delete on public.monthly_statements
for each row execute function public.audit_row_change();

create trigger statement_items_audit
after insert or update or delete on public.statement_items
for each row execute function public.audit_row_change();

create trigger settlements_audit
after insert or update or delete on public.settlements
for each row execute function public.audit_row_change();

grant execute on function public.require_portal_admin() to authenticated;
grant execute on function public.company_id_by_slug(public.company_slug) to authenticated;
grant execute on function public.record_invoice_payment(uuid, bigint, date, text) to authenticated;
grant execute on function public.submit_referral(text, text, text, text) to authenticated;
grant execute on function public.decide_referral(uuid, public.approval_decision, text) to authenticated;
grant execute on function public.propose_variable_commission(uuid, uuid, uuid, public.commission_kind, bigint, integer, text) to authenticated;
grant execute on function public.decide_commission_agreement(uuid, public.approval_decision, text) to authenticated;
grant execute on function public.propose_manual_ledger_entry(public.ledger_entry_type, uuid, uuid, bigint, date, date, text, uuid) to authenticated;
grant execute on function public.decide_manual_ledger_entry(uuid, public.approval_decision, text) to authenticated;
grant execute on function public.open_ledger_dispute(uuid, text) to authenticated;
grant execute on function public.propose_monthly_statement(date, date, date) to authenticated;
grant execute on function public.decide_monthly_statement(uuid, public.approval_decision, text) to authenticated;
grant execute on function public.submit_settlement_payment(uuid, date, text, uuid) to authenticated;
grant execute on function public.confirm_settlement_receipt(uuid) to authenticated;
