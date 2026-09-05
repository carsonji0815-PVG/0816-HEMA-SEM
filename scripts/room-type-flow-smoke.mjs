import assert from "node:assert/strict";
import fs from "node:fs/promises";

const [html,app,engine,edge]=await Promise.all([
  fs.readFile(new URL("../index.html",import.meta.url),"utf8"),
  fs.readFile(new URL("../app.js",import.meta.url),"utf8"),
  fs.readFile(new URL("../rooming-engine.js",import.meta.url),"utf8"),
  fs.readFile(new URL("../supabase/functions/public-trip-query/index.ts",import.meta.url),"utf8"),
]);

assert.equal((html.match(/name="roomType"/g)||[]).length,2,"admin and public forms must both expose requested room type");
for(const label of ["单间","标间拼住","标间单住","无需住宿"])assert.ok(html.includes(`>${label}</option>`),`missing room type option: ${label}`);
for(const token of ["bindAccommodationRoomType","customFields.roomType=requestedRoomType","details.roomType=normalizeRoomType","headerMap.roomType","attendeeRequestedRoomType","同步到分房管理","column.key===\"roomType\""])assert.ok(app.includes(token),`room type flow is missing: ${token}`);
assert.ok(engine.includes('Object.hasOwn(attendee?.customFields||{},"roomType")'),"rooming must read the canonical registration room type first");
for(const token of ["normalizeRoomType(details.roomType)","roomType:requestedRoomType","normalizeRoomType(payload.roomType)"])assert.ok(edge.includes(token),`edge persistence is missing: ${token}`);
console.log(JSON.stringify({forms:2,options:4,adminSave:"pass",publicSave:"pass",excelImport:"pass",roomingRead:"pass",edgePersistence:"pass"},null,2));
