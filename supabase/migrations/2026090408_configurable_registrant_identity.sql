-- Allow every meeting to choose its own public registrant identity fields.
-- Historical projects keep region + name + employee number through the UI fallback.

alter table public.registrants add column if not exists phone text;
alter table public.registrants add column if not exists phone_norm text;

alter table public.registrants alter column region drop not null;
alter table public.registrants alter column region set default '';
alter table public.registrants alter column display_name drop not null;
alter table public.registrants alter column display_name set default '';
alter table public.registrants alter column employee_no drop not null;
alter table public.registrants alter column employee_no set default '';
alter table public.registrants alter column employee_no_norm drop not null;
alter table public.registrants alter column employee_no_norm set default '';

alter table public.registrants drop constraint if exists registrants_meeting_id_employee_no_norm_key;
drop index if exists public.registrants_meeting_identity_idx;
create unique index if not exists registrants_meeting_employee_identity_idx
  on public.registrants(meeting_id, employee_no_norm)
  where employee_no_norm is not null and employee_no_norm <> '';
create unique index if not exists registrants_meeting_phone_identity_idx
  on public.registrants(meeting_id, phone_norm)
  where phone_norm is not null and phone_norm <> '';

