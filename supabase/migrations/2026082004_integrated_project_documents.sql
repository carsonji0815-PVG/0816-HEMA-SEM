-- Unified project metadata shared by Journey Desk and the Alibaba document service.

alter table public.meetings add column if not exists activity_type text not null default 'external';
alter table public.meetings add column if not exists project_identifier text;
alter table public.meetings add column if not exists activity_owner text;
alter table public.meetings add column if not exists activity_date date;

update public.meetings
set project_identifier = coalesce(nullif(project_identifier, ''), slug),
    activity_owner = coalesce(nullif(activity_owner, ''), client_name, '待补充'),
    activity_date = coalesce(activity_date, start_date, current_date)
where project_identifier is null or activity_owner is null or activity_date is null;

alter table public.meetings drop constraint if exists meetings_activity_type_check;
alter table public.meetings add constraint meetings_activity_type_check check (activity_type in ('internal','external'));

drop function if exists public.create_meeting_project(text,text,uuid);

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
    if public.meeting_role(p_source_id) not in ('ops','client') then raise exception '无权复制该项目'; end if;
    select * into v_source from public.meetings where id=p_source_id;
  end if;
  insert into public.meetings(
    slug,name,activity_type,project_identifier,activity_owner,activity_date,
    deadline,capacity,allowed_departure_cities,check_city_mismatch,check_departure_city,
    client_name,start_date,end_date,venues,service_phone,brand_color,auth_mode,
    flight_lead_minutes,train_lead_minutes,field_config,template_name,registration_template
  ) values(
    lower(trim(p_slug)),trim(p_name),p_activity_type,trim(p_identifier),trim(p_activity_owner),p_activity_date,
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

grant execute on function public.create_meeting_project(text,text,text,text,text,date,uuid) to authenticated;
