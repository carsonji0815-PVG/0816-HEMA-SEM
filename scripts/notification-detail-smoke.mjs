import { chromium } from "playwright";

const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on("pageerror",error=>errors.push(error.message));
await page.addInitScript(()=>{
  const initial={id:"notice-test",type:"change",text:"报名端修改",time:"2026-09-05T09:30:00+08:00",read:false,publicSource:true,auditOnly:false,attendeeName:"季凡希",actorName:"季亮亮（报名端）",changes:[
    {label:"去程出发场站",before:"上海虹桥机场T2航站楼",after:"上海浦东机场T2航站楼"},
    {label:"去程接送时间",before:"",after:"2026-11-27T10:00:00+00:00"},
  ]};
  localStorage.setItem("journey-desk-state-v1",JSON.stringify({attendees:[],notifications:[initial]}));
  Object.defineProperty(window,"APP_CONFIG",{value:{mode:"demo"},writable:false,configurable:false});
});
await page.goto("http://127.0.0.1:4173/#notifications",{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();});
await page.locator('[data-notification-detail="notice-test"]').click();
const result=await page.locator("#notificationDetailDialog").evaluate(dialog=>{
  const row=dialog.querySelector(".change-detail-row"),text=dialog.textContent,style=getComputedStyle(row);
  return{open:dialog.open,text,rowColumns:style.gridTemplateColumns,rowHeight:row.getBoundingClientRect().height};
});
await page.screenshot({path:".tmp/notification-detail-compact.png",fullPage:true});
if(!result.open||!result.text.includes("2026-11-27 18:00")||result.text.includes("T10:00:00+00:00")||result.rowHeight>90||errors.length)throw new Error(JSON.stringify({result,errors}));
console.log(JSON.stringify({notificationDetail:"pass",result,errors},null,2));
await browser.close();
