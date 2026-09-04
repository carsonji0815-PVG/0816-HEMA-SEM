import { chromium } from "playwright";

const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on("pageerror",error=>errors.push(error.message));
const columns=[
  ["序号","sequence"],["参会者类别","attendeeType"],["客户姓名(姓/名)*","name"],["城市","city"],
  ["医院/连锁","hospital"],["科室/门店","department"],["职称","title"],["性别","venue"],
  ["身份证号/护照号*","sex"],["手机号","idNumber"],["客户编号*","phone"],["会场","hcpId"],
  ["住宿安排(Y/N)","accommodation"],["是否航空(Y/N)","flight"],["大区","outDate"],
].map(([header,key])=>({header,key,required:header.includes("*"),custom:false}));
await page.addInitScript(({columns})=>{
  Object.defineProperty(window,"APP_CONFIG",{value:{mode:"demo"},writable:false,configurable:false});
  localStorage.setItem("journey-desk-state-v1",JSON.stringify({
    currentUserId:"u-ops",activeProjectId:"demo-hema",
    settings:{registrationTemplate:{version:1,columns},templateImported:true,templateIsSystemDefault:false},
    attendees:[{id:"alignment-1",attendeeType:"HCP",name:"季凡希",city:"上海",hospital:"上海市嘉定区中心医院",department:"内分泌科",title:"副主任医师",venue:"长沙",sex:"男",idNumber:"310123456789012345",phone:"13800000001",hcpId:"HCP-001",accommodation:"Y",flight:"Y",region:"上海大区",businessStatus:"active",customFields:{},risks:[]}]
  }));
},{columns});
await page.goto("http://127.0.0.1:4173/#attendees",{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();});
await page.waitForSelector('[data-page="attendees"].active');
const expected=["sequence","attendeeType","name","city","hospital","department","title","sex","idNumber","phone","hcpId","venue","accommodation","flight","region"];
const headingKeys=await page.locator("#attendeeTableHead [data-template-key]").evaluateAll(nodes=>nodes.slice(0,15).map(node=>node.dataset.templateKey));
if(JSON.stringify(headingKeys)!==JSON.stringify(expected))throw new Error(`Repaired heading keys mismatch: ${headingKeys.join(",")}`);
const rowValues=await page.locator("#attendeeTableBody tr").first().locator("td.template-data-cell span").evaluateAll(nodes=>nodes.slice(0,15).map(node=>node.textContent.trim()));
for(const value of ["男","310***********2345","138****0001","HCP-001","长沙","上海大区"])if(!rowValues.includes(value))throw new Error(`Roster value missing after repair: ${value}`);
await page.evaluate(()=>{window.XLSX.writeFile=(workbook,fileName)=>{window.__alignmentExport={fileName,rows:window.XLSX.utils.sheet_to_json(workbook.Sheets["报名表"],{header:1,defval:""})};};});
await page.click("#exportExcel");
const exported=await page.evaluate(()=>window.__alignmentExport);
if(!exported?.rows?.length)throw new Error("Excel export was not captured");
const exportHeaders=exported.rows[0],exportRow=exported.rows[1];
for(const [header,value] of [["性别","男"],["身份证号/护照号*","310123456789012345"],["手机号","13800000001"],["客户编号*","HCP-001"],["会场","长沙"],["大区","上海大区"]]){
  const index=exportHeaders.indexOf(header);if(index<0||exportRow[index]!==value)throw new Error(`Export mismatch for ${header}: ${exportRow[index]}`);
}
console.log(JSON.stringify({rosterColumnAlignment:"pass",excelColumnAlignment:"pass",errors},null,2));
await browser.close();if(errors.length)process.exitCode=1;
