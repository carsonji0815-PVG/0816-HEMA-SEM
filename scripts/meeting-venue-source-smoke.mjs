import { chromium } from "playwright";

const base=process.env.TEST_BASE_URL||"http://127.0.0.1:4173";
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
await page.addInitScript(()=>{localStorage.clear();Object.defineProperty(window,"APP_CONFIG",{value:{mode:"demo"},writable:false,configurable:false});});

await page.goto(`${base}/#settings`,{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();});
await page.locator('#settingsForm [name="venues"]').fill("长沙");
await page.locator("#settingsForm").evaluate(form=>form.requestSubmit());
await page.waitForTimeout(250);
await page.evaluate(()=>{location.hash="registration";});
await page.waitForTimeout(150);

const adminOptions=await page.locator('#registrationForm [name="venue"] option').allTextContents();
if(JSON.stringify(adminOptions)!==JSON.stringify(["请选择当前项目会场","长沙"]))throw new Error(`Admin venue options are not meeting-scoped: ${JSON.stringify(adminOptions)}`);
const filterOptions=await page.locator('#venueFilter option').allTextContents();
if(JSON.stringify(filterOptions)!==JSON.stringify(["全部会场","长沙"]))throw new Error(`Roster venue filter is not meeting-scoped: ${JSON.stringify(filterOptions)}`);

for(const selector of ["#adminReturnTransferCollectionSection","#publicReturnTransferCollectionSection"]){
  const control=page.locator(`${selector} input[readonly]`);
  if(await control.count()!==1)throw new Error(`${selector} is missing automatic arrival-time guidance`);
  if(await control.inputValue()!=="按照实际航班/车次抵达时间")throw new Error(`${selector} has the wrong automatic arrival-time guidance`);
}

console.log(JSON.stringify({adminOptions,filterOptions,automaticReturnPickupTime:"pass",errors},null,2));
await browser.close();
if(errors.length)process.exitCode=1;
