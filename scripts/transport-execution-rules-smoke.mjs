import { chromium } from "playwright";

const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on("pageerror",error=>errors.push(error.message));
await page.goto("http://127.0.0.1:4173/#settings",{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();});
if(await page.locator("#transportStationRules .transport-station-rule-row").count()<4)throw new Error("Station-level rules were not rendered");
await page.click("#addTransportStationRule");
const last=page.locator("#transportStationRules .transport-station-rule-row").last();await last.locator('[name="transportRuleStation"]').fill("福州南站");await last.locator('[name="transportRuleMinutes"]').fill("105");
await page.click('#settingsForm button[type="submit"]');
if(!await page.locator('[name="transportRuleStation"]').evaluateAll(inputs=>inputs.some(input=>input.value==="福州南站")))throw new Error("Station rule save failed");

await page.goto("http://127.0.0.1:4173/#transport",{waitUntil:"domcontentloaded"});
await page.locator('[data-edit-transport][data-type="pickup"]').first().click();
if(await page.locator('#transportEditForm [name="time"]').count())throw new Error("Pickup editor must not include time");
if(await page.locator('#transportEditForm [name="point"]').count())throw new Error("Pickup editor must not include meeting point");
if(!await page.locator('#transportEditForm [name="placardFile"]').count())throw new Error("Pickup placard attachment is missing");
await page.selectOption("#transportMode","driver");
if(!await page.locator("#driverFields").isVisible())throw new Error("Independent driver fields were not shown");
await page.click("#cancelTransport");
await page.locator('[data-edit-transport][data-type="dropoff"]').first().click();
if(!await page.locator('#transportEditForm [name="time"]').count()||!await page.locator('#transportEditForm [name="point"]').count())throw new Error("Dropoff time or point is missing");
await page.click("#cancelTransport");

const downloadPromise=page.waitForEvent("download");await page.click("#exportTransportPlan");const download=await downloadPromise;if(!download.suggestedFilename().includes("接送执行安排"))throw new Error("Transport export filename is incorrect");
console.log(JSON.stringify({stationRules:"pass",pickupNoTimeOrPoint:"pass",placardAttachment:"pass",driverPerAttendee:"pass",dropoffTimeAndPoint:"pass",transportExport:"pass",errors},null,2));
await browser.close();if(errors.length)process.exitCode=1;
