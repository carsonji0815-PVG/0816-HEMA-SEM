import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root=new URL("../",import.meta.url);
const [app,migration,revisionMigration]=await Promise.all([
  fs.readFile(new URL("app.js",root),"utf8"),
  fs.readFile(new URL("supabase/migrations/2026090510_admin_realtime_refresh.sql",root),"utf8"),
  fs.readFile(new URL("supabase/migrations/2026090511_meeting_live_revision.sql",root),"utf8"),
]);

for(const table of ["meetings","attendees","transports","column_locks","notifications","registrants"])assert.match(migration,new RegExp(`['\"]${table}['\"]`));
assert.match(app,/function configureAdminAutoSync\(\)/);
assert.match(app,/function refreshAdminState\(/);
assert.match(app,/refreshAuxiliary:false/);
assert.doesNotMatch(app,/if\(adminEditorIsActive\(\)\)/);
assert.match(app,/captureAdminInteraction\(\)/);
assert.match(app,/restoreAdminInteraction\(interaction\)/);
assert.match(app,/document\.visibilityState==="hidden"/);
assert.match(app,/navigator\.onLine===false/);
assert.match(app,/get_meeting_live_revision/);
assert.match(app,/system_configuration/);
assert.match(app,/setInterval\(\(\)=>refreshAdminState\("poll"\),3000\)/);
assert.match(app,/table:"attendees",filter:`meeting_id=eq\.\$\{meetingId\}`/);
assert.match(app,/table:"meetings",filter:`id=eq\.\$\{meetingId\}`/);
assert.match(revisionMigration,/create or replace function public\.get_meeting_live_revision/);
assert.match(revisionMigration,/public\.is_meeting_member\(p_meeting_id\)/);
assert.match(revisionMigration,/max\(a\.updated_at\)/);
assert.match(revisionMigration,/max\(t\.updated_at\)/);

console.log("admin auto refresh smoke: ok");
