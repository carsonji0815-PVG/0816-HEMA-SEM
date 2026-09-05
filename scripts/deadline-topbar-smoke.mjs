import { chromium } from "playwright";

const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on("pageerror",error=>errors.push(error.message));
await page.addInitScript(()=>{localStorage.clear();Object.defineProperty(window,"APP_CONFIG",{value:{mode:"demo"},writable:false,configurable:false});});
await page.goto("http://127.0.0.1:4173/#settings",{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();});
await page.fill('#settingsForm [name="deadline"]',"2026-12-31T20:45");
await page.locator("#settingsForm").evaluate(form=>form.requestSubmit());
await page.waitForFunction(()=>document.querySelector("#topbarRegistrationDeadline")?.textContent.includes("12月31日 20:45"));
const result=await page.evaluate(()=>({state:document.querySelector("#topbarRegistrationState").textContent,deadline:document.querySelector("#topbarRegistrationDeadline").textContent,input:document.querySelector('#settingsForm [name="deadline"]').value}));
if(errors.length||result.state!=="报名开放中"||result.deadline!=="· 截止 12月31日 20:45"||result.input!=="2026-12-31T20:45")throw new Error(JSON.stringify({result,errors}));
console.log(JSON.stringify({...result,errors},null,2));
await browser.close();
