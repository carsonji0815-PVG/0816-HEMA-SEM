import { chromium } from "playwright";
import fs from "node:fs/promises";

await fs.mkdir(".tmp/browser",{recursive:true});
const headers=["No. 序号","Attendee Type 参会者类别","Name 客户姓名(姓/名)*","City 城市","Hospital/Chain 医院/连锁","Department/Store 科室/门店","Title 职称","会场 （多城会议）","Sex 性别","ID/Passpor No.* 身份证号/护照号*","Mobile Phone # 手机号","HCP ID* 客户编号*","Accommodation 住宿安排(Y/N)","Flight 是否航空(Y/N)","Departure Date 出发日期","Departure City 出发城市","Arrival City 到达城市","Flight/Train No. 航班/车次号","Departure time 出发时间","Arrival time 到达时间","Return Date 返回日期","Departure City 出发城市","Arrival City 到达城市","Flight/Train No. 航班/车次号","Departure time 出发时间","Arrival time 到达时间","Region 大区","Contact Name 销售联系人姓名","Contact Mobile 销售联系人手机","MSL医学部联系人","Remarks 备注"];
const valid=[1,"HCP","线下测试医生","上海","测试医院","血液科","主任医师","大连会场","女","TEST-ID-OFFLINE","13800007777","HCP-OFFLINE","Y","Y","2026-09-04","上海","大连","MU7001","08:00","10:00","2026-09-06","大连","南京","MU7002","18:00","20:00","华东大区","陈哲","","宋老师","线下收集"];
const invalid=[2,"HCP","错误号码医生","北京","测试医院","血液科","","大连会场","男","TEST-ID-BAD","123","HCP-BAD","N","N"];
const csv=[headers,valid,invalid].map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(",")).join("\n");
const fixture=".tmp/browser/offline-roster.csv"; await fs.writeFile(fixture,"\ufeff"+csv);

const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[]; page.on("pageerror",error=>errors.push(error.message));
await page.route("http://127.0.0.1:4173/",async route=>{
  const response=await route.fetch();
  const html=(await response.text()).replace('mode: "production"','mode: "demo"');
  await route.fulfill({response,body:html,headers:{...response.headers(),"content-type":"text/html; charset=utf-8"}});
});
await page.goto("http://127.0.0.1:4173/#attendees",{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();}); await page.waitForSelector('[data-page="attendees"].active');
const before=await page.locator("#attendeeTableBody tr").count(); await page.click("#importRoster"); await page.setInputFiles("#rosterFile",fixture);
await page.waitForSelector(".import-status.new");
if (!await page.locator(".import-status.error").innerText().then(text=>text.includes("手机号格式错误"))) throw new Error("Invalid row was not blocked");
if (!await page.locator("#confirmImport").innerText().then(text=>text.includes("1 条有效名单"))) throw new Error("Valid import count incorrect");
await page.screenshot({path:".tmp/browser/import-theme.png",fullPage:true}); await page.click("#confirmImport");
if (await page.locator("#attendeeTableBody tr").count()!==before+1) throw new Error("Valid offline attendee was not imported");
if (await page.locator("#importRoster").evaluate(node=>node.classList.contains("is-hidden"))) throw new Error("Ops import entry is hidden");
console.log(JSON.stringify({validImported:1,invalidBlocked:1,opsImportEntry:"pass",themeScreenshot:".tmp/browser/import-theme.png",errors},null,2));
await browser.close(); if(errors.length)process.exitCode=1;
