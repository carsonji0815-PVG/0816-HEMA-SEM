import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const TravelFields=require("../../../travel-fields.js");
globalThis.TravelFields=TravelFields;
const TravelVerification=require("../../../travel-verification.js");

const dictionary=[
  {city:"上海",type:"HIGH_SPEED_RAIL",name:"上海虹桥站",shortName:"上海虹桥站"},
  {city:"成都",type:"PLANE",name:"成都双流机场T1航站楼",shortName:"成都双流 T1"},
  {city:"成都",type:"PLANE",name:"成都天府机场T2航站楼",shortName:"成都天府 T2"},
];

test("city cleanup removes full-width and zero-width whitespace",()=>{
  assert.equal(TravelFields.normalizeCity(" \u200B成都市　"),"成都");
});

test("station options keep official values and short UI labels",()=>{
  const rows=TravelFields.stationList(dictionary," 成都市 ","飞机");
  assert.deepEqual(rows.map(row=>row.name),["成都双流机场T1航站楼","成都天府机场T2航站楼"]);
  assert.equal(TravelFields.displayStation(rows[0].name,"PLANE",dictionary),"成都双流 T1");
  assert.equal(TravelFields.officialStation("成都双流 T1","PLANE",dictionary),"成都双流机场T1航站楼");
});

test("station search filters only the current city/type result set by short label",()=>{
  const beijing=[
    {city:"北京",type:"HIGH_SPEED_RAIL",name:"北京南站",shortName:"北京南站"},
    {city:"北京",type:"HIGH_SPEED_RAIL",name:"北京丰台站",shortName:"北京丰台站"},
    {city:"北京",type:"HIGH_SPEED_RAIL",name:"北京西站",shortName:"北京西站"},
  ];
  assert.deepEqual(TravelFields.filterStationOptions(beijing,"北京南").map(item=>item.name),["北京南站"]);
  assert.deepEqual(TravelFields.filterStationOptions(beijing,"北京").map(item=>item.name),["北京南站","北京丰台站","北京西站"]);
  assert.deepEqual(TravelFields.filterStationOptions(beijing,"丰台").map(item=>item.name),["北京丰台站"]);
  assert.equal(TravelFields.filterStationOptions(beijing,"广州").length,0);
});

test("local attendance clears every corresponding station",()=>{
  const item=TravelFields.applyLegacy({departTransportType:"LOCAL_ATTEND",departStation:"错误场站",arriveTransportType:"LOCAL_ATTEND",arriveStation:"错误场站",returnDepartTransportType:"LOCAL_ATTEND",returnDepartStation:"错误场站",returnArriveTransportType:"LOCAL_ATTEND",returnArriveStation:"错误场站"});
  assert.equal(item.departStation,"");assert.equal(item.arriveStation,"");assert.equal(item.returnDepartStation,"");assert.equal(item.returnArriveStation,"");
});

test("return local verification flags a forbidden station only on that field",()=>{
  const attendee={returnDepartDate:"2026-09-12",returnDepartCity:"大连",returnDepartTransportType:"LOCAL_ATTEND",returnDepartStation:"大连北站",returnArriveDate:"2026-09-12",returnArriveCity:"大连",returnArriveTransportType:"LOCAL_ATTEND",returnArriveStation:""};
  const issues=TravelVerification.localIssues(attendee,"return");
  assert.ok(issues.some(issue=>issue.field==="returnDepartStation"));
  assert.ok(!issues.some(issue=>issue.field==="returnArriveStation"));
});

test("dictionary mismatch identifies only the bad station field",()=>{
  const attendee={departDate:"2026-09-04",departCity:"上海",departTransportType:"HIGH_SPEED_RAIL",departStation:"成都东站",arriveDate:"2026-09-04",arriveCity:"上海",arriveTransportType:"HIGH_SPEED_RAIL",arriveStation:"上海虹桥站",outNo:"G1",outDeparture:"08:00",outArrival:"09:00"};
  const issues=TravelVerification.dictionaryIssues(attendee,"outbound",dictionary);
  assert.deepEqual(issues.map(issue=>issue.field),["departStation"]);
});
