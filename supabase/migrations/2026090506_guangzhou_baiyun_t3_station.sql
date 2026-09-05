insert into public.station_dict(city_name,transport_type,station_name,station_short_name)
values ('广州','PLANE','广州白云机场T3航站楼','广州白云 T3')
on conflict(city_name,transport_type,station_name) do update
set station_short_name=excluded.station_short_name,
    updated_at=now();
