import assert from "node:assert/strict";
import { chromium } from "playwright";

const base=process.env.TRAVEL_PREVIEW_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("https://fonts.**",route=>route.abort());
  await page.route("**/app-config.js",async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('mode: "production"','mode: "demo"')});});
  await page.goto(`${base}#settings`,{waitUntil:"domcontentloaded"});
  await page.waitForSelector('#resetDemo',{state:'attached'});
  if(!await page.evaluate(()=>localStorage.getItem("journey-desk-state-v1")))await page.evaluate(()=>{window.confirm=()=>true;document.querySelector('#resetDemo').click();});
  await page.evaluate(()=>{const key="journey-desk-state-v1",state=JSON.parse(localStorage.getItem(key));state.settings.activityType="internal";state.settings.fieldConfig={...(state.settings.fieldConfig||{}),clothingSize:true,internalRoomingMode:"manual"};state.projects[0].activityType="internal";localStorage.setItem(key,JSON.stringify(state));});
  await page.reload({waitUntil:"domcontentloaded"});
  assert.equal(await page.locator('[name="fieldClothingSize"]').isChecked(),true);
  assert.equal(await page.locator('[name="pairingPriority1"]').isDisabled(),true);
  assert.match(await page.locator('.rooming-rules-panel h2').textContent(),/内部会议/);
  await page.goto(`${base}#registration`,{waitUntil:"domcontentloaded"});
  for(const name of ["custom__businessUnit","custom__internalPosition","custom__employeeNo","custom__clothingSize"])assert.equal(await page.locator(`#registrationForm [name="${name}"]`).isVisible(),true,`${name} should be visible`);
  for(const name of ["hcpId","hospital","department","title","mslContact"])assert.equal(await page.locator(`#registrationForm [name="${name}"]`).isVisible(),false,`${name} should be hidden`);
  await page.goto(`${base}#attendees`,{waitUntil:"domcontentloaded"});
  const headers=await page.locator('#attendeeTableHead th').allTextContents();
  for(const label of ["所属 BU*","职位*","员工号*","衣服尺寸"])assert.ok(headers.some(value=>value.includes(label.replace('*',''))),`missing ${label}`);
  assert.ok(!headers.some(value=>/HCP ID|客户编号/.test(value)),"internal roster exposed HCP column");
  await page.goto(`${base}#rooming`,{waitUntil:"domcontentloaded"});
  assert.equal(await page.locator('#applyRoomingSuggestions').isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({internalFields:"pass",clothingToggle:"pass",internalRoster:"pass",manualRooming:"pass"},null,2));
}finally{await browser.close();}
