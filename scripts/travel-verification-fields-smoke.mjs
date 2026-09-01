import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";
const require=createRequire(import.meta.url),F=require("../travel-fields.js"),V=require("../travel-verification.js");
const attendee=F.applyLegacy({departDate:"2026-09-04",departCity:"上海",departTransportType:"PLANE",departStation:"上海虹桥国际机场T2航站楼",arriveDate:"2026-09-04",arriveCity:"北京",arriveTransportType:"PLANE",arriveStation:"北京首都国际机场T3航站楼",outNo:"MU5101",outDeparture:"09:00",outArrival:"11:00",returnDate:"2026-09-06",returnNo:"G101",returnFrom:"北京南站",returnTo:"上海虹桥站",returnDeparture:"12:00",returnArrival:"17:00"});
const plan=V.snapshot(attendee,"outbound");
assert.equal(V.buildCheck(attendee,"outbound",{found:true,match:plan}).status,"verified");
const different=V.buildCheck(attendee,"outbound",{found:true,match:{...plan,departure:"09:30",to:"北京大兴国际机场"}});
assert.deepEqual(different.fieldIssues.map(i=>i.field).sort(),["arriveStation","outDeparture"]);
assert.equal(V.buildCheck(attendee,"outbound",{found:false,match:plan}).status,"unavailable");
assert.equal(V.buildCheck(attendee,"outbound",{found:true,match:{...plan,date:undefined}}).status,"unavailable");
assert.equal(V.buildCheck(attendee,"outbound",{found:true,match:{...plan,date:undefined,departureDate:plan.date}}).status,"verified");
assert.equal(V.buildCheck(attendee,"return",{found:true,mode:"train",provider:"aliyun_train",requested:{date:attendee.returnDate},match:{...V.snapshot(attendee,"return"),date:undefined}}).status,"verified");
const six=V.buildCheck(attendee,"outbound",{found:true,match:{date:"2026-09-05",number:"MU5102",from:"银川河东国际机场T3航站楼",to:"北京大兴国际机场",departure:"13:00",arrival:"15:00"}});
assert.deepEqual([...new Set(six.fieldIssues.map(i=>i.field))].sort(),["arriveDate","arriveStation","departDate","departStation","outArrival","outDeparture","outNo"]);
const persisted=JSON.parse(JSON.stringify({...attendee,customFields:{_travelVerification:{outbound:V.buildCheck(attendee,"outbound",{found:true,match:plan})}}}));
assert.equal(V.verifiedField(persisted,"departStation"),true);persisted.outDeparture="10:00";assert.equal(V.verifiedField(persisted,"departStation"),false);

const base=process.env.TRAVEL_PREVIEW_URL||"http://127.0.0.1:4340/";
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
try{
 const page=await browser.newPage({viewport:{width:1380,height:960}}),errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("https://fonts.**",route=>route.abort());
 await page.route(base,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('mode: "production"','mode: "demo"')});});
 const source=await readFile(new URL("../app.js",import.meta.url),"utf8");
 // This closure hook is injected only in the test browser, never into shipped app.js.
 function testHook(){
 window.testVerification={
  setup(fields){state.attendees=[{...state.attendees[0],...fields,id:"test-attendee",name:"核验测试",customFields:{}}];state.locks={master:false,rows:[],columns:[]};state.settings.managerEditEnabled=true;state.settings.registrationOpen=true;staffAccess={allowed:true,systemRole:"super_admin"};backendMeetingId="test-project";
  backend={auth:{getSession:async()=>({data:{session:{access_token:"test-only-token"}}})},from:()=>{
    let patch;const q={eq:()=>q,select:()=>patch?Promise.resolve(window.failWrite?{error:{message:"模拟保存失败"}}:{data:[{id:"test-attendee"}]}):q,single:async()=>({data:{...toDbAttendee(state.attendees[0]),updated_at:"test-version"}}),update:value=>{patch=value;window.testWrites=(window.testWrites||[]).concat(JSON.parse(JSON.stringify(value)));return q;}};return q;
  }};
  renderAll();},
  seed(){const a=state.attendees[0];a.customFields._travelVerification={outbound:TravelVerification.buildCheck(a,"outbound",{found:true,match:{...TravelVerification.snapshot(a,"outbound"),departure:"09:30"}}),return:TravelVerification.buildCheck(a,"return",{found:true,mode:"train",match:TravelVerification.snapshot(a,"return")})};renderTravelVerificationResults();},
  data:()=>JSON.parse(JSON.stringify(state.attendees[0])),
  restore(fields){state.attendees=[fields];renderAttendeeTable();},
  results:()=>renderTravelVerificationResults(),
  lock(){state.locks.columns=["outbound"];},
  export(){window.testExport=null;const original=XLSX.writeFile;XLSX.writeFile=wb=>window.testExport=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1});exportExcel();XLSX.writeFile=original;}
 };
 }
 const hook="("+testHook.toString()+")();";
 await page.route("**/app.js?*",route=>route.fulfill({contentType:"text/javascript",body:source.replace('  document.addEventListener("DOMContentLoaded", init);',hook+'\n  document.addEventListener("DOMContentLoaded", init);')}));
 let calls=0;
 await page.route("https://139.196.97.236/**",async route=>{calls++;await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"本测试禁止调用在线数据源"})});});
 await page.goto(base,{waitUntil:"domcontentloaded"});
 await page.waitForSelector("#attendeeTableBody [data-open-attendee]",{state:"attached"});
 await page.evaluate(a=>window.testVerification.setup(a),attendee);
 await page.evaluate(()=>window.testVerification.seed());
 await page.locator("[data-review-travel]").first().click();
 const problems=()=>page.locator('#tripEditForm [aria-invalid="true"]').evaluateAll(inputs=>inputs.map(i=>i.name).sort());
 assert.deepEqual(await problems(),["outDeparture"]);
 assert.equal(await page.locator('#tripEditForm [name="departStation"] option:checked').textContent(),"上海虹桥 T2");
 await page.locator('#tripEditForm [name="outDeparture"]').fill("09:30");
 await page.locator('#tripEditForm [type="submit"]').click();
 await page.waitForFunction(()=>!document.querySelector("#attendeeDialog").open);
 assert.equal(calls,0,"saving must not consume provider quota");
 const saved=await page.evaluate(()=>window.testVerification.data());
 assert.equal(saved.departStation,attendee.departStation);
 assert.equal(saved.outDeparture,"09:30");
 assert.equal(!!saved.customFields._travelVerification.outbound,false);
 assert.equal(!!saved.customFields._travelVerification.return,true);
 await page.evaluate(()=>window.testVerification.export());
 assert.ok((await page.evaluate(()=>window.testExport.flat())).includes(attendee.departStation));
 await page.locator("[data-review-travel]").first().click();
 await page.evaluate(()=>window.failWrite=true);
 await page.locator('#tripEditForm [type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector(".trip-save-error")?.textContent.includes("模拟保存失败"));
 assert.equal(calls,0);
 await page.evaluate(()=>{window.failWrite=false;window.testVerification.lock();});
 await page.locator("#cancelEdit").click();await page.locator("[data-review-travel]").first().click();
 assert.equal(await page.locator('#tripEditForm [name^="depart"]:disabled, #tripEditForm [name^="arrive"]:disabled, #tripEditForm [name^="out"]:disabled').count(),11);
 assert.equal(await page.locator('#tripEditForm [name^="return"]:disabled').count(),0);
 assert.deepEqual(errors,[]);
 console.log("PASS: field errors, manual-only save, no provider calls, retained return, safe export, save failure, column locks");
}finally{await browser.close();}
