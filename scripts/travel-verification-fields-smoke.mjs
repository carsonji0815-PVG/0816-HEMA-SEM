import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";
const V=createRequire(import.meta.url)("../travel-verification.js");
const attendee={outDate:"2026-09-04",outNo:"MU5101",outFrom:"上海虹桥国际机场T2航站楼",outTo:"北京首都国际机场T3航站楼",outDeparture:"09:00",outArrival:"11:00",returnDate:"2026-09-06",returnNo:"G101",returnFrom:"北京南站",returnTo:"上海虹桥站",returnDeparture:"12:00",returnArrival:"17:00"};
const plan=V.snapshot(attendee,"outbound");
assert.equal(V.buildCheck(attendee,"outbound",{found:true,match:plan}).status,"verified");
const different=V.buildCheck(attendee,"outbound",{found:true,match:{...plan,departure:"09:30",to:"北京大兴国际机场"}});
assert.deepEqual(different.fieldIssues.map(i=>i.field).sort(),["outDeparture","outTo"]);
assert.equal(V.buildCheck(attendee,"outbound",{found:false,match:plan}).status,"unavailable");
assert.equal(V.buildCheck(attendee,"outbound",{found:true,match:{...plan,date:undefined}}).status,"unavailable");
assert.equal(V.buildCheck(attendee,"outbound",{found:true,match:{...plan,date:undefined,departureDate:plan.date}}).status,"verified");
assert.equal(V.buildCheck(attendee,"return",{found:true,mode:"train",provider:"aliyun_train",requested:{date:attendee.returnDate},match:{...V.snapshot(attendee,"return"),date:undefined}}).status,"verified");
const six=V.buildCheck(attendee,"outbound",{found:true,match:{date:"2026-09-05",number:"MU5102",from:"银川河东国际机场T3航站楼",to:"北京大兴国际机场",departure:"13:00",arrival:"15:00"}});
assert.equal(new Set(six.fieldIssues.map(i=>i.field)).size,6);
const persisted=JSON.parse(JSON.stringify({...attendee,customFields:{_travelVerification:{outbound:V.buildCheck(attendee,"outbound",{found:true,match:plan})}}}));
assert.equal(V.verifiedField(persisted,"outFrom"),true);persisted.outDeparture="10:00";assert.equal(V.verifiedField(persisted,"outFrom"),false);

const base="http://127.0.0.1:4173/";
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
  backend={auth:{getSession:async()=>({data:{session:{access_token:"test-only-token"}}})},from:()=>({upsert:async rows=>{window.testWrites=(window.testWrites||[]).concat(JSON.parse(JSON.stringify(rows)));return window.failWrite?{error:{message:"模拟保存失败"}}:{error:null};}})};
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
 let calls=0,mode="new-error",captured=[];
 await page.route("https://139.196.97.236/**",async route=>{
   const body=route.request().postDataJSON();captured.push(body);calls++;
   await new Promise(resolve=>setTimeout(resolve,150));
   if(mode==="fail")return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"模拟接口不可用"})});
   const results=body.journeys.map(j=>({attendeeId:j.attendeeId,segment:j.segment,mode:j.mode,found:true,match:{date:j.date,number:j.number,from:j.from,to:j.to,departure:j.departure,arrival:mode==="new-error"&&j.segment==="outbound"?"11:30":j.arrival},warnings:[]}));
   await route.fulfill({contentType:"application/json",body:JSON.stringify({results})});
 });
 await page.goto(base,{waitUntil:"domcontentloaded"});
 await page.waitForSelector("#attendeeTableBody [data-open-attendee]",{state:"attached"});
 await page.evaluate(a=>window.testVerification.setup(a),attendee);
 await page.evaluate(()=>window.testVerification.seed());
 await page.locator("[data-fix-travel]").click();
 const problems=()=>page.locator('#tripEditForm [aria-invalid="true"]').evaluateAll(inputs=>inputs.map(i=>i.name).sort());
 assert.deepEqual(await problems(),["outDeparture"]);
 assert.equal(await page.locator('#tripEditForm [name="outFrom"]').inputValue(),"上海虹桥 T2");
 assert.equal(await page.locator('#tripEditForm input:disabled').count(),0);
 await page.locator('#tripEditForm [name="outDeparture"]').fill("09:30");
 await page.locator('#tripEditForm [type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('#tripEditForm [name="outArrival"]')?.getAttribute("aria-invalid")==="true");
 assert.deepEqual(await problems(),["outArrival"]);
 assert.equal(calls,1);
 assert.equal(captured[0].journeys[0].from,attendee.outFrom);
 mode="pass";
 await page.locator('#tripEditForm [name="outArrival"]').fill("11:30");
 await page.locator('#tripEditForm [type="submit"]').click();
 await page.waitForFunction(()=>!document.querySelector("#attendeeDialog").open&&document.querySelector("#travelVerificationDialog").open);
 assert.equal(calls,2);
 assert.equal(await page.locator(".travel-verified-cell").count(),12);
 assert.equal(await page.locator('.travel-verified-cell[data-template-key="name"]').count(),0);
 const saved=await page.evaluate(()=>window.testVerification.data());
 assert.equal(saved.outFrom,attendee.outFrom);
 await page.evaluate(()=>window.testVerification.export());
 assert.ok((await page.evaluate(()=>window.testExport.flat())).includes(attendee.outFrom));
 await page.reload({waitUntil:"domcontentloaded"});
 await page.waitForSelector("#attendeeTableBody",{state:"attached"});
 assert.equal(await page.locator(".travel-verified-cell").count(),12,"real localStorage reload preserves verified cell marks");
 await page.evaluate(a=>window.testVerification.setup(a),attendee);
 await page.evaluate(a=>window.testVerification.restore(a),saved);
 assert.equal(await page.locator(".travel-verified-cell").count(),12);
 await page.evaluate(()=>window.testVerification.results());
 await page.locator("[data-fix-travel]").click();
 mode="fail";
 await page.locator('#tripEditForm [type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector("#tripEditForm")?.textContent.includes("模拟接口不可用"));
 assert.deepEqual(await problems(),[]);
 assert.equal(await page.locator(".travel-verified-cell").count(),0);
 assert.equal(await page.locator("#attendeeDialog").evaluate(el=>el.open),true);
 mode="pass";await page.evaluate(()=>window.failWrite=true);
 const before=calls;
 await page.locator('#tripEditForm [type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector(".trip-save-error")?.textContent.includes("模拟保存失败"));
 assert.equal(calls,before);
 await page.evaluate(()=>{window.failWrite=false;window.testVerification.lock();});
 await page.locator("#cancelEdit").click();await page.locator("[data-fix-travel]").click();
 assert.equal(await page.locator('#tripEditForm [name^="out"]:disabled').count(),6);
 assert.equal(await page.locator('#tripEditForm [name^="return"]:disabled').count(),0);
 assert.deepEqual(errors,[]);
 console.log("PASS: field-only errors, fresh API retry, new errors, passed close, 12 persistent cells, reload, official export, API/save failure, locks");
}finally{await browser.close();}
