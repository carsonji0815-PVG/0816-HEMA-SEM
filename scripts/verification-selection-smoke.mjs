import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url);
const panel=require("../travel-verification-panel.js");
const attendees=[{id:"person-1",name:"测试人员",region:"华东大区",outNo:"MU1001",returnNo:"",customFields:{}}];
const V={
  viewState:(_attendee,segment)=>segment==="outbound"?"pending":"blank",
  snapshot:(_attendee,segment)=>segment==="outbound"?{number:"MU1001",date:"2026-09-03",from:"上海虹桥机场",to:"大连周水子机场"}:{},
  currentIssues:()=>[],
  transportMode:data=>String(data.number||"").startsWith("MU")?"flight":"unknown",
  keys:segment=>segment==="outbound"?{date:"outDate",departCity:"departCity",departTransportType:"departTransportType",from:"outFrom",arriveDate:"arriveDate",arriveCity:"arriveCity",arriveTransportType:"arriveTransportType",to:"outTo",number:"outNo",departure:"outDeparture",arrival:"outArrival"}:{date:"returnDate",departCity:"returnDepartCity",departTransportType:"returnDepartTransportType",from:"returnFrom",arriveDate:"returnArriveDate",arriveCity:"returnArriveCity",arriveTransportType:"returnArriveTransportType",to:"returnTo",number:"returnNo",departure:"returnDeparture",arrival:"returnArrival"}
};
const selected=new Set(["person-1:outbound"]);
const rendered=panel.render(attendees,V,{selected});
assert.deepEqual(rendered.selectableKeys,["person-1:outbound"]);
assert.deepEqual(rendered.visibleSelectableKeys,["person-1:outbound"]);
assert.match(rendered.html,/data-select-verification="person-1"/);
assert.match(rendered.html,/data-select-segment="outbound"/);
assert.match(rendered.html,/data-review-segment="outbound"/);
assert.match(rendered.html,/verify-card-selected/);
const paid=panel.render(attendees,V,{globalFlightEnabled:true});
assert.match(paid.html,/data-disable-flight-query="person-1"[^>]*checked/);
const disabledPaid=panel.render(attendees,V,{globalFlightEnabled:true,disabledPaid:new Set(["person-1:outbound"])});
assert.doesNotMatch(disabledPaid.html,/data-disable-flight-query="person-1"[^>]*checked/);

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
assert.match(app,/selection\.has\(verificationSelectionKey/);
assert.match(app,/variflightGlobalEnabled/);
assert.match(app,/disabledVerificationFlightSegments/);
assert.doesNotMatch(app,/verifyTravelAttendees\(\[draft\],\{allowPaid:false\}\)/);
assert.match(html,/id="verificationSelectVisible"/);
assert.match(html,/id="verificationSelectionCount"/);
assert.match(html,/批量核验已选行程/);
assert.match(html,/id="verificationGlobalFlightEnabled"/);
assert.match(rendered.html,/verify-compact-table/);
console.log("verification selection smoke: ok");
