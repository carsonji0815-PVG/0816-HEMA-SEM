-- Repair browser-produced two-digit years (for example 0026 instead of 2026)
-- and prevent malformed journey years from entering any write path again.
do $$
declare
  column_name text;
  constraint_name text;
begin
  foreach column_name in array array['depart_date','arrive_date','return_depart_date','return_arrive_date','out_date','return_date'] loop
    execute format(
      'update public.attendees set %1$I=(%1$I + interval ''2000 years'')::date where %1$I is not null and extract(year from %1$I) between 1 and 99',
      column_name
    );
    constraint_name := 'attendees_' || column_name || '_year_check';
    if not exists (
      select 1 from pg_constraint
      where conrelid='public.attendees'::regclass and conname=constraint_name
    ) then
      execute format(
        'alter table public.attendees add constraint %I check (%I is null or (%I >= date ''2000-01-01'' and %I <= date ''2099-12-31'')) not valid',
        constraint_name,column_name,column_name,column_name
      );
    end if;
    execute format('alter table public.attendees validate constraint %I',constraint_name);
  end loop;
end $$;
