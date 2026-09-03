import assert from "node:assert/strict";
import fs from "node:fs/promises";

const app=await fs.readFile(new URL("../app.js",import.meta.url),"utf8");
const render=app.slice(app.indexOf("function renderAttendeeTable()"),app.indexOf("function updateSelectedAttendeeControls"));
assert.match(render,/const templateColumns=meetingTemplateColumns\(\)/);
assert.doesNotMatch(render,/JOURNEY_FORM_COLUMNS\.filter/);
assert.match(app,/function exportExcel\(\)[\s\S]*?const journeyColumns=JOURNEY_FORM_COLUMNS\.filter/);
assert.match(render,/TravelVerification\.verifiedField/);
console.log("roster duplicate journey columns removed; export and verification highlights preserved: ok");
