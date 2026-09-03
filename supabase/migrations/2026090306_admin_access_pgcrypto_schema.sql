-- Self-hosted Supabase installs pgcrypto in the extensions schema.
create or replace function public.create_admin_access_link(p_minutes integer default 60,p_target_email text default null)
returns table(token text,expires_at timestamptz) language plpgsql security definer set search_path=public as $$
declare v_token text:=encode(extensions.gen_random_bytes(32),'hex'); v_expires timestamptz;
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可生成临时登录链接'; end if;
  p_minutes:=greatest(5,least(1440,coalesce(p_minutes,60)));
  if p_target_email is not null and not exists(select 1 from public.system_staff_allowlist where email=lower(trim(p_target_email)) and active) then raise exception '指定邮箱不在系统白名单'; end if;
  v_expires:=now()+make_interval(mins=>p_minutes);
  insert into public.admin_access_links(token_hash,target_email,expires_at,created_by)
  values(encode(extensions.digest(v_token,'sha256'),'hex'),nullif(lower(trim(p_target_email)),''),v_expires,auth.uid());
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,metadata)
  select m.id,auth.uid(),coalesce((select display_name from public.profiles where user_id=auth.uid()),'超级管理员'),'create_temp_login_link','security',null,
    jsonb_build_object('expiresAt',v_expires,'targetEmail',nullif(lower(trim(p_target_email)),''))
  from public.meetings m where m.archived_at is null order by m.created_at limit 1;
  return query select v_token,v_expires;
end; $$;

create or replace function public.validate_admin_access_link(p_token text)
returns table(valid boolean,target_email text,expires_at timestamptz) language plpgsql security definer set search_path=public as $$
declare v_hash text:=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex');
begin
  update public.admin_access_links set last_validated_at=now()
  where token_hash=v_hash and revoked_at is null and admin_access_links.expires_at>now();
  return query select true,l.target_email,l.expires_at from public.admin_access_links l
    where l.token_hash=v_hash and l.revoked_at is null and l.expires_at>now()
  union all select false,null::text,null::timestamptz where not exists(
    select 1 from public.admin_access_links l where l.token_hash=v_hash and l.revoked_at is null and l.expires_at>now()
  ) limit 1;
end; $$;

grant execute on function public.create_admin_access_link(integer,text) to authenticated;
grant execute on function public.validate_admin_access_link(text) to anon,authenticated;
notify pgrst, 'reload schema';
