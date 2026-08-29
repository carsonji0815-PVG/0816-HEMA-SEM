-- Private paper privacy-letter attachments with attendee-scoped access.

alter table public.attendees add column if not exists privacy_letter_file_path text;
alter table public.attendees add column if not exists privacy_letter_file_name text;
alter table public.attendees add column if not exists privacy_letter_file_size bigint;
alter table public.attendees add column if not exists privacy_letter_uploaded_at timestamptz;
alter table public.attendees add column if not exists privacy_letter_uploaded_by uuid references auth.users(id) on delete set null;

update public.attendees
set privacy_letter_status = case
  when privacy_letter_status = 'pending' then 'pending'
  when privacy_letter_status in ('sent','complete') then 'electronic'
  when privacy_letter_status in ('electronic','paper') then privacy_letter_status
  else 'pending'
end;

do $$ begin
  alter table public.attendees add constraint attendees_privacy_letter_status_check
    check (privacy_letter_status in ('pending','electronic','paper'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.attendees add constraint attendees_paper_privacy_letter_file_check
    check (
      privacy_letter_status <> 'paper'
      or (
        nullif(trim(privacy_letter_file_path),'') is not null
        and nullif(trim(privacy_letter_file_name),'') is not null
      )
    );
exception when duplicate_object then null; end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'privacy-letter-files',
  'privacy-letter-files',
  false,
  15728640,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.privacy_storage_meeting_id(object_name text)
returns uuid language plpgsql stable security definer set search_path=public,storage as $$
declare parts text[];
begin
  parts:=storage.foldername(object_name);
  if coalesce(array_length(parts,1),0)<2 then return null; end if;
  return parts[1]::uuid;
exception when others then return null;
end; $$;

create or replace function public.privacy_storage_attendee_id(object_name text)
returns uuid language plpgsql stable security definer set search_path=public,storage as $$
declare parts text[];
begin
  parts:=storage.foldername(object_name);
  if coalesce(array_length(parts,1),0)<2 then return null; end if;
  return parts[2]::uuid;
exception when others then return null;
end; $$;

create or replace function public.can_read_privacy_letter_object(object_name text)
returns boolean language sql stable security definer set search_path=public,storage as $$
  select exists(
    select 1 from public.attendees a
    where a.id=public.privacy_storage_attendee_id(object_name)
      and a.meeting_id=public.privacy_storage_meeting_id(object_name)
      and (
        public.is_system_admin()
        or public.meeting_role(a.meeting_id) in ('ops','client')
        or a.owner_id=auth.uid()
      )
  )
$$;

create or replace function public.can_write_privacy_letter_object(object_name text)
returns boolean language sql stable security definer set search_path=public,storage as $$
  select exists(
    select 1 from public.attendees a
    where a.id=public.privacy_storage_attendee_id(object_name)
      and a.meeting_id=public.privacy_storage_meeting_id(object_name)
      and not a.row_locked
      and not exists(select 1 from public.meetings m where m.id=a.meeting_id and m.master_locked)
      and (
        public.can_edit_attendee_records(a.meeting_id)
        or a.owner_id=auth.uid()
      )
  )
$$;

drop policy if exists "authorized users read privacy letters" on storage.objects;
create policy "authorized users read privacy letters" on storage.objects for select to authenticated
using (bucket_id='privacy-letter-files' and public.can_read_privacy_letter_object(name));

drop policy if exists "authorized users upload privacy letters" on storage.objects;
create policy "authorized users upload privacy letters" on storage.objects for insert to authenticated
with check (bucket_id='privacy-letter-files' and public.can_write_privacy_letter_object(name));

drop policy if exists "authorized users update privacy letters" on storage.objects;
create policy "authorized users update privacy letters" on storage.objects for update to authenticated
using (bucket_id='privacy-letter-files' and public.can_write_privacy_letter_object(name))
with check (bucket_id='privacy-letter-files' and public.can_write_privacy_letter_object(name));

drop policy if exists "authorized users delete privacy letters" on storage.objects;
create policy "authorized users delete privacy letters" on storage.objects for delete to authenticated
using (bucket_id='privacy-letter-files' and public.can_write_privacy_letter_object(name));

revoke all on function public.privacy_storage_meeting_id(text) from public;
revoke all on function public.privacy_storage_attendee_id(text) from public;
revoke all on function public.can_read_privacy_letter_object(text) from public;
revoke all on function public.can_write_privacy_letter_object(text) from public;
grant execute on function public.privacy_storage_meeting_id(text) to authenticated;
grant execute on function public.privacy_storage_attendee_id(text) to authenticated;
grant execute on function public.can_read_privacy_letter_object(text) to authenticated;
grant execute on function public.can_write_privacy_letter_object(text) to authenticated;
