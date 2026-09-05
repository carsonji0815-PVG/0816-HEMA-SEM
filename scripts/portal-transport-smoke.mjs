import { chromium } from "playwright";
import fs from "node:fs/promises";

await fs.mkdir(".tmp/browser", { recursive: true });
const browser = await chromium.launch({ headless:true, executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/rest/v1/transports*", route => route.request().method() === "GET" ? route.continue() : route.fulfill({ status:201, contentType:"application/json", body:"[]" }));
await page.route("**/functions/v1/public-trip-query", route => route.fulfill({
  status:200, contentType:"application/json", body:JSON.stringify({
    found:true, project:{transferCollectionEnabled:true}, attendee:{name:"测试参会者",outboundTransferOrigin:"上海环宇城",outboundTransferTime:"2026-09-04T07:30",outboundTransferDriverName:"王师傅",outboundTransferDriverPhone:"13800138001",outboundTransferVehicle:"沪A12345",returnTransferDestination:"上海环宇城",returnTransferDriverName:"李师傅",returnTransferDriverPhone:"13800138002",returnTransferVehicle:"沪B67890"},
    outbound:{number:"MU1001",from:"上海",fromStation:"上海虹桥机场T2",to:"大连",date:"2026-09-04"},
    returnTrip:{number:"MU1002",from:"大连",to:"上海",toStation:"上海虹桥机场T2",date:"2026-09-06"},
    transports:[
      {direction:"pickup",driver:"会务工作人员",phone:"",vehicle:"",time:"2026-09-04T10:20:00+08:00",point:"机场到达口",placardFileName:"接机牌.jpg",placardFileUrl:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='140'%3E%3Crect width='240' height='140' fill='%23fff8f5'/%3E%3Ctext x='120' y='76' text-anchor='middle' font-size='22' fill='%23d52b1e'%3EWelcome%3C/text%3E%3C/svg%3E"},
      {direction:"dropoff",driver:"刘师傅",phone:"13900000000",vehicle:"辽B12345",time:"2026-09-06T16:40:00+08:00",point:"酒店大堂"},
    ],
  }),
}));
await page.goto("http://127.0.0.1:4173/#portal", { waitUntil:"domcontentloaded" });
await page.click('[data-portal-tab="lookup"]');
await page.fill("#lookupPhone", "13800005201");
await page.click('#lookupForm button[type="submit"]');
await page.waitForSelector("#addCalendarButton");
const text = await page.locator("#lookupResult").innerText();
if (!text.includes("会务工作人员现场接待") || !text.includes("无需司机及车辆信息")) throw new Error("Staff pickup display failed");
if (!text.includes("会议地接送安排") || !text.includes("出发地（属地）接送安排") || !text.includes("按照实际航班/车次抵达时间")) throw new Error("Transport scope separation failed");
if (!["王师傅","13800138001","沪A12345","李师傅","13800138002","沪B67890"].every(value=>text.includes(value))) throw new Error("Local-transfer driver details failed");
if (await page.locator(".lookup-transport-group.meeting .lookup-transfer-card").count() !== 2 || await page.locator(".lookup-transport-group.local .lookup-transfer-card").count() !== 2) throw new Error("Meeting and local query layouts are not aligned");
if (!await page.locator(".lookup-placard-preview img").isVisible()) throw new Error("Pickup placard thumbnail failed");
await page.screenshot({path:".tmp/browser/portal-transport-scopes.png",fullPage:true});
const downloadPromise = page.waitForEvent("download");
await page.click("#addCalendarButton");
const download = await downloadPromise;
const calendarPath = ".tmp/browser/transport-reminders.ics";
await download.saveAs(calendarPath);
const calendar = await fs.readFile(calendarPath, "utf8");
if ((calendar.match(/BEGIN:VEVENT/g) || []).length !== 2 || !calendar.includes("TRIGGER:-PT30M")) throw new Error("Calendar reminders failed");
await page.setViewportSize({ width:1280, height:900 });
await page.goto("http://127.0.0.1:4173/#transport", { waitUntil:"domcontentloaded" });
await page.locator("#loginDialog").evaluate(dialog => { if (dialog.open) dialog.close(); });
await page.waitForSelector('[data-page="transport"].active');
await page.locator('[data-edit-transport][data-type="dropoff"]').first().click();
const ruleText = await page.locator("#transportEditForm .risk-preview").innerText();
if (!ruleText.includes("大连周水子机场提前 120 分钟") || !ruleText.includes("2026-09-06 16:40")) throw new Error("Station-level flight dropoff recommendation failed");
await page.selectOption("#transportMode", "staff");
if (!await page.locator("#driverFields").evaluate(node => node.classList.contains("is-hidden"))) throw new Error("Staff mode did not hide driver fields");
await page.click('#transportEditForm button[type="submit"]');
await page.waitForFunction(()=>!document.querySelector("#attendeeDialog").open);
if (!await page.locator("#transportTableBody").innerText().then(value => value.includes("工作人员"))) throw new Error("Staff transport save failed");
await page.locator('[data-edit-transport][data-type="dropoff"]').nth(2).click();
const trainRuleText = await page.locator("#transportEditForm .risk-preview").innerText();
if (!trainRuleText.includes("福州站提前 90 分钟") || !trainRuleText.includes("2026-09-12 16:52")) throw new Error("Station-level train dropoff recommendation failed");
await page.locator("#cancelTransport").click();
console.log(JSON.stringify({ portal:"pass", staffPickup:"pass", calendarEvents:2, reminder:"30 minutes", flightDropoff:"-2h", trainDropoff:"-1.5h", staffMode:"pass", errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
