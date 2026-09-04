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

grant execute on function public.list_system_staff(uuid) to authenticated;
grant execute on function public.set_project_staff_member(uuid,text,boolean) to authenticated;
grant execute on function public.register_staff_session(text,text) to authenticated;
