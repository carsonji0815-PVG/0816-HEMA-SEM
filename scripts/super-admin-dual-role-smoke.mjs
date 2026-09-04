import fs from "node:fs";
import assert from "node:assert/strict";

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const sql=fs.readFileSync(new URL("../supabase/migrations/2026090401_super_admin_project_manager_dual_role.sql",import.meta.url),"utf8");

assert.match(app,/兼任当前项目会务负责人/);
assert.match(app,/不影响超级管理员的全局最高权限/);
assert.doesNotMatch(sql,/system_role\s*=\s*'super_admin'\s+or\s+exists/i);
assert.doesNotMatch(sql,/system_role='super_admin'\s+then raise exception/i);
assert.match(sql,/v_staff\.system_role<>'super_admin' and v_owner=v_user\.id/);
assert.match(sql,/project_staff_access_changed/);

console.log("super-admin dual-role smoke passed");
