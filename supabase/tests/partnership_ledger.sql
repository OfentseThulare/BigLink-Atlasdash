\set ON_ERROR_STOP on

do $$
declare
  v_atlas_company_id uuid := '00000000-0000-4000-8000-000000000001';
  v_big_link_company_id uuid := '00000000-0000-4000-8000-000000000002';
  v_atlas_auth_id uuid := '10000000-0000-4000-8000-000000000001';
  v_big_link_auth_id uuid := '10000000-0000-4000-8000-000000000002';
  v_atlas_profile_id uuid := '20000000-0000-4000-8000-000000000001';
  v_big_link_profile_id uuid := '20000000-0000-4000-8000-000000000002';
  v_referral_id uuid;
  v_invoice_id uuid;
  v_entitlement_id uuid;
  v_first_ledger_id uuid;
  v_dispute_id uuid;
  v_statement_id uuid;
  v_settlement_id uuid;
  v_proof_document_id uuid;
  v_count integer;
  v_amount bigint;
begin
  insert into auth.users (id)
  values (v_atlas_auth_id), (v_big_link_auth_id)
  on conflict do nothing;

  insert into public.profiles (id, auth_user_id, full_name, email, status)
  values
    (v_atlas_profile_id, v_atlas_auth_id, 'Atlas Admin', 'atlas.admin@example.com', 'active'),
    (v_big_link_profile_id, v_big_link_auth_id, 'Big Link Admin', 'big.admin@example.com', 'active')
  on conflict (id) do update
  set status = excluded.status;

  insert into public.company_memberships (profile_id, company_id, status, activated_at)
  values
    (v_atlas_profile_id, v_atlas_company_id, 'active', now()),
    (v_big_link_profile_id, v_big_link_company_id, 'active', now())
  on conflict (profile_id) do update
  set company_id = excluded.company_id,
      status = excluded.status,
      activated_at = excluded.activated_at;

  perform set_config('request.jwt.claim.sub', v_big_link_auth_id::text, false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);

  v_referral_id := public.submit_referral(
    'Example Customer',
    'finance@example.com',
    null,
    'Introduced through Big Link leadership'
  );

  perform set_config('request.jwt.claim.sub', v_atlas_auth_id::text, false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);

  perform public.decide_referral(v_referral_id, 'approved', 'Accepted');

  insert into public.source_invoices (
    source_system,
    source_id,
    invoice_number,
    kind,
    issuer_company_id,
    bill_to_name,
    referral_id,
    issue_date,
    due_date,
    subtotal_cents,
    vat_cents,
    total_including_vat_cents,
    status,
    created_by
  )
  values (
    'atlas_dash',
    'atlas-invoice-001',
    'AT-001',
    'referral_commission_source',
    v_atlas_company_id,
    'Example Customer',
    v_referral_id,
    '2026-07-10',
    '2026-07-30',
    100000,
    15000,
    115000,
    'issued',
    v_atlas_profile_id
  )
  returning id into v_invoice_id;

  select id
  into v_entitlement_id
  from public.commission_entitlements
  where source_invoice_id = v_invoice_id;

  if v_entitlement_id is null then
    raise exception 'Expected referral invoice to create commission entitlement';
  end if;

  select total_entitlement_cents
  into v_amount
  from public.commission_entitlements
  where id = v_entitlement_id;

  if v_amount <> 11500 then
    raise exception 'Expected 10 percent of VAT-inclusive invoice to be 11500 cents, got %', v_amount;
  end if;

  perform public.record_invoice_payment(v_invoice_id, 57500, '2026-07-15', 'PAY-1');

  select released_cents
  into v_amount
  from public.commission_entitlements
  where id = v_entitlement_id;

  if v_amount <> 5750 then
    raise exception 'Expected first partial payment to release 5750 cents, got %', v_amount;
  end if;

  perform public.record_invoice_payment(v_invoice_id, 57500, '2026-07-20', 'PAY-2');

  select released_cents
  into v_amount
  from public.commission_entitlements
  where id = v_entitlement_id;

  if v_amount <> 11500 then
    raise exception 'Expected full payment to release 11500 cents, got %', v_amount;
  end if;

  select coalesce(sum(amount_cents), 0)
  into v_amount
  from public.ledger_entries
  where commission_entitlement_id = v_entitlement_id
    and status = 'payable';

  if v_amount <> 11500 then
    raise exception 'Expected payable commission ledger total of 11500 cents, got %', v_amount;
  end if;

  select id
  into v_first_ledger_id
  from public.ledger_entries
  where commission_entitlement_id = v_entitlement_id
  order by occurred_on, created_at
  limit 1;

  perform set_config('request.jwt.claim.sub', v_big_link_auth_id::text, false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);

  v_dispute_id := public.open_ledger_dispute(
    v_first_ledger_id,
    'The first released commission needs supporting invoice allocation reviewed.'
  );

  if v_dispute_id is null then
    raise exception 'Expected dispute to be created';
  end if;

  select count(*)
  into v_count
  from public.ledger_entries
  where status = 'payable'
    and commission_entitlement_id = v_entitlement_id;

  if v_count <> 1 then
    raise exception 'Expected one undisputed payable commission ledger item, got %', v_count;
  end if;

  v_statement_id := public.propose_monthly_statement('2026-07-01', '2026-07-31', '2026-08-07');

  perform set_config('request.jwt.claim.sub', v_atlas_auth_id::text, false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);

  perform public.decide_monthly_statement(v_statement_id, 'approved', 'Approved');

  select settlement_amount_cents
  into v_amount
  from public.monthly_statements
  where id = v_statement_id;

  if v_amount <> 5750 then
    raise exception 'Expected statement to net only undisputed payable amount of 5750 cents, got %', v_amount;
  end if;

  select id
  into v_settlement_id
  from public.settlements
  where statement_id = v_statement_id;

  if v_settlement_id is null then
    raise exception 'Expected locked statement to create settlement';
  end if;

  insert into public.documents (
    subject_type,
    subject_id,
    kind,
    storage_path,
    original_filename,
    content_type,
    size_bytes,
    sha256,
    uploaded_by
  )
  values (
    'settlements',
    v_settlement_id,
    'settlement_proof',
    'settlements/test-proof.pdf',
    'test-proof.pdf',
    'application/pdf',
    2048,
    repeat('a', 64),
    v_atlas_profile_id
  )
  returning id into v_proof_document_id;

  perform public.submit_settlement_payment(
    v_settlement_id,
    '2026-08-05',
    'EFT-REF-001',
    v_proof_document_id
  );

  perform set_config('request.jwt.claim.sub', v_big_link_auth_id::text, false);
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', false);

  perform public.confirm_settlement_receipt(v_settlement_id);

  select count(*)
  into v_count
  from public.ledger_entries le
  join public.statement_items si on si.ledger_entry_id = le.id
  where si.statement_id = v_statement_id
    and le.status = 'settled';

  if v_count <> 1 then
    raise exception 'Expected one statement ledger item to settle, got %', v_count;
  end if;

  select count(*)
  into v_count
  from public.ledger_entries
  where id = v_first_ledger_id
    and status = 'disputed';

  if v_count <> 1 then
    raise exception 'Expected disputed item to remain disputed after settlement';
  end if;
end;
$$;
