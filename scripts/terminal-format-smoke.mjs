import { chromium } from "playwright";
import fs from "node:fs/promises";

const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage();const errors=[];page.on("pageerror",error=>errors.push(error.message));
await page.goto("http://127.0.0.1:4173/?preview=terminal#attendees",{waitUntil:"domcontentloaded"});
const labels=await page.evaluate(()=>{const format=window.__verificationTerminalLabel;return[
  format("上海虹桥机场T2航站楼","MU5101","flight"),
  format("南通兴东机场T3航站楼","ZH1234","flight"),
  format("银川河东机场 T3","CA1234","flight"),
  format("北京首都机场2号航站楼","CA1234","flight"),
  format("北京大兴机场","CZ1234","flight"),
  format("大连周水子机场","G54484","flight"),
  format("成都天府机场T2航站楼","G54484","flight"),
  format("上海虹桥","G1651","train"),
  format("福州南","G1651","train"),
];});
const expected=["上海虹桥 T2","南通 T3","银川 T3","北京首都 T2","北京大兴","大连","成都天府 T2","上海虹桥站","福州南站"];
if(JSON.stringify(labels)!==JSON.stringify(expected))throw new Error(`Terminal labels mismatch: ${JSON.stringify({labels,expected})}`);
const app=await fs.readFile(new URL("../app.js",import.meta.url),"utf8");
const roomingExport=app.match(/function exportRoomingList\(\)[^\n]+/)?.[0]||"";
const rosterExport=app.slice(app.indexOf("function exportExcel()"));
if(roomingExport.includes("verificationTerminalLabel")||rosterExport.includes("verificationTerminalLabel"))throw new Error("Internal station shorthand leaked into an external export");
console.log(JSON.stringify({flightLabels:"pass",beijingAirports:"pass",trainStations:"pass",errors},null,2));
await browser.close();if(errors.length)process.exitCode=1;
