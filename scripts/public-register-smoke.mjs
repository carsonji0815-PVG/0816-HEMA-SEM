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
  const project={name:"测试项目",clientName:"测试客户",startDate:"2026-09-04",endDate:"2026-09-06",deadline:"2026-08-26T18:00:00+08:00",venues:["上海会场"],servicePhone:"400-001",registrationOpen:true,newRegistrationAllowed:true,fieldConfig:{hcpId:false,remarks:false,serviceDeskName:"王会务",serviceDeskStart:"09:00",serviceDeskEnd:"18:00",quotaRegions:["华东大区"],registrationIdentityFields:["name","phone"]}};
  const stations={上海:["上海浦东机场T2航站楼"],大连:["大连周水子机场"]};
  const response = body.action === "project-info" ? {project} : body.action === "station-list" ? {stations:(stations[body.city]||[]).map(name=>({city:body.city,type:"PLANE",name,shortName:name}))} : body.action === "registrant-login" ? {authenticated:true,sessionToken:"test-session",registrant:{id:"r1",name:body.name,phone:body.registrantPhone},attendees:[],project} : {saved:true,needsApproval:false,attendee:{id:"test-attendee",...body.details,region:"华东大区",customFields:{...(body.details.customFields||{}),roomType:body.details.roomType},contactName:"测试人员",contactMobile:body.details.contactMobile,approval:"normal",rowLocked:false}};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(response)});
});
await page.goto("http://127.0.0.1:4173/#portal", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#publicPortalView:not(.is-hidden)");
const fields = await page.locator("#publicRegistrationForm input:not(:disabled),#publicRegistrationForm select:not(:disabled)").evaluateAll(nodes => nodes.map(node => node.name));
const loginOpen = await page.locator("#loginDialog").evaluate(node => node.open);
if (loginOpen) throw new Error("Public registration unexpectedly requires login");
if (fields.join(",") !== "name,registrantPhone") throw new Error(`Unexpected configurable public fields: ${fields.join(",")}`);
if (await page.locator('[data-portal-tab]').count() !== 3) throw new Error("Unified portal tabs missing");
if (!await page.locator(".public-service-desk").innerText().then(text=>text.includes("会务负责人")&&text.includes("王会务")&&text.includes("400-001")&&text.includes("09:00–18:00"))) throw new Error("Configurable service desk row missing");
if (await page.locator("#publicServiceDeskPhone").getAttribute("href") !== "tel:400001") throw new Error("Service desk phone is not actionable");
await page.click('[data-portal-tab="lookup"]');
await page.waitForSelector('[data-portal-panel="lookup"]:not(.is-hidden)');
await page.click('[data-portal-tab="register"]');
await page.waitForSelector('[data-portal-panel="register"]:not(.is-hidden)');
await page.fill('#publicRegistrationForm [name="name"]', "测试人员");
await page.fill('#publicRegistrationForm [name="registrantPhone"]', "13800001001");
await page.click('#publicRegistrationForm button[type="submit"]');
await page.waitForSelector("#publicFullRegistrationStep:not(.is-hidden)");
if (!await page.locator("#publicProjectName").innerText().then(text => text.includes("测试项目"))) throw new Error("Project identity was not displayed");
if (!await page.locator("#publicRegistrantIdentity").innerText().then(text => text.includes("测试人员"))) throw new Error("Registrant identity was not displayed");
if (await page.locator('#publicFullRegistrationForm input[name="name"]').getAttribute("readonly") !== null) throw new Error("Attendee name should be editable");
if (!await page.locator('[data-config-field="hcpId"]').evaluate(node => node.classList.contains("is-hidden"))) throw new Error("Project field configuration was not applied");
if (await page.locator('#publicFullRegistrationForm [name="hcpId"]').getAttribute("required") !== null) throw new Error("Hidden project field remains required");
if (!await page.locator('#publicFullRegistrationForm [name="roomType"]').isVisible()) throw new Error("Requested room type is missing from the public registration form");
if (await page.locator('#publicFullRegistrationForm [name="roomType"]').getAttribute("required") === null) throw new Error("Requested room type must be completed when accommodation is required");
const full = page.locator("#publicFullRegistrationForm");
const values = {name:"测试参会者",phone:"13900001111",region:"华东大区",city:"上海",hospital:"测试医院",department:"血液科",venue:"上海",sex:"女",idNumber:"TEST-ID-001",departDate:"2026-09-04",departCity:"上海",arriveDate:"2026-09-04",arriveCity:"大连",outNo:"MU1001",outDeparture:"08:00",outArrival:"10:00",returnDepartDate:"2026-09-06",returnDepartCity:"大连",returnArriveDate:"2026-09-06",returnArriveCity:"上海",returnNo:"MU1002",returnDeparture:"18:00",returnArrival:"20:00"};
for (const [name,value] of Object.entries(values)) { const field = full.locator(`[name="${name}"]`); if (["venue","sex"].includes(name)) await field.selectOption(value); else await field.fill(value); }
await full.locator('[name="departTransportType"]').selectOption("PLANE");
await full.locator('[data-station-input="depart"]').fill("上海浦东机场T2航站楼");
await full.locator('[data-station-input="arrive"]').fill("大连周水子机场");
await full.locator('[name="returnDepartTransportType"]').selectOption("PLANE");
await full.locator('[data-station-input="returnDepart"]').fill("大连周水子机场");
await full.locator('[data-station-input="returnArrive"]').fill("上海浦东机场T2航站楼");
await full.locator('[name="roomType"]').selectOption("shared");
await full.locator('button[type="submit"]').click();
await page.waitForSelector('[data-edit-public-attendee="test-attendee"]');
if (!await page.locator("#publicAttendeeList").innerText().then(text=>text.includes("测试参会者"))) throw new Error("Saved attendee was not restored to registrant list");
if (!requests.some(item => item.action === "registrant-login") || !requests.some(item => item.action === "save-attendee")) throw new Error("Registrant workspace requests missing");
if (!requests.some(item => item.action === "save-attendee" && item.details.roomType === "shared" && item.details.accommodation === "Y")) throw new Error("Requested room type was not submitted with the attendee");
await page.click('[data-edit-public-attendee="test-attendee"]');
if (await full.locator('[name="roomType"]').inputValue() !== "shared") throw new Error("Saved requested room type was not restored for editing");
for (const [name,value] of Object.entries({departCity:"上海",arriveCity:"大连",returnDepartCity:"大连",returnArriveCity:"上海"})) if(await full.locator(`[name="${name}"]`).inputValue()!==value)throw new Error(`Saved journey city was not restored: ${name}`);
for (const [side,value] of Object.entries({depart:"上海浦东机场T2航站楼",arrive:"大连周水子机场",returnDepart:"大连周水子机场",returnArrive:"上海浦东机场T2航站楼"})) if(await full.locator(`[data-station-input="${side}"]`).inputValue()!==value)throw new Error(`Saved journey station was not restored: ${side}`);
if (!requests.every(item => item.meeting === "hema-sem-2026")) throw new Error("Project slug was not sent");
console.log(JSON.stringify({ route:"#portal", tabs:3, authFields:fields, fullFields:await full.locator("input,select,textarea").count(), registrantWorkspace:"pass", multiAttendee:"pass", projectIdentity:"pass", loginOpen, errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
