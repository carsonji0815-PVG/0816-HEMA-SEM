-- Keep the login profile when its original project is deleted.  Profiles are
-- account-level records; the legacy meeting_id column is only a compatibility
-- pointer and must not cascade-delete the account profile.

alter table public.profiles alter column meeting_id drop not null;
alter table public.profiles drop constraint if exists profiles_meeting_id_fkey;
alter table public.profiles
  add constraint profiles_meeting_id_fkey
  foreign key (meeting_id) references public.meetings(id) on delete set null;

drop policy if exists "members read profiles" on public.profiles;
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated
using (user_id=auth.uid() or public.is_system_admin());

create or replace function public.link_profile_first_project()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  update public.profiles
  set meeting_id=new.id
  where user_id=new.owner_user_id and meeting_id is null;
  return new;
end; $$;

drop trigger if exists meetings_link_profile_first_project on public.meetings;
create trigger meetings_link_profile_first_project
after insert on public.meetings
for each row execute function public.link_profile_first_project();

create or replace function public.delete_meeting_project(p_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare
  v_replacement uuid;
begin
  if not public.can_manage_project(p_id) then raise exception '无权删除该项目'; end if;

  select m.id into v_replacement
  from public.meetings m
  where m.id<>p_id
    and m.owner_user_id in (select p.user_id from public.profiles p where p.meeting_id=p_id)
  order by m.created_at desc
  limit 1;

  update public.profiles set meeting_id=v_replacement where meeting_id=p_id;
  delete from public.meetings where id=p_id;
end; $$;

grant execute on function public.delete_meeting_project(uuid) to authenticated;
