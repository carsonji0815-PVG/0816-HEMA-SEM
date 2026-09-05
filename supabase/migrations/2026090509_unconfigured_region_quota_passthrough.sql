-- Regions without a positive listener quota remain registerable and are reported as unallocated actuals.
create or replace function public.enforce_external_listener_quota()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_type text; v_quotas jsonb; v_quota integer; v_count integer;
begin
  if coalesce(new.business_status,'active')='cancelled' or public.is_guest_attendee_role(new.attendee_type) then return new; end if;
  select activity_type,coalesce(field_config->'registrationQuotas','[]'::jsonb) into v_type,v_quotas from public.meetings where id=new.meeting_id;
  if v_type='internal' or jsonb_typeof(v_quotas)<>'array' or jsonb_array_length(v_quotas)=0 then return new; end if;
  select coalesce(sum(greatest(0,coalesce((item->>'quota')::integer,0))),0) into v_quota from jsonb_array_elements(v_quotas) item
    where public.normalize_quota_venue(item->>'venue')=public.normalize_quota_venue(new.venue) and trim(coalesce(item->>'region',''))=trim(coalesce(new.region,'')) and coalesce(item->>'role','听众')='听众';
  if v_quota=0 then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.meeting_id::text||'|'||public.normalize_quota_venue(new.venue)||'|'||trim(coalesce(new.region,'')),0));
  select count(*) into v_count from public.attendees a where a.meeting_id=new.meeting_id and coalesce(a.business_status,'active')<>'cancelled' and not public.is_guest_attendee_role(a.attendee_type) and public.normalize_quota_venue(a.venue)=public.normalize_quota_venue(new.venue) and trim(coalesce(a.region,''))=trim(coalesce(new.region,'')) and a.id is distinct from new.id;
  if v_count>=v_quota then raise exception '该会场和大区听众名额已满'; end if;
  return new;
end; $$;

revoke all on function public.enforce_external_listener_quota() from public;
