-- Management APIs require a server-recorded session and an aal2 JWT.
create or replace function public.is_allowed_staff()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(auth.jwt()->>'aal','')='aal2' and exists(
    select 1 from public.staff_login_sessions ls
    where ls.user_id=auth.uid()
      and ls.email=public.current_staff_email()
      and ls.active
      and ls.session_id=public.current_auth_session_id()
      and ls.last_seen_at>now()-interval '30 minutes'
      and (
        exists(select 1 from public.system_staff_allowlist s where s.email=ls.email and s.active)
        or exists(select 1 from public.project_client_accounts c where c.user_id=auth.uid() and c.email=ls.email and c.active)
      )
  )
$$;

comment on function public.is_allowed_staff() is 'Allows management access only for active aal2 sessions belonging to approved staff or project client accounts.';
