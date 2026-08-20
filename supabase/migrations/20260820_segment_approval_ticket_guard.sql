-- Separate outbound/return approvals and prevent ticketing before required approval

alter table public.attendees add column if not exists outbound_approval_status text not null default 'normal';
alter table public.attendees add column if not exists return_approval_status text not null default 'normal';

update public.attendees set
  outbound_approval_status=case when exists(select 1 from unnest(risks) risk where risk like '%不在预设范围%') then case when approval='approved' then 'approved' else 'pending' end else 'normal' end,
  return_approval_status=case when exists(select 1 from unnest(risks) risk where risk like '%不一致%') then case when approval='approved' then 'approved' else 'pending' end else 'normal' end;

create or replace function public.guard_ticket_after_approval()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_role public.app_role;
begin
  v_role:=public.meeting_role(new.meeting_id);
  if v_role='sales' and (new.outbound_approval_status is distinct from old.outbound_approval_status or new.return_approval_status is distinct from old.return_approval_status) then
    raise exception '销售负责人不能修改行程审批状态';
  end if;
  if new.ticket_status in ('processing','ticketed','changed') and (new.outbound_approval_status in ('pending','rejected') or new.return_approval_status in ('pending','rejected')) then
    raise exception '所需行程尚未审批通过，不能进行出票';
  end if;
  return new;
end; $$;

drop trigger if exists attendees_guard_ticket_after_approval on public.attendees;
create trigger attendees_guard_ticket_after_approval before update on public.attendees
for each row execute function public.guard_ticket_after_approval();

create or replace function public.audit_attendee_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_actor_name text;
  v_message text;
  v_changes text[] := '{}';
begin
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor_name
  from public.profiles p left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=new.meeting_id
  where p.user_id=auth.uid();
  v_actor_name:=coalesce(v_actor_name,'系统');
  if tg_op='INSERT' then v_message:=v_actor_name||'新增报名：'||new.name;
  else
    if old.out_from is distinct from new.out_from then v_changes:=array_append(v_changes,'去程出发城市：'||coalesce(old.out_from,'空')||' → '||coalesce(new.out_from,'空')); end if;
    if old.out_to is distinct from new.out_to then v_changes:=array_append(v_changes,'去程到达城市：'||coalesce(old.out_to,'空')||' → '||coalesce(new.out_to,'空')); end if;
    if old.out_no is distinct from new.out_no then v_changes:=array_append(v_changes,'去程航班/车次：'||coalesce(old.out_no,'空')||' → '||coalesce(new.out_no,'空')); end if;
    if old.return_from is distinct from new.return_from then v_changes:=array_append(v_changes,'返程出发城市：'||coalesce(old.return_from,'空')||' → '||coalesce(new.return_from,'空')); end if;
    if old.return_to is distinct from new.return_to then v_changes:=array_append(v_changes,'返程到达城市：'||coalesce(old.return_to,'空')||' → '||coalesce(new.return_to,'空')); end if;
    if old.return_no is distinct from new.return_no then v_changes:=array_append(v_changes,'返程航班/车次：'||coalesce(old.return_no,'空')||' → '||coalesce(new.return_no,'空')); end if;
    if old.outbound_approval_status is distinct from new.outbound_approval_status then v_changes:=array_append(v_changes,'去程审批：'||old.outbound_approval_status||' → '||new.outbound_approval_status); end if;
    if old.return_approval_status is distinct from new.return_approval_status then v_changes:=array_append(v_changes,'返程审批：'||old.return_approval_status||' → '||new.return_approval_status); end if;
    if old.privacy_letter_status is distinct from new.privacy_letter_status then v_changes:=array_append(v_changes,'隐私沟通函：'||old.privacy_letter_status||' → '||new.privacy_letter_status); end if;
    if old.ticket_status is distinct from new.ticket_status then v_changes:=array_append(v_changes,'出票状态：'||old.ticket_status||' → '||new.ticket_status); end if;
    if old.name is distinct from new.name then v_changes:=array_append(v_changes,'姓名：'||old.name||' → '||new.name); end if;
    if old.phone is distinct from new.phone then v_changes:=array_append(v_changes,'手机号：'||old.phone||' → '||new.phone); end if;
    if old.venue is distinct from new.venue then v_changes:=array_append(v_changes,'会场：'||coalesce(old.venue,'空')||' → '||coalesce(new.venue,'空')); end if;
    if old.custom_fields is distinct from new.custom_fields then v_changes:=array_append(v_changes,'项目补充字段已更新'); end if;
    v_message:=v_actor_name||'变更了'||new.name||'：'||coalesce(array_to_string(v_changes,'；'),'报名资料已更新');
  end if;
  insert into public.change_logs(meeting_id,attendee_id,actor_id,action,changes) values(new.meeting_id,new.id,auth.uid(),case when tg_op='INSERT' then 'create' else 'change' end,jsonb_build_object('details',v_changes));
  insert into public.notifications(meeting_id,recipient_id,type,message) values(new.meeting_id,null,case when tg_op='INSERT' then 'create' else 'change' end,v_message);
  return new;
end; $$;
