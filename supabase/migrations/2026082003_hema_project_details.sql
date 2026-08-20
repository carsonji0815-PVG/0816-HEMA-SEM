update public.meetings
set client_name = coalesce(nullif(client_name, ''), '礼来'),
    start_date = coalesce(start_date, date '2026-09-04'),
    end_date = coalesce(end_date, date '2026-09-12'),
    venues = case when cardinality(venues) = 0 then array['大连会场', '福州会场']::text[] else venues end
where slug = 'hema-sem-2026';
