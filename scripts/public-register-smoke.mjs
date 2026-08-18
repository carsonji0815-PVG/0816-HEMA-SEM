import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const requests = [];
await page.route("**/functions/v1/public-trip-query", async route => {
  const body = route.request().postDataJSON(); requests.push(body);
  const response = body.action === "authenticate" ? { authenticated:true, attendee:{ attendeeType:"HCP", name:body.name, region:body.region, phone:body.phone, accommodation:"Y", flight:"Y" }, project:{name:"测试项目",venues:["上海会场"],servicePhone:"400-001",fieldConfig:{hcpId:false,remarks:false}} } : { completed:true, needsApproval:false };
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(response)});
});
await page.goto("http://127.0.0.1:4173/#portal", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#publicPortalView:not(.is-hidden)");
const fields = await page.locator("#publicRegistrationForm input").evaluateAll(nodes => nodes.map(node => node.name));
const loginOpen = await page.locator("#loginDialog").evaluate(node => node.open);
if (loginOpen) throw new Error("Public registration unexpectedly requires login");
if (fields.join(",") !== "region,name,phone") throw new Error(`Unexpected public fields: ${fields.join(",")}`);
if (await page.locator('[data-portal-tab]').count() !== 2) throw new Error("Unified portal tabs missing");
await page.click('[data-portal-tab="lookup"]');
await page.waitForSelector('[data-portal-panel="lookup"]:not(.is-hidden)');
await page.click('[data-portal-tab="register"]');
await page.waitForSelector('[data-portal-panel="register"]:not(.is-hidden)');
await page.fill('#publicRegistrationForm [name="region"]', "华东大区");
await page.fill('#publicRegistrationForm [name="name"]', "测试人员");
await page.fill('#publicRegistrationForm [name="phone"]', "123");
await page.click('#publicRegistrationForm button[type="submit"]');
const validation = await page.locator("#publicRegistrationResult").innerText();
if (!validation.includes("正确的 11 位手机号")) throw new Error("Phone validation failed");
await page.fill('#publicRegistrationForm [name="phone"]', "13800009999");
await page.click('#publicRegistrationForm button[type="submit"]');
await page.waitForSelector("#publicFullRegistrationStep:not(.is-hidden)");
if (await page.locator('#publicFullRegistrationForm input[name="name"]').getAttribute("readonly") === null) throw new Error("Authenticated name is not locked");
if (!await page.locator('[data-config-field="hcpId"]').evaluate(node => node.classList.contains("is-hidden"))) throw new Error("Project field configuration was not applied");
if (await page.locator('#publicFullRegistrationForm [name="hcpId"]').getAttribute("required") !== null) throw new Error("Hidden project field remains required");
const full = page.locator("#publicFullRegistrationForm");
const values = {city:"上海",hospital:"测试医院",department:"血液科",venue:"上海会场",sex:"女",idNumber:"TEST-ID-001",contactName:"测试销售",contactMobile:"13800008888",outDate:"2026-09-04",outFrom:"上海",outTo:"大连",outNo:"MU1001",outDeparture:"08:00",outArrival:"10:00",returnDate:"2026-09-06",returnFrom:"大连",returnTo:"上海",returnNo:"MU1002",returnDeparture:"18:00",returnArrival:"20:00"};
for (const [name,value] of Object.entries(values)) { const field = full.locator(`[name="${name}"]`); if (["venue","sex"].includes(name)) await field.selectOption(value); else await field.fill(value); }
await full.locator('button[type="submit"]').click();
await page.waitForSelector("#publicFullRegistrationResult .lookup-success");
if (!requests.some(item => item.action === "authenticate") || !requests.some(item => item.action === "complete-registration")) throw new Error("Two-step registration requests missing");
if (!requests.every(item => item.meeting === "hema-sem-2026")) throw new Error("Project slug was not sent");
console.log(JSON.stringify({ route:"#portal", tabs:2, authFields:fields, fullFields:await full.locator("input,select,textarea").count(), twoStepRegistration:"pass", loginOpen, validation, errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
