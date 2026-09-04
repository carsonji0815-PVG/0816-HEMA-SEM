-- Prevent stale browser tabs from replacing newer meeting settings.

alter table public.meetings
  add column if not exists settings_version bigint not null default 0,
  add column if not exists settings_updated_at timestamptz,
  add column if not exists settings_updated_by uuid references auth.users(id) on delete set null;

create or replace function public.update_meeting_settings(
  p_meeting_id uuid,
  p_expected_version bigint,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_before public.meetings%rowtype;
  v_after public.meetings%rowtype;
  v_field_config jsonb;
  v_actor text;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  if not public.is_system_admin() and public.meeting_role(p_meeting_id) <> 'ops' then
    raise exception '无权修改会议设置';
  end if;
  if jsonb_typeof(coalesce(p_patch,'{}'::jsonb)) <> 'object' then
    raise exception '会议设置数据格式不正确';
  end if;

  select * into v_before from public.meetings where id=p_meeting_id for update;
  if v_before.id is null then raise exception '会议项目不存在'; end if;
  if v_before.settings_version <> coalesce(p_expected_version,-1) then
    raise exception using
      errcode='40001',
      message='会议设置已被其他页面或账号更新，请刷新后重试';
  end if;

  v_field_config := coalesce(v_before.field_config,'{}'::jsonb)
    || coalesce(p_patch->'field_config','{}'::jsonb);

  update public.meetings set
    name=case when p_patch ? 'name' then nullif(trim(p_patch->>'name'),'') else name end,
    client_name=case when p_patch ? 'client_name' then nullif(trim(p_patch->>'client_name'),'') else client_name end,
    start_date=case when p_patch ? 'start_date' then nullif(p_patch->>'start_date','')::date else start_date end,
    end_date=case when p_patch ? 'end_date' then nullif(p_patch->>'end_date','')::date else end_date end,
    deadline=case when p_patch ? 'deadline' then nullif(p_patch->>'deadline','')::timestamptz else deadline end,
    capacity=case when p_patch ? 'capacity' then greatest(0,(p_patch->>'capacity')::integer) else capacity end,
    service_phone=case when p_patch ? 'service_phone' then nullif(trim(p_patch->>'service_phone'),'') else service_phone end,
    venues=case when p_patch ? 'venues' then array(select jsonb_array_elements_text(p_patch->'venues')) else venues end,
    allowed_departure_cities=case when p_patch ? 'allowed_departure_cities' then array(select jsonb_array_elements_text(p_patch->'allowed_departure_cities')) else allowed_departure_cities end,
    check_city_mismatch=case when p_patch ? 'check_city_mismatch' then (p_patch->>'check_city_mismatch')::boolean else check_city_mismatch end,
    flight_lead_minutes=case when p_patch ? 'flight_lead_minutes' then (p_patch->>'flight_lead_minutes')::integer else flight_lead_minutes end,
    train_lead_minutes=case when p_patch ? 'train_lead_minutes' then (p_patch->>'train_lead_minutes')::integer else train_lead_minutes end,
    transport_group_minutes=case when p_patch ? 'transport_group_minutes' then (p_patch->>'transport_group_minutes')::integer else transport_group_minutes end,
    transfer_collection_enabled=case when p_patch ? 'transfer_collection_enabled' then (p_patch->>'transfer_collection_enabled')::boolean else transfer_collection_enabled end,
    transfer_collection_roles=case when p_patch ? 'transfer_collection_roles' then array(select jsonb_array_elements_text(p_patch->'transfer_collection_roles')) else transfer_collection_roles end,
    field_config=v_field_config,
    settings_version=v_before.settings_version+1,
    settings_updated_at=now(),
    settings_updated_by=auth.uid()
  where id=p_meeting_id
  returning * into v_after;

  select coalesce(display_name,'管理员') into v_actor
  from public.profiles where user_id=auth.uid();

  insert into public.operation_audit_logs(
    meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data,metadata
  ) values(
    p_meeting_id,auth.uid(),coalesce(v_actor,'管理员'),'meeting_settings_updated','meeting',p_meeting_id::text,
    to_jsonb(v_before)-'registration_template',to_jsonb(v_after)-'registration_template',
    jsonb_build_object('previousVersion',v_before.settings_version,'version',v_after.settings_version,'changedKeys',(select jsonb_agg(key) from jsonb_object_keys(p_patch) key))
  );

  return jsonb_build_object(
    'settingsVersion',v_after.settings_version,
    'settingsUpdatedAt',v_after.settings_updated_at
  );
end;
$$;

revoke all on function public.update_meeting_settings(uuid,bigint,jsonb) from public;
grant execute on function public.update_meeting_settings(uuid,bigint,jsonb) to authenticated;

-- Project metadata edits also advance the same version, so an older settings
-- form cannot put the previous meeting name/type back afterwards.
create or replace function public.update_meeting_project(
  p_id uuid,
  p_name text,
  p_slug text,
  p_activity_type text,
  p_identifier text,
  p_activity_owner text,
  p_activity_date date
) returns void
language plpgsql security definer set search_path=public
as $$
declare
  v_before public.meetings%rowtype;
  v_after public.meetings%rowtype;
  v_actor text;
begin
  if not public.can_manage_project(p_id) then raise exception '无权编辑该项目'; end if;
  if p_activity_type not in ('internal','external') or nullif(trim(p_name),'') is null
     or nullif(trim(p_slug),'') is null or nullif(trim(p_identifier),'') is null
     or nullif(trim(p_activity_owner),'') is null or p_activity_date is null then
    raise exception '请完整填写项目基本资料';
  end if;
  select * into v_before from public.meetings where id=p_id for update;
  update public.meetings set
    name=trim(p_name),slug=lower(trim(p_slug)),activity_type=p_activity_type,
    project_identifier=trim(p_identifier),activity_owner=trim(p_activity_owner),
    activity_date=p_activity_date,start_date=coalesce(start_date,p_activity_date),
    end_date=coalesce(end_date,p_activity_date),settings_version=settings_version+1,
    settings_updated_at=now(),settings_updated_by=auth.uid()
  where id=p_id returning * into v_after;
  select coalesce(display_name,'管理员') into v_actor from public.profiles where user_id=auth.uid();
  insert into public.operation_audit_logs(
    meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data,metadata
  ) values(
    p_id,auth.uid(),coalesce(v_actor,'管理员'),'meeting_project_updated','meeting',p_id::text,
    to_jsonb(v_before)-'registration_template',to_jsonb(v_after)-'registration_template',
    jsonb_build_object('previousVersion',v_before.settings_version,'version',v_after.settings_version)
  );
end;
$$;

grant execute on function public.update_meeting_project(uuid,text,text,text,text,text,date) to authenticated;
