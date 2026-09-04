import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root=new URL("../",import.meta.url);
const [app,html,edge,sql,attachmentSql]=await Promise.all([
  fs.readFile(new URL("app.js",root),"utf8"),
  fs.readFile(new URL("index.html",root),"utf8"),
  fs.readFile(new URL("supabase/functions/public-trip-query/index.ts",root),"utf8"),
  fs.readFile(new URL("supabase/migrations/2026090201_optional_archives_templates_quotas_transfers.sql",root),"utf8"),
  fs.readFile(new URL("supabase/migrations/2026090202_registration_template_attachment_delete.sql",root),"utf8"),
]);

assert.doesNotMatch(html,/data-page="documents"/);
assert.match(html,/id="openProjectDocuments"/);
assert.match(html,/id="projectDocumentsDialog"/);
assert.match(app,/暂未上传项目建档文件/);
assert.match(app,/const activeManagementOpen = \(\) => true/);
assert.doesNotMatch(app,/routeName="documents"/);
assert.match(app,/支持多选，单个文件最大 50MB/);
assert.match(app,/data-document-replace/);

assert.match(app,/get_project_registration_template_delete_status/);
assert.match(app,/该模板已被报名数据使用，不允许删除/);
assert.match(app,/确认删除该报名模板？删除后模板文件不可恢复/);
assert.match(html,/id="removeProjectTemplateAttachment"/);
assert.match(app,/remove_project_registration_template_attachment/);
assert.match(app,/报名字段和历史数据已保留/);
assert.match(app,/const extension=\(file\.name\.match\(\/\\\.\(xlsx\|xls\|csv\)\$\/i\)\?\.\[0\]\|\|"\.xlsx"\)\.toLowerCase\(\)/);
assert.match(app,/newStoragePath=`\$\{backendMeetingId\}\/\$\{crypto\.randomUUID\(\)\}\$\{extension\}`/);
assert.doesNotMatch(app,/newStoragePath=`\$\{backendMeetingId\}\/\$\{crypto\.randomUUID\(\)\}-\$\{safeName\}`/);
assert.match(attachmentSql,/template_name=null,template_storage_path=null/);
assert.match(attachmentSql,/registrationTemplatePreserved/);
assert.match(sql,/registration-template-files/);
assert.match(sql,/template_is_system_default/);

assert.match(html,/接送机 \/ 接送站信息收集设置/);
assert.match(html,/id="publicTransferCollectionSection"/);
assert.match(app,/transferCollectionAllowed/);
for(const field of ["outbound_transfer_origin","outbound_transfer_time","outbound_transfer_notes","return_transfer_destination","return_transfer_time","return_transfer_notes"]){assert.match(sql,new RegExp(field));assert.match(edge,new RegExp(field));}
assert.match(sql,/activity_type.*internal/si);
assert.match(sql,/attendees_external_listener_quota/);
assert.match(app,/state\.settings\.activityType==="internal"/);
assert.match(edge,/managementOpen:true/);

console.log("optional archives, templates, quotas and transfer collection smoke: ok");
