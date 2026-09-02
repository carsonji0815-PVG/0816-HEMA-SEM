-- Canonical airport names follow the VariFlight display convention: remove
-- the word “国际”, while preserving the airport identity and terminal.
create or replace function public.canonical_station_name(p_value text,p_transport_type text)
returns text language sql immutable parallel safe as $$
  select case when p_transport_type='PLANE'
    then replace(public.normalize_station_text(p_value),'国际机场','机场')
    else public.normalize_station_text(p_value) end
$$;

create or replace function public.guard_station_dictionary()
returns trigger language plpgsql as $$
begin
  new.city_name:=regexp_replace(public.normalize_station_text(new.city_name),'市$','');
  new.station_name:=public.canonical_station_name(new.station_name,new.transport_type);
  new.station_short_name:=coalesce(nullif(public.normalize_station_text(new.station_short_name),''),new.station_name);
  if new.city_name='' or new.station_name='' or new.transport_type not in('PLANE','HIGH_SPEED_RAIL') then raise exception '场站字典数据无效'; end if;
  new.updated_at:=now();return new;
end; $$;

insert into public.station_dict(city_name,transport_type,station_name,station_short_name)
select city_name,transport_type,public.canonical_station_name(station_name,transport_type),station_short_name
from public.station_dict where transport_type='PLANE' and station_name like '%国际机场%'
on conflict(city_name,transport_type,station_name) do update
set station_short_name=excluded.station_short_name,updated_at=now();
delete from public.station_dict where transport_type='PLANE' and station_name like '%国际机场%';

alter table public.attendees disable trigger user;
update public.attendees set
  depart_station=replace(depart_station,'国际机场','机场'),
  arrive_station=replace(arrive_station,'国际机场','机场'),
  return_depart_station=replace(return_depart_station,'国际机场','机场'),
  return_arrive_station=replace(return_arrive_station,'国际机场','机场'),
  out_from=replace(out_from,'国际机场','机场'),
  out_to=replace(out_to,'国际机场','机场'),
  return_from=replace(return_from,'国际机场','机场'),
  return_to=replace(return_to,'国际机场','机场'),
  custom_fields=replace(custom_fields::text,'国际机场','机场')::jsonb
where concat_ws('|',depart_station,arrive_station,return_depart_station,return_arrive_station,out_from,out_to,return_from,return_to,custom_fields::text) like '%国际机场%';
alter table public.attendees enable trigger user;

update public.system_configuration
set settings=replace(settings::text,'国际机场','机场')::jsonb,updated_at=now()
where settings::text like '%国际机场%';

create or replace function public.replace_station_dictionary(p_items jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可维护场站字典'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception '场站字典格式错误'; end if;
  create temporary table tmp_station_dict(city_name text,transport_type text,station_name text,station_short_name text) on commit drop;
  insert into tmp_station_dict
  select regexp_replace(public.normalize_station_text(city),'市$',''),public.normalize_station_text(type),
    public.canonical_station_name(name,public.normalize_station_text(type)),
    coalesce(nullif(public.normalize_station_text(short_name),''),public.canonical_station_name(name,public.normalize_station_text(type)))
  from jsonb_to_recordset(p_items) as x(city text,type text,name text,short_name text);
  if exists(select 1 from tmp_station_dict where city_name='' or station_name='' or transport_type not in('PLANE','HIGH_SPEED_RAIL')) then raise exception '场站字典包含无效数据'; end if;
  delete from public.station_dict;
  insert into public.station_dict(city_name,transport_type,station_name,station_short_name)
  select distinct city_name,transport_type,station_name,station_short_name from tmp_station_dict;
  get diagnostics v_count=row_count;return v_count;
end; $$;
revoke all on function public.replace_station_dictionary(jsonb) from public;
grant execute on function public.replace_station_dictionary(jsonb) to authenticated;

notify pgrst,'reload schema';
