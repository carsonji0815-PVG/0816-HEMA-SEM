import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root=new URL("../",import.meta.url);
const [app,html,css,migration]=await Promise.all([
  fs.readFile(new URL("app.js",root),"utf8"),
  fs.readFile(new URL("index.html",root),"utf8"),
  fs.readFile(new URL("styles.css",root),"utf8"),
  fs.readFile(new URL("supabase/migrations/2026083001_workflow_rooming_audit.sql",root),"utf8"),
]);

assert.match(html,/data-page="rooming"/);
assert.match(html,/id="roomingTableBody"/);
assert.match(app,/function roomingNights/);
assert.match(app,/function exportRoomingList/);
assert.match(html,/行程真实性核验结果/);
assert.match(app,/未触发审批/);
assert.doesNotMatch(app,/location\.hash\s*=\s*["']approvals["']/);
assert.match(app,/state\.locks\.columns\.includes\("transport"\)/);
assert.match(app,/activeVisibleAttendees\(\).*renderLocks|renderLocks[\s\S]{0,500}activeVisibleAttendees\(\)/);
assert.match(html,/data-page="system"/);
assert.match(app,/routeName==="system"&&!isSystemAdmin/);
assert.match(app,/downloadSystemBackup/);
assert.match(app,/restoreSystemBackup/);
assert.match(app,/system_configuration/);
assert.match(app,/operation_audit_logs/);
assert.match(migration,/guard_transport_write/);
assert.match(migration,/jsonb_build_array/);
assert.match(migration,/new\.business_status is distinct from 'cancelled'/);
assert.match(css,/html\[data-theme="dark"\]/);
assert.doesNotMatch(html,/项目链接标识/);

console.log("workflow, rooming and system settings smoke: ok");
