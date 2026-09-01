-- Canonical city / transport / station fields. Existing Excel columns and
-- legacy out_* fields remain for compatibility with approvals and exports.
alter table public.attendees add column if not exists depart_date date;
alter table public.attendees add column if not exists depart_city text;
alter table public.attendees add column if not exists depart_transport_type text;
alter table public.attendees add column if not exists depart_station text;
alter table public.attendees add column if not exists arrive_date date;
alter table public.attendees add column if not exists arrive_city text;
alter table public.attendees add column if not exists arrive_transport_type text;
alter table public.attendees add column if not exists arrive_station text;

-- Technical backfill must not create attendee change reminders or audit noise.
alter table public.attendees disable trigger attendees_audit_change;
update public.attendees set
  depart_date=coalesce(depart_date,out_date),
  depart_transport_type=coalesce(depart_transport_type,case when coalesce(out_no,'') ilike '%本地参会%' then 'LOCAL_ATTEND' when coalesce(is_flight,false) then 'PLANE' else 'HIGH_SPEED_RAIL' end),
  depart_city=coalesce(nullif(depart_city,''),regexp_replace(regexp_replace(coalesce(out_from,''),'国际机场.*$|机场.*$','','g'),'火车站$|高铁站$|站$','','g')),
  depart_station=case when coalesce(depart_transport_type,case when coalesce(out_no,'') ilike '%本地参会%' then 'LOCAL_ATTEND' when coalesce(is_flight,false) then 'PLANE' else 'HIGH_SPEED_RAIL' end)='LOCAL_ATTEND' then null else coalesce(nullif(depart_station,''),nullif(out_from,'')) end,
  arrive_date=coalesce(arrive_date,out_date),
  arrive_transport_type=coalesce(arrive_transport_type,case when coalesce(out_no,'') ilike '%本地参会%' then 'LOCAL_ATTEND' when coalesce(is_flight,false) then 'PLANE' else 'HIGH_SPEED_RAIL' end),
  arrive_city=coalesce(nullif(arrive_city,''),regexp_replace(regexp_replace(coalesce(out_to,''),'国际机场.*$|机场.*$','','g'),'火车站$|高铁站$|站$','','g')),
  arrive_station=case when coalesce(arrive_transport_type,case when coalesce(out_no,'') ilike '%本地参会%' then 'LOCAL_ATTEND' when coalesce(is_flight,false) then 'PLANE' else 'HIGH_SPEED_RAIL' end)='LOCAL_ATTEND' then null else coalesce(nullif(arrive_station,''),nullif(out_to,'')) end;
alter table public.attendees enable trigger attendees_audit_change;

alter table public.attendees drop constraint if exists attendees_depart_transport_type_check;
alter table public.attendees add constraint attendees_depart_transport_type_check check (depart_transport_type is null or depart_transport_type in ('PLANE','HIGH_SPEED_RAIL','LOCAL_ATTEND'));
alter table public.attendees drop constraint if exists attendees_arrive_transport_type_check;
alter table public.attendees add constraint attendees_arrive_transport_type_check check (arrive_transport_type is null or arrive_transport_type in ('PLANE','HIGH_SPEED_RAIL','LOCAL_ATTEND'));
alter table public.attendees drop constraint if exists attendees_local_depart_station_check;
alter table public.attendees add constraint attendees_local_depart_station_check check (depart_transport_type is distinct from 'LOCAL_ATTEND' or depart_station is null);
alter table public.attendees drop constraint if exists attendees_local_arrive_station_check;
alter table public.attendees add constraint attendees_local_arrive_station_check check (arrive_transport_type is distinct from 'LOCAL_ATTEND' or arrive_station is null);

create or replace function public.guard_attendee_update()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_meeting public.meetings%rowtype;
  v_role public.app_role;
  v_transfer boolean := coalesce(current_setting('app.registrant_transfer',true),'')='on';
  v_locked text[];
begin
  select * into v_meeting from public.meetings where id=old.meeting_id;
  v_role := public.meeting_role(old.meeting_id);
  select coalesce(array_agg(field_group),array[]::text[]) into v_locked from public.column_locks where meeting_id=old.meeting_id and locked;
  if not public.is_system_admin() and not v_transfer then
    if v_role in ('ops','client') and not v_meeting.manager_attendee_edit_enabled then raise exception '管理员当前仅有查看权限，请先开启管理员编辑权限'; end if;
    if v_role='sales' and old.owner_id<>auth.uid() then raise exception '无权修改其他填报人的参会者'; end if;
    if (v_meeting.master_locked or old.row_locked) and (to_jsonb(new)-array['updated_at']) is distinct from (to_jsonb(old)-array['updated_at']) then raise exception '名单已锁定，不能修改'; end if;
    if 'identity'=any(v_locked) and row(new.name,new.city,new.hospital,new.department,new.title,new.venue,new.sex,new.id_number,new.hcp_id) is distinct from row(old.name,old.city,old.hospital,old.department,old.title,old.venue,old.sex,old.id_number,old.hcp_id) then raise exception '身份与证件整列已锁定'; end if;
    if 'contact'=any(v_locked) and row(new.phone,new.contact_name,new.contact_mobile) is distinct from row(old.phone,old.contact_name,old.contact_mobile) then raise exception '联系方式整列已锁定'; end if;
    if 'outbound'=any(v_locked) and row(new.depart_date,new.depart_city,new.depart_transport_type,new.depart_station,new.arrive_date,new.arrive_city,new.arrive_transport_type,new.arrive_station,new.out_date,new.out_from,new.out_to,new.out_no,new.out_departure,new.out_arrival) is distinct from row(old.depart_date,old.depart_city,old.depart_transport_type,old.depart_station,old.arrive_date,old.arrive_city,old.arrive_transport_type,old.arrive_station,old.out_date,old.out_from,old.out_to,old.out_no,old.out_departure,old.out_arrival) then raise exception '去程整列已锁定'; end if;
    if 'return'=any(v_locked) and row(new.return_date,new.return_from,new.return_to,new.return_no,new.return_departure,new.return_arrival) is distinct from row(old.return_date,old.return_from,old.return_to,old.return_no,old.return_departure,old.return_arrival) then raise exception '返程整列已锁定'; end if;
    if 'accommodation'=any(v_locked) and row(new.accommodation,new.custom_fields) is distinct from row(old.accommodation,old.custom_fields) then raise exception '住宿整列已锁定'; end if;
    if 'remarks'=any(v_locked) and new.remarks is distinct from old.remarks then raise exception '备注整列已锁定'; end if;
    if v_role='sales' and (new.owner_id<>old.owner_id or new.registrant_id is distinct from old.registrant_id or new.approval<>old.approval or new.row_locked<>old.row_locked) then raise exception '无权修改负责人、填报绑定、审批或锁定状态'; end if;
  end if;
  if new.depart_transport_type='LOCAL_ATTEND' then new.depart_station:=null; end if;
  if new.arrive_transport_type='LOCAL_ATTEND' then new.arrive_station:=null; end if;
  return new;
end; $$;

notify pgrst, 'reload schema';

-- Add readable audit labels without changing the generic old/new capture.
create or replace function public.journey_field_label(p_field text)
returns text language sql immutable as $$select case p_field
  when 'depart_date' then '出发日期' when 'depart_city' then '出发城市'
  when 'depart_transport_type' then '出发出行方式' when 'depart_station' then '出发场站'
  when 'arrive_date' then '抵达日期' when 'arrive_city' then '抵达城市'
  when 'arrive_transport_type' then '抵达出行方式' when 'arrive_station' then '抵达场站'
  else p_field end$$;

comment on column public.attendees.depart_station is 'Standard official station/airport name; null for LOCAL_ATTEND';
comment on column public.attendees.arrive_station is 'Standard official station/airport name; null for LOCAL_ATTEND';

create or replace function public.audit_attendee_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
  v_action text;
  v_changes jsonb := '[]'::jsonb;
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_labels jsonb := jsonb_build_object(
    'name','姓名','city','城市','hospital','医院/连锁','department','科室/门店','title','职称',
    'venue','会场','sex','性别','id_number','身份证号/护照号','phone','手机号','hcp_id','客户编号',
    'accommodation','住宿需求','depart_date','出发日期','depart_city','出发城市',
    'depart_transport_type','出发出行方式','depart_station','出发场站','arrive_date','抵达日期',
    'arrive_city','抵达城市','arrive_transport_type','抵达出行方式','arrive_station','抵达场站','out_date','去程日期','out_from','去程出发城市','out_to','去程到达城市',
    'out_no','去程航班/车次','out_departure','去程出发时间','out_arrival','去程到达时间',
    'return_date','返程日期','return_from','返程出发城市','return_to','返程到达城市',
    'return_no','返程航班/车次','return_departure','返程出发时间','return_arrival','返程到达时间',
    'region','大区','remarks','备注','custom_fields','分房/扩展信息','privacy_letter_status','隐私沟通函',
    'ticket_status','出票状态','outbound_approval_status','去程审批','return_approval_status','返程审批',
    'business_status','报名状态','registrant_id','填报人','row_locked','整行锁定'
  );
begin
  select display_name into v_actor_name from public.profiles where user_id = auth.uid() limit 1;
  v_actor_name := coalesce(v_actor_name, '系统');
  v_action := case when tg_op = 'INSERT' then 'create'
                   when new.business_status = 'cancelled' and old.business_status is distinct from new.business_status then 'cancel'
                   else 'change' end;
  v_new := to_jsonb(new);
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;

  for v_key in select key from jsonb_each(v_new)
  loop
    if v_key not in ('updated_at','created_at','risks','approval')
       and (tg_op = 'INSERT' or v_old -> v_key is distinct from v_new -> v_key) then
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'field', v_key,
        'label', coalesce(v_labels ->> v_key, v_key),
        'before', case when tg_op = 'INSERT' then null else v_old -> v_key end,
        'after', v_new -> v_key
      ));
    end if;
  end loop;

  insert into public.change_logs(meeting_id, attendee_id, actor_id, action, changes)
  values (new.meeting_id, new.id, auth.uid(), v_action, v_changes);

  insert into public.operation_audit_logs(meeting_id,attendee_id,actor_user_id,actor_registrant_id,actor_label,action,target_type,target_id,before_data,after_data)
  values(new.meeting_id,new.id,auth.uid(),new.registrant_id,v_actor_name,v_action,'attendee',new.id::text,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));

  if new.business_status is distinct from 'cancelled' and v_action <> 'cancel' then
    insert into public.notifications(meeting_id, recipient_id, type, message)
    values (
      new.meeting_id, null, v_action,
      v_actor_name || case when v_action = 'create' then '新增报名：' else '更新了' end ||
      new.name || case when jsonb_array_length(v_changes) > 0 then '（' || jsonb_array_length(v_changes) || '项变更）' else '' end
    );
  end if;
  return new;
end; $$;
