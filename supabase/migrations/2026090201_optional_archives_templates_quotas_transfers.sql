-- Optional project archives, safe template lifecycle, internal/external quotas,
-- and optional attendee transfer collection.

alter table public.meetings add column if not exists template_storage_path text;
alter table public.meetings add column if not exists template_is_system_default boolean not null default false;
alter table public.meetings add column if not exists transfer_collection_enabled boolean not null default false;
alter table public.meetings add column if not exists transfer_collection_roles text[] not null default '{}'::text[];

alter table public.attendees add column if not exists outbound_transfer_origin text;
alter table public.attendees add column if not exists outbound_transfer_time timestamptz;
alter table public.attendees add column if not exists outbound_transfer_notes text;
alter table public.attendees add column if not exists return_transfer_destination text;
alter table public.attendees add column if not exists return_transfer_time timestamptz;
alter table public.attendees add column if not exists return_transfer_notes text;

do $$ begin
  alter table public.meetings add constraint meetings_transfer_collection_roles_check
    check (transfer_collection_roles <@ array['角色嘉宾','听众','赞助商']::text[]);
exception when duplicate_object then null; end $$;

-- A project document is an optional archive. It never gates project modules.
create or replace function public.project_management_open(target_meeting uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.meetings where id=target_meeting)
$$;

drop function if exists public.save_project_registration_template(uuid,text,jsonb);
create function public.save_project_registration_template(p_meeting_id uuid,p_template_name text,p_template jsonb,p_storage_path text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_before jsonb; v_actor text;
begin
  if not (public.is_system_admin() or public.meeting_role(p_meeting_id)='ops') then raise exception '无权设置报名模板'; end if;
  if jsonb_typeof(p_template->'columns')<>'array' or jsonb_array_length(p_template->'columns')<2 then raise exception '报名模板至少需要两个字段'; end if;
  select jsonb_build_object('template',registration_template,'name',template_name,'storagePath',template_storage_path) into v_before from public.meetings where id=p_meeting_id for update;
  perform set_config('app.registration_config_rpc','on',true);
  update public.meetings set template_name=nullif(trim(p_template_name),''),registration_template=p_template,template_imported_at=now(),template_storage_path=nullif(trim(p_storage_path),''),template_is_system_default=false where id=p_meeting_id;
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor from public.profiles p left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=p_meeting_id where p.user_id=auth.uid();
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'系统'),'registration_template_saved','meeting',p_meeting_id::text,v_before,jsonb_build_object('template',p_template,'name',p_template_name,'storagePath',p_storage_path));
end; $$;

create or replace function public.get_project_registration_template_delete_status(p_meeting_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  if not (public.is_system_admin() or public.meeting_role(p_meeting_id)='ops') then raise exception '无权删除报名模板'; end if;
  select jsonb_build_object('referenced',exists(select 1 from public.attendees a where a.meeting_id=m.id),'system_default',m.template_is_system_default,'registration_open',m.registration_open,'storage_path',m.template_storage_path,'imported',m.template_imported_at is not null)
  into v_result from public.meetings m where m.id=p_meeting_id;
  if v_result is null then raise exception '会议项目不存在'; end if;
  return v_result;
end; $$;

drop function if exists public.remove_project_registration_template(uuid);
create function public.remove_project_registration_template(p_meeting_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_meeting public.meetings%rowtype; v_actor text;
begin
  if not (public.is_system_admin() or public.meeting_role(p_meeting_id)='ops') then raise exception '无权删除报名模板'; end if;
  select * into v_meeting from public.meetings where id=p_meeting_id for update;
  if v_meeting.id is null then raise exception '会议项目不存在'; end if;
  if v_meeting.template_is_system_default then raise exception '系统内置默认模板不允许删除'; end if;
  if v_meeting.registration_open then raise exception '请先关闭报名开关，再删除模板'; end if;
  if exists(select 1 from public.attendees where meeting_id=p_meeting_id) then raise exception '该模板已被报名数据使用，不允许删除'; end if;
  perform set_config('app.registration_config_rpc','on',true);
  update public.meetings set template_name=null,registration_template='{}'::jsonb,template_imported_at=null,template_storage_path=null,template_is_system_default=false where id=p_meeting_id;
  select coalesce(mm.display_name,p.display_name,'系统') into v_actor from public.profiles p left join public.meeting_members mm on mm.user_id=auth.uid() and mm.meeting_id=p_meeting_id where p.user_id=auth.uid();
  insert into public.operation_audit_logs(meeting_id,actor_user_id,actor_label,action,target_type,target_id,before_data,after_data)
  values(p_meeting_id,auth.uid(),coalesce(v_actor,'系统'),'registration_template_removed','meeting',p_meeting_id::text,jsonb_build_object('template',v_meeting.registration_template,'name',v_meeting.template_name,'storagePath',v_meeting.template_storage_path),'{}'::jsonb);
  return v_meeting.template_storage_path;
end; $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('registration-template-files','registration-template-files',false,20971520,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv','application/csv','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.registration_template_storage_meeting_id(object_name text)
returns uuid language plpgsql stable security definer set search_path=public,storage as $$
declare parts text[];
begin parts:=storage.foldername(object_name);if coalesce(array_length(parts,1),0)<1 then return null;end if;return parts[1]::uuid;exception when others then return null;end; $$;

create or replace function public.can_manage_registration_template_object(object_name text)
returns boolean language sql stable security definer set search_path=public,storage as $$
  select public.is_system_admin() or public.meeting_role(public.registration_template_storage_meeting_id(object_name))='ops'
$$;

drop policy if exists "project managers read registration templates" on storage.objects;
create policy "project managers read registration templates" on storage.objects for select to authenticated using(bucket_id='registration-template-files' and public.can_manage_registration_template_object(name));
drop policy if exists "project managers upload registration templates" on storage.objects;
create policy "project managers upload registration templates" on storage.objects for insert to authenticated with check(bucket_id='registration-template-files' and public.can_manage_registration_template_object(name));
drop policy if exists "project managers update registration templates" on storage.objects;
create policy "project managers update registration templates" on storage.objects for update to authenticated using(bucket_id='registration-template-files' and public.can_manage_registration_template_object(name)) with check(bucket_id='registration-template-files' and public.can_manage_registration_template_object(name));
drop policy if exists "project managers delete registration templates" on storage.objects;
create policy "project managers delete registration templates" on storage.objects for delete to authenticated using(bucket_id='registration-template-files' and public.can_manage_registration_template_object(name));

create or replace function public.normalize_quota_venue(value text)
returns text language sql immutable as $$select trim(regexp_replace(coalesce(value,''),'会场$','','g'))$$;
create or replace function public.is_guest_attendee_role(value text)
returns boolean language sql immutable as $$select coalesce(value,'') ~* '(主席|主持|讲者|讨论嘉宾|组长|嘉宾|chair|moderator|speaker|panelist)'$$;

create or replace function public.enforce_external_listener_quota()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_type text; v_quotas jsonb; v_quota integer; v_count integer;
begin
  if new.business_status='cancelled' or public.is_guest_attendee_role(new.attendee_type) then return new; end if;
  select activity_type,coalesce(field_config->'registrationQuotas','[]'::jsonb) into v_type,v_quotas from public.meetings where id=new.meeting_id;
  if v_type='internal' or jsonb_typeof(v_quotas)<>'array' or jsonb_array_length(v_quotas)=0 then return new; end if;
  select coalesce(sum(greatest(0,coalesce((item->>'quota')::integer,0))),0) into v_quota from jsonb_array_elements(v_quotas) item
    where public.normalize_quota_venue(item->>'venue')=public.normalize_quota_venue(new.venue) and trim(coalesce(item->>'region',''))=trim(coalesce(new.region,'')) and coalesce(item->>'role','听众')='听众';
  if v_quota=0 then raise exception '该会场和大区尚未配置听众名额'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.meeting_id::text||'|'||public.normalize_quota_venue(new.venue)||'|'||trim(coalesce(new.region,'')),0));
  select count(*) into v_count from public.attendees a where a.meeting_id=new.meeting_id and a.business_status<>'cancelled' and not public.is_guest_attendee_role(a.attendee_type) and public.normalize_quota_venue(a.venue)=public.normalize_quota_venue(new.venue) and trim(coalesce(a.region,''))=trim(coalesce(new.region,'')) and a.id is distinct from new.id;
  if v_count>=v_quota then raise exception '该会场和大区听众名额已满'; end if;
  return new;
end; $$;

drop trigger if exists attendees_external_listener_quota on public.attendees;
create trigger attendees_external_listener_quota before insert or update of attendee_type,venue,region,business_status on public.attendees for each row execute function public.enforce_external_listener_quota();

revoke all on function public.registration_template_storage_meeting_id(text) from public;
revoke all on function public.can_manage_registration_template_object(text) from public;
revoke all on function public.normalize_quota_venue(text) from public;
revoke all on function public.is_guest_attendee_role(text) from public;
revoke all on function public.enforce_external_listener_quota() from public;
grant execute on function public.save_project_registration_template(uuid,text,jsonb,text) to authenticated;
grant execute on function public.get_project_registration_template_delete_status(uuid) to authenticated;
grant execute on function public.remove_project_registration_template(uuid) to authenticated;
grant execute on function public.project_management_open(uuid) to authenticated;
grant execute on function public.registration_template_storage_meeting_id(text) to authenticated;
grant execute on function public.can_manage_registration_template_object(text) to authenticated;

create index if not exists attendees_quota_lookup_idx on public.attendees(meeting_id,business_status,venue,region);
