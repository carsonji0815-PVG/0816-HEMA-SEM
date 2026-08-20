-- Project-specific registration templates, batch transport and roster progress

alter table public.meetings add column if not exists template_name text;
alter table public.meetings add column if not exists registration_template jsonb not null default '{}'::jsonb;

alter table public.attendees add column if not exists custom_fields jsonb not null default '{}'::jsonb;
alter table public.attendees add column if not exists privacy_letter_status text not null default 'pending';
alter table public.attendees add column if not exists ticket_status text not null default 'pending';

alter table public.transports add column if not exists staff_name text;
alter table public.transports add column if not exists service_mode text;
alter table public.transports add column if not exists batch_id uuid;
alter table public.transports add column if not exists batch_name text;
alter table public.transports add column if not exists terminal text;
alter table public.transports add column if not exists placard text;
alter table public.transports add column if not exists capacity integer;
alter table public.transports add column if not exists notes text;
alter table public.transports add column if not exists time_strategy text;

create or replace function public.audit_attendee_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_actor_name text;
  v_message text;
  v_changes text[] := '{}';
begin
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor_name
  from public.profiles p
  left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=new.meeting_id
  where p.user_id=auth.uid();
  v_actor_name := coalesce(v_actor_name,'系统');
  if tg_op='INSERT' then
    v_message := v_actor_name || '新增报名：' || new.name;
  else
    if old.out_from is distinct from new.out_from then v_changes:=array_append(v_changes,'去程出发城市：'||coalesce(old.out_from,'空')||' → '||coalesce(new.out_from,'空')); end if;
    if old.out_to is distinct from new.out_to then v_changes:=array_append(v_changes,'去程到达城市：'||coalesce(old.out_to,'空')||' → '||coalesce(new.out_to,'空')); end if;
    if old.out_no is distinct from new.out_no then v_changes:=array_append(v_changes,'去程航班/车次：'||coalesce(old.out_no,'空')||' → '||coalesce(new.out_no,'空')); end if;
    if old.return_from is distinct from new.return_from then v_changes:=array_append(v_changes,'返程出发城市：'||coalesce(old.return_from,'空')||' → '||coalesce(new.return_from,'空')); end if;
    if old.return_to is distinct from new.return_to then v_changes:=array_append(v_changes,'返程到达城市：'||coalesce(old.return_to,'空')||' → '||coalesce(new.return_to,'空')); end if;
    if old.return_no is distinct from new.return_no then v_changes:=array_append(v_changes,'返程航班/车次：'||coalesce(old.return_no,'空')||' → '||coalesce(new.return_no,'空')); end if;
    if old.privacy_letter_status is distinct from new.privacy_letter_status then v_changes:=array_append(v_changes,'隐私沟通函：'||old.privacy_letter_status||' → '||new.privacy_letter_status); end if;
    if old.ticket_status is distinct from new.ticket_status then v_changes:=array_append(v_changes,'出票状态：'||old.ticket_status||' → '||new.ticket_status); end if;
    if old.name is distinct from new.name then v_changes:=array_append(v_changes,'姓名：'||old.name||' → '||new.name); end if;
    if old.phone is distinct from new.phone then v_changes:=array_append(v_changes,'手机号：'||old.phone||' → '||new.phone); end if;
    if old.venue is distinct from new.venue then v_changes:=array_append(v_changes,'会场：'||coalesce(old.venue,'空')||' → '||coalesce(new.venue,'空')); end if;
    if old.custom_fields is distinct from new.custom_fields then v_changes:=array_append(v_changes,'项目补充字段已更新'); end if;
    v_message := v_actor_name || '变更了' || new.name || '：' || coalesce(array_to_string(v_changes,'；'),'报名资料已更新');
  end if;
  insert into public.change_logs(meeting_id,attendee_id,actor_id,action,changes)
  values(new.meeting_id,new.id,auth.uid(),case when tg_op='INSERT' then 'create' else 'change' end,jsonb_build_object('details',v_changes));
  insert into public.notifications(meeting_id,recipient_id,type,message)
  values(new.meeting_id,null,case when tg_op='INSERT' then 'create' else 'change' end,v_message);
  return new;
end; $$;

create or replace function public.create_meeting_project(p_name text,p_slug text,p_source_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_profile public.profiles%rowtype; v_source public.meetings%rowtype;
begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into v_profile from public.profiles where user_id=auth.uid();
  if v_profile.user_id is null then raise exception '账号资料不存在'; end if;
  if p_source_id is not null then
    if public.meeting_role(p_source_id) not in ('ops','client') then raise exception '无权复制该项目'; end if;
    select * into v_source from public.meetings where id=p_source_id;
  end if;
  insert into public.meetings(slug,name,deadline,capacity,allowed_departure_cities,check_city_mismatch,check_departure_city,client_name,start_date,end_date,venues,service_phone,brand_color,auth_mode,flight_lead_minutes,train_lead_minutes,field_config,template_name,registration_template)
  values(lower(trim(p_slug)),trim(p_name),case when p_source_id is null then null else v_source.deadline end,coalesce(v_source.capacity,120),coalesce(v_source.allowed_departure_cities,'{}'),coalesce(v_source.check_city_mismatch,true),coalesce(v_source.check_departure_city,true),v_source.client_name,v_source.start_date,v_source.end_date,coalesce(v_source.venues,'{}'),v_source.service_phone,coalesce(v_source.brand_color,'#5267d9'),coalesce(v_source.auth_mode,'region_name_phone'),coalesce(v_source.flight_lead_minutes,120),coalesce(v_source.train_lead_minutes,90),coalesce(v_source.field_config,'{}'::jsonb),v_source.template_name,coalesce(v_source.registration_template,'{}'::jsonb))
  returning id into v_id;
  insert into public.meeting_members(meeting_id,user_id,display_name,phone,role) values(v_id,auth.uid(),v_profile.display_name,v_profile.phone,'ops');
  if p_source_id is not null then insert into public.column_locks(meeting_id,field_group,locked,updated_by) select v_id,field_group,locked,auth.uid() from public.column_locks where meeting_id=p_source_id; end if;
  return v_id;
end; $$;

grant execute on function public.create_meeting_project(text,text,uuid) to authenticated;
