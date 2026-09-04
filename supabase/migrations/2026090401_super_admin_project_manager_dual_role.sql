-- Keep the system-wide super administrator role while allowing the same
-- account to be explicitly assigned as an operations manager for a project.

create table if not exists public.meeting_staff_assignments (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  email text not null references public.system_staff_allowlist(email) on delete cascade,
  role public.app_role not null default 'ops',
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(meeting_id,email),
  check(email=lower(trim(email)))
);
alter table public.meeting_staff_assignments enable row level security;

create or replace function public.list_system_staff(p_meeting_id uuid)
returns table(email text,display_name text,system_role text,account_created boolean,project_enabled boolean)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可查看系统账号'; end if;
  return query
  select s.email,s.display_name,s.system_role,(u.id is not null),
    (exists(select 1 from public.meeting_staff_assignments ma where ma.meeting_id=p_meeting_id and ma.email=s.email)
      or exists(select 1 from public.meeting_members mm where mm.meeting_id=p_meeting_id and mm.user_id=u.id))
  from public.system_staff_allowlist s
  left join auth.users u on lower(trim(u.email))=s.email
  where s.active
  order by case when s.system_role='super_admin' then 0 else 1 end,s.created_at;
end; $$;

create or replace function public.set_project_staff_member(p_meeting_id uuid,p_email text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_email text:=lower(trim(p_email));
  v_staff public.system_staff_allowlist%rowtype;
  v_user auth.users%rowtype;
  v_role public.app_role;
  v_owner uuid;
  v_actor text;
  v_was_enabled boolean;
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可设置项目权限'; end if;
  select * into v_staff from public.system_staff_allowlist where email=v_email and active;
  if v_staff.email is null then raise exception '该邮箱不是可分配账号'; end if;
  select * into v_user from auth.users where lower(trim(email))=v_email;
  v_role:=case when v_staff.system_role='readonly' then 'sales'::public.app_role else 'ops'::public.app_role end;
  select owner_user_id into v_owner from public.meetings where id=p_meeting_id;
  if v_owner is null then raise exception '项目不存在'; end if;
  select exists(select 1 from public.meeting_staff_assignments where meeting_id=p_meeting_id and email=v_email)
    or (v_user.id is not null and exists(select 1 from public.meeting_members where meeting_id=p_meeting_id and user_id=v_user.id))
  into v_was_enabled;

  if p_enabled then
    insert into public.meeting_staff_assignments(meeting_id,email,role,assigned_by,updated_at)
    values(p_meeting_id,v_email,v_role,auth.uid(),now())
    on conflict(meeting_id,email) do update set role=excluded.role,assigned_by=excluded.assigned_by,updated_at=now();
    if v_user.id is not null then
      insert into public.profiles(user_id,meeting_id,display_name,role)
      values(v_user.id,null,v_staff.display_name,v_role)
      on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role;
      insert into public.meeting_members(meeting_id,user_id,display_name,role)
      values(p_meeting_id,v_user.id,v_staff.display_name,v_role)
      on conflict(meeting_id,user_id) do update set display_name=excluded.display_name,role=excluded.role;
    end if;
  else
    -- Removing the project-level appointment never removes global super-admin
    -- access and does not transfer project ownership away from a super admin.
    if v_staff.system_role<>'super_admin' and v_owner=v_user.id then
      update public.meetings set owner_user_id=auth.uid() where id=p_meeting_id;
    end if;
    delete from public.meeting_staff_assignments where meeting_id=p_meeting_id and email=v_email;
    if v_user.id is not null then delete from public.meeting_members where meeting_id=p_meeting_id and user_id=v_user.id; end if;
  end if;

  select coalesce(display_name,public.current_staff_email()) into v_actor from public.profiles where user_id=auth.uid();
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data,metadata)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'超级管理员'),'project_staff_access_changed','staff',v_email,
    jsonb_build_object('projectEnabled',v_was_enabled),jsonb_build_object('projectEnabled',p_enabled),
    jsonb_build_object('email',v_email,'displayName',v_staff.display_name,'systemRole',v_staff.system_role));
end; $$;

create or replace function public.register_staff_session(p_device_id text,p_user_agent text default null)
returns table(allowed boolean,revoked_sessions integer,max_devices integer)
language plpgsql security definer set search_path=public as $$
declare
  v_email text:=public.current_staff_email();
  v_session uuid:=public.current_auth_session_id();
  v_max integer;
  v_revoked integer:=0;
  v_role public.app_role;
  v_name text;
begin
  if auth.uid() is null or v_session is null then raise exception '登录会话无效'; end if;
  select case when system_role='readonly' then 'sales'::public.app_role else 'ops'::public.app_role end,display_name
    into v_role,v_name from public.system_staff_allowlist where email=v_email and active;
  if v_role is null then raise exception '当前邮箱未开放管理系统权限'; end if;
  if exists(select 1 from public.staff_login_sessions where session_id=v_session and not active) then raise exception '当前登录会话已失效，请重新登录'; end if;
  select greatest(1,least(20,coalesce((settings->>'maxConcurrentDevices')::integer,2)))
    into v_max from public.system_configuration where singleton;
  v_max:=coalesce(v_max,2);
  update public.staff_login_sessions set active=false,revoked_at=now(),revoked_reason='会话超时'
    where user_id=auth.uid() and active and last_seen_at<=now()-interval '30 minutes';
  insert into public.staff_login_sessions(session_id,user_id,email,device_id,user_agent,active,last_seen_at,revoked_at,revoked_reason)
  values(v_session,auth.uid(),v_email,left(coalesce(nullif(trim(p_device_id),''),v_session::text),120),left(coalesce(p_user_agent,''),500),true,now(),null,null)
  on conflict(session_id) do update set device_id=excluded.device_id,user_agent=excluded.user_agent,active=true,last_seen_at=now(),revoked_at=null,revoked_reason=null;
  with excess as (
    select session_id from public.staff_login_sessions where user_id=auth.uid() and active and session_id<>v_session
    order by last_seen_at desc offset greatest(v_max-1,0)
  )
  update public.staff_login_sessions s set active=false,revoked_at=now(),revoked_reason='超出同账号最大在线设备数'
    where s.session_id in(select session_id from excess);
  get diagnostics v_revoked=row_count;

  insert into public.profiles(user_id,meeting_id,display_name,role)
  values(auth.uid(),null,v_name,v_role)
  on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role;
  insert into public.meeting_members(meeting_id,user_id,display_name,role)
  select a.meeting_id,auth.uid(),v_name,a.role from public.meeting_staff_assignments a where a.email=v_email
  on conflict(meeting_id,user_id) do update set display_name=excluded.display_name,role=excluded.role;

  return query select true,v_revoked,v_max;
end; $$;

create or replace function public.create_meeting_project(
  p_name text,p_slug text,p_activity_type text,p_identifier text,p_activity_owner text,p_activity_date date,p_source_id uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_profile public.profiles%rowtype; v_source public.meetings%rowtype; v_has_source_template boolean:=false;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_profile from public.profiles where user_id=auth.uid();
  if v_profile.user_id is null then raise exception '账号资料不存在'; end if;
  if p_activity_type not in ('internal','external') then raise exception '活动类型不正确'; end if;
  if nullif(trim(p_identifier),'') is null or nullif(trim(p_activity_owner),'') is null or p_activity_date is null then raise exception '请完整填写项目基本资料'; end if;
  if p_source_id is not null then
    if not public.can_manage_project(p_source_id) then raise exception '无权复制该项目'; end if;
    select * into v_source from public.meetings where id=p_source_id;
    v_has_source_template:=v_source.template_imported_at is not null
      and jsonb_typeof(v_source.registration_template->'columns')='array'
      and jsonb_array_length(v_source.registration_template->'columns')>0;
  end if;
  insert into public.meetings(
    slug,name,owner_user_id,archive_ready,activity_type,project_identifier,activity_owner,activity_date,
    deadline,capacity,allowed_departure_cities,check_city_mismatch,check_departure_city,client_name,start_date,end_date,venues,service_phone,brand_color,auth_mode,
    flight_lead_minutes,train_lead_minutes,field_config,template_name,registration_template,template_imported_at,template_storage_path,template_is_system_default
  ) values(
    lower(trim(p_slug)),trim(p_name),auth.uid(),false,p_activity_type,trim(p_identifier),trim(p_activity_owner),p_activity_date,
    case when p_source_id is null then null else v_source.deadline end,coalesce(v_source.capacity,120),coalesce(v_source.allowed_departure_cities,'{}'),
    coalesce(v_source.check_city_mismatch,true),coalesce(v_source.check_departure_city,true),v_source.client_name,coalesce(v_source.start_date,p_activity_date),
    coalesce(v_source.end_date,p_activity_date),coalesce(v_source.venues,'{}'),v_source.service_phone,coalesce(v_source.brand_color,'#5267d9'),
    coalesce(v_source.auth_mode,'region_name_phone'),coalesce(v_source.flight_lead_minutes,120),coalesce(v_source.train_lead_minutes,90),coalesce(v_source.field_config,'{}'::jsonb),
    case when v_has_source_template then coalesce(v_source.template_name,'引用会议报名模板') else null end,
    case when v_has_source_template then v_source.registration_template else '{}'::jsonb end,
    case when v_has_source_template then now() else null end,null,
    case when v_has_source_template then coalesce(v_source.template_is_system_default,false) else false end
  ) returning id into v_id;
  insert into public.meeting_members(meeting_id,user_id,display_name,phone,role) values(v_id,auth.uid(),v_profile.display_name,v_profile.phone,'ops');
  if p_source_id is not null then
    insert into public.column_locks(meeting_id,field_group,locked,updated_by) select v_id,field_group,locked,auth.uid() from public.column_locks where meeting_id=p_source_id;
  end if;
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,metadata)
  values(v_id,auth.uid(),coalesce(v_profile.display_name,'系统'),'meeting_project_created','meeting',v_id::text,
    jsonb_build_object('sourceMeetingId',p_source_id,'registrationTemplateReferenced',v_has_source_template,'sourceAttachmentCopied',false));
  return v_id;
end; $$;

grant execute on function public.list_system_staff(uuid) to authenticated;
grant execute on function public.set_project_staff_member(uuid,text,boolean) to authenticated;
grant execute on function public.register_staff_session(text,text) to authenticated;
grant execute on function public.create_meeting_project(text,text,text,text,text,date,uuid) to authenticated;
