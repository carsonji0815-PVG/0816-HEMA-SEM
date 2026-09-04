import fs from "node:fs";
import assert from "node:assert/strict";

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const mirror=fs.readFileSync(new URL("../会议行程管理系统.html",import.meta.url),"utf8");
const edge=fs.readFileSync(new URL("../supabase/functions/staff-account-admin/index.ts",import.meta.url),"utf8");

assert.equal(html,mirror,"HTML mirrors must remain identical");
for(const id of ["staffAccountDialog","staffAccountForm","changePasswordDialog","changePasswordForm"])assert.match(html,new RegExp(`id="${id}"`));
assert.match(app,/functions\/v1\/staff-account-admin/);
assert.match(app,/must_change_password/);
assert.match(app,/backend\.auth\.updateUser/);
assert.match(edge,/system_role!=="super_admin"/);
assert.match(edge,/SUPABASE_SERVICE_ROLE_KEY/);
assert.match(edge,/must_change_password:true/);
assert.doesNotMatch(edge,/console\.log\([^)]*password/i);

console.log("project staff account smoke passed");
