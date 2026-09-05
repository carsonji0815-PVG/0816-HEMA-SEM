-- A small revision fingerprint lets management pages poll frequently without repeatedly downloading the full roster.
create or replace function public.get_meeting_live_revision(p_meeting_id uuid)
returns text
language plpgsql stable security definer set search_path=public
as $$
declare result text;
begin
  if not public.is_meeting_member(p_meeting_id) then raise exception '无权查看该会议'; end if;
  select md5(concat_ws('|',
    coalesce((select md5(to_jsonb(m)::text) from public.meetings m where m.id=p_meeting_id),''),
    coalesce((select count(*)::text||':'||coalesce(max(a.updated_at)::text,'') from public.attendees a where a.meeting_id=p_meeting_id),'0:'),
    coalesce((select count(*)::text||':'||coalesce(max(t.updated_at)::text,'') from public.transports t join public.attendees a on a.id=t.attendee_id where a.meeting_id=p_meeting_id),'0:'),
    coalesce((select count(*)::text||':'||coalesce(max(c.updated_at)::text,'') from public.column_locks c where c.meeting_id=p_meeting_id),'0:'),
    coalesce((select count(*)::text||':'||coalesce(max(n.created_at)::text,'')||':'||count(*) filter(where n.read_at is null)::text from public.notifications n where n.meeting_id=p_meeting_id),'0::0'),
    coalesce((select count(*)::text||':'||coalesce(max(r.updated_at)::text,'') from public.registrants r where r.meeting_id=p_meeting_id),'0:'),
    coalesce((select count(*)::text||':'||coalesce(max(o.created_at)::text,'') from public.operation_audit_logs o where o.meeting_id=p_meeting_id),'0:')
  )) into result;
  return result;
end; $$;

revoke all on function public.get_meeting_live_revision(uuid) from public;
grant execute on function public.get_meeting_live_revision(uuid) to authenticated;
