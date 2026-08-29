import { chromium } from "playwright";
import fs from "node:fs/promises";

const base = "http://127.0.0.1:4173/";
const browser = await chromium.launch({ headless:true, executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport:{width:1280,height:900} });
const browserErrors=[]; page.on("pageerror",error=>browserErrors.push(error.message)); page.on("console",message=>{if(message.type()==="error")browserErrors.push(message.text());});
await page.route("https://139.196.97.236/**", route => route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({files:[{type:"quotation"},{type:"confirmation",documentStatus:"pending"}],user:{role:"admin"}})}));
await page.route(base, async route => {
  const response = await route.fetch();
  const html = (await response.text()).replace('mode: "production"', 'mode: "demo"');
  await route.fulfill({ response, body:html, headers:{...response.headers(),"content-type":"text/html; charset=utf-8"} });
});
await page.goto(base,{waitUntil:"domcontentloaded"});
await page.waitForTimeout(1500);
if(browserErrors.length)throw new Error(`Browser startup failed: ${browserErrors.join(" | ")}`);
await page.waitForSelector('.page.active');

page.once("dialog",dialog=>dialog.accept());
await page.locator("#resetDemo").evaluate(button=>button.click());
await page.evaluate(() => {
  const key="journey-desk-state-v1"; const state=JSON.parse(localStorage.getItem(key)); const attendee=state.attendees[0];
  attendee.customFields={...(attendee.customFields||{}),_travelVerification:{
    outbound:{provider:"aerodatabox",source:{label:"AeroDataBox（API.Market）",referenceUrl:"https://www.flightstats.com/v2/flight-tracker/CA/8902"},checkedAt:"2026-08-29T08:00:00Z",match:{departure:"23:10",arrival:"00:35",arrivalDayOffset:1},warnings:[]},
    return:{provider:"aliyun_train",source:{label:"阿里云市场·聚合数据"},checkedAt:"2026-08-29T08:00:00Z",match:{departure:"18:22",arrival:"22:10",arrivalDayOffset:0},warnings:[]},
  }};
  localStorage.setItem(key,JSON.stringify(state));
});
await page.reload({waitUntil:"domcontentloaded"});
await page.waitForSelector("#attendeeTableBody [data-open-attendee]",{state:"attached"});
await page.evaluate(()=>{document.querySelectorAll(".page").forEach(page=>page.classList.remove("active"));document.querySelector('[data-page="attendees"]').classList.add("active");});
await page.locator('#attendeeTableBody [data-open-attendee]').first().click();
const detail=await page.locator("#attendeeDetail").innerText();
if(!detail.includes("23:10 → 00:35+1")||!detail.includes("AeroDataBox（API.Market）")||!detail.includes("阿里云市场·聚合数据"))throw new Error(`Verification detail missing: ${detail}`);

await page.locator("#editTripButton").click();
await page.locator('#tripEditForm [name="outNo"]').fill("CA8903");
await page.locator('#tripEditForm button[type="submit"]').click();
const invalidation=await page.evaluate(() => { const state=JSON.parse(localStorage.getItem("journey-desk-state-v1")); const checks=state.attendees[0].customFields?._travelVerification||{}; return {outbound:!!checks.outbound,return:!!checks.return}; });
if(invalidation.outbound||!invalidation.return)throw new Error(`Segment invalidation failed: ${JSON.stringify(invalidation)}`);

const appSource=await fs.readFile(new URL("../app.js",import.meta.url),"utf8");
if(!appSource.includes('"去程计划时刻核验","返程计划时刻核验"'))throw new Error("Verification export columns missing");
console.log(JSON.stringify({crossDay:"pass",sourceTrace:"pass",segmentInvalidation:"pass",exportColumns:"pass"},null,2));
await browser.close();
