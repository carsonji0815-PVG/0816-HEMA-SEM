import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [app,edge,styles]=await Promise.all([
  fs.readFile(new URL("../app.js",import.meta.url),"utf8"),
  fs.readFile(new URL("../supabase/functions/public-trip-query/index.ts",import.meta.url),"utf8"),
  fs.readFile(new URL("../styles.css",import.meta.url),"utf8"),
]);

for(const token of ["finalRooming","assignedRoomType","finalHotel","assignedVenue","meetingVenue","finalRoomType","finalCheckIn","finalCheckOut"]){
  assert.ok(edge.includes(token),`query edge is not using final rooming field: ${token}`);
}
for(const token of ["lookup-stay-summary","住宿酒店","会议会场","申请房型","实际房型","入住日期","退房日期","lookup-flight.png","lookup-time.png","lookup-station.png"]){
  assert.ok(app.includes(token)||styles.includes(token),`query result token is missing: ${token}`);
}
assert.ok(!app.includes('<div class="participant-info-card"><div><small>会议</small>'),"query result still duplicates meeting overview");
for(const rule of [".transport-table{min-width:1320px;table-layout:fixed}","word-break:keep-all","white-space:nowrap"]){
  assert.ok(styles.includes(rule),`desktop transport wrapping rule is missing: ${rule}`);
}
console.log(JSON.stringify({finalRoomingSource:"pass",duplicateMeetingOverview:"removed",journeyIcons:"pass",desktopTransportWrapping:"pass"},null,2));
