-- Execute as database role supabase_admin after the ordinary migration.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

alter default privileges in schema public
  revoke all privileges on tables from anon;
alter default privileges in schema public
  revoke all privileges on sequences from anon;
alter default privileges in schema public
  revoke truncate, references, trigger on tables from authenticated;
