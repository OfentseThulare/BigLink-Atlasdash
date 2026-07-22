create or replace function public.record_partner_invoice(
  p_invoice_number text,
  p_issue_date date,
  p_due_date date,
  p_line_description text,
  p_subtotal_cents bigint,
  p_vat_cents bigint default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_big_link_company_id uuid;
  v_atlas_company_id uuid;
  v_atlas_bill_to_name text;
  v_total_including_vat_cents bigint;
  v_invoice_id uuid;
  v_invoice_number text;
  v_line_description text;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  v_invoice_number := btrim(p_invoice_number);
  v_line_description := btrim(p_line_description);

  if v_actor.company_id is null then
    raise exception 'No active administrator company membership found';
  end if;

  if v_invoice_number is null or char_length(v_invoice_number) < 1 or char_length(v_invoice_number) > 80 then
    raise exception 'Invoice reference is required and must be 1 to 80 characters';
  end if;

  if v_line_description is null or char_length(v_line_description) < 2 or char_length(v_line_description) > 500 then
    raise exception 'Line description is required and must be 2 to 500 characters';
  end if;

  if p_issue_date is null then
    raise exception 'Issue date is required';
  end if;

  if p_due_date < p_issue_date then
    raise exception 'Due date must be on or after issue date';
  end if;

  v_big_link_company_id := public.company_id_by_slug('big_link');
  if v_actor.company_id <> v_big_link_company_id then
    raise exception 'Only Big Link administrators can record partner invoices';
  end if;

  if p_subtotal_cents is null or p_subtotal_cents <= 0 then
    raise exception 'Subtotal amount must be greater than zero';
  end if;

  if p_vat_cents is null then
    p_vat_cents := 0;
  end if;

  if p_vat_cents < 0 then
    raise exception 'VAT amount cannot be negative';
  end if;

  v_total_including_vat_cents := p_subtotal_cents + p_vat_cents;

  if v_total_including_vat_cents <= 0 then
    raise exception 'Invoice total must be greater than zero';
  end if;

  v_atlas_company_id := public.company_id_by_slug('atlas');

  select coalesce(c.display_name, c.legal_name)
  into v_atlas_bill_to_name
  from public.companies c
  where c.id = v_atlas_company_id;

  if v_atlas_bill_to_name is null then
    raise exception 'Atlas company record was not found';
  end if;

  insert into public.source_invoices (
    source_system,
    source_id,
    invoice_number,
    kind,
    issuer_company_id,
    bill_to_company_id,
    bill_to_name,
    issue_date,
    due_date,
    subtotal_cents,
    vat_cents,
    total_including_vat_cents,
    status,
    created_by,
    raw_source
  )
  values (
    'portal'::public.invoice_source_system,
    v_invoice_number,
    v_invoice_number,
    'direct_service_obligation'::public.invoice_kind,
    v_actor.company_id,
    v_atlas_company_id,
    v_atlas_bill_to_name,
    p_issue_date,
    p_due_date,
    p_subtotal_cents,
    p_vat_cents,
    v_total_including_vat_cents,
    'issued'::public.source_invoice_status,
    v_actor.profile_id,
    jsonb_build_object(
      'created_by_company_id', v_actor.company_id,
      'source', 'portal_form',
      'line_description', v_line_description
    )
  )
  returning id into v_invoice_id;

  insert into public.source_invoice_items (
    invoice_id,
    position,
    description,
    quantity,
    unit_price_cents,
    line_total_cents
  )
  values (
    v_invoice_id,
    0,
    v_line_description,
    1,
    p_subtotal_cents,
    v_total_including_vat_cents
  );

  perform public.process_source_invoice(v_invoice_id);
  return v_invoice_id;
end;
$$;

grant execute on function public.record_partner_invoice(text, date, date, text, bigint, bigint) to authenticated;
