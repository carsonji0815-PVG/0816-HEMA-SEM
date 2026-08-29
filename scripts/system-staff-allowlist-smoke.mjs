import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [app, html, migration] = await Promise.all([
  fs.readFile(new URL("app.js", root), "utf8"),
  fs.readFile(new URL("index.html", root), "utf8"),
  fs.readFile(new URL("supabase/migrations/2026082903_system_staff_allowlist.sql", root), "utf8"),
]);

const approved = [
  "jll@grandchinamice.com",
  "shenxy@grandchinamice.com",
  "chenyan@grandchinamice.com",
  "zhucy@grandchinamice.com",
  "zhuby@grandchinamice.com",
  "zhanh@grandchinamice.com",
  "yml@grandchinamice.com",
];

for (const email of approved) assert.match(migration, new RegExp(email.replaceAll(".", "\\.")));
assert.match(migration, /system_role='super_admin'/);
assert.match(migration, /public\.is_allowed_staff\(\)/);
assert.match(migration, /set_project_staff_member/);
assert.match(app, /await loadStaffAccess\(\);await loadBackendState\(\)/);
assert.match(app, /staffAccess\.systemRole === "super_admin"/);
assert.match(app, /list_system_staff/);
assert.match(html, /管理员安全登录/);
assert.doesNotMatch(html, /进入参会服务/);

console.log("system staff allowlist smoke: ok");
