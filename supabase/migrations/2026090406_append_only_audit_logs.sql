-- Security hardening: audit history is append-only.
-- PostgreSQL superusers retain an emergency recovery path by design; application
-- roles and service functions cannot rewrite or delete historical audit events.
create or replace function public.reject_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'audit logs are append-only'
    using errcode = '42501';
end;
$$;

revoke all on function public.reject_audit_log_mutation() from public, anon, authenticated;

drop trigger if exists operation_audit_logs_append_only on public.operation_audit_logs;
create trigger operation_audit_logs_append_only
before update or delete on public.operation_audit_logs
for each row execute function public.reject_audit_log_mutation();

drop trigger if exists operation_audit_logs_no_truncate on public.operation_audit_logs;
create trigger operation_audit_logs_no_truncate
before truncate on public.operation_audit_logs
for each statement execute function public.reject_audit_log_mutation();

drop trigger if exists luggage_audit_logs_append_only on public.luggage_audit_logs;
create trigger luggage_audit_logs_append_only
before update or delete on public.luggage_audit_logs
for each row execute function public.reject_audit_log_mutation();

drop trigger if exists luggage_audit_logs_no_truncate on public.luggage_audit_logs;
create trigger luggage_audit_logs_no_truncate
before truncate on public.luggage_audit_logs
for each statement execute function public.reject_audit_log_mutation();

revoke update, delete, truncate on public.operation_audit_logs from anon, authenticated, service_role;
revoke update, delete, truncate on public.luggage_audit_logs from anon, authenticated, service_role;
