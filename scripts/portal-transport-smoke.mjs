import { chromium } from "playwright";
import fs from "node:fs/promises";

await fs.mkdir(".tmp/browser", { recursive: true });
const browser = await chromium.launch({ headless:true, executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport:{ width:390, height:844 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/functions/v1/public-trip-query", route => route.fulfill({
  status:200, contentType:"application/json", body:JSON.stringify({
    found:true, attendee:{name:"测试参会者"},
    outbound:{number:"MU1001",from:"上海",to:"大连",date:"2026-09-04"},
    returnTrip:{number:"MU1002",from:"大连",to:"上海",date:"2026-09-06"},
    transports:[
      {direction:"pickup",driver:"会务工作人员",phone:"",vehicle:"",time:"2026-09-04T10:20:00+08:00",point:"机场到达口"},
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
if (!ruleText.includes("起飞前 120 分钟") || !ruleText.includes("2026-09-06 16:40")) throw new Error("Flight dropoff recommendation failed");
await page.selectOption("#transportMode", "staff");
if (!await page.locator("#driverFields").evaluate(node => node.classList.contains("is-hidden"))) throw new Error("Staff mode did not hide driver fields");
await page.click('#transportEditForm button[type="submit"]');
if (!await page.locator("#transportGrid").innerText().then(value => value.includes("工作人员接待"))) throw new Error("Staff transport save failed");
await page.locator('[data-edit-transport][data-type="dropoff"]').nth(2).click();
const trainRuleText = await page.locator("#transportEditForm .risk-preview").innerText();
if (!trainRuleText.includes("出发前 90 分钟") || !trainRuleText.includes("2026-09-12 16:52")) throw new Error("Train dropoff recommendation failed");
await page.locator("#cancelTransport").click();
console.log(JSON.stringify({ portal:"pass", staffPickup:"pass", calendarEvents:2, reminder:"30 minutes", flightDropoff:"-2h", trainDropoff:"-1.5h", staffMode:"pass", errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
