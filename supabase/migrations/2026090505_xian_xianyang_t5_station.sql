insert into public.station_dict(city_name,transport_type,station_name,station_short_name)
values ('西安','PLANE','西安咸阳机场T5航站楼','西安咸阳 T5')
on conflict(city_name,transport_type,station_name) do update
set station_short_name=excluded.station_short_name,
    updated_at=now();
