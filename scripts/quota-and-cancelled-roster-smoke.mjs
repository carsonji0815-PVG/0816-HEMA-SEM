import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root=new URL("../",import.meta.url);
const [app,html,quotaMigration]=await Promise.all([
  fs.readFile(new URL("app.js",root),"utf8"),
  fs.readFile(new URL("index.html",root),"utf8"),
  fs.readFile(new URL("supabase/migrations/2026090509_unconfigured_region_quota_passthrough.sql",root),"utf8"),
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
assert.match(app,/\? "角色嘉宾" : "听众"/);
assert.match(app,/return \["听众","角色嘉宾"\]/);
assert.match(html,/<title>礼来会议管理平台<\/title>/);
assert.match(app,/normalizedQuotaConfiguration/);
assert.match(app,/unmatchedQuotaAttendeeCount/);
assert.match(app,/未分配名额/);
assert.match(app,/unallocated:true/);
assert.match(app,/\["实际报名",totalActual/);
assert.match(quotaMigration,/if v_quota=0 then return new;/);
assert.doesNotMatch(quotaMigration,/尚未配置听众名额/);
assert.match(app,/unlimitedRole=activeQuotaRole==="角色嘉宾"/);
assert.match(app,/角色嘉宾"}\u6309实际报名统计，无缺口预警/);
assert.match(app,/quota-status unlimited">实际统计/);
assert.match(app,/if\(normalized\.role==="角色嘉宾"\)return/);
assert.match(app,/guestMeetingRole/);
assert.match(app,/讨论嘉宾（组长）/);
assert.match(app,/summaryRow\("全部举办城市",ordered,true\)/);
assert.match(html,/id="toggleCancelledRoster"/);
assert.match(app,/cancelledRosterView\?a\.businessStatus==="cancelled":a\.businessStatus!=="cancelled"/);
assert.match(app,/完整保留报名模板全部字段/);
assert.match(app,/暂无已删除或已取消报名人员/);

console.log("quota and cancelled roster smoke: ok");
