import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const app=readFileSync('app.js','utf8'),html=readFileSync('index.html','utf8'),edge=readFileSync('supabase/functions/public-trip-query/index.ts','utf8'),sql=readFileSync('supabase/migrations/2026090304_approval_notifications_security.sql','utf8'),roomSql=readFileSync('supabase/migrations/2026090513_rooming_conflict_approval.sql','utf8');
const checks={
  externalOnly:app.includes('if(isInternalMeeting())return {outbound:[],return:[]};')&&sql.includes("activity_type,'external')='internal'"),
  thresholds:html.includes('name="earliestArrival"')&&html.includes('name="latestDeparture"')&&edge.includes('去程抵达早于会议允许最早抵达时间'),
  cityMismatch:edge.includes('去程出发城市与返程抵达城市不一致'),
  roomConflict:roomSql.includes("v_requested<>v_suggested")&&roomSql.includes("meetings_refresh_rooming_approvals")&&app.includes('申请房型与当前会议的默认房型规则不一致'),
  editableRules:html.includes('name="mismatchRule"')&&html.includes('name="defaultRoomType"')&&html.includes('name="roomConflictApproval"')&&app.includes('roomingRules:isInternalMeeting()'),
  structuredNotice:edge.includes('publicChangeDetails')&&edge.includes('change_details:changes')&&sql.includes("source text not null default 'system'"),
  adminAuditOnly:sql.includes('User-visible reminders are intentionally created only')&&app.includes('item.auditOnly=true'),
  inAppOnly:sql.includes('notification_email_outbox')&&!html.includes('approvalEmailNotifications')&&edge.includes('email_requested:false')&&!edge.includes('notification_email_outbox").insert'),
  softDelete:sql.includes("'soft_delete',true")&&app.includes('项目已归档；参会数据和附件均保留'),
  sessionTimeouts:edge.includes('Date.now()+60*60*1000')&&app.includes('30*60*1000'),
  uploadWhitelist:app.includes('禁止上传可执行文件'),
  phoneMask:app.includes('138')&&app.includes('maskPhone'),
};

const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(5000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.APP_CONFIG={mode:"demo"};'}));
await page.goto('http://127.0.0.1:4173/#settings',{waitUntil:'domcontentloaded'});await page.waitForTimeout(500);
checks.rulePanel=await page.locator('.approval-rules-panel').count()===1;
await page.evaluate(()=>location.hash='approvals');await page.waitForTimeout(200);
checks.approvalDetails=(await page.locator('#approvalBoard').innerText()).includes('触发原因');
await page.evaluate(()=>location.hash='attendees');await page.waitForTimeout(200);
checks.maskedRoster=(await page.locator('#attendeeTableBody').innerText()).includes('138****5201');
await page.evaluate(()=>location.hash='notifications');await page.waitForTimeout(200);
checks.notificationScope=(await page.locator('[data-page="notifications"] .page-heading').innerText()).includes('仅展示报名端');
await browser.close();

const failed=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name);
console.log(JSON.stringify({checks,errors,allPassed:failed.length===0&&errors.length===0},null,2));
if(failed.length||errors.length)process.exit(1);
