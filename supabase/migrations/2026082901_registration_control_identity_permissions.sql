-- Project-level registration control, public registrant identity binding,
-- soft cancellation, transfer, audit trails and server-side access rules.

alter table public.meetings add column if not exists registration_open boolean not null default false;
alter table public.meetings add column if not exists registration_open_updated_at timestamptz;
alter table public.meetings add column if not exists registration_open_updated_by uuid references auth.users(id) on delete set null;
alter table public.meetings add column if not exists template_imported_at timestamptz;
alter table public.meetings add column if not exists manager_attendee_edit_enabled boolean not null default false;

update public.meetings
set template_imported_at = coalesce(template_imported_at, created_at)
where jsonb_typeof(registration_template->'columns') = 'array'
  and jsonb_array_length(registration_template->'columns') > 0;

alter table public.meeting_members add column if not exists employee_no text;

create table if not exists public.registrants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  region text not null,
  display_name text not null,
  employee_no text not null,
  employee_no_norm text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(meeting_id, employee_no_norm)
);
create index if not exists registrants_meeting_identity_idx on public.registrants(meeting_id, employee_no_norm);

create table if not exists public.public_registration_sessions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  registrant_id uuid not null references public.registrants(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists public_registration_sessions_lookup_idx on public.public_registration_sessions(token_hash, expires_at);

alter table public.attendees add column if not exists registrant_id uuid references public.registrants(id) on delete set null;
alter table public.attendees add column if not exists business_status text not null default 'active';
alter table public.attendees add column if not exists cancelled_at timestamptz;
alter table public.attendees add column if not exists cancelled_by_registrant_id uuid references public.registrants(id) on delete set null;

do $$ begin
  alter table public.attendees add constraint attendees_business_status_check check (business_status in ('active','cancelled'));
exception when duplicate_object then null; end $$;
create index if not exists attendees_registrant_idx on public.attendees(meeting_id, registrant_id, business_status);

create table if not exists public.operation_audit_logs (
  id bigint generated always as identity primary key,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  attendee_id uuid references public.attendees(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_registrant_id uuid references public.registrants(id) on delete set null,
  actor_label text not null default '系统',
  action text not null,
  target_type text not null default 'meeting',
  target_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists operation_audit_meeting_created_idx on public.operation_audit_logs(meeting_id, created_at desc);

alter table public.registrants enable row level security;
alter table public.public_registration_sessions enable row level security;
alter table public.operation_audit_logs enable row level security;

create or replace function public.meeting_role(target_meeting uuid)
returns public.app_role language sql stable security definer set search_path=public
as $$
  select coalesce(
    (select mm.role from public.meeting_members mm where mm.meeting_id=target_meeting and mm.user_id=auth.uid()),
    case when public.can_manage_project(target_meeting) then 'ops'::public.app_role else null end
  )
$$;

create or replace function public.is_meeting_member(target_meeting uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select public.is_system_admin() or exists(
    select 1 from public.meeting_members mm where mm.meeting_id=target_meeting and mm.user_id=auth.uid()
  ) or public.can_manage_project(target_meeting)
$$;

create or replace function public.project_management_open(target_meeting uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select coalesce(m.registration_open,false) or coalesce(m.archive_ready,false)
  from public.meetings m where m.id=target_meeting
$$;

create or replace function public.can_edit_attendee_records(target_meeting uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select public.is_system_admin()
    or (
      public.meeting_role(target_meeting) in ('ops','client')
      and exists(select 1 from public.meetings m where m.id=target_meeting and m.manager_attendee_edit_enabled)
    )
$$;

drop policy if exists "meeting members read meeting" on public.meetings;
drop policy if exists "project owners read meeting" on public.meetings;
create policy "meeting members read meeting" on public.meetings for select to authenticated
using (public.is_meeting_member(id));

drop policy if exists "managers update meeting" on public.meetings;
drop policy if exists "project owners update meeting" on public.meetings;
create policy "meeting managers update meeting" on public.meetings for update to authenticated
using (public.is_system_admin() or public.meeting_role(id) in ('ops','client'))
with check (public.is_system_admin() or public.meeting_role(id) in ('ops','client'));

create or replace function public.guard_meeting_registration_config()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(current_setting('app.registration_config_rpc',true),'')<>'on'
    and row(new.registration_open,new.template_name,new.registration_template,new.template_imported_at,new.manager_attendee_edit_enabled)
      is distinct from row(old.registration_open,old.template_name,old.registration_template,old.template_imported_at,old.manager_attendee_edit_enabled) then
    raise exception '报名开关、模板与管理员编辑权限必须通过受控接口修改';
  end if;
  return new;
end; $$;
drop trigger if exists meetings_guard_registration_config on public.meetings;
create trigger meetings_guard_registration_config before update on public.meetings
for each row execute function public.guard_meeting_registration_config();

drop policy if exists "project managers read registrants" on public.registrants;
create policy "project managers read registrants" on public.registrants for select to authenticated
using (public.is_system_admin() or public.meeting_role(meeting_id) in ('ops','client'));

drop policy if exists "project managers read operation audit" on public.operation_audit_logs;
create policy "project managers read operation audit" on public.operation_audit_logs for select to authenticated
using (public.is_system_admin() or public.meeting_role(meeting_id) in ('ops','client'));

drop policy if exists "role scoped attendee read" on public.attendees;
create policy "role scoped attendee read" on public.attendees for select to authenticated
using (
  public.is_system_admin()
  or public.meeting_role(meeting_id) in ('ops','client')
  or owner_id=auth.uid()
);

drop policy if exists "role scoped attendee insert" on public.attendees;
drop policy if exists "archive ready attendee insert" on public.attendees;
create policy "permission scoped attendee insert" on public.attendees for insert to authenticated
with check (
  public.project_management_open(meeting_id)
  and not exists(select 1 from public.meetings m where m.id=meeting_id and m.master_locked)
  and (public.can_edit_attendee_records(meeting_id) or owner_id=auth.uid())
);

drop policy if exists "role scoped attendee update" on public.attendees;
create policy "permission scoped attendee update" on public.attendees for update to authenticated
using (public.can_edit_attendee_records(meeting_id) or owner_id=auth.uid())
with check (public.can_edit_attendee_records(meeting_id) or owner_id=auth.uid());

create or replace function public.guard_attendee_update()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_meeting public.meetings%rowtype;
  v_role public.app_role;
  v_transfer boolean := coalesce(current_setting('app.registrant_transfer',true),'')='on';
begin
  select * into v_meeting from public.meetings where id=old.meeting_id;
  v_role := public.meeting_role(old.meeting_id);
  if not public.is_system_admin() and not v_transfer then
    if v_role in ('ops','client') and not v_meeting.manager_attendee_edit_enabled then
      raise exception '管理员当前仅有查看权限，请先开启管理员编辑权限';
    end if;
    if v_role='sales' and old.owner_id<>auth.uid() then raise exception '无权修改其他填报人的参会者'; end if;
  end if;
  if not v_transfer and not public.is_system_admin() and (v_meeting.master_locked or old.row_locked)
    and (to_jsonb(new)-array['updated_at']) is distinct from (to_jsonb(old)-array['updated_at']) then
    raise exception '名单已锁定，不能修改';
  end if;
  if not public.is_system_admin() and not v_transfer and v_role='sales'
    and (new.owner_id<>old.owner_id or new.registrant_id is distinct from old.registrant_id or new.approval<>old.approval or new.row_locked<>old.row_locked) then
    raise exception '无权修改负责人、填报绑定、审批或锁定状态';
  end if;
  return new;
end; $$;

create or replace function public.audit_attendee_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_actor_name text;
  v_action text;
begin
  select coalesce(mm.display_name,p.display_name) into v_actor_name
  from public.profiles p left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=new.meeting_id
  where p.user_id=auth.uid();
  if v_actor_name is null and new.registrant_id is not null then
    select display_name||'（'||employee_no||'）' into v_actor_name from public.registrants where id=new.registrant_id;
  end if;
  v_actor_name:=coalesce(v_actor_name,'系统/公开端');
  v_action:=case when tg_op='INSERT' then 'registration_created' when old.business_status is distinct from new.business_status and new.business_status='cancelled' then 'registration_cancelled' else 'attendee_changed' end;
  insert into public.change_logs(meeting_id,attendee_id,actor_id,action,changes)
  values(new.meeting_id,new.id,auth.uid(),v_action,jsonb_build_object('before',case when tg_op='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
  insert into public.operation_audit_logs(meeting_id,attendee_id,actor_user_id,actor_registrant_id,actor_label,action,target_type,target_id,before_data,after_data)
  values(new.meeting_id,new.id,auth.uid(),new.registrant_id,v_actor_name,v_action,'attendee',new.id::text,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
  insert into public.notifications(meeting_id,recipient_id,type,message)
  values(new.meeting_id,null,case when v_action='registration_created' then 'create' else 'change' end,v_actor_name||case when v_action='registration_created' then '新增报名：' when v_action='registration_cancelled' then '取消报名：' else '更新了参会信息：' end||new.name);
  return new;
end; $$;

create or replace function public.set_registration_open(p_meeting_id uuid,p_open boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_before boolean; v_template timestamptz; v_actor text;
begin
  if not (public.is_system_admin() or public.meeting_role(p_meeting_id) in ('ops','client')) then raise exception '无权更改报名开放状态'; end if;
  select registration_open,template_imported_at into v_before,v_template from public.meetings where id=p_meeting_id for update;
  if p_open and v_template is null then raise exception '请先导入报名表模板，再开启报名'; end if;
  perform set_config('app.registration_config_rpc','on',true);
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor from public.profiles p left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=p_meeting_id where p.user_id=auth.uid();
  update public.meetings set registration_open=p_open,registration_open_updated_at=now(),registration_open_updated_by=auth.uid() where id=p_meeting_id;
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'系统'),'registration_switch_changed','meeting',p_meeting_id::text,jsonb_build_object('registrationOpen',v_before),jsonb_build_object('registrationOpen',p_open));
end; $$;

create or replace function public.save_project_registration_template(p_meeting_id uuid,p_template_name text,p_template jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_before jsonb; v_actor text;
begin
  if not (public.is_system_admin() or public.meeting_role(p_meeting_id) in ('ops','client')) then raise exception '无权设置报名模板'; end if;
  if jsonb_typeof(p_template->'columns')<>'array' or jsonb_array_length(p_template->'columns')<2 then raise exception '报名模板至少需要两个字段'; end if;
  select registration_template into v_before from public.meetings where id=p_meeting_id for update;
  perform set_config('app.registration_config_rpc','on',true);
  update public.meetings set template_name=nullif(trim(p_template_name),''),registration_template=p_template,template_imported_at=now() where id=p_meeting_id;
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor from public.profiles p left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=p_meeting_id where p.user_id=auth.uid();
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'系统'),'registration_template_saved','meeting',p_meeting_id::text,v_before,p_template);
end; $$;

create or replace function public.remove_project_registration_template(p_meeting_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_open boolean; v_before jsonb; v_actor text;
begin
  if not (public.is_system_admin() or public.meeting_role(p_meeting_id) in ('ops','client')) then raise exception '无权删除报名模板'; end if;
  select registration_open,registration_template into v_open,v_before from public.meetings where id=p_meeting_id for update;
  if v_open then raise exception '请先关闭报名开关，再删除模板'; end if;
  perform set_config('app.registration_config_rpc','on',true);
  update public.meetings set template_name=null,registration_template='{}'::jsonb,template_imported_at=null where id=p_meeting_id;
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor from public.profiles p left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=p_meeting_id where p.user_id=auth.uid();
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'系统'),'registration_template_removed','meeting',p_meeting_id::text,v_before,'{}'::jsonb);
end; $$;

create or replace function public.set_manager_attendee_edit(p_meeting_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_before boolean; v_actor text;
begin
  if not (public.is_system_admin() or public.can_manage_project(p_meeting_id)) then raise exception '仅项目负责人或超级管理员可设置编辑权限'; end if;
  select manager_attendee_edit_enabled into v_before from public.meetings where id=p_meeting_id for update;
  perform set_config('app.registration_config_rpc','on',true);
  update public.meetings set manager_attendee_edit_enabled=p_enabled where id=p_meeting_id;
  select coalesce(display_name,'系统') into v_actor from public.profiles where user_id=auth.uid();
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'系统'),'manager_edit_permission_changed','meeting',p_meeting_id::text,jsonb_build_object('enabled',v_before),jsonb_build_object('enabled',p_enabled));
end; $$;

create or replace function public.transfer_registrant_attendees(p_meeting_id uuid,p_from_registrant uuid,p_to_registrant uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer; v_from text; v_to text; v_actor text;
begin
  if not (public.is_system_admin() or public.meeting_role(p_meeting_id) in ('ops','client')) then raise exception '无权执行填报人移交'; end if;
  if p_from_registrant=p_to_registrant then raise exception '新旧填报人不能相同'; end if;
  select display_name||'（'||employee_no||'）' into v_from from public.registrants where id=p_from_registrant and meeting_id=p_meeting_id;
  select display_name||'（'||employee_no||'）' into v_to from public.registrants where id=p_to_registrant and meeting_id=p_meeting_id and active;
  if v_from is null or v_to is null then raise exception '填报人不存在或已停用'; end if;
  perform set_config('app.registrant_transfer','on',true);
  update public.attendees set registrant_id=p_to_registrant where meeting_id=p_meeting_id and registrant_id=p_from_registrant;
  get diagnostics v_count=row_count;
  select coalesce(display_name,'系统') into v_actor from public.profiles where user_id=auth.uid();
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data,metadata)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'系统'),'registrant_transferred','registrant',p_from_registrant::text,jsonb_build_object('registrantId',p_from_registrant,'label',v_from),jsonb_build_object('registrantId',p_to_registrant,'label',v_to),jsonb_build_object('attendeeCount',v_count));
  return v_count;
end; $$;

grant execute on function public.project_management_open(uuid) to authenticated;
grant execute on function public.can_edit_attendee_records(uuid) to authenticated;
grant execute on function public.set_registration_open(uuid,boolean) to authenticated;
grant execute on function public.save_project_registration_template(uuid,text,jsonb) to authenticated;
grant execute on function public.remove_project_registration_template(uuid) to authenticated;
grant execute on function public.set_manager_attendee_edit(uuid,boolean) to authenticated;
grant execute on function public.transfer_registrant_attendees(uuid,uuid,uuid) to authenticated;
