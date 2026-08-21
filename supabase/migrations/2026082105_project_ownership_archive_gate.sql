-- Project ownership, system administrator access, editable/deletable projects,
-- and the archive prerequisite used to unlock registration workflows.

alter table public.meetings add column if not exists owner_user_id uuid references auth.users(id) on delete restrict;
alter table public.meetings add column if not exists archive_ready boolean not null default false;

update public.meetings m
set owner_user_id = (
  select mm.user_id
  from public.meeting_members mm
  where mm.meeting_id = m.id and mm.role = 'ops'
  order by mm.created_at asc
  limit 1
)
where m.owner_user_id is null;

create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.profiles p
    where p.user_id=auth.uid()
      and upper(regexp_replace(trim(p.display_name),'\s+','','g')) in ('季亮亮','JLL')
  )
$$;

create or replace function public.can_manage_project(target_meeting uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select public.is_system_admin() or exists(
    select 1 from public.meetings m
    where m.id=target_meeting and m.owner_user_id=auth.uid()
  )
$$;

create or replace function public.is_meeting_member(target_meeting uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select public.can_manage_project(target_meeting) $$;

create or replace function public.meeting_role(target_meeting uuid)
returns public.app_role language sql stable security definer set search_path=public
as $$ select case when public.can_manage_project(target_meeting) then 'ops'::public.app_role else null end $$;

drop policy if exists "meeting members read meeting" on public.meetings;
create policy "project owners read meeting" on public.meetings for select to authenticated
using (public.can_manage_project(id));

drop policy if exists "managers update meeting" on public.meetings;
create policy "project owners update meeting" on public.meetings for update to authenticated
using (public.can_manage_project(id)) with check (public.can_manage_project(id));

drop policy if exists "project owners delete meeting" on public.meetings;
create policy "project owners delete meeting" on public.meetings for delete to authenticated
using (public.can_manage_project(id));

drop policy if exists "role scoped attendee insert" on public.attendees;
create policy "archive ready attendee insert" on public.attendees for insert to authenticated
with check (
  public.can_manage_project(meeting_id)
  and exists(select 1 from public.meetings m where m.id=meeting_id and m.archive_ready and not m.master_locked)
);

create or replace function public.create_meeting_project(
  p_name text,
  p_slug text,
  p_activity_type text,
  p_identifier text,
  p_activity_owner text,
  p_activity_date date,
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
  if p_activity_type not in ('internal','external') then raise exception '活动类型不正确'; end if;
  if nullif(trim(p_identifier),'') is null or nullif(trim(p_activity_owner),'') is null or p_activity_date is null then raise exception '请完整填写项目基本资料'; end if;
  if p_source_id is not null then
    if not public.can_manage_project(p_source_id) then raise exception '无权复制该项目'; end if;
    select * into v_source from public.meetings where id=p_source_id;
  end if;
  insert into public.meetings(
    slug,name,owner_user_id,archive_ready,activity_type,project_identifier,activity_owner,activity_date,
    deadline,capacity,allowed_departure_cities,check_city_mismatch,check_departure_city,
    client_name,start_date,end_date,venues,service_phone,brand_color,auth_mode,
    flight_lead_minutes,train_lead_minutes,field_config,template_name,registration_template
  ) values(
    lower(trim(p_slug)),trim(p_name),auth.uid(),false,p_activity_type,trim(p_identifier),trim(p_activity_owner),p_activity_date,
    case when p_source_id is null then null else v_source.deadline end,
    coalesce(v_source.capacity,120),coalesce(v_source.allowed_departure_cities,'{}'),
    coalesce(v_source.check_city_mismatch,true),coalesce(v_source.check_departure_city,true),
    v_source.client_name,coalesce(v_source.start_date,p_activity_date),coalesce(v_source.end_date,p_activity_date),
    coalesce(v_source.venues,'{}'),v_source.service_phone,coalesce(v_source.brand_color,'#5267d9'),
    coalesce(v_source.auth_mode,'region_name_phone'),coalesce(v_source.flight_lead_minutes,120),
    coalesce(v_source.train_lead_minutes,90),coalesce(v_source.field_config,'{}'::jsonb),
    v_source.template_name,coalesce(v_source.registration_template,'{}'::jsonb)
  ) returning id into v_id;
  insert into public.meeting_members(meeting_id,user_id,display_name,phone,role)
  values(v_id,auth.uid(),v_profile.display_name,v_profile.phone,'ops');
  if p_source_id is not null then
    insert into public.column_locks(meeting_id,field_group,locked,updated_by)
    select v_id,field_group,locked,auth.uid() from public.column_locks where meeting_id=p_source_id;
  end if;
  return v_id;
end; $$;

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
begin
  if not public.can_manage_project(p_id) then raise exception '无权编辑该项目'; end if;
  if p_activity_type not in ('internal','external') or nullif(trim(p_name),'') is null
     or nullif(trim(p_slug),'') is null or nullif(trim(p_identifier),'') is null
     or nullif(trim(p_activity_owner),'') is null or p_activity_date is null then
    raise exception '请完整填写项目基本资料';
  end if;
  update public.meetings set
    name=trim(p_name), slug=lower(trim(p_slug)), activity_type=p_activity_type,
    project_identifier=trim(p_identifier), activity_owner=trim(p_activity_owner),
    activity_date=p_activity_date, start_date=coalesce(start_date,p_activity_date),
    end_date=coalesce(end_date,p_activity_date)
  where id=p_id;
end; $$;

create or replace function public.delete_meeting_project(p_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.can_manage_project(p_id) then raise exception '无权删除该项目'; end if;
  delete from public.meetings where id=p_id;
end; $$;

grant execute on function public.is_system_admin() to authenticated;
grant execute on function public.can_manage_project(uuid) to authenticated;
grant execute on function public.create_meeting_project(text,text,text,text,text,date,uuid) to authenticated;
grant execute on function public.update_meeting_project(uuid,text,text,text,text,text,date) to authenticated;
grant execute on function public.delete_meeting_project(uuid) to authenticated;
