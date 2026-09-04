import { chromium } from "playwright";
import fs from "node:fs/promises";

const base="http://127.0.0.1:4173/";
const functionUrl="**/supabase/functions/v1/public-trip-query";
const source=await fs.readFile(new URL("../supabase/functions/public-trip-query/index.ts",import.meta.url),"utf8");
const migration=await fs.readFile(new URL("../supabase/migrations/2026082901_registration_control_identity_permissions.sql",import.meta.url),"utf8");
for(const required of ["public_registration_sessions","registrant_id","cancel-attendee","sessionToken"])if(!source.includes(required)&&!migration.includes(required))throw new Error(`Missing server security primitive: ${required}`);

const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const project=(open,regions=["华东","华南"])=>({slug:"hema-sem-2026",name:"HEMA SEM",startDate:"2026-09-04",endDate:"2026-09-06",venues:["大连会场"],registrationOpen:open,newRegistrationAllowed:open,managementOpen:true,templateImported:true,registrationTemplate:{version:1,columns:[{header:"姓名*",key:"name",required:true},{header:"手机号*",key:"phone",required:true},{header:"大区*",key:"region",required:true},{header:"联系人",key:"contactName"},{header:"联系人手机",key:"contactMobile"}]},fieldConfig:{quotaRegions:regions}});

async function pageFor(open,regions=["华东","华南"]){
  const page=await browser.newPage({viewport:{width:1200,height:900}});const calls=[];
  await page.route(functionUrl,async route=>{
    const body=JSON.parse(route.request().postData()||"{}");calls.push(body);
    let responseBody;
    if(body.action==="project-info")responseBody={project:project(open,regions)};
    else if(body.action==="registrant-login")responseBody={authenticated:true,sessionToken:"secure-session",registrant:{id:"r-1",region:body.region,name:body.name,employeeNo:body.employeeNo},mode:body.mode,project:project(open,regions),attendees:[]};
    else if(body.action==="save-attendee")responseBody={saved:true,attendee:{id:"a-new",name:"测试参会者",phone:"13800000001",region:"华东",hospital:"测试医院",venue:"大连会场",businessStatus:"active",rowLocked:false,approval:"normal"},project:project(open,regions)};
    else if(body.action==="cancel-attendee")responseBody={cancelled:true};
    else responseBody={found:true,project:project(open),attendee:{name:"测*",venue:"大连会场",accommodation:"需要住宿",hotel:"会议酒店"},outbound:{},returnTrip:{},transports:[]};
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(responseBody)});
  });
  return{page,calls};
}

{
  const{page,calls}=await pageFor(true,[]);await page.goto(`${base}?event=hema-sem-2026#portal`,{waitUntil:"domcontentloaded"});const region=page.locator('#publicRegistrationForm input[name="region"]');await region.waitFor();if(await region.getAttribute("required")!==null)throw new Error("Unconfigured region must be optional");await page.locator('#publicRegistrationForm [name="name"]').fill("张三");await page.locator('#publicRegistrationForm [name="employeeNo"]').fill("E1001");await page.locator('#publicRegistrationForm button[type="submit"]').click();await page.waitForSelector('#publicAttendeeEditor:not(.is-hidden)');const login=calls.find(call=>call.action==="registrant-login");if(login?.region!=="")throw new Error("Blank unconfigured region was not accepted");await page.close();
}

{
  const{page,calls}=await pageFor(false);await page.goto(`${base}?event=hema-sem-2026#portal`,{waitUntil:"domcontentloaded"});await page.waitForSelector('[data-portal-tab="register"]:disabled');await page.waitForSelector('[data-portal-tab="manage"].active');await page.locator('#publicManageForm [name="region"]').selectOption("华东");await page.locator('#publicManageForm [name="name"]').fill("张三");await page.locator('#publicManageForm [name="employeeNo"]').fill("E1001");await page.locator('#publicManageForm button[type="submit"]').click();await page.waitForSelector('.public-attendee-empty');const empty=await page.locator('.public-attendee-empty').innerText();if(!empty.includes("暂无您提交的参会报名数据"))throw new Error("Manage empty-state missing");const login=calls.find(call=>call.action==="registrant-login");if(login?.phone||login?.employeeNo!=="E1001"||login?.mode!=="manage")throw new Error("Registrant login fields incorrect");await page.close();
}

{
  const{page,calls}=await pageFor(true);await page.goto(`${base}?event=hema-sem-2026#portal`,{waitUntil:"domcontentloaded"});await page.waitForSelector('#publicRegistrationForm button:not(:disabled)');const options=await page.locator('#publicRegistrationForm [name="region"] option').allTextContents();if(!options.includes("华东")||!options.includes("华南"))throw new Error("Configured region options missing");await page.locator('#publicRegistrationForm [name="region"]').selectOption("华东");await page.locator('#publicRegistrationForm [name="name"]').fill("张三");await page.locator('#publicRegistrationForm [name="employeeNo"]').fill("E1001");await page.locator('#publicRegistrationForm button[type="submit"]').click();await page.waitForSelector('#publicAttendeeEditor:not(.is-hidden)');const form=page.locator('#publicFullRegistrationForm');await form.locator('[name="name"]').fill("测试参会者");await form.locator('[name="phone"]').fill("13800000001");await form.locator('[name="contactMobile"]').fill("13900000001");for(const [field,value] of Object.entries({departDate:"2026-09-04",departCity:"大连",arriveDate:"2026-09-04",arriveCity:"大连",outNo:"本地参会",outDeparture:"08:00",outArrival:"08:00",returnDepartDate:"2026-09-06",returnDepartCity:"大连",returnArriveDate:"2026-09-06",returnArriveCity:"大连",returnNo:"本地参会",returnDeparture:"18:00",returnArrival:"18:00"}))await form.locator(`[name="${field}"]`).fill(value);await form.locator('[name="departTransportType"]').selectOption("LOCAL_ATTEND");await form.locator('[name="returnDepartTransportType"]').selectOption("LOCAL_ATTEND");await form.locator('button[type="submit"]').click();await page.waitForSelector('[data-cancel-public-attendee="a-new"]');const save=calls.find(call=>call.action==="save-attendee");if(save?.sessionToken!=="secure-session"||save?.registrantName||save?.registrantRegion)throw new Error("Save does not use opaque server session");page.once("dialog",dialog=>dialog.accept());await page.locator('[data-cancel-public-attendee="a-new"]').click();await page.waitForFunction(()=>document.body.innerText.includes("已取消报名"));const cancel=calls.find(call=>call.action==="cancel-attendee");if(cancel?.sessionToken!=="secure-session")throw new Error("Cancel does not enforce session");await page.close();
}

console.log(JSON.stringify({closedRegistration:"pass",optionalUnconfiguredRegion:"pass",employeeIdentity:"pass",sessionBinding:"pass",softCancel:"pass",serverPrimitives:"pass"},null,2));
await browser.close();
