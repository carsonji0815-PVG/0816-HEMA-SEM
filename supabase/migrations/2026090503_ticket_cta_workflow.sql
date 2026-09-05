-- Meeting-scoped ticket status dictionary and researcher-meeting CTA signing.

alter table public.attendees add column if not exists cta_status text not null default 'pending';

do $$ begin
  alter table public.attendees add constraint attendees_cta_status_check
    check (cta_status in ('pending','completed'));
exception when duplicate_object then null; end $$;

update public.meetings
set field_config=coalesce(field_config,'{}'::jsonb)
  || jsonb_build_object(
    'meetingCategory',coalesce(nullif(field_config->>'meetingCategory',''),'standard'),
    'ctaEnabled',case when field_config->>'meetingCategory'='researcher' then coalesce((field_config->>'ctaEnabled')::boolean,false) else false end,
    'ticketStatusOptions',coalesce(field_config->'ticketStatusOptions','[
      {"id":"pending","label":"待出票","approval":"none"},
      {"id":"processing","label":"出票中","approval":"both"},
      {"id":"ticketed","label":"已出票（机票）","approval":"both"},
      {"id":"rail_ticketed","label":"已出票（高铁）","approval":"both"},
      {"id":"mixed_ticketed","label":"已出票（机票+高铁）","approval":"both"},
      {"id":"changed","label":"改签中","approval":"both"},
      {"id":"refunded","label":"已退票","approval":"none"},
      {"id":"outbound_ticketed_return_pending","label":"去程已出票+返程待审批","approval":"outbound"},
      {"id":"outbound_pending_return_ticketed","label":"去程待审批+返程已出票","approval":"return"}
    ]'::jsonb)
  );

create or replace function public.validate_meeting_ticket_cta_config()
returns trigger language plpgsql set search_path=public as $$
declare v_options jsonb; v_total integer; v_ids integer; v_labels integer;
begin
  v_options:=coalesce(new.field_config->'ticketStatusOptions','[]'::jsonb);
  if jsonb_typeof(v_options)<>'array' or jsonb_array_length(v_options)=0 then raise exception '当前会议至少需要一个出票状态'; end if;
  select count(*),count(distinct item->>'id'),count(distinct lower(trim(item->>'label')))
  into v_total,v_ids,v_labels from jsonb_array_elements(v_options) item;
  if v_total<>v_ids or v_total<>v_labels then raise exception '出票状态编号和名称不能重复'; end if;
  if not exists(select 1 from jsonb_array_elements(v_options) item where item->>'id'='pending') then raise exception '必须保留系统初始状态“待出票”'; end if;
  if exists(select 1 from jsonb_array_elements(v_options) item where coalesce(item->>'id','')='' or coalesce(trim(item->>'label'),'')='' or coalesce(item->>'approval','none') not in ('none','outbound','return','both')) then raise exception '出票状态配置不完整'; end if;
  if exists(select 1 from public.attendees a where a.meeting_id=new.id and not exists(select 1 from jsonb_array_elements(v_options) item where item->>'id'=a.ticket_status)) then raise exception '不能删除已有参会人员正在使用的出票状态'; end if;
  if coalesce((new.field_config->>'ctaEnabled')::boolean,false) and coalesce(new.field_config->>'meetingCategory','standard')<>'researcher' then raise exception 'CTA 签署仅可用于研究者会议'; end if;
  return new;
end; $$;

drop trigger if exists meetings_validate_ticket_cta_config on public.meetings;
create trigger meetings_validate_ticket_cta_config before update of field_config on public.meetings
for each row execute function public.validate_meeting_ticket_cta_config();

create or replace function public.guard_ticket_after_approval()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_role public.app_role;
  v_config jsonb;
  v_option jsonb;
  v_requirement text;
  v_researcher_cta boolean;
begin
  v_role:=public.meeting_role(new.meeting_id);
  select coalesce(field_config,'{}'::jsonb) into v_config from public.meetings where id=new.meeting_id;
  if v_role='sales' and (new.outbound_approval_status is distinct from old.outbound_approval_status or new.return_approval_status is distinct from old.return_approval_status) then
    raise exception '销售负责人不能修改行程审批状态';
  end if;

  select item into v_option
  from jsonb_array_elements(coalesce(v_config->'ticketStatusOptions','[]'::jsonb)) item
  where item->>'id'=new.ticket_status limit 1;
  if v_option is null then raise exception '出票状态不属于当前会议状态字典'; end if;
  v_requirement:=coalesce(v_option->>'approval','none');
  if v_requirement in ('outbound','both') and new.outbound_approval_status in ('pending','rejected') then
    raise exception '去程尚未审批通过，不能切换到该出票状态';
  end if;
  if v_requirement in ('return','both') and new.return_approval_status in ('pending','rejected') then
    raise exception '返程尚未审批通过，不能切换到该出票状态';
  end if;

  v_researcher_cta:=coalesce(v_config->>'meetingCategory','standard')='researcher'
    and coalesce((v_config->>'ctaEnabled')::boolean,false);
  if new.cta_status='completed' and new.cta_status is distinct from old.cta_status and not v_researcher_cta then
    raise exception '仅已开启 CTA 签署的研究者会议可标记 CTA 已完成';
  end if;
  return new;
end; $$;

drop trigger if exists attendees_guard_ticket_after_approval on public.attendees;
create trigger attendees_guard_ticket_after_approval before update on public.attendees
for each row execute function public.guard_ticket_after_approval();

comment on column public.attendees.cta_status is 'Researcher-meeting CTA signature status: pending/completed';
