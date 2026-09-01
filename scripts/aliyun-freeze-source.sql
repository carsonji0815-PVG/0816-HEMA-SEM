-- Run once on the SOURCE project, only for the user-approved cutover window.
-- Data is not modified. A single transaction blocks all public-table writes.
-- Rollback before cutover: DROP SCHEMA _lilly_migration_guard CASCADE;
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
create schema _lilly_migration_guard;
revoke all on schema _lilly_migration_guard from public;
create function _lilly_migration_guard.reject_source_write()
returns trigger language plpgsql security definer
set search_path=pg_catalog
as $$ begin
  raise exception '系统已进入阿里云迁移只读窗口，请刷新页面后使用新入口：https://139.196.97.236/meeting/' using errcode='55000';
end; $$;
revoke all on function _lilly_migration_guard.reject_source_write() from public;
do $$ declare item record; begin
  for item in select tablename from pg_tables where schemaname='public' loop
    execute format('create trigger lilly_migration_readonly before insert or update or delete or truncate on public.%I for each statement execute function _lilly_migration_guard.reject_source_write()',item.tablename);
  end loop;
end; $$;
commit;
select count(*) as protected_tables from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where t.tgname='lilly_migration_readonly' and n.nspname='public';
