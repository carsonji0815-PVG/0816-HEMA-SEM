import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const R=require("../rooming-engine.js");

assert.equal(R.normalizeType("标间单住"),"twin_single");
assert.equal(R.normalizeType("标间拼住"),"shared");
assert.equal(R.label("twin_single"),"标间单住");

const rules={singleTitles:["主任医师","副主任医师"],twinSingleKeywords:["标间单住"],defaultType:"shared",pairingPriorities:["hospital","city","province","region"]};
assert.deepEqual(R.recommendation({title:"主任医师",remarks:"请安排标间单住"},rules),{type:"twin_single",source:"备注要求标间单住"});
assert.equal(R.recommendation({title:"副主任医师",remarks:""},rules).type,"single");
assert.equal(R.recommendation({title:"主治医师",remarks:""},rules).type,"shared");

const attendee=(id,sex,hospital,city,province,region,extra={})=>({id,name:id,sex,hospital,city,region,title:"主治医师",accommodation:"Y",customFields:{province,...(extra.customFields||{})},...extra});
const list=[
  attendee("a","女","同院","甲城","甲省","一区"),attendee("b","女","同院","乙城","乙省","二区"),
  attendee("c","男","C院","丙城","丙省","三区"),attendee("d","男","D院","丙城","丁省","四区"),
  attendee("e","女","E院","戊城","同省","五区"),attendee("f","女","F院","己城","同省","六区"),
  attendee("g","男","G院","庚城","庚省","同区"),attendee("h","男","H院","辛城","辛省","同区"),
  attendee("i","女","I院","壬城","壬省","九区")
];
const patches=R.autoAssign(list,rules);
assert.equal(patches.get("a").roommateId,"b");assert.equal(patches.get("a").pairingReason,"同一医院");
assert.equal(patches.get("c").roommateId,"d");assert.equal(patches.get("c").pairingReason,"同一城市");
assert.equal(patches.get("e").roommateId,"f");assert.equal(patches.get("e").pairingReason,"同一省份其他城市");
assert.equal(patches.get("g").roommateId,"h");assert.equal(patches.get("g").pairingReason,"同一大区");
assert.equal(patches.get("i").roommateId,"");assert.equal(patches.get("i").pendingManual,true);

const manual=attendee("manual","女","M院","M城","M省","M区",{arriveDate:"2026-09-03",returnDepartDate:"2026-09-05",customFields:{province:"M省",_rooming:{assignedType:"twin_single",actualNights:5,manualFields:["assignedType","actualNights"]}}});
const manualPatch=R.autoAssign([manual],rules).get("manual");
assert.equal(manualPatch.assignedType,"twin_single");assert.equal(manualPatch.actualNights,5);assert.equal(manualPatch.roommateId,"");
assert.equal(R.referenceNights(manual),2);assert.equal(R.record(manual).actualNights,5);

console.log("rooming engine: three room types, priority matching, manual precedence and independent actual nights passed");
