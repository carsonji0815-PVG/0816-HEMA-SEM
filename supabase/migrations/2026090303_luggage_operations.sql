-- Production luggage operations: meeting configuration, capacity, templates and audit-safe reset.
-- Keeps public.luggage_records as the canonical table for compatibility with existing offline terminals.
begin;

create table if not exists public.meeting_luggage_config (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  enable_luggage boolean not null default false,
  total_rows integer not null default 50 check (total_rows between 1 and 9999),
  per_row_max_position integer not null default 50 check (per_row_max_position between 1 and 9999),
  allow_multi_bag boolean not null default false,
  label_template jsonb not null default '{"paperWidth":80,"paperHeight":120,"margin":4,"fontSize":12,"fields":["barcode","position","name"]}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.meeting_luggage_config(meeting_id,enable_luggage)
select id,coalesce(luggage_enabled,false) from public.meetings
on conflict(meeting_id) do update set enable_luggage=excluded.enable_luggage;

alter table public.luggage_records add column if not exists bag_count integer not null default 1 check (bag_count between 1 and 99);
create unique index if not exists luggage_active_position_idx on public.luggage_records(meeting_id,storage_row,storage_slot) where status='寄存';

alter table public.meeting_luggage_config enable row level security;
drop policy if exists "luggage config project read" on public.meeting_luggage_config;
create policy "luggage config project read" on public.meeting_luggage_config for select to authenticated using(public.can_manage_project(meeting_id));
revoke all on public.meeting_luggage_config from anon,authenticated;
grant select on public.meeting_luggage_config to authenticated;

create or replace function public.luggage_config(p_meeting_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.meeting_luggage_config%rowtype; v_used integer;
begin
  if auth.uid() is null or not coalesce(public.can_manage_project(p_meeting_id),false) then raise exception '没有当前会议的行李管理权限'; end if;
  insert into public.meeting_luggage_config(meeting_id,enable_luggage)
    select id,coalesce(luggage_enabled,false) from public.meetings where id=p_meeting_id
    on conflict(meeting_id) do nothing;
  select * into v from public.meeting_luggage_config where meeting_id=p_meeting_id;
  select count(*) into v_used from public.luggage_records where meeting_id=p_meeting_id and status='寄存';
  return jsonb_build_object('meeting_id',v.meeting_id,'enable_luggage',v.enable_luggage,'total_rows',v.total_rows,
    'per_row_max_position',v.per_row_max_position,'allow_multi_bag',v.allow_multi_bag,'label_template',v.label_template,
    'used_positions',v_used,'capacity',v.total_rows*v.per_row_max_position,'remaining_positions',greatest(0,v.total_rows*v.per_row_max_position-v_used));
end $$;

create or replace function public.save_luggage_config(p_meeting_id uuid,p_config jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_rows integer; v_per integer; v_enabled boolean; v_multi boolean; v_template jsonb; v_used integer;
begin
  if auth.uid() is null or not coalesce(public.can_manage_project(p_meeting_id),false) then raise exception '没有当前会议的行李管理权限'; end if;
  v_rows:=coalesce((p_config->>'total_rows')::integer,50); v_per:=coalesce((p_config->>'per_row_max_position')::integer,50);
  v_enabled:=coalesce((p_config->>'enable_luggage')::boolean,false); v_multi:=coalesce((p_config->>'allow_multi_bag')::boolean,false);
  v_template:=coalesce(p_config->'label_template','{}'::jsonb);
  if v_rows not between 1 and 9999 or v_per not between 1 and 9999 then raise exception '库位参数必须为1至9999的整数'; end if;
  select count(*) into v_used from public.luggage_records where meeting_id=p_meeting_id and status='寄存';
  if v_rows*v_per<v_used then raise exception '新容量小于当前已占用库位，不能保存'; end if;
  if not v_enabled and v_used>0 then raise exception '仍有未领取行李，不能关闭行李寄存'; end if;
  insert into public.meeting_luggage_config(meeting_id,enable_luggage,total_rows,per_row_max_position,allow_multi_bag,label_template,updated_by,updated_at)
  values(p_meeting_id,v_enabled,v_rows,v_per,v_multi,v_template,auth.uid(),now())
  on conflict(meeting_id) do update set enable_luggage=excluded.enable_luggage,total_rows=excluded.total_rows,
    per_row_max_position=excluded.per_row_max_position,allow_multi_bag=excluded.allow_multi_bag,
    label_template=excluded.label_template,updated_by=auth.uid(),updated_at=now();
  update public.meetings set luggage_enabled=v_enabled,luggage_used=luggage_used or v_enabled where id=p_meeting_id;
  insert into public.luggage_audit_logs(meeting_id,action,actor_id) values(p_meeting_id,'config_update',auth.uid());
  return public.luggage_config(p_meeting_id);
end $$;

create or replace function public.reset_meeting_luggage(p_meeting_id uuid,p_confirmation text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not coalesce(public.is_system_admin(),false) then raise exception '仅超级管理员可重置库位'; end if;
  if p_confirmation is distinct from 'RESET LUGGAGE' then raise exception '重置确认文字不正确'; end if;
  insert into public.luggage_audit_logs(meeting_id,luggage_barcode,action,actor_id)
    select p_meeting_id,luggage_barcode,'reset_delete',auth.uid() from public.luggage_records where meeting_id=p_meeting_id;
  delete from public.luggage_records where meeting_id=p_meeting_id;
  insert into public.luggage_audit_logs(meeting_id,action,actor_id) values(p_meeting_id,'meeting_reset',auth.uid());
end $$;

-- Business-facing schema name requested by the luggage submodule. The existing table remains canonical
-- so already deployed offline clients and RPCs continue to work without a destructive migration.
create or replace view public.meeting_luggage_record as
select luggage_barcode as id,meeting_id,attendee_id,name as attendee_name,mobile as phone,storage_row as row_no,
 storage_slot as position_no,bag_count,status,operator_checkin as operator_create,checkin_time as create_time,
 operator_checkout as operator_fetch,checkout_time as fetch_time from public.luggage_records;

create or replace function public.set_meeting_luggage_enabled(p_meeting_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not coalesce(public.can_manage_project(p_meeting_id),false) then raise exception '没有当前会议的行李管理权限'; end if;
  if p_enabled is null then raise exception '开关值不能为空'; end if;
  perform 1 from public.meetings where id=p_meeting_id for update;
  if not found then raise exception '会议不存在'; end if;
  if not p_enabled and exists(select 1 from public.luggage_records where meeting_id=p_meeting_id and status='寄存') then raise exception '仍有未领取行李，不能关闭行李管理'; end if;
  update public.meetings set luggage_enabled=p_enabled where id=p_meeting_id;
  insert into public.meeting_luggage_config(meeting_id,enable_luggage,updated_by,updated_at) values(p_meeting_id,p_enabled,auth.uid(),now())
    on conflict(meeting_id) do update set enable_luggage=excluded.enable_luggage,updated_by=auth.uid(),updated_at=now();
end $$;

create or replace function public.sync_luggage_record(p_meeting_id uuid,p_record jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_enabled boolean; v_multi boolean; v_rows integer; v_per integer; v_person public.attendees%rowtype; v_old public.luggage_records%rowtype;
  v_code text:=p_record->>'luggage_barcode'; v_status text:=p_record->>'status'; v_rev integer:=(p_record->>'revision')::integer;
  v_in timestamptz:=(p_record->>'checkin_time')::timestamptz; v_out timestamptz:=(p_record->>'checkout_time')::timestamptz;
  v_updated timestamptz:=(p_record->>'updated_at')::timestamptz; v_row integer:=(p_record->>'storage_row')::integer;
  v_slot integer:=(p_record->>'storage_slot')::integer;
begin
  if auth.uid() is null or not coalesce(public.can_manage_project(p_meeting_id),false) then raise exception '没有当前会议的行李管理权限'; end if;
  if (p_record->>'event_id') is distinct from p_meeting_id::text then raise exception '会议不匹配'; end if;
  if v_code is null or v_code !~ '^LUG[0-9A-Z]{10,60}$' or v_status not in ('寄存','已取') or v_rev not in (1,2)
    or v_in is null or v_updated is null or v_row not between 1 and 9999 or v_slot not between 1 and 9999 then raise exception '行李记录格式无效'; end if;
  select coalesce(c.enable_luggage,m.luggage_enabled),coalesce(c.allow_multi_bag,false),coalesce(c.total_rows,50),coalesce(c.per_row_max_position,50)
    into v_enabled,v_multi,v_rows,v_per from public.meetings m left join public.meeting_luggage_config c on c.meeting_id=m.id where m.id=p_meeting_id for update of m;
  if not found then raise exception '会议不存在'; end if;
  select * into v_old from public.luggage_records where luggage_barcode=v_code for update;
  if found then
    if v_old.meeting_id<>p_meeting_id or v_old.attendee_id::text is distinct from p_record->>'attend_id' or v_old.storage_row<>v_row or v_old.storage_slot<>v_slot or v_old.checkin_time<>v_in then raise exception '条码冲突，不能覆盖原记录'; end if;
    if v_old.revision>=v_rev then return; end if;
    if not v_enabled then raise exception '本场行李管理已关闭，请管理员重新启用后同步'; end if;
    update public.luggage_records set status=v_status,checkout_time=v_out,operator_checkout=coalesce(p_record->>'operator_checkout',''),revision=v_rev,updated_at=v_updated,synced_by=auth.uid(),synced_at=now() where luggage_barcode=v_code;
  else
    if not v_enabled then raise exception '本场行李管理已关闭'; end if;
    if v_row>v_rows or v_slot>v_per then raise exception '库位超出本场配置范围'; end if;
    if exists(select 1 from public.luggage_records where meeting_id=p_meeting_id and storage_row=v_row and storage_slot=v_slot and status='寄存') then raise exception '该库位已占用，请联网刷新后重新分配'; end if;
    if not v_multi and exists(select 1 from public.luggage_records where meeting_id=p_meeting_id and attendee_id=(p_record->>'attend_id')::uuid and status='寄存') then raise exception '该参会人已有未取行李，本场不允许多件寄存'; end if;
    select * into v_person from public.attendees where id=(p_record->>'attend_id')::uuid and meeting_id=p_meeting_id;
    if not found then raise exception '参会编号不属于本场会议'; end if;
    insert into public.luggage_records(luggage_barcode,meeting_id,attendee_id,name,dept,mobile,storage_row,storage_slot,bag_count,status,checkin_time,checkout_time,operator_checkin,operator_checkout,revision,updated_at,synced_by)
    values(v_code,p_meeting_id,v_person.id,v_person.name,coalesce(v_person.department,''),coalesce(v_person.phone,''),v_row,v_slot,1,v_status,v_in,v_out,coalesce(p_record->>'operator_checkin',''),coalesce(p_record->>'operator_checkout',''),v_rev,v_updated,auth.uid());
  end if;
  insert into public.luggage_audit_logs(meeting_id,luggage_barcode,action,actor_id) values(p_meeting_id,v_code,case when v_status='寄存' then 'checkin' else 'checkout' end,auth.uid());
end $$;

create or replace function public.luggage_ledger_page(p_meeting_id uuid,p_after text default '')
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null or not coalesce(public.can_manage_project(p_meeting_id),false) then raise exception '没有当前会议的行李管理权限'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'event_id',meeting_id::text,'attend_id',attendee_id::text,'name',name,'dept',dept,'mobile',mobile,
    'luggage_barcode',luggage_barcode,'storage_row',storage_row,'storage_slot',storage_slot,'bag_count',bag_count,'status',status,
    'checkin_time',checkin_time,'checkout_time',checkout_time,'operator_checkin',operator_checkin,
    'operator_checkout',operator_checkout,'revision',revision,'updated_at',updated_at,'synced_at',synced_at,'sync_status','synced') order by luggage_barcode)
    from (select * from public.luggage_records where meeting_id=p_meeting_id and luggage_barcode>coalesce(p_after,'') order by luggage_barcode limit 500) records),'[]'::jsonb);
end $$;

revoke all on function public.luggage_config(uuid),public.save_luggage_config(uuid,jsonb),public.reset_meeting_luggage(uuid,text),public.set_meeting_luggage_enabled(uuid,boolean) from public,anon;
grant execute on function public.luggage_config(uuid),public.save_luggage_config(uuid,jsonb),public.reset_meeting_luggage(uuid,text),public.set_meeting_luggage_enabled(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
