-- Explicit transport selection is authoritative. Repair airport values that
-- were previously formatted as rail stations because a flight number began
-- with a train-like letter (for example G54484).
create or replace function public.canonical_station_name(p_value text,p_transport_type text)
returns text language sql immutable parallel safe as $$
  select case when p_transport_type='PLANE'
    then regexp_replace(replace(public.normalize_station_text(p_value),'国际机场','机场'),'(机场|航站楼)站$','\1')
    else public.normalize_station_text(p_value) end
$$;

alter table public.attendees disable trigger user;
update public.attendees
set
  depart_station=case when depart_transport_type='PLANE' then regexp_replace(depart_station,'(机场|航站楼)站$','\1') else depart_station end,
  arrive_station=case when arrive_transport_type='PLANE' then regexp_replace(arrive_station,'(机场|航站楼)站$','\1') else arrive_station end,
  return_depart_station=case when return_depart_transport_type='PLANE' then regexp_replace(return_depart_station,'(机场|航站楼)站$','\1') else return_depart_station end,
  return_arrive_station=case when return_arrive_transport_type='PLANE' then regexp_replace(return_arrive_station,'(机场|航站楼)站$','\1') else return_arrive_station end,
  out_from=case when depart_transport_type='PLANE' then regexp_replace(out_from,'(机场|航站楼)站$','\1') else out_from end,
  out_to=case when arrive_transport_type='PLANE' then regexp_replace(out_to,'(机场|航站楼)站$','\1') else out_to end,
  return_from=case when return_depart_transport_type='PLANE' then regexp_replace(return_from,'(机场|航站楼)站$','\1') else return_from end,
  return_to=case when return_arrive_transport_type='PLANE' then regexp_replace(return_to,'(机场|航站楼)站$','\1') else return_to end,
  custom_fields=(coalesce(custom_fields,'{}'::jsonb)-'_travelVerification'-'_travelVerifiedHighlights'),
  verify_highlight_fields='[]'::jsonb
where
  (depart_transport_type='PLANE' and depart_station ~ '(机场|航站楼)站$')
  or (arrive_transport_type='PLANE' and arrive_station ~ '(机场|航站楼)站$')
  or (return_depart_transport_type='PLANE' and return_depart_station ~ '(机场|航站楼)站$')
  or (return_arrive_transport_type='PLANE' and return_arrive_station ~ '(机场|航站楼)站$');
alter table public.attendees enable trigger user;

notify pgrst,'reload schema';
