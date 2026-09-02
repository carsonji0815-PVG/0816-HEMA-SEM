-- Delete only the uploaded registration-template attachment while preserving
-- the parsed field schema, registration availability and all attendee data.
create or replace function public.remove_project_registration_template_attachment(p_meeting_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_meeting public.meetings%rowtype; v_actor text;
begin
  if not (public.is_system_admin() or public.meeting_role(p_meeting_id)='ops') then raise exception '无权删除报名模板附件'; end if;
  select * into v_meeting from public.meetings where id=p_meeting_id for update;
  if v_meeting.id is null then raise exception '会议项目不存在'; end if;
  if v_meeting.template_is_system_default then raise exception '系统内置默认模板没有可删除附件'; end if;
  if v_meeting.template_imported_at is null or (v_meeting.template_name is null and v_meeting.template_storage_path is null) then raise exception '当前没有可删除的报名模板附件'; end if;
  perform set_config('app.registration_config_rpc','on',true);
  update public.meetings set template_name=null,template_storage_path=null where id=p_meeting_id;
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor from public.profiles p left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=p_meeting_id where p.user_id=auth.uid();
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'系统'),'registration_template_attachment_removed','meeting',p_meeting_id::text,jsonb_build_object('name',v_meeting.template_name,'storagePath',v_meeting.template_storage_path),jsonb_build_object('registrationTemplatePreserved',true,'registrationOpenPreserved',v_meeting.registration_open));
  return v_meeting.template_storage_path;
end; $$;

revoke all on function public.remove_project_registration_template_attachment(uuid) from public;
grant execute on function public.remove_project_registration_template_attachment(uuid) to authenticated;
