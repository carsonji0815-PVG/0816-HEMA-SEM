-- Integrated on-site luggage service. Apply after 2026083001.
-- Additive only: does not alter attendee/travel approval behavior or open any meeting.
begin;
alter table public.meetings add column if not exists luggage_enabled boolean not null default false;
alter table public.meetings add column if not exists luggage_used boolean not null default false;

create table if not exists public.luggage_records (
  luggage_barcode text primary key check (luggage_barcode ~ '^LUG[0-9A-Z]{10,60}$'),
  meeting_id uuid not null references public.meetings(id) on delete restrict,
  attendee_id uuid not null references public.attendees(id) on delete restrict,
  name text not null, dept text not null default '', mobile text not null default '',
  storage_row integer not null check (storage_row between 1 and 9999),
  storage_slot integer not null check (storage_slot between 1 and 9999),
  status text not null check (status in ('寄存','已取')),
  checkin_time timestamptz not null, checkout_time timestamptz,
  operator_checkin text not null default '', operator_checkout text not null default '',
  revision integer not null check (revision in (1,2)),
  updated_at timestamptz not null,
  synced_by uuid not null references auth.users(id),
  synced_at timestamptz not null default now(),
  check ((status='寄存' and checkout_time is null and revision=1) or
         (status='已取' and checkout_time >= checkin_time and revision=2))
);
create index if not exists luggage_meeting_barcode_idx on public.luggage_records(meeting_id,luggage_barcode);
create index if not exists luggage_meeting_attendee_idx on public.luggage_records(meeting_id,attendee_id);
create index if not exists luggage_in_storage_idx on public.luggage_records(meeting_id) where status='寄存';

create table if not exists public.luggage_audit_logs (
  id bigint generated always as identity primary key,
  meeting_id uuid not null references public.meetings(id) on delete restrict,
  luggage_barcode text,
  action text not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists luggage_audit_meeting_idx on public.luggage_audit_logs(meeting_id,created_at);
alter table public.luggage_records enable row level security;
alter table public.luggage_audit_logs enable row level security;
drop policy if exists "luggage project read" on public.luggage_records;
create policy "luggage project read" on public.luggage_records for select to authenticated using(public.can_manage_project(meeting_id));
drop policy if exists "luggage audit project read" on public.luggage_audit_logs;
create policy "luggage audit project read" on public.luggage_audit_logs for select to authenticated using(public.can_manage_project(meeting_id));
revoke all on public.luggage_records,public.luggage_audit_logs from anon,authenticated;
grant select on public.luggage_records,public.luggage_audit_logs to authenticated;

-- Also protects direct meeting updates, not just the switch RPC.
create or replace function public.guard_luggage_feature() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.luggage_enabled is distinct from old.luggage_enabled then
    if not coalesce(public.can_manage_project(old.id),false) then raise exception '没有当前会议的行李管理权限'; end if;
    if not new.luggage_enabled and exists(select 1 from public.luggage_records where meeting_id=old.id and status='寄存') then
      raise exception '仍有未领取行李，不能关闭行李管理';
    end if;
    if new.luggage_enabled then new.luggage_used := true; end if;
    insert into public.luggage_audit_logs(meeting_id,action,actor_id)
      values(old.id,case when new.luggage_enabled then 'enable' else 'disable' end,auth.uid());
  end if;
  -- Historical records cannot be hidden by clearing the flag.
  if old.luggage_used then new.luggage_used:=true; end if;
  return new;
end $$;
drop trigger if exists luggage_feature_guard on public.meetings;
create trigger luggage_feature_guard before update of luggage_enabled,luggage_used on public.meetings
for each row execute function public.guard_luggage_feature();

create or replace function public.set_meeting_luggage_enabled(p_meeting_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not coalesce(public.can_manage_project(p_meeting_id),false) then raise exception '没有当前会议的行李管理权限'; end if;
  if p_enabled is null then raise exception '开关值不能为空'; end if;
  perform 1 from public.meetings where id=p_meeting_id for update;
  if not found then raise exception '会议不存在'; end if;
  update public.meetings set luggage_enabled=p_enabled where id=p_meeting_id;
end $$;

create or replace function public.luggage_attendees(p_meeting_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null or not coalesce(public.can_manage_project(p_meeting_id),false) then raise exception '没有当前会议的行李管理权限'; end if;
  if not exists(select 1 from public.meetings where id=p_meeting_id and luggage_enabled) then raise exception '本场行李管理未启用'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('attend_id',id::text,'name',name,'dept',coalesce(department,''),'mobile',coalesce(phone,'')) order by id)
    from public.attendees where meeting_id=p_meeting_id and business_status is distinct from 'cancelled'),'[]'::jsonb);
end $$;

create or replace function public.sync_luggage_record(p_meeting_id uuid,p_record jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_enabled boolean; v_person public.attendees%rowtype; v_old public.luggage_records%rowtype;
  v_code text:=p_record->>'luggage_barcode'; v_status text:=p_record->>'status';
  v_rev integer:=(p_record->>'revision')::integer;
  v_in timestamptz:=(p_record->>'checkin_time')::timestamptz;
  v_out timestamptz:=(p_record->>'checkout_time')::timestamptz;
  v_updated timestamptz:=(p_record->>'updated_at')::timestamptz;
  v_row integer:=(p_record->>'storage_row')::integer; v_slot integer:=(p_record->>'storage_slot')::integer;
begin
  if auth.uid() is null or not coalesce(public.can_manage_project(p_meeting_id),false) then raise exception '没有当前会议的行李管理权限'; end if;
  if (p_record->>'event_id') is distinct from p_meeting_id::text then raise exception '会议不匹配'; end if;
  if v_code is null or v_code !~ '^LUG[0-9A-Z]{10,60}$' or v_status is null or v_status not in ('寄存','已取')
     or v_rev is null or v_rev not in (1,2) or v_in is null or v_updated is null
     or v_row is null or v_row not between 1 and 9999 or v_slot is null or v_slot not between 1 and 9999
     or length(coalesce(p_record->>'operator_checkin',''))>64 or length(coalesce(p_record->>'operator_checkout',''))>64 then raise exception '行李记录格式无效'; end if;
  if (v_status='寄存' and (v_rev<>1 or v_out is not null)) or (v_status='已取' and (v_rev<>2 or v_out is null or v_out<v_in)) then raise exception '出入库状态或时间不一致'; end if;
  -- Serialize switch changes and record writes per meeting. Late retries never reopen a checkout.
  select luggage_enabled into v_enabled from public.meetings where id=p_meeting_id for update;
  if not found then raise exception '会议不存在'; end if;
  select * into v_old from public.luggage_records where luggage_barcode=v_code for update;
  if found then
    if v_old.meeting_id<>p_meeting_id or v_old.attendee_id::text is distinct from p_record->>'attend_id'
       or v_old.storage_row<>v_row or v_old.storage_slot<>v_slot or v_old.checkin_time<>v_in then raise exception '条码冲突，不能覆盖原记录'; end if;
    if v_old.revision>=v_rev then return; end if;
    if not v_enabled then raise exception '本场行李管理已关闭，请管理员重新启用后同步'; end if;
    update public.luggage_records set status=v_status,checkout_time=v_out,operator_checkout=coalesce(p_record->>'operator_checkout',''),revision=v_rev,updated_at=v_updated,synced_by=auth.uid(),synced_at=now() where luggage_barcode=v_code;
  else
    if not v_enabled then raise exception '本场行李管理已关闭，请管理员重新启用后同步'; end if;
    select * into v_person from public.attendees where id=(p_record->>'attend_id')::uuid and meeting_id=p_meeting_id;
    if not found then raise exception '参会编号不属于本场会议'; end if;
    -- Offline records may arrive after registration cancellation. Preserve that luggage history.
    insert into public.luggage_records(luggage_barcode,meeting_id,attendee_id,name,dept,mobile,storage_row,storage_slot,status,checkin_time,checkout_time,operator_checkin,operator_checkout,revision,updated_at,synced_by)
    values(v_code,p_meeting_id,v_person.id,v_person.name,coalesce(v_person.department,''),coalesce(v_person.phone,''),v_row,v_slot,v_status,v_in,v_out,coalesce(p_record->>'operator_checkin',''),coalesce(p_record->>'operator_checkout',''),v_rev,v_updated,auth.uid());
  end if;
  insert into public.luggage_audit_logs(meeting_id,luggage_barcode,action,actor_id) values(p_meeting_id,v_code,case when v_status='寄存' then 'checkin' else 'checkout' end,auth.uid());
end $$;

create or replace function public.luggage_ledger_page(p_meeting_id uuid,p_after text default '')
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null or not coalesce(public.can_manage_project(p_meeting_id),false) then raise exception '没有当前会议的行李管理权限'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'event_id',meeting_id::text,'attend_id',attendee_id::text,'name',name,'dept',dept,'mobile',mobile,
    'luggage_barcode',luggage_barcode,'storage_row',storage_row,'storage_slot',storage_slot,'status',status,
    'checkin_time',checkin_time,'checkout_time',checkout_time,'operator_checkin',operator_checkin,
    'operator_checkout',operator_checkout,'revision',revision,'updated_at',updated_at,'sync_status','synced') order by luggage_barcode)
    from (select * from public.luggage_records where meeting_id=p_meeting_id and luggage_barcode>coalesce(p_after,'') order by luggage_barcode limit 500) records),'[]'::jsonb);
end $$;

revoke all on function public.guard_luggage_feature() from public,anon,authenticated;
revoke all on function public.set_meeting_luggage_enabled(uuid,boolean),public.luggage_attendees(uuid),public.sync_luggage_record(uuid,jsonb),public.luggage_ledger_page(uuid,text) from public,anon;
grant execute on function public.set_meeting_luggage_enabled(uuid,boolean),public.luggage_attendees(uuid),public.sync_luggage_record(uuid,jsonb),public.luggage_ledger_page(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
