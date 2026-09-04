-- Keep the system-wide super administrator role while allowing the same
-- account to be explicitly assigned as an operations manager for a project.

create or replace function public.list_system_staff(p_meeting_id uuid)
returns table(email text,display_name text,system_role text,account_created boolean,project_enabled boolean)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可查看系统账号'; end if;
  return query
  select s.email,s.display_name,s.system_role,(u.id is not null),
    exists(select 1 from public.meeting_members mm where mm.meeting_id=p_meeting_id and mm.user_id=u.id)
  from public.system_staff_allowlist s
  left join auth.users u on lower(trim(u.email))=s.email
  where s.active
  order by case when s.system_role='super_admin' then 0 else 1 end,s.created_at;
end; $$;

create or replace function public.set_project_staff_member(p_meeting_id uuid,p_email text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_email text:=lower(trim(p_email));
  v_staff public.system_staff_allowlist%rowtype;
  v_user auth.users%rowtype;
  v_role public.app_role;
  v_owner uuid;
  v_actor text;
  v_was_enabled boolean;
begin
  if not public.is_system_admin() then raise exception '仅超级管理员可设置项目权限'; end if;
  select * into v_staff from public.system_staff_allowlist where email=v_email and active;
  if v_staff.email is null then raise exception '该邮箱不是可分配账号'; end if;
  select * into v_user from auth.users where lower(trim(email))=v_email;
  if v_user.id is null then raise exception '该邮箱尚未创建登录账号'; end if;

  v_role:=case when v_staff.system_role='readonly' then 'sales'::public.app_role else 'ops'::public.app_role end;
  select owner_user_id into v_owner from public.meetings where id=p_meeting_id;
  if v_owner is null then raise exception '项目不存在'; end if;
  select exists(select 1 from public.meeting_members where meeting_id=p_meeting_id and user_id=v_user.id) into v_was_enabled;

  insert into public.profiles(user_id,meeting_id,display_name,role)
  values(v_user.id,null,v_staff.display_name,v_role)
  on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role;

  if p_enabled then
    insert into public.meeting_members(meeting_id,user_id,display_name,role)
    values(p_meeting_id,v_user.id,v_staff.display_name,v_role)
    on conflict(meeting_id,user_id) do update set display_name=excluded.display_name,role=excluded.role;
  else
    -- Removing the project-level appointment never removes global super-admin
    -- access and does not transfer project ownership away from a super admin.
    if v_staff.system_role<>'super_admin' and v_owner=v_user.id then
      update public.meetings set owner_user_id=auth.uid() where id=p_meeting_id;
    end if;
    delete from public.meeting_members where meeting_id=p_meeting_id and user_id=v_user.id;
  end if;

  select coalesce(display_name,public.current_staff_email()) into v_actor from public.profiles where user_id=auth.uid();
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data,metadata)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'超级管理员'),'project_staff_access_changed','staff',v_email,
    jsonb_build_object('projectEnabled',v_was_enabled),jsonb_build_object('projectEnabled',p_enabled),
    jsonb_build_object('email',v_email,'displayName',v_staff.display_name,'systemRole',v_staff.system_role));
end; $$;

grant execute on function public.list_system_staff(uuid) to authenticated;
grant execute on function public.set_project_staff_member(uuid,text,boolean) to authenticated;
