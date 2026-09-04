-- The public registration surface is implemented by reviewed Edge functions
-- using the service role.  Anonymous browsers must never address business
-- tables or their sequences directly, even though RLS also denies the rows.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

-- Authenticated staff keep the ordinary SELECT / INSERT / UPDATE / DELETE
-- privileges required by the management UI.  PostgreSQL ownership operations
-- are never needed by a browser session.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Supabase and project migrations create objects as either postgres or
-- supabase_admin.  Harden both default ACLs so future tables cannot silently
-- reintroduce the broad grants above.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

-- Objects owned by supabase_admin require the companion operational ACL file
-- to be executed as that grantor; PostgreSQL intentionally prevents another
-- non-superuser grantor from changing those default privileges.
