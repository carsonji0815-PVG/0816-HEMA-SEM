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

const lodgingDates=R.lodgingDates(manual);
assert.deepEqual(lodgingDates,{checkIn:"2026-09-03",checkOut:"2026-09-05"},"lodging dates should initially inherit travel dates");
const manuallyDated=attendee("dated","女","D院","上海","上海市","华东大区",{arriveDate:"2026-09-03",returnDepartDate:"2026-09-05",customFields:{province:"上海市",_rooming:{checkInDate:"2026-09-04",checkOutDate:"2026-09-07",actualNights:2,manualFields:["checkInDate","checkOutDate","actualNights"]}}});
assert.deepEqual(R.referenceDates(manuallyDated),{arrival:"2026-09-03",departure:"2026-09-05"});
assert.deepEqual(R.lodgingDates(manuallyDated),{checkIn:"2026-09-04",checkOut:"2026-09-07"});
assert.equal(R.referenceNights(manuallyDated),3);
assert.equal(R.travelReferenceNights(manuallyDated),2);
manuallyDated.arriveDate="2026-09-01";manuallyDated.returnDepartDate="2026-09-10";
assert.deepEqual(R.lodgingDates(manuallyDated),{checkIn:"2026-09-04",checkOut:"2026-09-07"},"travel changes must not overwrite manually maintained lodging dates");
assert.equal(R.record(manuallyDated).actualNights,2,"travel changes must not overwrite actual allowed nights");
const invalidDates=attendee("invalid","女","D院","上海","上海市","华东大区",{customFields:{province:"上海市",_rooming:{checkInDate:"2026-09-07",checkOutDate:"2026-09-04"}}});
assert.equal(R.lodgingDateIssue(invalidDates),"退房日期不能早于入住日期");

const finalRoom=(id,type,checkInDate,checkOutDate,actualNights,roommateId="")=>attendee(id,"女",`${id}院`,"上海","上海市","华东大区",{customFields:{province:"上海市",_rooming:{assignedType:type,checkInDate,checkOutDate,actualNights,roommateId,manualFields:["assignedType","checkInDate","checkOutDate","actualNights","roommateId"]}}});
const occupancy=R.dailyOccupancy([
  finalRoom("single","single","2026-09-03","2026-09-06",2),
  finalRoom("twin","twin_single","2026-09-04","2026-09-06",2),
  finalRoom("pair-a","shared","2026-09-03","2026-09-05",2,"pair-b"),
  finalRoom("pair-b","shared","2026-09-03","2026-09-05",2,"pair-a"),
  finalRoom("unpaired","shared","2026-09-03","2026-09-05",2),
  finalRoom("none","none","2026-09-03","2026-09-05",2)
]);
assert.deepEqual(occupancy.rows,[
  {date:"2026-09-03",single:1,shared:1,twinSingle:0},
  {date:"2026-09-04",single:1,shared:1,twinSingle:1},
  {date:"2026-09-05",single:0,shared:0,twinSingle:1}
],"daily occupancy must count rooms, cap by actual nights, exclude checkout day and de-duplicate shared pairs");
assert.deepEqual(R.dailyOccupancy([finalRoom("single","single","2026-09-03","2026-09-06",3)],{from:"2026-09-04",to:"2026-09-05"}).rows.map(row=>row.date),["2026-09-04","2026-09-05"],"date range must be inclusive");

console.log("rooming engine: room types, pairing, independent dates and daily room occupancy passed");
