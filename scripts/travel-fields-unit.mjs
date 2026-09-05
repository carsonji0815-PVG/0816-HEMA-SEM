import {test} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),F=require("../travel-fields.js");
test("transport enums and local attendee are normalized",()=>{
  assert.equal(F.normalizeType("飞机"),"PLANE");assert.equal(F.normalizeType("高铁"),"HIGH_SPEED_RAIL");assert.equal(F.normalizeType("本地参会"),"LOCAL_ATTEND");
  assert.equal(F.applyLegacy({departCity:"上海",departTransportType:"LOCAL_ATTEND",departStation:"错误场站"}).outFrom,"上海");
});
test("journey dates repair two-digit browser years and reject invalid dates",()=>{
  assert.equal(F.normalizeDate("0026-11-28"),"2026-11-28");
  assert.equal(F.normalizeDate("26/11/28"),"2026-11-28");
  assert.equal(F.normalizeDate("2026年2月28日"),"2026-02-28");
  assert.equal(F.normalizeDate("2026-02-29"),"");
  assert.equal(F.normalizeDate("1999-12-31"),"");
  const attendee=F.applyLegacy({departDate:"0026-11-27",returnDepartDate:"0026-11-28"});
  assert.equal(attendee.outDate,"2026-11-27");assert.equal(attendee.returnDate,"2026-11-28");
});
test("dictionary filters city and transport independently",()=>{
  assert.ok(F.options([], "上海市","PLANE").every(name=>name.includes("机场")));
  assert.ok(F.options([], "北京","HIGH_SPEED_RAIL").every(name=>name.endsWith("站")));
  assert.ok(!F.options([], "北京","HIGH_SPEED_RAIL").some(name=>name.includes("机场")));
});
test("display is abbreviated and storage remains official",()=>{
  const official="上海虹桥机场T2航站楼";
  assert.equal(F.displayStation(official,"PLANE"),"上海虹桥 T2");
  assert.equal(F.officialStation("上海虹桥 T2","PLANE"),official);
  assert.equal(F.officialStation("大连北","高铁"),"大连北站");
  assert.equal(F.officialStation("大连周水子机场站","PLANE"),"大连周水子机场");
  assert.equal(F.officialStation("成都天府机场T2航站楼站","PLANE"),"成都天府机场T2航站楼");
  assert.equal(F.officialStation("广州白云 T3","PLANE"),"广州白云机场T3航站楼");
  assert.equal(F.officialStation("西安咸阳国际机场 5号航站楼","PLANE"),"西安咸阳机场T5航站楼");
  assert.equal(F.officialStation("泸州东高铁站","HIGH_SPEED_RAIL"),"泸州东站");
});
test("custom dictionary is data-driven",()=>{
  const parsed=F.parseDictionary("合肥|PLANE|合肥新桥机场T2航站楼\n合肥|HIGH_SPEED_RAIL|合肥南站");
  assert.deepEqual(F.options(parsed,"合肥","PLANE"),["合肥新桥机场T2航站楼"]);
});
