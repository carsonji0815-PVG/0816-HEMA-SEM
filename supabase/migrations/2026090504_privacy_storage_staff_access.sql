-- Keep private attachments protected while allowing an active global super
-- administrator to upload even when the short-lived staff heartbeat has just
-- expired. The browser refreshes that heartbeat immediately before upload.

create or replace function public.is_active_global_super_admin()
returns boolean language sql stable security definer set search_path=public,auth as $$
  select exists(
    select 1
    from auth.users u
    join public.system_staff_allowlist s on s.email=lower(trim(u.email))
    where u.id=auth.uid() and s.active and s.system_role='super_admin'
  )
$$;

create or replace function public.can_read_privacy_letter_object(object_name text)
returns boolean language sql stable security definer set search_path=public,storage as $$
  select exists(
    select 1 from public.attendees a
    where a.id=public.privacy_storage_attendee_id(object_name)
      and a.meeting_id=public.privacy_storage_meeting_id(object_name)
      and (
        public.is_active_global_super_admin()
        or public.is_system_admin()
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
        public.is_active_global_super_admin()
        or public.can_edit_attendee_records(a.meeting_id)
        or a.owner_id=auth.uid()
      )
  )
$$;

revoke all on function public.is_active_global_super_admin() from public;
grant execute on function public.is_active_global_super_admin() to authenticated;
grant execute on function public.can_read_privacy_letter_object(text) to authenticated;
grant execute on function public.can_write_privacy_letter_object(text) to authenticated;
