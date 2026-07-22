create or replace function public.record_atlas_dash_payment(
  p_invoice_source_id text,
  p_amount_cents bigint,
  p_paid_on date,
  p_reference text default null
)
returns table (
  payment_id uuid,
  released_ledger_entry_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.source_invoices%rowtype;
  v_declared_by uuid;
  v_total_paid_cents bigint;
  v_payment_id uuid;
  v_released_ledger_entry_id uuid;
begin
  if p_invoice_source_id is null or btrim(p_invoice_source_id) = '' then
    raise exception 'Invoice source id is required for payment recording';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  if p_paid_on is null then
    raise exception 'Payment date is required';
  end if;

  select *
  into v_invoice
  from public.source_invoices
  where source_system = 'atlas_dash'
    and source_id = p_invoice_source_id
  for update;

  if not found then
    raise exception 'Atlas invoice was not found for source id %', p_invoice_source_id;
  end if;

  select m.profile_id
  into v_declared_by
  from public.company_memberships m
  join public.profiles p on p.id = m.profile_id
  where m.company_id = v_invoice.issuer_company_id
    and m.status = 'active'
    and p.status = 'active'
  order by m.activated_at desc nulls last, m.created_at desc
  limit 1;

  if v_declared_by is null then
    raise exception 'No active profile found for invoice issuer to declare payment';
  end if;

  select coalesce(sum(amount_cents), 0) + p_amount_cents
  into v_total_paid_cents
  from public.invoice_payments
  where invoice_id = v_invoice.id
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
    v_invoice.id,
    p_amount_cents,
    p_paid_on,
    nullif(trim(p_reference), ''),
    v_declared_by
  )
  returning id into v_payment_id;

  update public.source_invoices
  set status = case
    when v_total_paid_cents >= total_including_vat_cents then 'paid'::public.source_invoice_status
    else 'partially_paid'::public.source_invoice_status
  end
  where id = v_invoice.id;

  v_released_ledger_entry_id := public.release_commission_for_payment(v_payment_id);

  payment_id := v_payment_id;
  released_ledger_entry_id := v_released_ledger_entry_id;
  return next;
end;
$$;

grant execute on function public.record_atlas_dash_payment(text, bigint, date, text) to service_role;
