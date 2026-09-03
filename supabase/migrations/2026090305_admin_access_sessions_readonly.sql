-- Temporary admin access links, concurrent-device enforcement and a dedicated
-- account-level read-only role.  Authentication remains Supabase Auth; these
-- controls are enforced again by RLS through is_allowed_staff().

alter table public.system_staff_allowlist drop constraint if exists system_staff_allowlist_system_role_check;
alter table public.system_staff_allowlist add constraint system_staff_allowlist_system_role_check
  check (system_role in ('super_admin','ops','readonly'));

create table if not exists public.staff_login_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  device_id text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text
);
create index if not exists staff_login_sessions_user_active_idx
  on public.staff_login_sessions(user_id,active,last_seen_at desc);
alter table public.staff_login_sessions enable row level security;

create table if not exists public.admin_access_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  target_email text,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_validated_at timestamptz,
  revoked_at timestamptz,
  check (target_email is null or target_email=lower(trim(target_email)))
);
alter table public.admin_access_links enable row level security;

create or replace function public.current_auth_session_id()
returns uuid language plpgsql stable security definer set search_path=public as $$
begin
  return nullif(auth.jwt()->>'session_id','')::uuid;
exception when others then return null;
end; $$;

create or replace function public.is_allowed_staff()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from public.system_staff_allowlist s
    join public.staff_login_sessions ls
      on ls.email=s.email and ls.user_id=auth.uid()
    where s.email=public.current_staff_email()
      and s.active and ls.active
      and ls.session_id=public.current_auth_session_id()
      and ls.last_seen_at > now()-interval '30 minutes'
  )
$$;

create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_allowed_staff() and exists(
    select 1 from public.system_staff_allowlist s
    where s.email=public.current_staff_email() and s.active and s.system_role='super_admin'
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
begin
  if auth.uid() is null or v_session is null then raise exception '登录会话无效'; end if;
  if not exists(select 1 from public.system_staff_allowlist where email=v_email and active) then
    raise exception '当前邮箱未开放管理系统权限';
  end if;
  if exists(select 1 from public.staff_login_sessions where session_id=v_session and not active) then
    raise exception '当前登录会话已失效，请重新登录';
  end if;
  select greatest(1,least(20,coalesce((settings->>'maxConcurrentDevices')::integer,2)))
  into v_max from public.system_configuration where singleton;
  v_max:=coalesce(v_max,2);
  update public.staff_login_sessions set active=false,revoked_at=now(),revoked_reason='会话超时'
    where user_id=auth.uid() and active and last_seen_at<=now()-interval '30 minutes';
  insert into public.staff_login_sessions(session_id,user_id,email,device_id,user_agent,active,last_seen_at,revoked_at,revoked_reason)
  values(v_session,auth.uid(),v_email,left(coalesce(nullif(trim(p_device_id),''),v_session::text),120),left(coalesce(p_user_agent,''),500),true,now(),null,null)
  on conflict(session_id) do update set device_id=excluded.device_id,user_agent=excluded.user_agent,active=true,last_seen_at=now(),revoked_at=null,revoked_reason=null;
  with excess as (
    select session_id from public.staff_login_sessions
    where user_id=auth.uid() and active and session_id<>v_session
    order by last_seen_at desc offset greatest(v_max-1,0)
  )
  update public.staff_login_sessions s set active=false,revoked_at=now(),revoked_reason='超出同账号最大在线设备数'
  where s.session_id in(select session_id from excess);
  get diagnostics v_revoked=row_count;
  return query select true,v_revoked,v_max;
end; $$;

create or replace function public.get_staff_access()
returns table(allowed boolean,email text,display_name text,system_role text)
language sql stable security definer set search_path=public as $$
  select public.is_allowed_staff(),public.current_staff_email(),s.display_name,s.system_role
  from (select 1) seed
  left join public.system_staff_allowlist s on s.email=public.current_staff_email() and s.active
$$;

create or replace function public.create_admin_access_link(p_minutes integer default 60,p_target_email text default null)
returns table(token text,expires_at timestamptz) language plpgsql security definer set search_path=public as $$
declare v_token text:=encode(extensions.gen_random_bytes(32),'hex'); v_expires timestamptz;
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可生成临时登录链接'; end if;
  p_minutes:=greatest(5,least(1440,coalesce(p_minutes,60)));
  if p_target_email is not null and not exists(select 1 from public.system_staff_allowlist where email=lower(trim(p_target_email)) and active) then
    raise exception '指定邮箱不在系统白名单';
  end if;
  v_expires:=now()+make_interval(mins=>p_minutes);
  insert into public.admin_access_links(token_hash,target_email,expires_at,created_by)
  values(encode(extensions.digest(v_token,'sha256'),'hex'),nullif(lower(trim(p_target_email)),''),v_expires,auth.uid());
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,metadata)
  select m.id,auth.uid(),coalesce((select display_name from public.profiles where user_id=auth.uid()),'超级管理员'),'create_temp_login_link','security',null,
    jsonb_build_object('expiresAt',v_expires,'targetEmail',nullif(lower(trim(p_target_email)),''))
  from public.meetings m where m.archived_at is null order by m.created_at limit 1;
  return query select v_token,v_expires;
end; $$;

create or replace function public.validate_admin_access_link(p_token text)
returns table(valid boolean,target_email text,expires_at timestamptz) language plpgsql security definer set search_path=public as $$
declare v_hash text:=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex');
begin
  update public.admin_access_links set last_validated_at=now()
  where token_hash=v_hash and revoked_at is null and admin_access_links.expires_at>now();
  return query select true,l.target_email,l.expires_at from public.admin_access_links l
    where l.token_hash=v_hash and l.revoked_at is null and l.expires_at>now()
  union all select false,null::text,null::timestamptz where not exists(
    select 1 from public.admin_access_links l where l.token_hash=v_hash and l.revoked_at is null and l.expires_at>now()
  ) limit 1;
end; $$;

create or replace function public.set_system_staff_role(p_email text,p_role text)
returns void language plpgsql security definer set search_path=public as $$
declare v_email text:=lower(trim(p_email)); v_user uuid;
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可设置系统角色'; end if;
  if p_role not in ('ops','readonly') then raise exception '不支持的系统角色'; end if;
  if exists(select 1 from public.system_staff_allowlist where email=v_email and system_role='super_admin') then raise exception '超级管理员角色不可更改'; end if;
  update public.system_staff_allowlist set system_role=p_role,updated_at=now(),created_by=auth.uid() where email=v_email and active;
  if not found then raise exception '账号不存在'; end if;
  select id into v_user from auth.users where lower(email)=v_email limit 1;
  if v_user is not null then
    update public.profiles set role=case when p_role='readonly' then 'sales'::public.app_role else 'ops'::public.app_role end where user_id=v_user;
    update public.meeting_members set role=case when p_role='readonly' then 'sales'::public.app_role else 'ops'::public.app_role end where user_id=v_user;
  end if;
end; $$;

create or replace function public.set_project_staff_member(p_meeting_id uuid,p_email text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_email text:=lower(trim(p_email)); v_staff public.system_staff_allowlist%rowtype; v_user auth.users%rowtype; v_role public.app_role; v_owner uuid;
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可设置项目权限'; end if;
  select * into v_staff from public.system_staff_allowlist where email=v_email and active;
  if v_staff.email is null or v_staff.system_role='super_admin' then raise exception '该邮箱不是可分配账号'; end if;
  select * into v_user from auth.users where lower(trim(email))=v_email;
  if v_user.id is null then raise exception '该邮箱尚未创建登录账号'; end if;
  v_role:=case when v_staff.system_role='readonly' then 'sales'::public.app_role else 'ops'::public.app_role end;
  select owner_user_id into v_owner from public.meetings where id=p_meeting_id;
  if p_enabled then
    insert into public.profiles(user_id,meeting_id,display_name,role) values(v_user.id,null,v_staff.display_name,v_role)
      on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role;
    insert into public.meeting_members(meeting_id,user_id,display_name,role) values(p_meeting_id,v_user.id,v_staff.display_name,v_role)
      on conflict(meeting_id,user_id) do update set display_name=excluded.display_name,role=excluded.role;
  else
    if v_owner=v_user.id then update public.meetings set owner_user_id=auth.uid() where id=p_meeting_id; end if;
    delete from public.meeting_members where meeting_id=p_meeting_id and user_id=v_user.id;
  end if;
end; $$;

drop policy if exists "role scoped attendee read" on public.attendees;
create policy "role scoped attendee read" on public.attendees for select to authenticated using (
  public.is_allowed_staff() and (
    public.is_system_admin() or public.meeting_role(meeting_id) in ('ops','client') or owner_id=auth.uid()
    or exists(select 1 from public.system_staff_allowlist s where s.email=public.current_staff_email() and s.system_role='readonly' and public.is_meeting_member(meeting_id))
  )
);

drop policy if exists "staff see own sessions" on public.staff_login_sessions;
create policy "staff see own sessions" on public.staff_login_sessions for select to authenticated using(user_id=auth.uid() or public.is_system_admin());
drop policy if exists "admin manages access links" on public.admin_access_links;
create policy "admin manages access links" on public.admin_access_links for all to authenticated using(public.is_system_admin()) with check(public.is_system_admin());

grant execute on function public.current_auth_session_id() to authenticated;
grant execute on function public.register_staff_session(text,text) to authenticated;
grant execute on function public.create_admin_access_link(integer,text) to authenticated;
grant execute on function public.validate_admin_access_link(text) to anon,authenticated;
grant execute on function public.set_system_staff_role(text,text) to authenticated;
grant execute on function public.set_project_staff_member(uuid,text,boolean) to authenticated;
revoke insert,update,delete on public.staff_login_sessions from authenticated;
revoke insert,update,delete on public.admin_access_links from authenticated;

notify pgrst, 'reload schema';
