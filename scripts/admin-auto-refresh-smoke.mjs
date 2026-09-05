import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root=new URL("../",import.meta.url);
const [app,migration]=await Promise.all([
  fs.readFile(new URL("app.js",root),"utf8"),
  fs.readFile(new URL("supabase/migrations/2026090510_admin_realtime_refresh.sql",root),"utf8"),
]);

for(const table of ["meetings","attendees","transports","column_locks","notifications","registrants"])assert.match(migration,new RegExp(`['\"]${table}['\"]`));
assert.match(app,/function configureAdminAutoSync\(\)/);
assert.match(app,/function refreshAdminState\(/);
assert.match(app,/refreshAuxiliary:false/);
assert.match(app,/dialog\[open\]/);
assert.match(app,/document\.visibilityState==="hidden"/);
assert.match(app,/navigator\.onLine===false/);
assert.match(app,/table:"attendees",filter:`meeting_id=eq\.\$\{meetingId\}`/);
assert.match(app,/table:"meetings",filter:`id=eq\.\$\{meetingId\}`/);

console.log("admin auto refresh smoke: ok");
