import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root=new URL("../",import.meta.url);
const [app,html]=await Promise.all([
  fs.readFile(new URL("app.js",root),"utf8"),
  fs.readFile(new URL("index.html",root),"utf8"),
]);

assert.match(html,/id="editQuotasFromSettings"/);
assert.match(html,/会议报名名额/);
assert.match(app,/renderSettingsQuotaSummary\(\)/);
assert.match(app,/报名进度已重新统计/);
assert.match(html,/id="quotaRegionPresets"/);
assert.match(html,/id="quotaRegionOptions"/);
assert.match(app,/name="quotaRegion" list="quotaRegionOptions"/);
assert.match(app,/quotaRegions/);
assert.match(html,/报名统计/);
assert.doesNotMatch(html,/分组明细/);
assert.match(app,/\? "嘉宾" : "听众"/);
assert.match(app,/return \["听众","嘉宾"\]/);
assert.match(app,/normalizedQuotaConfiguration/);
assert.match(html,/id="toggleCancelledRoster"/);
assert.match(app,/cancelledRosterView\?a\.businessStatus==="cancelled":a\.businessStatus!=="cancelled"/);
assert.match(app,/完整保留报名模板全部字段/);
assert.match(app,/暂无已删除或已取消报名人员/);

console.log("quota and cancelled roster smoke: ok");
