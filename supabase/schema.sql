-- Journey Desk / Supabase production schema
-- Run once in Supabase SQL Editor. Never expose the service_role key in GitHub Pages.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('ops', 'client', 'sales');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.approval_status as enum ('normal', 'pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  deadline timestamptz,
  capacity integer not null default 120 check (capacity > 0),
  allowed_departure_cities text[] not null default '{}',
  check_city_mismatch boolean not null default true,
  check_departure_city boolean not null default true,
  master_locked boolean not null default false,
  client_name text,
  start_date date,
  end_date date,
  venues text[] not null default '{}',
  service_phone text,
  brand_color text not null default '#5267d9',
  auth_mode text not null default 'region_name_phone',
  flight_lead_minutes integer not null default 120,
  train_lead_minutes integer not null default 90,
  field_config jsonb not null default '{"title":true,"hcpId":true,"accommodation":true,"flight":true,"mslContact":true,"remarks":true}'::jsonb,
  template_name text,
  registration_template jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  display_name text not null,
  phone text,
  role public.app_role not null default 'sales',
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_members (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  role public.app_role not null default 'sales',
  created_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create table if not exists public.attendees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  owner_id uuid not null references public.profiles(user_id),
  attendee_type text,
  name text not null,
  city text,
  hospital text,
  department text,
  title text,
  venue text,
  sex text,
  id_number text not null,
  phone text not null,
  hcp_id text not null,
  accommodation boolean not null default false,
  is_flight boolean not null default false,
  out_date date,
  out_from text,
  out_to text,
  out_no text,
  out_departure time,
  out_arrival time,
  return_date date,
  return_from text,
  return_to text,
  return_no text,
  return_departure time,
  return_arrival time,
  region text,
  contact_name text,
  contact_mobile text,
  msl_contact text,
  remarks text,
  custom_fields jsonb not null default '{}'::jsonb,
  privacy_letter_status text not null default 'pending',
  ticket_status text not null default 'pending',
  approval public.approval_status not null default 'normal',
  risks text[] not null default '{}',
  row_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, phone)
);

alter table public.attendees add column if not exists contact_name text;
alter table public.attendees add column if not exists contact_mobile text;

create index if not exists attendees_meeting_owner_idx on public.attendees(meeting_id, owner_id);
create index if not exists attendees_phone_idx on public.attendees(meeting_id, phone);

create table if not exists public.transports (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  direction text not null check (direction in ('pickup', 'dropoff')),
  driver_name text,
  driver_phone text,
  vehicle text,
  service_time timestamptz,
  meeting_point text,
  staff_name text,
  service_mode text,
  batch_id uuid,
  batch_name text,
  terminal text,
  placard text,
  capacity integer,
  notes text,
  time_strategy text,
  updated_at timestamptz not null default now(),
  unique (attendee_id, direction)
);

create table if not exists public.column_locks (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  field_group text not null,
  locked boolean not null default true,
  updated_by uuid references public.profiles(user_id),
  updated_at timestamptz not null default now(),
  primary key (meeting_id, field_group)
);

create table if not exists public.change_logs (
  id bigint generated always as identity primary key,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  attendee_id uuid references public.attendees(id) on delete set null,
  actor_id uuid references public.profiles(user_id) on delete set null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  recipient_id uuid references public.profiles(user_id) on delete cascade,
  type text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.public_query_logs (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists public_query_logs_rate_idx on public.public_query_logs(ip_hash, created_at desc);

create or replace function public.current_meeting_id()
returns uuid language sql stable security definer set search_path = public
as $$ select meeting_id from public.profiles where user_id = auth.uid() $$;

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where user_id = auth.uid() $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists attendees_touch_updated_at on public.attendees;
create trigger attendees_touch_updated_at before update on public.attendees
for each row execute function public.touch_updated_at();

create or replace function public.guard_attendee_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meeting_locked boolean;
  v_role public.app_role;
begin
  select master_locked into v_meeting_locked from public.meetings where id = old.meeting_id;
  select role into v_role from public.profiles where user_id = auth.uid();
  if (v_meeting_locked or old.row_locked)
    and (to_jsonb(new) - array['updated_at','row_locked']) is distinct from (to_jsonb(old) - array['updated_at','row_locked']) then
    raise exception '名单已锁定，不能修改';
  end if;
  if v_role = 'sales' and old.owner_id <> auth.uid() then
    raise exception '无权修改其他负责人的参会者';
  end if;
  if v_role = 'sales' and (new.owner_id <> old.owner_id or new.approval <> old.approval or new.row_locked <> old.row_locked) then
    raise exception '销售无权修改负责人、审批状态或锁定状态';
  end if;
  if v_role = 'sales' and exists (select 1 from public.column_locks where meeting_id = old.meeting_id and field_group = 'identity' and locked)
    and row(new.name,new.sex,new.id_number,new.hcp_id,new.hospital,new.department) is distinct from row(old.name,old.sex,old.id_number,old.hcp_id,old.hospital,old.department) then
    raise exception '身份与证件字段已锁定';
  end if;
  if v_role = 'sales' and exists (select 1 from public.column_locks where meeting_id = old.meeting_id and field_group = 'contact' and locked)
    and new.phone is distinct from old.phone then raise exception '手机号字段已锁定'; end if;
  if v_role = 'sales' and exists (select 1 from public.column_locks where meeting_id = old.meeting_id and field_group = 'outbound' and locked)
    and row(new.out_date,new.out_from,new.out_to,new.out_no,new.out_departure,new.out_arrival) is distinct from row(old.out_date,old.out_from,old.out_to,old.out_no,old.out_departure,old.out_arrival) then
    raise exception '去程字段已锁定';
  end if;
  if v_role = 'sales' and exists (select 1 from public.column_locks where meeting_id = old.meeting_id and field_group = 'return' and locked)
    and row(new.return_date,new.return_from,new.return_to,new.return_no,new.return_departure,new.return_arrival) is distinct from row(old.return_date,old.return_from,old.return_to,old.return_no,old.return_departure,old.return_arrival) then
    raise exception '返程字段已锁定';
  end if;
  if v_role = 'sales' and exists (select 1 from public.column_locks where meeting_id = old.meeting_id and field_group = 'accommodation' and locked)
    and new.accommodation is distinct from old.accommodation then raise exception '住宿字段已锁定'; end if;
  if v_role = 'sales' and exists (select 1 from public.column_locks where meeting_id = old.meeting_id and field_group = 'remarks' and locked)
    and new.remarks is distinct from old.remarks then raise exception '备注字段已锁定'; end if;
  return new;
end; $$;

drop trigger if exists attendees_guard_update on public.attendees;
create trigger attendees_guard_update before update on public.attendees
for each row execute function public.guard_attendee_update();

create or replace function public.audit_attendee_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
  v_action text;
  v_message text;
begin
  select display_name into v_actor_name from public.profiles where user_id = auth.uid();
  v_actor_name := coalesce(v_actor_name, '系统');
  v_action := case when tg_op = 'INSERT' then 'create' else 'change' end;
  v_message := case when tg_op = 'INSERT'
    then v_actor_name || '新增报名：' || new.name
    else v_actor_name || '更新了' || new.name || '的报名或行程信息' end;
  insert into public.change_logs(meeting_id, attendee_id, actor_id, action, changes)
  values (new.meeting_id, new.id, auth.uid(), v_action, jsonb_build_object('approval', new.approval));
  insert into public.notifications(meeting_id, recipient_id, type, message)
  values (new.meeting_id, null, v_action, v_message);
  return new;
end; $$;

drop trigger if exists attendees_audit_change on public.attendees;
create trigger attendees_audit_change after insert or update on public.attendees
for each row execute function public.audit_attendee_change();

alter table public.meetings enable row level security;
alter table public.profiles enable row level security;
alter table public.attendees enable row level security;
alter table public.transports enable row level security;
alter table public.column_locks enable row level security;
alter table public.change_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.public_query_logs enable row level security;

drop policy if exists "meeting members read meeting" on public.meetings;
create policy "meeting members read meeting" on public.meetings for select to authenticated
using (id = public.current_meeting_id());

drop policy if exists "managers update meeting" on public.meetings;
create policy "managers update meeting" on public.meetings for update to authenticated
using (id = public.current_meeting_id() and public.current_app_role() in ('ops','client'))
with check (id = public.current_meeting_id() and public.current_app_role() in ('ops','client'));

drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles" on public.profiles for select to authenticated
using (meeting_id = public.current_meeting_id());

drop policy if exists "role scoped attendee read" on public.attendees;
create policy "role scoped attendee read" on public.attendees for select to authenticated
using (meeting_id = public.current_meeting_id() and (public.current_app_role() in ('ops','client') or owner_id = auth.uid()));

drop policy if exists "role scoped attendee insert" on public.attendees;
create policy "role scoped attendee insert" on public.attendees for insert to authenticated
with check (
  meeting_id = public.current_meeting_id()
  and not exists (select 1 from public.meetings m where m.id = meeting_id and m.master_locked)
  and (public.current_app_role() in ('ops','client') or owner_id = auth.uid())
);

drop policy if exists "role scoped attendee update" on public.attendees;
create policy "role scoped attendee update" on public.attendees for update to authenticated
using (meeting_id = public.current_meeting_id() and (public.current_app_role() in ('ops','client') or owner_id = auth.uid()))
with check (meeting_id = public.current_meeting_id() and (public.current_app_role() in ('ops','client') or owner_id = auth.uid()));

drop policy if exists "role scoped transport read" on public.transports;
create policy "role scoped transport read" on public.transports for select to authenticated
using (exists (select 1 from public.attendees a where a.id = attendee_id and a.meeting_id = public.current_meeting_id() and (public.current_app_role() in ('ops','client') or a.owner_id = auth.uid())));

drop policy if exists "managers manage transport" on public.transports;
create policy "managers manage transport" on public.transports for all to authenticated
using (public.current_app_role() in ('ops','client')) with check (public.current_app_role() in ('ops','client'));

drop policy if exists "meeting members read locks" on public.column_locks;
create policy "meeting members read locks" on public.column_locks for select to authenticated
using (meeting_id = public.current_meeting_id());

drop policy if exists "managers manage locks" on public.column_locks;
create policy "managers manage locks" on public.column_locks for all to authenticated
using (meeting_id = public.current_meeting_id() and public.current_app_role() in ('ops','client'))
with check (meeting_id = public.current_meeting_id() and public.current_app_role() in ('ops','client'));

drop policy if exists "meeting members read logs" on public.change_logs;
create policy "meeting members read logs" on public.change_logs for select to authenticated
using (meeting_id = public.current_meeting_id() and (public.current_app_role() in ('ops','client') or actor_id = auth.uid()));

drop policy if exists "members create logs" on public.change_logs;
create policy "members create logs" on public.change_logs for insert to authenticated
with check (meeting_id = public.current_meeting_id() and actor_id = auth.uid());

drop policy if exists "recipient reads notifications" on public.notifications;
create policy "recipient reads notifications" on public.notifications for select to authenticated
using (meeting_id = public.current_meeting_id() and (recipient_id = auth.uid() or (recipient_id is null and public.current_app_role() in ('ops','client'))));

drop policy if exists "recipient updates notifications" on public.notifications;
create policy "recipient updates notifications" on public.notifications for update to authenticated
using (meeting_id = public.current_meeting_id() and (recipient_id = auth.uid() or (recipient_id is null and public.current_app_role() in ('ops','client'))))
with check (meeting_id = public.current_meeting_id());

-- Replace the contact details before production.
insert into public.meetings (slug, name, deadline, capacity, allowed_departure_cities)
values ('hema-sem-2026', 'HEMA SEM · 大连 & 福州', '2026-08-26 18:00:00+08', 120, array['上海','北京','广州','杭州','南京','厦门'])
on conflict (slug) do nothing;
