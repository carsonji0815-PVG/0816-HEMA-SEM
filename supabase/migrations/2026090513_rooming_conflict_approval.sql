-- Route every requested-room/default-rule mismatch to lodging approval.
-- This trigger intentionally runs after attendees_apply_approval_rules.
create or replace function public.apply_rooming_conflict_approval()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_meeting public.meetings%rowtype;
  v_rules jsonb;
  v_room jsonb;
  v_requested text;
  v_suggested text;
  v_status text;
  v_single_title boolean := false;
  v_twin_keyword boolean := false;
  v_conflict boolean := false;
begin
  select * into v_meeting from public.meetings where id=new.meeting_id;
  v_room := coalesce(new.custom_fields->'_rooming','{}'::jsonb);

  if coalesce(v_meeting.activity_type,'external')='internal' then
    if new.custom_fields ? '_rooming' then
      new.custom_fields := jsonb_set(new.custom_fields,'{_rooming,approvalStatus}','"normal"'::jsonb,true);
    end if;
    return new;
  end if;

  v_rules := coalesce(v_meeting.field_config->'roomingRules','{}'::jsonb);
  v_requested := coalesce(nullif(new.custom_fields->>'roomType',''),nullif(v_room->>'requestedType',''),'');
  if v_requested in ('标间拼住','拼住','shared') then v_requested := 'shared';
  elsif v_requested in ('标间单住','标间独住','twin_single') then v_requested := 'twin_single';
  elsif v_requested in ('单间','single') then v_requested := 'single';
  elsif v_requested in ('无需住宿','不住宿','none') then v_requested := 'none';
  end if;

  select exists(
    select 1 from jsonb_array_elements_text(coalesce(v_rules->'singleTitles','["主任医师","副主任医师"]'::jsonb)) as item(value)
    where nullif(item.value,'') is not null and position(item.value in coalesce(new.title,''))>0
  ) into v_single_title;
  select exists(
    select 1 from jsonb_array_elements_text(coalesce(v_rules->'twinSingleKeywords','["标间单住","标间独住"]'::jsonb)) as item(value)
    where nullif(item.value,'') is not null and position(item.value in coalesce(new.remarks,''))>0
  ) into v_twin_keyword;

  if v_single_title and v_twin_keyword then v_suggested := 'twin_single';
  elsif v_single_title then v_suggested := 'single';
  else v_suggested := coalesce(nullif(v_rules->>'defaultType',''),'shared');
  end if;
  if v_suggested not in ('single','shared','twin_single') then v_suggested := 'shared'; end if;

  v_conflict := coalesce((v_rules->>'conflictApproval')::boolean,true)
    and v_requested in ('single','shared','twin_single')
    and v_requested<>v_suggested;
  v_status := coalesce(v_room->>'approvalStatus','normal');
  -- The earlier travel-approval trigger may normalize the room status while
  -- this same update is carrying an explicit lodging decision. Recover that
  -- decision from the newly changed assignment source before finalizing.
  if tg_op='UPDATE' and coalesce(new.custom_fields->'_rooming'->>'assignmentSource','') is distinct from coalesce(old.custom_fields->'_rooming'->>'assignmentSource','') then
    if new.custom_fields->'_rooming'->>'assignmentSource'='approval' then v_status := 'approved';
    elsif new.custom_fields->'_rooming'->>'assignmentSource'='approval_rejected' then v_status := 'rejected';
    end if;
  end if;
  if v_conflict then
    if v_status not in ('approved','rejected') then v_status := 'pending'; end if;
  else
    v_status := 'normal';
  end if;

  v_room := jsonb_set(v_room,'{requestedType}',to_jsonb(v_requested),true);
  v_room := jsonb_set(v_room,'{suggestedType}',to_jsonb(v_suggested),true);
  v_room := jsonb_set(v_room,'{approvalStatus}',to_jsonb(v_status),true);
  new.custom_fields := jsonb_set(coalesce(new.custom_fields,'{}'::jsonb),'{_rooming}',v_room,true);

  new.approval := case
    when new.outbound_approval_status in ('pending','rejected') or new.return_approval_status in ('pending','rejected') or (v_conflict and v_status in ('pending','rejected')) then 'pending'
    when new.outbound_approval_status='approved' or new.return_approval_status='approved' or (v_conflict and v_status='approved') then 'approved'
    else 'normal'
  end;
  return new;
end;
$$;

drop trigger if exists zz_attendees_apply_rooming_conflict on public.attendees;
create trigger zz_attendees_apply_rooming_conflict
before insert or update of title,remarks,custom_fields
on public.attendees
for each row execute function public.apply_rooming_conflict_approval();

create or replace function public.refresh_rooming_approvals_after_rule_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if coalesce(old.field_config->'roomingRules','{}'::jsonb) is distinct from coalesce(new.field_config->'roomingRules','{}'::jsonb) then
    update public.attendees
    set custom_fields=jsonb_set(coalesce(custom_fields,'{}'::jsonb),'{_rooming,approvalStatus}','"normal"'::jsonb,true)
    where meeting_id=new.id and coalesce(business_status,'active')='active';
  end if;
  return new;
end;
$$;

drop trigger if exists meetings_refresh_rooming_approvals on public.meetings;
create trigger meetings_refresh_rooming_approvals
after update of field_config on public.meetings
for each row execute function public.refresh_rooming_approvals_after_rule_change();

-- Re-evaluate existing rows immediately using each meeting's current settings.
update public.attendees
set custom_fields=coalesce(custom_fields,'{}'::jsonb)
where coalesce(business_status,'active')='active';

notify pgrst, 'reload schema';
