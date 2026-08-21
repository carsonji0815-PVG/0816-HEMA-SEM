-- Project-level interval used by the automatic pickup/dropoff grouping tool.

alter table public.meetings
  add column if not exists transport_group_minutes integer not null default 30
  check (transport_group_minutes between 10 and 180);
