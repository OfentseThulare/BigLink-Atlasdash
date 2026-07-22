create type public.dispute_resolution_outcome as enum (
  'restore_payable',
  'close_with_adjustment'
);

create or replace function public.propose_ledger_settlement(
  p_entry_id uuid,
  p_paid_on date,
  p_reference text
)
returns uuid
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
begin
  select *
  into v_actor
  from public.require_portal_admin();

  if p_entry_id is null then
    raise exception 'Ledger entry id is required';
  end if;

  if p_paid_on is null then
    raise exception 'Settlement paid-on date is required';
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

  if v_entry.status <> 'payable' then
    raise exception 'Only payable ledger entries can be proposed for settlement';
  end if;

  if v_actor.company_id <> v_entry.debtor_company_id then
    raise exception 'Only the debtor can propose settlement';
  end if;

  if v_entry.metadata ? 'settlement_proposal' then
    raise exception 'A settlement proposal already exists for this ledger entry';
  end if;

  v_before_data := to_jsonb(v_entry);

  perform set_config('app.allow_ledger_mutation', 'on', true);

  update public.ledger_entries
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'settlement_proposal', jsonb_build_object(
      'proposed_by_company_id', v_actor.company_id,
      'proposed_by_profile_id', v_actor.profile_id,
      'proposed_at', now(),
      'paid_on', p_paid_on,
      'reference', v_reference
    )
  )
  where id = p_entry_id
  returning * into v_after_entry;

  perform public.write_audit_event(
    'propose_ledger_settlement',
    'ledger_entries',
    p_entry_id,
    v_before_data,
    to_jsonb(v_after_entry)
  );

  return v_after_entry.id;
end;
$$;

create or replace function public.decide_ledger_settlement(
  p_entry_id uuid,
  p_approved boolean,
  p_comment text
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
  v_comment text;
  v_new_status public.ledger_status;
  v_decision text;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  if p_entry_id is null then
    raise exception 'Ledger entry id is required';
  end if;

  if p_approved is null then
    raise exception 'Approval decision is required';
  end if;

  v_comment := nullif(trim(p_comment), '');

  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception 'Comment is too long';
  end if;

  select *
  into v_entry
  from public.ledger_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'Ledger entry not found';
  end if;

  if v_entry.status <> 'payable' then
    raise exception 'Only payable ledger entries can be decided';
  end if;

  if v_actor.company_id <> v_entry.creditor_company_id then
    raise exception 'Only the creditor can confirm settlement';
  end if;

  if not (v_entry.metadata ? 'settlement_proposal') then
    raise exception 'No pending settlement proposal for this ledger entry';
  end if;

  if v_entry.metadata -> 'settlement_proposal' ->> 'proposed_by_company_id' is null then
    raise exception 'Settlement proposal is invalid';
  end if;

  v_before_data := to_jsonb(v_entry);

  if p_approved then
    v_new_status := 'settled';
    v_decision := 'approved';
  else
    v_new_status := 'payable';
    v_decision := 'rejected';
  end if;

  perform set_config('app.allow_ledger_mutation', 'on', true);

  update public.ledger_entries
  set status = v_new_status,
    metadata = (
      coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'settlement_decision', jsonb_build_object(
          'decision', v_decision,
          'decided_by_company_id', v_actor.company_id,
          'decided_by_profile_id', v_actor.profile_id,
          'decided_at', now(),
          'comment', v_comment,
          'paid_on', v_entry.metadata -> 'settlement_proposal' ->> 'paid_on',
          'reference', v_entry.metadata -> 'settlement_proposal' ->> 'reference'
        )
      )
      - 'settlement_proposal'
    )
  where id = p_entry_id
  returning * into v_after_entry;

  perform public.write_audit_event(
    'decide_ledger_settlement',
    'ledger_entries',
    p_entry_id,
    v_before_data,
    to_jsonb(v_after_entry)
  );
end;
$$;

create or replace function public.resolve_dispute(
  p_dispute_id uuid,
  p_outcome text,
  p_comment text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_dispute public.disputes%rowtype;
  v_entry public.ledger_entries%rowtype;
  v_before_dispute jsonb;
  v_after_dispute public.disputes%rowtype;
  v_before_entry jsonb;
  v_after_entry public.ledger_entries%rowtype;
  v_adjustment public.ledger_entries%rowtype;
  v_outcome public.dispute_resolution_outcome;
  v_comment text;
  v_resolved_status public.dispute_status;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  if p_dispute_id is null then
    raise exception 'Dispute id is required';
  end if;

  v_comment := nullif(trim(p_comment), '');

  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception 'Comment is too long';
  end if;

  case lower(trim(p_outcome))
    when 'restore_payable' then
      v_outcome := 'restore_payable'::public.dispute_resolution_outcome;
    when 'restore' then
      v_outcome := 'restore_payable'::public.dispute_resolution_outcome;
    when 'close_with_adjustment' then
      v_outcome := 'close_with_adjustment'::public.dispute_resolution_outcome;
    when 'close' then
      v_outcome := 'close_with_adjustment'::public.dispute_resolution_outcome;
    when 'adjustment' then
      v_outcome := 'close_with_adjustment'::public.dispute_resolution_outcome;
    else
      raise exception 'Invalid dispute outcome';
  end case;

  select *
  into v_dispute
  from public.disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if v_dispute.status = 'resolved' then
    raise exception 'Dispute is already resolved';
  end if;

  select *
  into v_entry
  from public.ledger_entries
  where id = v_dispute.ledger_entry_id
  for update;

  if not found then
    raise exception 'Ledger entry for dispute not found';
  end if;

  if v_actor.company_id = v_dispute.opened_by_company_id then
    raise exception 'Only the non-opening company can resolve a dispute';
  end if;

  if v_actor.company_id not in (v_entry.debtor_company_id, v_entry.creditor_company_id) then
    raise exception 'Actor company must be party to the ledger entry';
  end if;

  if v_entry.status <> 'disputed' then
    raise exception 'Only disputed ledger entries can be resolved';
  end if;

  if v_outcome = 'close_with_adjustment' and v_actor.company_id = v_entry.debtor_company_id then
    raise exception 'Only the non-debtor party can resolve a dispute with adjustment';
  end if;

  v_before_dispute := to_jsonb(v_dispute);
  v_before_entry := to_jsonb(v_entry);
  v_resolved_status := 'resolved'::public.dispute_status;

  if v_outcome = 'restore_payable' then
    perform set_config('app.allow_ledger_mutation', 'on', true);

    update public.ledger_entries
    set status = 'payable',
      metadata = coalesce(metadata, '{}'::jsonb) - 'status_before_dispute',
      updated_at = now()
    where id = v_entry.id
    returning * into v_after_entry;
  else
    perform set_config('app.allow_ledger_mutation', 'on', true);

    update public.ledger_entries
    set status = 'voided_by_adjustment',
      metadata = coalesce(metadata, '{}'::jsonb) - 'status_before_dispute',
      updated_at = now()
    where id = v_entry.id
    returning * into v_after_entry;

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
      created_by,
      posted_at
    )
    values (
      'adjustment',
      v_entry.creditor_company_id,
      v_entry.debtor_company_id,
      v_entry.amount_cents,
      'settled',
      v_entry.occurred_on,
      v_entry.due_on,
      'Dispute adjustment for ' || v_dispute.id,
      v_entry.id,
      v_actor.profile_id,
      now()
    )
    returning * into v_adjustment;

    perform public.write_audit_event(
      'resolve_dispute_adjustment_created',
      'ledger_entries',
      v_adjustment.id,
      null,
      to_jsonb(v_adjustment)
    );
  end if;

  update public.disputes
  set status = v_resolved_status,
    proposed_resolution = coalesce(v_comment, case
      when v_outcome = 'restore_payable' then 'Dispute restored to original payable state.'
      else 'Dispute closed with offsetting adjustment.'
    end),
    resolution_adjustment_entry_id = v_adjustment.id,
    resolved_at = now(),
    updated_at = now()
  where id = p_dispute_id
  returning * into v_after_dispute;

  perform public.write_audit_event(
    'resolve_dispute',
    'disputes',
    p_dispute_id,
    v_before_dispute,
    to_jsonb(v_after_dispute)
  );

  perform public.write_audit_event(
    'resolve_dispute_ledger_update',
    'ledger_entries',
    v_entry.id,
    v_before_entry,
    to_jsonb(v_after_entry)
  );

  return v_adjustment.id;
end;
$$;

create or replace function public.update_record_notes(
  p_record_type text,
  p_record_id uuid,
  p_description text default null,
  p_reason text default null,
  p_reference text default null,
  p_proposed_resolution text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_record_type text;
  v_description text;
  v_reason text;
  v_reference text;
  v_proposed_resolution text;
  v_entry public.ledger_entries%rowtype;
  v_dispute public.disputes%rowtype;
  v_before_entry jsonb;
  v_after_entry public.ledger_entries%rowtype;
  v_before_dispute jsonb;
  v_after_dispute public.disputes%rowtype;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  v_record_type := lower(trim(p_record_type));

  if p_record_id is null then
    raise exception 'Record id is required';
  end if;

  v_description := nullif(trim(p_description), '');
  v_reason := nullif(trim(p_reason), '');
  v_reference := nullif(trim(p_reference), '');
  v_proposed_resolution := nullif(trim(p_proposed_resolution), '');

  case v_record_type
    when 'ledger_entry' then
      if v_description is null and v_reference is null then
        raise exception 'At least one narrative field is required for a ledger entry';
      end if;

      if v_description is not null and (char_length(v_description) < 2 or char_length(v_description) > 500) then
        raise exception 'Description must be between 2 and 500 characters';
      end if;

      if v_reference is not null and char_length(v_reference) > 120 then
        raise exception 'Reference is too long';
      end if;

      select *
      into v_entry
      from public.ledger_entries
      where id = p_record_id
      for update;

      if not found then
        raise exception 'Ledger entry not found';
      end if;

      if v_actor.company_id not in (v_entry.debtor_company_id, v_entry.creditor_company_id) then
        raise exception 'Actor company must be party to the ledger entry';
      end if;

      if
        (v_description is null or v_description = v_entry.description)
        and (v_reference is null or v_reference = v_entry.reference)
      then
        raise exception 'No note fields changed';
      end if;

      v_before_entry := to_jsonb(v_entry);

      perform set_config('app.allow_ledger_mutation', 'on', true);

      update public.ledger_entries
      set description = coalesce(v_description, v_entry.description),
        reference = coalesce(v_reference, v_entry.reference)
      where id = p_record_id
      returning * into v_after_entry;

      perform public.write_audit_event(
        'update_record_notes',
        'ledger_entries',
        p_record_id,
        v_before_entry,
        to_jsonb(v_after_entry)
      );
    when 'dispute' then
      if v_reason is null and v_proposed_resolution is null then
        raise exception 'At least one narrative field is required for a dispute';
      end if;

      if v_reason is not null and (char_length(v_reason) < 10 or char_length(v_reason) > 2000) then
        raise exception 'Reason must be between 10 and 2000 characters';
      end if;

      if v_proposed_resolution is not null and char_length(v_proposed_resolution) > 2000 then
        raise exception 'Proposed resolution is too long';
      end if;

      select *
      into v_dispute
      from public.disputes
      where id = p_record_id
      for update;

      if not found then
        raise exception 'Dispute not found';
      end if;

      select *
      into v_entry
      from public.ledger_entries
      where id = v_dispute.ledger_entry_id;

      if not found then
        raise exception 'Ledger entry for dispute not found';
      end if;

      if v_actor.company_id not in (v_entry.debtor_company_id, v_entry.creditor_company_id) then
        raise exception 'Actor company must be party to the dispute';
      end if;

      if
        (v_reason is null or v_reason = v_dispute.reason)
        and (v_proposed_resolution is null or v_proposed_resolution = v_dispute.proposed_resolution)
      then
        raise exception 'No note fields changed';
      end if;

      v_before_dispute := to_jsonb(v_dispute);

      update public.disputes
      set reason = coalesce(v_reason, v_dispute.reason),
        proposed_resolution = coalesce(v_proposed_resolution, v_dispute.proposed_resolution),
        updated_at = now()
      where id = p_record_id
      returning * into v_after_dispute;

      perform public.write_audit_event(
        'update_record_notes',
        'disputes',
        p_record_id,
        v_before_dispute,
        to_jsonb(v_after_dispute)
      );
    else
      raise exception 'Unknown record type';
  end case;
end;
$$;

grant execute on function public.propose_ledger_settlement(uuid, date, text) to authenticated;
grant execute on function public.decide_ledger_settlement(uuid, boolean, text) to authenticated;
grant execute on function public.resolve_dispute(uuid, text, text) to authenticated;
grant execute on function public.update_record_notes(text, uuid, text, text, text, text) to authenticated;
