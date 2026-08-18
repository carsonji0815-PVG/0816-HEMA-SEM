-- Multi-project upgrade for Journey Desk

alter table public.meetings add column if not exists client_name text;
alter table public.meetings add column if not exists start_date date;
alter table public.meetings add column if not exists end_date date;
alter table public.meetings add column if not exists venues text[] not null default '{}';
alter table public.meetings add column if not exists service_phone text;
alter table public.meetings add column if not exists brand_color text not null default '#205d43';
alter table public.meetings add column if not exists auth_mode text not null default 'region_name_phone';
alter table public.meetings add column if not exists flight_lead_minutes integer not null default 120;
alter table public.meetings add column if not exists train_lead_minutes integer not null default 90;
alter table public.meetings add column if not exists field_config jsonb not null default '{"title":true,"hcpId":true,"accommodation":true,"flight":true,"mslContact":true,"remarks":true}'::jsonb;

create table if not exists public.meeting_members (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  role public.app_role not null default 'sales',
  created_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

insert into public.meeting_members(meeting_id,user_id,display_name,phone,role)
select meeting_id,user_id,display_name,phone,role from public.profiles
on conflict (meeting_id,user_id) do update set display_name=excluded.display_name,phone=excluded.phone,role=excluded.role;

alter table public.meeting_members enable row level security;

create or replace function public.is_meeting_member(target_meeting uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.meeting_members mm where mm.meeting_id=target_meeting and mm.user_id=auth.uid()) $$;

create or replace function public.meeting_role(target_meeting uuid)
returns public.app_role language sql stable security definer set search_path=public
as $$ select role from public.meeting_members where meeting_id=target_meeting and user_id=auth.uid() $$;

drop policy if exists "members read memberships" on public.meeting_members;
create policy "members read memberships" on public.meeting_members for select to authenticated
using (public.is_meeting_member(meeting_id));

drop policy if exists "managers manage memberships" on public.meeting_members;
create policy "managers manage memberships" on public.meeting_members for all to authenticated
using (public.meeting_role(meeting_id) in ('ops','client'))
with check (public.meeting_role(meeting_id) in ('ops','client'));

drop policy if exists "meeting members read meeting" on public.meetings;
create policy "meeting members read meeting" on public.meetings for select to authenticated
using (public.is_meeting_member(id));

drop policy if exists "managers update meeting" on public.meetings;
create policy "managers update meeting" on public.meetings for update to authenticated
using (public.meeting_role(id) in ('ops','client'))
with check (public.meeting_role(id) in ('ops','client'));

drop policy if exists "role scoped attendee read" on public.attendees;
create policy "role scoped attendee read" on public.attendees for select to authenticated
using (public.is_meeting_member(meeting_id) and (public.meeting_role(meeting_id) in ('ops','client') or owner_id=auth.uid()));

drop policy if exists "role scoped attendee insert" on public.attendees;
create policy "role scoped attendee insert" on public.attendees for insert to authenticated
with check (public.is_meeting_member(meeting_id) and not exists(select 1 from public.meetings m where m.id=meeting_id and m.master_locked) and (public.meeting_role(meeting_id) in ('ops','client') or owner_id=auth.uid()));

drop policy if exists "role scoped attendee update" on public.attendees;
create policy "role scoped attendee update" on public.attendees for update to authenticated
using (public.is_meeting_member(meeting_id) and (public.meeting_role(meeting_id) in ('ops','client') or owner_id=auth.uid()))
with check (public.is_meeting_member(meeting_id) and (public.meeting_role(meeting_id) in ('ops','client') or owner_id=auth.uid()));

drop policy if exists "role scoped transport read" on public.transports;
create policy "role scoped transport read" on public.transports for select to authenticated
using (exists(select 1 from public.attendees a where a.id=attendee_id and public.is_meeting_member(a.meeting_id) and (public.meeting_role(a.meeting_id) in ('ops','client') or a.owner_id=auth.uid())));

drop policy if exists "managers manage transport" on public.transports;
create policy "managers manage transport" on public.transports for all to authenticated
using (exists(select 1 from public.attendees a where a.id=attendee_id and public.meeting_role(a.meeting_id) in ('ops','client')))
with check (exists(select 1 from public.attendees a where a.id=attendee_id and public.meeting_role(a.meeting_id) in ('ops','client')));

drop policy if exists "meeting members read locks" on public.column_locks;
create policy "meeting members read locks" on public.column_locks for select to authenticated using (public.is_meeting_member(meeting_id));
drop policy if exists "managers manage locks" on public.column_locks;
create policy "managers manage locks" on public.column_locks for all to authenticated
using (public.meeting_role(meeting_id) in ('ops','client')) with check (public.meeting_role(meeting_id) in ('ops','client'));

drop policy if exists "meeting members read logs" on public.change_logs;
create policy "meeting members read logs" on public.change_logs for select to authenticated
using (public.is_meeting_member(meeting_id) and (public.meeting_role(meeting_id) in ('ops','client') or actor_id=auth.uid()));
drop policy if exists "members create logs" on public.change_logs;
create policy "members create logs" on public.change_logs for insert to authenticated
with check (public.is_meeting_member(meeting_id) and actor_id=auth.uid());

drop policy if exists "recipient reads notifications" on public.notifications;
create policy "recipient reads notifications" on public.notifications for select to authenticated
using (public.is_meeting_member(meeting_id) and (recipient_id=auth.uid() or (recipient_id is null and public.meeting_role(meeting_id) in ('ops','client'))));
drop policy if exists "recipient updates notifications" on public.notifications;
create policy "recipient updates notifications" on public.notifications for update to authenticated
using (public.is_meeting_member(meeting_id) and (recipient_id=auth.uid() or (recipient_id is null and public.meeting_role(meeting_id) in ('ops','client'))))
with check (public.is_meeting_member(meeting_id));

create or replace function public.create_meeting_project(
  p_name text,
  p_slug text,
  p_source_id uuid default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_id uuid;
  v_profile public.profiles%rowtype;
  v_source public.meetings%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_profile from public.profiles where user_id=auth.uid();
  if v_profile.user_id is null then raise exception '账号资料不存在'; end if;
  if p_source_id is not null then
    if public.meeting_role(p_source_id) not in ('ops','client') then raise exception '无权复制该项目'; end if;
    select * into v_source from public.meetings where id=p_source_id;
  end if;
  insert into public.meetings(slug,name,deadline,capacity,allowed_departure_cities,check_city_mismatch,check_departure_city,client_name,start_date,end_date,venues,service_phone,brand_color,auth_mode,flight_lead_minutes,train_lead_minutes,field_config)
  values(lower(trim(p_slug)),trim(p_name),case when p_source_id is null then null else v_source.deadline end,coalesce(v_source.capacity,120),coalesce(v_source.allowed_departure_cities,'{}'),coalesce(v_source.check_city_mismatch,true),coalesce(v_source.check_departure_city,true),v_source.client_name,v_source.start_date,v_source.end_date,coalesce(v_source.venues,'{}'),v_source.service_phone,coalesce(v_source.brand_color,'#205d43'),coalesce(v_source.auth_mode,'region_name_phone'),coalesce(v_source.flight_lead_minutes,120),coalesce(v_source.train_lead_minutes,90),coalesce(v_source.field_config,'{}'::jsonb))
  returning id into v_id;
  insert into public.meeting_members(meeting_id,user_id,display_name,phone,role) values(v_id,auth.uid(),v_profile.display_name,v_profile.phone,'ops');
  if p_source_id is not null then
    insert into public.column_locks(meeting_id,field_group,locked,updated_by)
    select v_id,field_group,locked,auth.uid() from public.column_locks where meeting_id=p_source_id;
  end if;
  return v_id;
end; $$;

grant execute on function public.create_meeting_project(text,text,uuid) to authenticated;

create or replace function public.guard_attendee_update()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_meeting_locked boolean; v_role public.app_role;
begin
  select master_locked into v_meeting_locked from public.meetings where id=old.meeting_id;
  v_role := public.meeting_role(old.meeting_id);
  if (v_meeting_locked or old.row_locked) and (to_jsonb(new)-array['updated_at','row_locked']) is distinct from (to_jsonb(old)-array['updated_at','row_locked']) then raise exception '名单已锁定，不能修改'; end if;
  if v_role='sales' and old.owner_id<>auth.uid() then raise exception '无权修改其他负责人的参会者'; end if;
  if v_role='sales' and (new.owner_id<>old.owner_id or new.approval<>old.approval or new.row_locked<>old.row_locked) then raise exception '销售无权修改负责人、审批状态或锁定状态'; end if;
  if v_role='sales' and exists(select 1 from public.column_locks where meeting_id=old.meeting_id and field_group='identity' and locked) and row(new.name,new.sex,new.id_number,new.hcp_id,new.hospital,new.department) is distinct from row(old.name,old.sex,old.id_number,old.hcp_id,old.hospital,old.department) then raise exception '身份与证件字段已锁定'; end if;
  if v_role='sales' and exists(select 1 from public.column_locks where meeting_id=old.meeting_id and field_group='contact' and locked) and new.phone is distinct from old.phone then raise exception '手机号字段已锁定'; end if;
  if v_role='sales' and exists(select 1 from public.column_locks where meeting_id=old.meeting_id and field_group='outbound' and locked) and row(new.out_date,new.out_from,new.out_to,new.out_no,new.out_departure,new.out_arrival) is distinct from row(old.out_date,old.out_from,old.out_to,old.out_no,old.out_departure,old.out_arrival) then raise exception '去程字段已锁定'; end if;
  if v_role='sales' and exists(select 1 from public.column_locks where meeting_id=old.meeting_id and field_group='return' and locked) and row(new.return_date,new.return_from,new.return_to,new.return_no,new.return_departure,new.return_arrival) is distinct from row(old.return_date,old.return_from,old.return_to,old.return_no,old.return_departure,old.return_arrival) then raise exception '返程字段已锁定'; end if;
  return new;
end; $$;
