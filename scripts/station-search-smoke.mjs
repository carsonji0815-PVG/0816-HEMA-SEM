import assert from "node:assert/strict";
import {chromium} from "playwright";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
try{
  const page=await browser.newPage();
  const sides=["depart","arrive","returnDepart","returnArrive"];
  const fixture=`<form id="stationSearchSmoke">${sides.map(side=>`<label>${side}城市<input name="${side}City"></label><label>${side}方式<select name="${side}TransportType"><option value=""></option><option value="HIGH_SPEED_RAIL">高铁</option><option value="PLANE">飞机</option><option value="LOCAL_ATTEND">本地参会</option></select></label><label>${side}场站<select data-station-select="${side}" hidden></select><input data-station-input="${side}" hidden></label>`).join("")}</form>`;
  if(process.env.SMOKE_URL){await page.goto(process.env.SMOKE_URL,{waitUntil:"networkidle"});await page.evaluate(html=>document.body.insertAdjacentHTML("beforeend",html),fixture);}
  else{await page.setContent(fixture);await page.addScriptTag({path:path.join(root,"travel-fields.js")});}
  await page.evaluate(sides=>{
    const stations=["北京站","北京南站","北京西站","北京丰台站","北京朝阳站","北京北站"].map(name=>({city:"北京",type:"HIGH_SPEED_RAIL",name,shortName:name}));
    window.__dispose=TravelFields.bindForm(document.querySelector("#stationSearchSmoke"),{loadStations:async(city,type)=>city==="北京"&&type==="HIGH_SPEED_RAIL"?stations:[]});
    for(const side of sides){
      const form=document.querySelector("#stationSearchSmoke");form.elements[`${side}City`].value="北京";form.elements[`${side}TransportType`].value="HIGH_SPEED_RAIL";form.elements[`${side}TransportType`].dispatchEvent(new Event("change",{bubbles:true}));
    }
  },sides);
  const smoke=page.locator("#stationSearchSmoke");
  for(const side of sides){
    const input=smoke.locator(`[data-station-input="${side}"]`);await input.waitFor({state:"visible"});
    await input.fill("北京南");assert.deepEqual(await smoke.locator(`[data-station-select="${side}"] + input + .station-search-listbox [role="option"] span`).allTextContents(),["北京南站"]);
    await input.fill("北京");assert.equal(await smoke.locator(`[data-station-select="${side}"] + input + .station-search-listbox [role="option"]`).count(),6);
    assert.equal(await page.evaluate(side=>new FormData(document.querySelector("#stationSearchSmoke")).get(`${side}Station`),side),"北京");
    await input.fill("不存在");assert.match(await smoke.locator(`[data-station-select="${side}"] + input + .station-search-listbox`).textContent(),/手动录入/);
    assert.match(await smoke.locator(`[data-station-select="${side}"] + input + .station-search-listbox`).textContent(),/直接填写并保存/);
    await input.fill("北京南");await smoke.locator(`[data-station-select="${side}"] + input + .station-search-listbox [role="option"]`).click();
    assert.equal(await page.evaluate(side=>new FormData(document.querySelector("#stationSearchSmoke")).get(`${side}Station`),side),"北京南站");
  }
  const depart=smoke.locator('[data-station-input="depart"]');
  await smoke.locator('[name="departTransportType"]').selectOption("LOCAL_ATTEND");assert.equal(await depart.isDisabled(),true);assert.equal(await depart.inputValue(),"");
  await smoke.locator('[name="departTransportType"]').selectOption("HIGH_SPEED_RAIL");await depart.waitFor({state:"visible"});assert.equal(await depart.inputValue(),"");
  console.log("station search smoke passed: four journey station fields, local mode, reset and official-value submission");
}finally{await browser.close();}
