-- Supabase/PostgREST rejects unqualified DELETE statements invoked through RPC.
-- Keep the full-replacement semantics while making the target rows explicit.
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
  delete from public.station_dict where id is not null;
  insert into public.station_dict(city_name,transport_type,station_name,station_short_name)
  select distinct city_name,transport_type,station_name,station_short_name from tmp_station_dict;
  get diagnostics v_count=row_count;return v_count;
end; $$;

create or replace function public.replace_city_aliases(p_items jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可维护城市别名'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception '城市别名格式错误'; end if;
  create temporary table tmp_city_alias(alias_name text,standard_city_name text) on commit drop;
  insert into tmp_city_alias select public.normalize_station_text(alias),regexp_replace(public.normalize_station_text(city),'市$','') from jsonb_to_recordset(p_items) as x(alias text,city text);
  if exists(select 1 from tmp_city_alias where alias_name='' or standard_city_name='') then raise exception '城市别名包含无效数据'; end if;
  delete from public.city_alias where alias_name is not null;
  insert into public.city_alias(alias_name,standard_city_name) select distinct on(alias_name) alias_name,standard_city_name from tmp_city_alias order by alias_name;
  get diagnostics v_count=row_count;return v_count;
end; $$;

revoke all on function public.replace_station_dictionary(jsonb) from public;
revoke all on function public.replace_city_aliases(jsonb) from public;
grant execute on function public.replace_station_dictionary(jsonb) to authenticated;
grant execute on function public.replace_city_aliases(jsonb) to authenticated;
notify pgrst,'reload schema';
