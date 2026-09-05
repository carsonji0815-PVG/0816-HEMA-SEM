-- One authoritative meeting location catalog. IDs are stored in field_config and
-- referenced from attendee custom_fields so registration, rooming and lookup
-- cannot silently point at similarly named but unrelated records.

update public.meetings m
set field_config=jsonb_set(
  coalesce(m.field_config,'{}'::jsonb),
  '{locationCatalog}',
  jsonb_build_object(
    'version',1,
    'cities',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id','city-'||md5(m.id::text||':'||trim(city_name)),
        'name',trim(city_name)
      ) order by ordinal)
      from unnest(coalesce(m.venues,'{}'::text[])) with ordinality as venue(city_name,ordinal)
      where trim(city_name)<>''
    ),'[]'::jsonb),
    'hotels','[]'::jsonb,
    'meetingVenues','[]'::jsonb
  ),
  true
)
where not (coalesce(m.field_config,'{}'::jsonb) ? 'locationCatalog');

update public.attendees a
set custom_fields=jsonb_set(
  coalesce(a.custom_fields,'{}'::jsonb),
  '{_location}',
  jsonb_build_object('cityId',(
    select city_item.value->>'id'
    from public.meetings m,
         jsonb_array_elements(coalesce(m.field_config->'locationCatalog'->'cities','[]'::jsonb)) as city_item(value)
    where m.id=a.meeting_id and lower(regexp_replace(city_item.value->>'name','\s','','g'))=lower(regexp_replace(coalesce(a.venue,''),'\s','','g'))
    limit 1
  ),'venueId',''),
  true
)
where coalesce(a.custom_fields->'_location'->>'cityId','')=''
and exists(
  select 1
  from public.meetings m,
       jsonb_array_elements(coalesce(m.field_config->'locationCatalog'->'cities','[]'::jsonb)) as city_item(value)
  where m.id=a.meeting_id and lower(regexp_replace(city_item.value->>'name','\s','','g'))=lower(regexp_replace(coalesce(a.venue,''),'\s','','g'))
);

create or replace function public.validate_attendee_location_references()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_catalog jsonb;
  v_city_id text:=coalesce(new.custom_fields->'_location'->>'cityId','');
  v_hotel_id text:=coalesce(new.custom_fields->'_rooming'->>'hotelId','');
  v_venue_id text:=coalesce(new.custom_fields->'_location'->>'venueId','');
begin
  select coalesce(field_config->'locationCatalog','{}'::jsonb) into v_catalog from public.meetings where id=new.meeting_id;
  if v_city_id<>'' and not exists(select 1 from jsonb_array_elements(coalesce(v_catalog->'cities','[]'::jsonb)) item where item->>'id'=v_city_id) then
    raise exception '举办城市已失效，请重新选择' using errcode='23514';
  end if;
  if v_hotel_id<>'' and not exists(select 1 from jsonb_array_elements(coalesce(v_catalog->'hotels','[]'::jsonb)) item where item->>'id'=v_hotel_id and (v_city_id='' or item->>'cityId'=v_city_id)) then
    raise exception '住宿酒店与举办城市不匹配' using errcode='23514';
  end if;
  if v_venue_id<>'' and not exists(select 1 from jsonb_array_elements(coalesce(v_catalog->'meetingVenues','[]'::jsonb)) item where item->>'id'=v_venue_id and (v_city_id='' or item->>'cityId'=v_city_id)) then
    raise exception '会场信息与举办城市不匹配' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger if exists attendee_location_references_guard on public.attendees;
create trigger attendee_location_references_guard before insert or update of meeting_id,venue,custom_fields on public.attendees
for each row execute function public.validate_attendee_location_references();

create or replace function public.validate_meeting_location_catalog_update()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(
    select 1 from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'cities','[]'::jsonb)) item
    where coalesce(item->>'id','')='' or coalesce(trim(item->>'name'),'')=''
  ) or exists(
    select 1 from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'cities','[]'::jsonb)) item
    group by item->>'id' having count(*)>1
  ) then raise exception '举办城市目录存在空值或重复编号' using errcode='23514';
  end if;
  if exists(
    select 1 from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'hotels','[]'::jsonb)) hotel
    where not exists(select 1 from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'cities','[]'::jsonb)) city where city->>'id'=hotel->>'cityId')
  ) then raise exception '会议酒店必须关联有效举办城市' using errcode='23514';
  end if;
  if exists(
    select 1 from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'meetingVenues','[]'::jsonb)) venue
    where not exists(select 1 from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'cities','[]'::jsonb)) city where city->>'id'=venue->>'cityId')
       or (coalesce(venue->>'hotelId','')<>'' and not exists(select 1 from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'hotels','[]'::jsonb)) hotel where hotel->>'id'=venue->>'hotelId' and hotel->>'cityId'=venue->>'cityId'))
  ) then raise exception '会场必须关联同一举办城市下的有效酒店' using errcode='23514';
  end if;
  if exists(
    select venue->>'cityId' from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'meetingVenues','[]'::jsonb)) venue
    group by venue->>'cityId'
    having count(*)>1 and count(*) filter(where coalesce((venue->>'isDefault')::boolean,false))<>1
  ) then raise exception '同一举办城市配置多个会场时必须且只能指定一个默认会场' using errcode='23514';
  end if;
  if new.field_config->'locationCatalog' is distinct from old.field_config->'locationCatalog' and exists(
    select 1 from public.attendees a
    where a.meeting_id=new.id and (
      (coalesce(a.custom_fields->'_location'->>'cityId','')<>'' and not exists(select 1 from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'cities','[]'::jsonb)) item where item->>'id'=a.custom_fields->'_location'->>'cityId')) or
      (coalesce(a.custom_fields->'_rooming'->>'hotelId','')<>'' and not exists(select 1 from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'hotels','[]'::jsonb)) item where item->>'id'=a.custom_fields->'_rooming'->>'hotelId')) or
      (coalesce(a.custom_fields->'_location'->>'venueId','')<>'' and not exists(select 1 from jsonb_array_elements(coalesce(new.field_config->'locationCatalog'->'meetingVenues','[]'::jsonb)) item where item->>'id'=a.custom_fields->'_location'->>'venueId'))
    )
  ) then raise exception '地点目录仍被报名或分房记录使用，请先重新分配' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger if exists meeting_location_catalog_guard on public.meetings;
create trigger meeting_location_catalog_guard before update of field_config on public.meetings
for each row execute function public.validate_meeting_location_catalog_update();

notify pgrst, 'reload schema';
