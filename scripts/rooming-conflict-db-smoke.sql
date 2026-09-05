alter table public.meetings disable trigger meetings_guard_management_staff;

do $$
declare
  v_meeting_id uuid;
  v_attendee_id uuid;
  v_status text;
begin
  select a.meeting_id,a.id into v_meeting_id,v_attendee_id
  from public.attendees a
  join public.meetings m on m.id=a.meeting_id
  where coalesce(m.activity_type,'external')='external'
  order by a.created_at
  limit 1;
  if v_attendee_id is null then raise exception 'No external attendee available for rooming conflict smoke'; end if;

  update public.meetings
  set field_config=jsonb_set(coalesce(field_config,'{}'::jsonb),'{roomingRules}',
    '{"singleTitles":[],"twinSingleKeywords":[],"defaultType":"shared","conflictApproval":true}'::jsonb,true)
  where id=v_meeting_id;
  update public.attendees
  set title='测试职称',remarks='',custom_fields=jsonb_set(jsonb_set(coalesce(custom_fields,'{}'::jsonb),'{roomType}','"single"'::jsonb,true),'{_rooming,approvalStatus}','"normal"'::jsonb,true)
  where id=v_attendee_id;
  select custom_fields->'_rooming'->>'approvalStatus' into v_status from public.attendees where id=v_attendee_id;
  if v_status<>'pending' then raise exception 'Expected pending rooming conflict, got %',v_status; end if;

  update public.attendees
  set custom_fields=jsonb_set(jsonb_set(custom_fields,'{_rooming,assignmentSource}','"approval"'::jsonb,true),'{_rooming,approvalStatus}','"approved"'::jsonb,true)
  where id=v_attendee_id;
  select custom_fields->'_rooming'->>'approvalStatus' into v_status from public.attendees where id=v_attendee_id;
  if v_status<>'approved' then raise exception 'Expected approved rooming decision, got %',v_status; end if;
end;
$$;

alter table public.meetings enable trigger meetings_guard_management_staff;
