create or replace function public.record_ledger_receipt(
  p_entry_id uuid,
  p_paid_on date,
  p_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_entry public.ledger_entries%rowtype;
  v_before_data jsonb;
  v_after_entry public.ledger_entries%rowtype;
  v_reference text;
  v_metadata jsonb;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  if p_entry_id is null then
    raise exception 'Ledger entry id is required';
  end if;

  if p_paid_on is null then
    raise exception 'Receipt paid-on date is required';
  end if;

  v_reference := nullif(trim(p_reference), '');

  if v_reference is not null and char_length(v_reference) > 120 then
    raise exception 'Reference is too long';
  end if;

  select *
  into v_entry
  from public.ledger_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'Ledger entry not found';
  end if;

  if v_entry.status not in ('payable', 'included_in_statement') then
    raise exception 'Only payable or included-in-statement ledger entries can be recorded as received';
  end if;

  if v_actor.company_id <> v_entry.creditor_company_id then
    raise exception 'Only the creditor can record receipt';
  end if;

  v_before_data := to_jsonb(v_entry);
  v_metadata := coalesce(v_entry.metadata, '{}'::jsonb);

  if v_entry.metadata ? 'settlement_proposal' then
    v_metadata := (v_metadata || jsonb_build_object(
      'settlement_decision', jsonb_build_object(
        'decision', 'approved',
        'decided_by_company_id', v_actor.company_id,
        'decided_by_profile_id', v_actor.profile_id,
        'decided_at', now(),
        'paid_on', p_paid_on,
        'reference', coalesce(v_reference, v_entry.metadata -> 'settlement_proposal' ->> 'reference')
      )
    )) - 'settlement_proposal';
  end if;

  perform set_config('app.allow_ledger_mutation', 'on', true);

  update public.ledger_entries
  set status = 'settled',
    metadata = v_metadata
  where id = p_entry_id
  returning * into v_after_entry;

  perform public.write_audit_event(
    'record_ledger_receipt',
    'ledger_entries',
    p_entry_id,
    v_before_data,
    to_jsonb(v_after_entry)
  );
end;
$$;

grant execute on function public.record_ledger_receipt(uuid, date, text) to authenticated;
