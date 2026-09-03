-- External-meeting approval rules, public-registration notifications and
-- security hardening. Meeting-specific rule values remain in field_config.

alter table public.notifications add column if not exists attendee_id uuid references public.attendees(id) on delete set null;
alter table public.notifications add column if not exists actor_label text;
alter table public.notifications add column if not exists source text not null default 'system';
alter table public.notifications add column if not exists change_details jsonb not null default '[]'::jsonb;
alter table public.notifications add column if not exists email_requested boolean not null default false;
alter table public.meetings add column if not exists archived_at timestamptz;
alter table public.meetings add column if not exists archived_by uuid references auth.users(id) on delete set null;

create table if not exists public.notification_email_outbox (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  notification_id bigint not null references public.notifications(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.notification_email_outbox enable row level security;
drop policy if exists "managers read notification outbox" on public.notification_email_outbox;
create policy "managers read notification outbox" on public.notification_email_outbox for select to authenticated
using (public.is_system_admin() or public.meeting_role(meeting_id) in ('ops','client'));

-- Audit data is append-only to application users and retained for at least
-- 180 days by policy. Service maintenance may archive older rows.
revoke delete, update on public.operation_audit_logs from authenticated;
revoke delete, update on public.change_logs from authenticated;

create or replace function public.delete_meeting_project(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_manage_project(p_id) then raise exception '无权归档该项目'; end if;
  update public.meetings set archived_at=now(),archived_by=auth.uid(),registration_open=false,master_locked=true where id=p_id and archived_at is null;
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,metadata)
  values(p_id,auth.uid(),coalesce((select display_name from public.profiles where user_id=auth.uid()),'系统'),'archive','meeting',p_id::text,jsonb_build_object('soft_delete',true,'recoverable',true));
end; $$;

create or replace function public.audit_attendee_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
  v_action text;
  v_changes jsonb := '[]'::jsonb;
  v_old jsonb;
  v_new jsonb;
  v_key text;
begin
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor_name
  from public.profiles p left join public.meeting_members mm
    on mm.user_id=auth.uid() and mm.meeting_id=new.meeting_id
  where p.user_id=auth.uid() limit 1;
  v_actor_name := coalesce(v_actor_name, case when new.registrant_id is not null then '报名端参会人员' else '系统' end);
  v_action := case when tg_op='INSERT' then 'create'
                   when new.business_status='cancelled' and old.business_status is distinct from new.business_status then 'cancel'
                   else 'change' end;
  v_new := to_jsonb(new);
  v_old := case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  for v_key in select key from jsonb_each(v_new) loop
    if v_key not in ('updated_at','created_at','risks','approval')
       and (tg_op='INSERT' or v_old->v_key is distinct from v_new->v_key) then
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'field',v_key,'before',case when tg_op='INSERT' then null else v_old->v_key end,'after',v_new->v_key
      ));
    end if;
  end loop;
  insert into public.change_logs(meeting_id,attendee_id,actor_id,action,changes)
  values(new.meeting_id,new.id,auth.uid(),v_action,v_changes);
  insert into public.operation_audit_logs(meeting_id,attendee_id,actor_user_id,actor_registrant_id,actor_label,action,target_type,target_id,before_data,after_data,metadata)
  values(new.meeting_id,new.id,auth.uid(),new.registrant_id,v_actor_name,v_action,'attendee',new.id::text,
    case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),jsonb_build_object('retention_days',180));
  -- User-visible reminders are intentionally created only by the public
  -- registration service after it has calculated the exact field diff.
  return new;
end; $$;

create or replace function public.apply_attendee_approval_rules()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_meeting public.meetings%rowtype;
  v_rules jsonb;
  v_room jsonb;
  v_out_risks text[] := '{}';
  v_return_risks text[] := '{}';
  v_earliest timestamptz;
  v_latest timestamptz;
  v_arrival timestamptz;
  v_departure timestamptz;
  v_titles text[];
  v_room_pending boolean := false;
  v_out_changed boolean := true;
  v_return_changed boolean := true;
begin
  select * into v_meeting from public.meetings where id=new.meeting_id;
  if coalesce(v_meeting.activity_type,'external')='internal' then
    new.outbound_approval_status := 'normal';
    new.return_approval_status := 'normal';
    new.approval := 'normal';
    new.risks := '{}';
    if new.custom_fields ? '_rooming' then
      new.custom_fields := jsonb_set(new.custom_fields,'{_rooming,approvalStatus}','"normal"'::jsonb,true);
    end if;
    return new;
  end if;

  v_rules := coalesce(v_meeting.field_config->'travelApprovalRules','{}'::jsonb);
  if tg_op='UPDATE' then
    v_out_changed := row(new.depart_date,new.depart_city,new.depart_station,new.arrive_date,new.arrive_city,new.arrive_station,new.out_no,new.out_departure,new.out_arrival)
      is distinct from row(old.depart_date,old.depart_city,old.depart_station,old.arrive_date,old.arrive_city,old.arrive_station,old.out_no,old.out_departure,old.out_arrival);
    v_return_changed := row(new.return_depart_date,new.return_depart_city,new.return_depart_station,new.return_arrive_date,new.return_arrive_city,new.return_arrive_station,new.return_no,new.return_departure,new.return_arrival)
      is distinct from row(old.return_depart_date,old.return_depart_city,old.return_depart_station,old.return_arrive_date,old.return_arrive_city,old.return_arrive_station,old.return_no,old.return_departure,old.return_arrival);
  end if;
  if coalesce((v_rules->>'mismatchEnabled')::boolean,v_meeting.check_city_mismatch,true)
     and nullif(trim(new.depart_city),'') is not null and nullif(trim(new.return_arrive_city),'') is not null
     and trim(new.depart_city)<>trim(new.return_arrive_city) then
    v_return_risks := array_append(v_return_risks,'去程出发城市与返程抵达城市不一致');
  end if;
  if coalesce((v_rules->>'timeEnabled')::boolean,false) then
    begin v_earliest := nullif(coalesce(v_rules->>'earliestArrival',v_rules->>'arrivalStart'),'')::timestamptz; exception when others then v_earliest:=null; end;
    begin v_latest := nullif(coalesce(v_rules->>'latestDeparture',v_rules->>'returnEnd'),'')::timestamptz; exception when others then v_latest:=null; end;
    begin v_arrival := (new.arrive_date::text||' '||coalesce(new.out_arrival::text,'00:00'))::timestamp at time zone 'Asia/Shanghai'; exception when others then v_arrival:=null; end;
    begin v_departure := (new.return_depart_date::text||' '||coalesce(new.return_departure::text,'00:00'))::timestamp at time zone 'Asia/Shanghai'; exception when others then v_departure:=null; end;
    if v_earliest is not null and v_arrival is not null and v_arrival<v_earliest then v_out_risks:=array_append(v_out_risks,'去程抵达早于会议允许最早抵达时间'); end if;
    if v_latest is not null and v_departure is not null and v_departure>v_latest then v_return_risks:=array_append(v_return_risks,'返程撤离晚于会议允许最晚撤离时间'); end if;
  end if;
  new.outbound_approval_status := case when cardinality(v_out_risks)=0 then 'normal' when v_out_changed then 'pending' else coalesce(old.outbound_approval_status,'pending') end;
  new.return_approval_status := case when cardinality(v_return_risks)=0 then 'normal' when v_return_changed then 'pending' else coalesce(old.return_approval_status,'pending') end;
  new.risks := v_out_risks||v_return_risks;

  v_room := coalesce(new.custom_fields->'_rooming','{}'::jsonb);
  select coalesce(array_agg(value),array['主任医师','副主任医师']) into v_titles
  from jsonb_array_elements_text(coalesce(v_meeting.field_config->'roomingRules'->'singleTitles','["主任医师","副主任医师"]'::jsonb));
  v_room_pending := coalesce(v_room->>'requestedType','')='single'
    and (not (coalesce(new.title,'')=any(v_titles)) or coalesce((v_room->>'exceptionRequested')::boolean,false));
  if v_room_pending then
    if tg_op='INSERT' or old.custom_fields->'_rooming' is distinct from new.custom_fields->'_rooming' then
      v_room := jsonb_set(v_room,'{approvalStatus}','"pending"'::jsonb,true);
    end if;
    new.custom_fields := jsonb_set(coalesce(new.custom_fields,'{}'::jsonb),'{_rooming}',v_room,true);
  elsif new.custom_fields ? '_rooming' then
    new.custom_fields := jsonb_set(new.custom_fields,'{_rooming,approvalStatus}','"normal"'::jsonb,true);
  end if;
  new.approval := case when new.outbound_approval_status in ('pending','rejected') or new.return_approval_status in ('pending','rejected') or v_room_pending then 'pending'
                       when new.outbound_approval_status='approved' or new.return_approval_status='approved' then 'approved' else 'normal' end;
  return new;
end; $$;

drop trigger if exists attendees_apply_approval_rules on public.attendees;
create trigger attendees_apply_approval_rules before insert or update of
  depart_date,depart_city,depart_station,arrive_date,arrive_city,arrive_station,out_no,out_departure,out_arrival,
  return_depart_date,return_depart_city,return_depart_station,return_arrive_date,return_arrive_city,return_arrive_station,
  return_no,return_departure,return_arrival,title,custom_fields
on public.attendees for each row execute function public.apply_attendee_approval_rules();

notify pgrst, 'reload schema';
