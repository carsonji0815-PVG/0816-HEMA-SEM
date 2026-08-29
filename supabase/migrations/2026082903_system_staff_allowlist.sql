-- System staff allowlist and super-administrator enforcement.
-- Only the seven approved Grand China MICE accounts may enter the management app.

create table if not exists public.system_staff_allowlist (
  email text primary key,
  display_name text not null,
  system_role text not null check (system_role in ('super_admin','ops')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

insert into public.system_staff_allowlist(email,display_name,system_role,active) values
  ('jll@grandchinamice.com','季亮亮','super_admin',true),
  ('shenxy@grandchinamice.com','沈祥雨','ops',true),
  ('chenyan@grandchinamice.com','陈艳','ops',true),
  ('zhucy@grandchinamice.com','朱宸玥','ops',true),
  ('zhuby@grandchinamice.com','朱冰焰','ops',true),
  ('zhanh@grandchinamice.com','占慧','ops',true),
  ('yml@grandchinamice.com','易敏丽','ops',true)
on conflict(email) do update set
  display_name=excluded.display_name,
  system_role=excluded.system_role,
  active=excluded.active,
  updated_at=now();

alter table public.system_staff_allowlist enable row level security;

create or replace function public.current_staff_email()
returns text language sql stable security definer set search_path=public
as $$ select lower(trim(coalesce(auth.jwt()->>'email',''))) $$;

create or replace function public.is_allowed_staff()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.system_staff_allowlist s
    where s.email=public.current_staff_email() and s.active
  )
$$;

create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.system_staff_allowlist s
    where s.email=public.current_staff_email() and s.active and s.system_role='super_admin'
  )
$$;

create or replace function public.can_manage_project(target_meeting uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select public.is_allowed_staff() and (
    public.is_system_admin()
    or exists(select 1 from public.meetings m where m.id=target_meeting and m.owner_user_id=auth.uid())
    or exists(select 1 from public.meeting_members mm where mm.meeting_id=target_meeting and mm.user_id=auth.uid() and mm.role='ops')
  )
$$;

create or replace function public.is_meeting_member(target_meeting uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select public.is_allowed_staff() and (
    public.is_system_admin()
    or exists(select 1 from public.meeting_members mm where mm.meeting_id=target_meeting and mm.user_id=auth.uid())
    or public.can_manage_project(target_meeting)
  )
$$;

create or replace function public.meeting_role(target_meeting uuid)
returns public.app_role language sql stable security definer set search_path=public
as $$
  select case
    when not public.is_allowed_staff() then null
    when public.is_system_admin() then 'ops'::public.app_role
    else coalesce(
      (select mm.role from public.meeting_members mm where mm.meeting_id=target_meeting and mm.user_id=auth.uid()),
      case when public.can_manage_project(target_meeting) then 'ops'::public.app_role else null end
    )
  end
$$;

drop policy if exists "super admin reads staff allowlist" on public.system_staff_allowlist;
create policy "super admin reads staff allowlist" on public.system_staff_allowlist for select to authenticated
using (public.is_system_admin());

-- Ensure existing Auth accounts on the allowlist have account-level profiles.
insert into public.profiles(user_id,meeting_id,display_name,phone,role)
select u.id,null,s.display_name,null,'ops'::public.app_role
from auth.users u join public.system_staff_allowlist s on s.email=lower(trim(u.email))
where s.active
on conflict(user_id) do update set display_name=excluded.display_name,role='ops'::public.app_role;

create or replace function public.get_staff_access()
returns table(allowed boolean,email text,display_name text,system_role text)
language sql stable security definer set search_path=public
as $$
  select coalesce(s.active,false),public.current_staff_email(),s.display_name,s.system_role
  from (select 1) seed
  left join public.system_staff_allowlist s on s.email=public.current_staff_email() and s.active
$$;

create or replace function public.list_system_staff(p_meeting_id uuid)
returns table(email text,display_name text,system_role text,account_created boolean,project_enabled boolean)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可查看系统账号'; end if;
  return query
  select s.email,s.display_name,s.system_role,(u.id is not null),
    (s.system_role='super_admin' or exists(select 1 from public.meeting_members mm where mm.meeting_id=p_meeting_id and mm.user_id=u.id))
  from public.system_staff_allowlist s
  left join auth.users u on lower(trim(u.email))=s.email
  where s.active
  order by case when s.system_role='super_admin' then 0 else 1 end,s.created_at;
end; $$;

create or replace function public.set_project_staff_member(p_meeting_id uuid,p_email text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public
as $$
declare
  v_email text:=lower(trim(p_email));
  v_staff public.system_staff_allowlist%rowtype;
  v_user auth.users%rowtype;
  v_owner uuid;
  v_actor text;
  v_was_enabled boolean;
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可设置会务负责人账号'; end if;
  select * into v_staff from public.system_staff_allowlist where email=v_email and active;
  if v_staff.email is null or v_staff.system_role<>'ops' then raise exception '该邮箱不在会务负责人白名单'; end if;
  select * into v_user from auth.users where lower(trim(email))=v_email;
  if v_user.id is null then raise exception '该邮箱尚未创建登录账号，请先在 Supabase Authentication 中创建'; end if;
  select owner_user_id into v_owner from public.meetings where id=p_meeting_id;
  if v_owner is null then raise exception '项目不存在'; end if;
  select exists(select 1 from public.meeting_members where meeting_id=p_meeting_id and user_id=v_user.id) into v_was_enabled;
  if not p_enabled and v_owner=v_user.id then
    update public.meetings set owner_user_id=auth.uid() where id=p_meeting_id;
  end if;
  insert into public.profiles(user_id,meeting_id,display_name,phone,role)
  values(v_user.id,null,v_staff.display_name,null,'ops')
  on conflict(user_id) do update set display_name=excluded.display_name,role='ops';
  if p_enabled then
    insert into public.meeting_members(meeting_id,user_id,display_name,phone,role)
    values(p_meeting_id,v_user.id,v_staff.display_name,null,'ops')
    on conflict(meeting_id,user_id) do update set display_name=excluded.display_name,role='ops';
  else
    delete from public.meeting_members where meeting_id=p_meeting_id and user_id=v_user.id;
  end if;
  select coalesce(display_name,public.current_staff_email()) into v_actor from public.profiles where user_id=auth.uid();
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data,metadata)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'超级管理员'),'project_staff_access_changed','staff',v_email,
    jsonb_build_object('projectEnabled',v_was_enabled),jsonb_build_object('projectEnabled',p_enabled),jsonb_build_object('email',v_email,'displayName',v_staff.display_name));
end; $$;

create or replace function public.guard_management_staff()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.is_allowed_staff() then raise exception '当前邮箱未开放管理系统权限'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists meetings_guard_management_staff on public.meetings;
create trigger meetings_guard_management_staff before insert or update or delete on public.meetings
for each row execute function public.guard_management_staff();

-- Rebuild sensitive-data policies so an old profile or direct URL cannot bypass the allowlist.
drop policy if exists "role scoped attendee read" on public.attendees;
create policy "role scoped attendee read" on public.attendees for select to authenticated
using (public.is_allowed_staff() and (public.is_system_admin() or public.meeting_role(meeting_id) in ('ops','client') or owner_id=auth.uid()));

drop policy if exists "permission scoped attendee insert" on public.attendees;
create policy "permission scoped attendee insert" on public.attendees for insert to authenticated
with check (public.is_allowed_staff() and public.project_management_open(meeting_id)
  and not exists(select 1 from public.meetings m where m.id=meeting_id and m.master_locked)
  and (public.can_edit_attendee_records(meeting_id) or owner_id=auth.uid()));

drop policy if exists "permission scoped attendee update" on public.attendees;
create policy "permission scoped attendee update" on public.attendees for update to authenticated
using (public.is_allowed_staff() and (public.can_edit_attendee_records(meeting_id) or owner_id=auth.uid()))
with check (public.is_allowed_staff() and (public.can_edit_attendee_records(meeting_id) or owner_id=auth.uid()));

drop policy if exists "role scoped transport read" on public.transports;
create policy "role scoped transport read" on public.transports for select to authenticated
using (public.is_allowed_staff() and exists(select 1 from public.attendees a where a.id=attendee_id and public.is_meeting_member(a.meeting_id)));

drop policy if exists "managers manage transport" on public.transports;
create policy "managers manage transport" on public.transports for all to authenticated
using (public.is_allowed_staff() and exists(select 1 from public.attendees a where a.id=attendee_id and public.meeting_role(a.meeting_id) in ('ops','client')))
with check (public.is_allowed_staff() and exists(select 1 from public.attendees a where a.id=attendee_id and public.meeting_role(a.meeting_id) in ('ops','client')));

grant execute on function public.current_staff_email() to authenticated;
grant execute on function public.is_allowed_staff() to authenticated;
grant execute on function public.is_system_admin() to authenticated;
grant execute on function public.get_staff_access() to authenticated;
grant execute on function public.list_system_staff(uuid) to authenticated;
grant execute on function public.set_project_staff_member(uuid,text,boolean) to authenticated;
