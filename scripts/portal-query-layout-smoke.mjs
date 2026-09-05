import { chromium } from "playwright";
import fs from "node:fs/promises";

await fs.mkdir(".tmp/browser", { recursive:true });
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const mobile=process.env.PORTAL_QUERY_VIEWPORT==="mobile";
const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1100},isMobile:mobile,deviceScaleFactor:mobile?2:1});
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
await page.route("**/functions/v1/public-trip-query",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
  found:true,
  project:{name:"IBU Efsitora China SEM",startDate:"2026-11-27",endDate:"2026-11-28",transferCollectionEnabled:true},
  attendee:{name:"季凡希",venue:"长沙",accommodation:"需要住宿",hotel:"长沙国际会议中心酒店",outboundTransferOrigin:"上海环宇城",outboundTransferTime:"2026-11-27T10:00:00+08:00",outboundTransferDriverName:"bob",outboundTransferDriverPhone:"1349349349",outboundTransferVehicle:"沪3483434",returnTransferDestination:"上海体育馆",returnTransferDriverName:"louis",returnTransferDriverPhone:"1323949349399",returnTransferVehicle:"沪34349349"},
  outbound:{number:"CZ5828",from:"上海",fromStation:"上海浦东机场T2航站楼",to:"长沙",toStation:"长沙黄花机场T2航站楼",date:"2026-11-27",arrivalDate:"2026-11-27",departure:"12:10",arrival:"14:45"},
  returnTrip:{number:"MU5364",from:"长沙",fromStation:"长沙黄花机场T2航站楼",to:"上海",toStation:"上海虹桥机场T2航站楼",date:"2026-11-28",arrivalDate:"2026-11-28",departure:"19:20",arrival:"21:20"},
  transports:[
    {direction:"pickup",driver:"alex",phone:"13823497891",vehicle:"湘A3483438",terminal:"长沙黄花机场T2航站楼",placard:"礼来会议接机",placardFileName:"pickup-card.jpg",placardFileUrl:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='220'%3E%3Crect width='360' height='220' rx='18' fill='%23fff9f6'/%3E%3Ctext x='180' y='90' text-anchor='middle' font-size='34' font-family='sans-serif' fill='%23d52b1e'%3ELilly%3C/text%3E%3Ctext x='180' y='140' text-anchor='middle' font-size='22' font-family='sans-serif' fill='%23352a2a'%3EWelcome%3C/text%3E%3C/svg%3E"},
    {direction:"dropoff",driver:"mia",phone:"13858454858",vehicle:"湘A348483248",service_time:"2026-11-28T19:20:00+08:00",meeting_point:"酒店1楼大堂礼来签到台",terminal:"长沙黄花机场T2航站楼"}
  ]
})}));
await page.goto("http://127.0.0.1:4173/#portal",{waitUntil:"domcontentloaded"});
await page.click('[data-portal-tab="lookup"]');
await page.fill("#lookupPhone","13003240331");
await page.click('#lookupForm button[type="submit"]');
await page.waitForSelector(".lookup-placard-preview img");
const portal=page.locator("#publicPortalView");
if(!await portal.evaluate(node=>node.classList.contains("portal-lookup-mode")))throw new Error("Lookup layout mode was not activated");
const headerBox=await page.locator(".lookup-copy").boundingBox();
const cardBox=await page.locator(".portal-card").boundingBox();
const meetingBox=await page.locator(".lookup-transport-group.meeting").boundingBox();
const localBox=await page.locator(".lookup-transport-group.local").boundingBox();
if(!headerBox||!cardBox||headerBox.y>=cardBox.y)throw new Error("Meeting platform context is not above the query workspace");
if(!meetingBox||!localBox||meetingBox.width<(mobile?340:1000)||localBox.width<(mobile?340:1000)||localBox.y<=meetingBox.y)throw new Error("Transport sections are not full-width stacked rows");
if(await page.locator(".lookup-transport-group.meeting .lookup-transfer-card").count()!==2||await page.locator(".lookup-transport-group.local .lookup-transfer-card").count()!==2)throw new Error("Outbound and return cards are not paired within each row");
if(await page.locator(".lookup-placard-preview img").getAttribute("alt")!=="接机牌样稿缩略图")throw new Error("Placard thumbnail semantics failed");
const journeyText=await page.locator(".lookup-transport-group.meeting .lookup-transfer-card").first().innerText();
for(const expected of ["航班号 / 车次号","CZ5828","出发航站楼 / 高铁站","上海浦东机场T2航站楼","出发时间","2026-11-27 12:10","抵达航站楼 / 高铁站","长沙黄花机场T2航站楼","抵达时间","2026-11-27 14:45"]){if(!journeyText.includes(expected))throw new Error(`Journey detail missing: ${expected}`);}
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
if(overflow>1)throw new Error(`Desktop horizontal overflow: ${overflow}px`);
await page.screenshot({path:mobile?".tmp/browser/mobile-portal-query-result.png":".tmp/browser/portal-query-balanced.png",fullPage:true});
if(mobile){
  await page.screenshot({path:".tmp/browser/mobile-portal-query-viewport.png"});
  await page.locator(".lookup-transport-group.meeting").screenshot({path:".tmp/browser/mobile-query-journey-focus.png"});
}
console.log(JSON.stringify({layout:"pass",viewport:mobile?"390x844":"1440x1100",headerAboveQuery:true,meetingRow:Math.round(meetingBox.width),localRow:Math.round(localBox.width),placardThumbnail:"pass",journeyDetails:"pass",overflow,errors},null,2));
await browser.close();
if(errors.length)process.exitCode=1;
