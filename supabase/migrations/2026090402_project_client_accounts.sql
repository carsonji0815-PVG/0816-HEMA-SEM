-- Project-scoped customer meeting-owner accounts. These accounts are separate
-- from the seven fixed internal operations accounts in system_staff_allowlist.

create table if not exists public.project_client_accounts (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  email text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(meeting_id,email),
  unique(meeting_id,user_id),
  check(email=lower(trim(email)))
);
create index if not exists project_client_accounts_user_active_idx
  on public.project_client_accounts(user_id,active,meeting_id);
alter table public.project_client_accounts enable row level security;

create or replace function public.is_allowed_staff()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.staff_login_sessions ls
    where ls.user_id=auth.uid()
      and ls.email=public.current_staff_email()
      and ls.active
      and ls.session_id=public.current_auth_session_id()
      and ls.last_seen_at>now()-interval '30 minutes'
      and (
        exists(select 1 from public.system_staff_allowlist s where s.email=ls.email and s.active)
        or exists(select 1 from public.project_client_accounts c where c.user_id=auth.uid() and c.email=ls.email and c.active)
      )
  )
$$;

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
  v_is_internal boolean:=false;
begin
  if auth.uid() is null or v_session is null then raise exception '登录会话无效'; end if;
  select case when system_role='readonly' then 'sales'::public.app_role else 'ops'::public.app_role end,display_name,true
    into v_role,v_name,v_is_internal from public.system_staff_allowlist where email=v_email and active;
  if v_role is null then
    select 'client'::public.app_role,display_name into v_role,v_name
    from public.project_client_accounts where user_id=auth.uid() and email=v_email and active
    order by created_at limit 1;
  end if;
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
  if v_is_internal then
    insert into public.meeting_members(meeting_id,user_id,display_name,role)
    select a.meeting_id,auth.uid(),v_name,a.role from public.meeting_staff_assignments a where a.email=v_email
    on conflict(meeting_id,user_id) do update set display_name=excluded.display_name,role=excluded.role;
  else
    insert into public.meeting_members(meeting_id,user_id,display_name,role)
    select c.meeting_id,auth.uid(),c.display_name,'client'::public.app_role from public.project_client_accounts c
    where c.user_id=auth.uid() and c.email=v_email and c.active
    on conflict(meeting_id,user_id) do update set display_name=excluded.display_name,role='client'::public.app_role;
  end if;
  return query select true,v_revoked,v_max;
end; $$;

create or replace function public.get_staff_access()
returns table(allowed boolean,email text,display_name text,system_role text)
language sql stable security definer set search_path=public as $$
  select public.is_allowed_staff(),public.current_staff_email(),
    coalesce(s.display_name,c.display_name),
    coalesce(s.system_role,case when c.user_id is not null then 'client' end)
  from (select 1) seed
  left join public.system_staff_allowlist s on s.email=public.current_staff_email() and s.active
  left join lateral (
    select pc.user_id,pc.display_name from public.project_client_accounts pc
    where pc.user_id=auth.uid() and pc.email=public.current_staff_email() and pc.active
    order by pc.created_at limit 1
  ) c on true
$$;

create or replace function public.list_project_client_accounts(p_meeting_id uuid)
returns table(email text,display_name text,account_created boolean,active boolean,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可查看客户会议负责人账号'; end if;
  return query select c.email,c.display_name,(u.id is not null),c.active,c.created_at
  from public.project_client_accounts c left join auth.users u on u.id=c.user_id
  where c.meeting_id=p_meeting_id order by c.created_at;
end; $$;

create or replace function public.set_project_client_account_active(p_meeting_id uuid,p_email text,p_active boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_email text:=lower(trim(p_email)); v_user uuid; v_name text; v_before boolean;
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可设置客户会议负责人账号'; end if;
  select user_id,display_name,active into v_user,v_name,v_before from public.project_client_accounts
    where meeting_id=p_meeting_id and email=v_email;
  if v_user is null then raise exception '客户会议负责人账号不存在'; end if;
  update public.project_client_accounts set active=p_active,updated_at=now() where meeting_id=p_meeting_id and email=v_email;
  if p_active then
    insert into public.meeting_members(meeting_id,user_id,display_name,role)
    values(p_meeting_id,v_user,v_name,'client')
    on conflict(meeting_id,user_id) do update set display_name=excluded.display_name,role=excluded.role;
  else
    delete from public.meeting_members where meeting_id=p_meeting_id and user_id=v_user;
  end if;
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data)
  values(p_meeting_id,auth.uid(),coalesce((select display_name from public.profiles where user_id=auth.uid()),'超级管理员'),
    'project_client_account_access_changed','client_account',v_email,jsonb_build_object('active',v_before),jsonb_build_object('active',p_active));
end; $$;

-- Registration opening depends only on a configured template. An attendee
-- roster may be empty; referenced projects inherit the source template via
-- create_meeting_project() and therefore satisfy this guard without reimport.
create or replace function public.set_registration_open(p_meeting_id uuid,p_open boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_before boolean; v_template timestamptz; v_actor text;
begin
  if not (public.is_system_admin() or public.meeting_role(p_meeting_id) in ('ops','client')) then raise exception '无权更改报名开放状态'; end if;
  select registration_open,template_imported_at into v_before,v_template from public.meetings where id=p_meeting_id for update;
  if p_open and v_template is null then raise exception '请先配置报名模板，或引用已有会议的报名模板；无需预先导入参会名单'; end if;
  perform set_config('app.registration_config_rpc','on',true);
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor from public.profiles p
    left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=p_meeting_id where p.user_id=auth.uid();
  update public.meetings set registration_open=p_open,registration_open_updated_at=now(),registration_open_updated_by=auth.uid() where id=p_meeting_id;
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data,metadata)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'系统'),'registration_switch_changed','meeting',p_meeting_id::text,
    jsonb_build_object('registrationOpen',v_before),jsonb_build_object('registrationOpen',p_open),
    jsonb_build_object('templateRequired',true,'attendeeRosterRequired',false));
end; $$;

drop policy if exists "admin reads project client accounts" on public.project_client_accounts;
create policy "admin reads project client accounts" on public.project_client_accounts for select to authenticated
using(public.is_system_admin() or user_id=auth.uid());

grant execute on function public.list_project_client_accounts(uuid) to authenticated;
grant execute on function public.set_project_client_account_active(uuid,text,boolean) to authenticated;
grant execute on function public.register_staff_session(text,text) to authenticated;
grant execute on function public.set_registration_open(uuid,boolean) to authenticated;
revoke insert,update,delete on public.project_client_accounts from authenticated;

notify pgrst, 'reload schema';
