insert into public.station_dict(city_name,transport_type,station_name,station_short_name) values
('西安','PLANE','西安咸阳机场T5航站楼','西安咸阳 T5'),
('广州','PLANE','广州白云机场T3航站楼','广州白云 T3')
on conflict(city_name,transport_type,station_name) do update
set station_short_name=excluded.station_short_name,
    updated_at=now();

delete from public.station_dict
where transport_type='PLANE'
  and station_name in ('西安咸阳国际机场T5航站楼','广州白云国际机场T3航站楼');
