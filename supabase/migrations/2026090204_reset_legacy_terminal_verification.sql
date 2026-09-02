-- Remove only verification evidence created by the previous airport naming
-- rule. Business itinerary fields remain intact and will be checked again.
alter table public.attendees disable trigger user;
update public.attendees
set custom_fields=(coalesce(custom_fields,'{}'::jsonb)-'_travelVerification'-'_travelVerifiedHighlights'),
    verify_highlight_fields='[]'::jsonb
where (custom_fields->'_travelVerification')::text like '%航站楼%';
alter table public.attendees enable trigger user;
notify pgrst,'reload schema';
