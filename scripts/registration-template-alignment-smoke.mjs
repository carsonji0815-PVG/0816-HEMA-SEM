import { chromium } from "playwright";

const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on("pageerror",error=>errors.push(error.message));
const columns=[
  ["序号","sequence"],["参会者类别","attendeeType"],["客户姓名(姓/名)*","name"],["城市","city"],
  ["医院/连锁","hospital"],["科室/门店","department"],["职称","title"],["性别","venue"],
  ["身份证号/护照号*","sex"],["手机号","idNumber"],["客户编号*","phone"],["会场","hcpId"],
  ["住宿安排(Y/N)","accommodation"],["是否航空(Y/N)","flight"],["大区","outDate"],
  ["去程属地送站出发地点","outboundTransferOrigin"],["去程属地预约送站时间","outboundTransferTime"],["去程属地送站备注","outboundTransferNotes"],
  ["返程属地接站送达目的地","returnTransferDestination"],["返程属地预估接站时间","returnTransferTime"],["返程属地接站备注","returnTransferNotes"],
].map(([header,key])=>({header,key,required:header.includes("*"),custom:false}));
await page.addInitScript(({columns})=>{
  Object.defineProperty(window,"APP_CONFIG",{value:{mode:"demo"},writable:false,configurable:false});
  localStorage.setItem("journey-desk-state-v1",JSON.stringify({
    currentUserId:"u-ops",activeProjectId:"demo-hema",
    settings:{registrationTemplate:{version:1,columns},templateImported:true,templateIsSystemDefault:false},
    attendees:[{id:"alignment-1",attendeeType:"HCP",name:"季凡希",city:"上海",hospital:"上海市嘉定区中心医院",department:"内分泌科",title:"副主任医师",venue:"长沙",sex:"男",idNumber:"310123456789012345",phone:"13800000001",hcpId:"HCP-001",accommodation:"Y",flight:"Y",region:"上海大区",registrantId:"11111111-2222-3333-4444-555555555555",registrantName:"报名人甲",registrantRegion:"华东大区",registrantEmployeeNo:"EMP-009",createdAt:"2026-09-04T08:30:00+08:00",outboundTransferOrigin:"酒店",outboundTransferTime:"2026-09-03T12:00",outboundTransferNotes:"前台集合",returnTransferDestination:"公司",returnTransferTime:"2026-09-05T18:00",returnTransferNotes:"提前联系",businessStatus:"active",customFields:{},risks:[]},{id:"alignment-invalid",attendeeType:"HCP",name:"异常测试",sex:"女",idNumber:"110101199001011231",phone:"1380000000",businessStatus:"active",customFields:{},risks:[]}]
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
for(const key of ["sex","idNumber","phone"]){const cell=page.locator(`#attendeeTableBody tr`).nth(1).locator(`[data-template-key="${key}"]`);if(!await cell.evaluate(node=>node.classList.contains("identity-invalid-cell")))throw new Error(`Identity validation highlight missing: ${key}`);}
const tableHeaders=await page.locator("#attendeeTableHead th").allTextContents();
if(tableHeaders.includes("新增多段行程"))throw new Error("Empty extra-journey column should be hidden");
for(const header of ["去程属地送站出发地点","去程属地预约送站时间","去程属地送站备注","返程属地接站送达目的地","返程属地预估接站时间","返程属地接站备注"])if(tableHeaders.filter(value=>value.trim()===header).length!==1)throw new Error(`Duplicate roster column: ${header}`);
await page.evaluate(()=>{const createObjectURL=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{blob.arrayBuffer().then(async buffer=>{const workbook=XLSX.read(buffer,{type:"array"}),zip=await JSZip.loadAsync(buffer),styles=await zip.file("xl/styles.xml").async("string");window.__alignmentExport={rows:XLSX.utils.sheet_to_json(workbook.Sheets["报名表"],{header:1,defval:""}),styles};});return createObjectURL(blob);};});
await page.click("#exportExcel");
await page.waitForFunction(()=>window.__alignmentExport?.rows?.length>0);
const exported=await page.evaluate(()=>window.__alignmentExport);
if(!exported?.rows?.length)throw new Error("Excel export was not captured");
for(const marker of ['name val="微软雅黑"','sz val="12"','horizontal="center"','vertical="center"','left style="thin"','right style="thin"','top style="thin"','bottom style="thin"'])if(!exported.styles.includes(marker))throw new Error(`Excel style missing: ${marker}`);
const exportHeaders=exported.rows[0],exportRow=exported.rows[1];
if(exportHeaders.includes("新增多段行程明细")||exportHeaders.includes("新增多段行程核验"))throw new Error("Empty extra-journey columns should not be exported");
for(const redundant of ["抵达出行方式","返程抵达方式"])if(exportHeaders.includes(redundant))throw new Error(`Redundant journey column exported: ${redundant}`);
for(const [previous,next] of [["抵达城市","抵达场站"],["返程抵达城市","返程抵达场站"]]){const indexes=[previous,next].map(header=>exportHeaders.indexOf(header));if(indexes.some(index=>index<0)||indexes[0]>=indexes[1])throw new Error(`Journey export order mismatch: ${previous} / ${next}`);}
for(const header of ["去程属地送站出发地点","去程属地预约送站时间","去程属地送站备注","返程属地接站送达目的地","返程属地预估接站时间","返程属地接站备注"])if(exportHeaders.filter(value=>value===header).length!==1)throw new Error(`Duplicate Excel column: ${header}`);
for(const [header,value] of [["性别","男"],["身份证号/护照号*","310123456789012345"],["手机号","13800000001"],["客户编号*","HCP-001"],["会场","长沙"],["大区","上海大区"]]){
  const index=exportHeaders.indexOf(header);if(index<0||exportRow[index]!==value)throw new Error(`Export mismatch for ${header}: ${exportRow[index]}`);
}
for(const [header,value] of [["报名人姓名","报名人甲"],["报名人大区","华东大区"],["报名人员工编号","EMP-009"],["报名人唯一标识","11111111-2222-3333-4444-555555555555"],["报名来源","报名端提交"]]){
  const index=exportHeaders.indexOf(header);if(index<0||exportRow[index]!==value)throw new Error(`Registrant export mismatch for ${header}: ${exportRow[index]}`);
}
console.log(JSON.stringify({rosterColumnAlignment:"pass",excelColumnAlignment:"pass",registrantTraceability:"pass",identityValidationHighlight:"pass",journeyColumnOrder:"pass",redundantArrivalModesRemoved:"pass",excelUnifiedStyle:"pass",emptyJourneyHidden:"pass",supplementalColumnsDeduplicated:"pass",errors},null,2));
await browser.close();if(errors.length)process.exitCode=1;
