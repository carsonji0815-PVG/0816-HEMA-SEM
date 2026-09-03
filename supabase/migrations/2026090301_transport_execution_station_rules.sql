-- Meeting-scoped transport execution metadata and private pickup placard files.

alter table public.transports add column if not exists placard_file_path text;
alter table public.transports add column if not exists placard_file_name text;
alter table public.transports add column if not exists placard_file_size bigint;
alter table public.transports add column if not exists time_source text;

do $$ begin
  alter table public.transports add constraint transports_time_source_check
    check (time_source is null or time_source in ('none','rule','manual'));
exception when duplicate_object then null; end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('transport-placards','transport-placards',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.transport_placard_meeting_id(object_name text)
returns uuid language plpgsql stable security definer set search_path=public,storage as $$
declare parts text[];
begin
  parts:=storage.foldername(object_name);
  if coalesce(array_length(parts,1),0)<2 then return null; end if;
  return parts[1]::uuid;
exception when others then return null;
end; $$;

create or replace function public.can_read_transport_placard_object(object_name text)
returns boolean language sql stable security definer set search_path=public,storage as $$
  select public.is_system_admin() or public.meeting_role(public.transport_placard_meeting_id(object_name)) in ('ops','client')
$$;

create or replace function public.can_write_transport_placard_object(object_name text)
returns boolean language sql stable security definer set search_path=public,storage as $$
  select public.is_system_admin() or public.meeting_role(public.transport_placard_meeting_id(object_name))='ops'
$$;

drop policy if exists "authorized users read transport placards" on storage.objects;
create policy "authorized users read transport placards" on storage.objects for select to authenticated
using (bucket_id='transport-placards' and public.can_read_transport_placard_object(name));
drop policy if exists "authorized users upload transport placards" on storage.objects;
create policy "authorized users upload transport placards" on storage.objects for insert to authenticated
with check (bucket_id='transport-placards' and public.can_write_transport_placard_object(name));
drop policy if exists "authorized users update transport placards" on storage.objects;
create policy "authorized users update transport placards" on storage.objects for update to authenticated
using (bucket_id='transport-placards' and public.can_write_transport_placard_object(name))
with check (bucket_id='transport-placards' and public.can_write_transport_placard_object(name));
drop policy if exists "authorized users delete transport placards" on storage.objects;
create policy "authorized users delete transport placards" on storage.objects for delete to authenticated
using (bucket_id='transport-placards' and public.can_write_transport_placard_object(name));

revoke all on function public.transport_placard_meeting_id(text) from public;
revoke all on function public.can_read_transport_placard_object(text) from public;
revoke all on function public.can_write_transport_placard_object(text) from public;
grant execute on function public.transport_placard_meeting_id(text) to authenticated;
grant execute on function public.can_read_transport_placard_object(text) to authenticated;
grant execute on function public.can_write_transport_placard_object(text) to authenticated;

notify pgrst, 'reload schema';
