-- Registration can be opened without an uploaded or referenced template.
-- The public form already falls back to the system standard field definition.
create or replace function public.set_registration_open(p_meeting_id uuid,p_open boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_before boolean; v_actor text;
begin
  if not (public.is_system_admin() or public.meeting_role(p_meeting_id) in ('ops','client')) then raise exception '无权更改报名开放状态'; end if;
  select registration_open into v_before from public.meetings where id=p_meeting_id for update;
  if v_before is null and not exists(select 1 from public.meetings where id=p_meeting_id) then raise exception '项目不存在'; end if;
  perform set_config('app.registration_config_rpc','on',true);
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor from public.profiles p
    left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=p_meeting_id where p.user_id=auth.uid();
  update public.meetings set registration_open=p_open,registration_open_updated_at=now(),registration_open_updated_by=auth.uid() where id=p_meeting_id;
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data,metadata)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'系统'),'registration_switch_changed','meeting',p_meeting_id::text,
    jsonb_build_object('registrationOpen',v_before),jsonb_build_object('registrationOpen',p_open),
    jsonb_build_object('templateRequired',false,'attendeeRosterRequired',false,'fallbackTemplate','system_standard'));
end; $$;

grant execute on function public.set_registration_open(uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
