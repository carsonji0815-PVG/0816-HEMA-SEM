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
  const project={name:"测试项目",clientName:"测试客户",startDate:"2026-09-04",endDate:"2026-09-06",deadline:"2026-08-26T18:00:00+08:00",venues:["上海会场"],servicePhone:"400-001",fieldConfig:{hcpId:false,remarks:false}};
  const response = body.action === "project-info" ? {project} : body.action === "registrant-login" ? {authenticated:true,attendees:[],project} : {saved:true,needsApproval:false,attendee:{id:"test-attendee",name:body.details.name,phone:body.details.phone,hospital:body.details.hospital,venue:body.details.venue,region:body.registrantRegion,contactName:body.registrantName,contactMobile:body.phone,approval:"normal",rowLocked:false}};
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
if (!await page.locator("#publicProjectName").innerText().then(text => text.includes("测试项目"))) throw new Error("Project identity was not displayed");
if (!await page.locator("#publicRegistrantIdentity").innerText().then(text => text.includes("测试人员"))) throw new Error("Registrant identity was not displayed");
if (await page.locator('#publicFullRegistrationForm input[name="name"]').getAttribute("readonly") !== null) throw new Error("Attendee name should be editable");
if (!await page.locator('[data-config-field="hcpId"]').evaluate(node => node.classList.contains("is-hidden"))) throw new Error("Project field configuration was not applied");
if (await page.locator('#publicFullRegistrationForm [name="hcpId"]').getAttribute("required") !== null) throw new Error("Hidden project field remains required");
const full = page.locator("#publicFullRegistrationForm");
const values = {name:"测试参会者",phone:"13900001111",city:"上海",hospital:"测试医院",department:"血液科",venue:"上海会场",sex:"女",idNumber:"TEST-ID-001",outDate:"2026-09-04",outFrom:"上海",outTo:"大连",outNo:"MU1001",outDeparture:"08:00",outArrival:"10:00",returnDate:"2026-09-06",returnFrom:"大连",returnTo:"上海",returnNo:"MU1002",returnDeparture:"18:00",returnArrival:"20:00"};
for (const [name,value] of Object.entries(values)) { const field = full.locator(`[name="${name}"]`); if (["venue","sex"].includes(name)) await field.selectOption(value); else await field.fill(value); }
await full.locator('button[type="submit"]').click();
await page.waitForSelector('[data-edit-public-attendee="test-attendee"]');
if (!await page.locator("#publicAttendeeList").innerText().then(text=>text.includes("测试参会者"))) throw new Error("Saved attendee was not restored to registrant list");
if (!requests.some(item => item.action === "registrant-login") || !requests.some(item => item.action === "save-attendee")) throw new Error("Registrant workspace requests missing");
if (!requests.every(item => item.meeting === "hema-sem-2026")) throw new Error("Project slug was not sent");
console.log(JSON.stringify({ route:"#portal", tabs:2, authFields:fields, fullFields:await full.locator("input,select,textarea").count(), registrantWorkspace:"pass", multiAttendee:"pass", projectIdentity:"pass", loginOpen, validation, errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
