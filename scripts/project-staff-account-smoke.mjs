import fs from "node:fs";
import assert from "node:assert/strict";

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const mirror=fs.readFileSync(new URL("../会议行程管理系统.html",import.meta.url),"utf8");
const edge=fs.readFileSync(new URL("../supabase/functions/staff-account-admin/index.ts",import.meta.url),"utf8");
const clientMigration=fs.readFileSync(new URL("../supabase/migrations/2026090402_project_client_accounts.sql",import.meta.url),"utf8");
const optionalTemplateMigration=fs.readFileSync(new URL("../supabase/migrations/2026090403_registration_template_optional.sql",import.meta.url),"utf8");

assert.equal(html,mirror,"HTML mirrors must remain identical");
for(const id of ["staffAccountDialog","staffAccountForm","clientAccountPanel","clientAccountDialog","clientAccountForm","changePasswordDialog","changePasswordForm"])assert.match(html,new RegExp(`id="${id}"`));
assert.match(html,/创建内部会务成员登录账号/);
assert.match(html,/创建客户会议负责人账号/);
assert.match(html,/无需导入报名模板即可开放报名/);
assert.match(app,/functions\/v1\/staff-account-admin/);
assert.match(app,/accountType:"staff"/);
assert.match(app,/accountType:"client"/);
assert.match(app,/renderProjectClientAccounts\(\)/);
assert.match(app,/创建登录账号（已完成）/);
assert.match(app,/must_change_password/);
assert.match(app,/backend\.auth\.updateUser/);
assert.match(edge,/system_role!=="super_admin"/);
assert.match(edge,/SUPABASE_SERVICE_ROLE_KEY/);
assert.match(edge,/must_change_password:true/);
assert.match(edge,/project_client_accounts/);
assert.match(edge,/role:"client"/);
assert.doesNotMatch(edge,/console\.log\([^)]*password/i);
assert.match(clientMigration,/create table if not exists public\.project_client_accounts/);
assert.match(optionalTemplateMigration,/templateRequired',false/);
assert.match(optionalTemplateMigration,/fallbackTemplate','system_standard/);
assert.doesNotMatch(optionalTemplateMigration,/template_imported_at|请先.*模板|from public\.attendees/is,"registration opening must not depend on a template or attendee roster");
assert.doesNotMatch(app,/enabled&&!project\.templateImported/);
assert.match(app,/canOpenNewRegistration = \(\) => !!state\.settings\.registrationOpen && !state\.locks\.master/);

console.log("project staff account smoke passed");
