import { chromium } from "playwright";
import assert from "node:assert/strict";

const base=process.env.TEST_BASE_URL||"http://127.0.0.1:4173";
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
await page.addInitScript(()=>{localStorage.clear();Object.defineProperty(window,"APP_CONFIG",{value:{mode:"demo"},writable:false,configurable:false});});

await page.goto(`${base}/#settings`,{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();});
await page.click("#addMeetingVenue");
const venueRow=page.locator("#meetingVenueRows .location-venue-row").last();
await venueRow.locator('[name="locationVenueName"]').fill("大连国际会议中心三楼宴会厅");
await venueRow.locator('[name="locationVenueDefault"]').check();
await page.locator("#settingsForm").evaluate(form=>form.requestSubmit());
await page.waitForTimeout(250);
await page.locator("#settingsForm").screenshot({path:".tmp/browser/location-catalog-settings.png"});

const catalog=await page.evaluate(()=>JSON.parse(localStorage.getItem("journey-desk-state-v1"))?.settings?.locationCatalog);
assert.ok(catalog?.cities?.some(item=>item.id==="city-dalian"&&item.name==="大连"),"city did not persist");
assert.ok(catalog?.hotels?.some(item=>item.id==="hotel-dalian-demo"&&item.cityId==="city-dalian"),"hotel did not persist with city relation");
assert.ok(catalog?.meetingVenues?.some(item=>item.name==="大连国际会议中心三楼宴会厅"&&item.cityId==="city-dalian"&&item.isDefault),"default venue did not persist with city relation");

await page.evaluate(()=>{location.hash="rooming";});
await page.waitForSelector('#roomingTableBody [data-room-field="hotelId"]');
await page.locator(".rooming-panel").screenshot({path:".tmp/browser/rooming-hotel-column.png"});
const hotelSelect=page.locator('#roomingTableBody [data-room-field="hotelId"]').filter({has:page.locator('option[value="hotel-dalian-demo"]')}).first();
const attendeeId=await hotelSelect.getAttribute("data-attendee");
await hotelSelect.selectOption("hotel-dalian-demo");
await page.waitForTimeout(200);
const identity=await page.evaluate(id=>{const state=JSON.parse(localStorage.getItem("journey-desk-state-v1")),attendee=state.attendees.find(item=>item.id===id);return{phone:attendee.phone,hotelId:attendee.customFields?._rooming?.hotelId,cityId:attendee.customFields?._location?.cityId,venueId:attendee.customFields?._location?.venueId};},attendeeId);
assert.equal(identity.hotelId,"hotel-dalian-demo","rooming hotel relation did not persist");
assert.equal(identity.cityId,"city-dalian","attendee city relation did not persist");
assert.ok(identity.venueId,"attendee venue relation did not persist");

await page.evaluate(()=>{location.hash="portal";});
await page.click('[data-portal-tab="lookup"]');
await page.fill("#lookupPhone",identity.phone.replace(/\D/g,""));
await page.click('#lookupForm button[type="submit"]');
await page.waitForSelector(".lookup-stay-summary");
const stay=await page.locator(".lookup-stay-summary").innerText();
for(const expected of ["大连会议酒店","大连国际会议中心三楼宴会厅"]){assert.ok(stay.includes(expected),`public lookup did not receive linked value: ${expected}`);}
assert.deepEqual(errors,[],"browser errors occurred");
console.log(JSON.stringify({cityToHotel:"pass",cityToVenue:"pass",roomingPersistence:"pass",publicLookup:"pass"},null,2));
await browser.close();
