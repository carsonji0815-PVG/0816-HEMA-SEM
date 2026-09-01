import {test} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),F=require("../travel-fields.js");
test("transport enums and local attendee are normalized",()=>{
  assert.equal(F.normalizeType("飞机"),"PLANE");assert.equal(F.normalizeType("高铁"),"HIGH_SPEED_RAIL");assert.equal(F.normalizeType("本地参会"),"LOCAL_ATTEND");
  assert.equal(F.applyLegacy({departCity:"上海",departTransportType:"LOCAL_ATTEND",departStation:"错误场站"}).outFrom,"上海");
});
test("dictionary filters city and transport independently",()=>{
  assert.ok(F.options([], "上海市","PLANE").every(name=>name.includes("机场")));
  assert.ok(F.options([], "北京","HIGH_SPEED_RAIL").every(name=>name.endsWith("站")));
  assert.ok(!F.options([], "北京","HIGH_SPEED_RAIL").some(name=>name.includes("机场")));
});
test("display is abbreviated and storage remains official",()=>{
  const official="上海虹桥国际机场T2航站楼";
  assert.equal(F.displayStation(official,"PLANE"),"上海虹桥 T2");
  assert.equal(F.officialStation("上海虹桥 T2","PLANE"),official);
  assert.equal(F.officialStation("大连北","高铁"),"大连北站");
});
test("custom dictionary is data-driven",()=>{
  const parsed=F.parseDictionary("合肥|PLANE|合肥新桥国际机场T2航站楼\n合肥|HIGH_SPEED_RAIL|合肥南站");
  assert.deepEqual(F.options(parsed,"合肥","PLANE"),["合肥新桥国际机场T2航站楼"]);
});
