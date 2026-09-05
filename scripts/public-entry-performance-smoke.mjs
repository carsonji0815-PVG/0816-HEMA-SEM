import { chromium } from "playwright";

const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const requests=[];const errors=[];
page.on("request",request=>requests.push(request.url()));
page.on("pageerror",error=>errors.push(error.message));
await page.addInitScript(()=>{localStorage.clear();Object.defineProperty(window,"APP_CONFIG",{value:{mode:"demo"},writable:false,configurable:false});});
const started=Date.now();
await page.goto("http://127.0.0.1:4173/?event=hema-sem-2026#portal",{waitUntil:"domcontentloaded"});
await page.waitForSelector("#publicPortalView:not(.is-hidden)");
const initial=await page.evaluate(()=>({
  xlsx:typeof window.XLSX,
  jszip:typeof window.JSZip,
  title:document.querySelector("#publicProjectName")?.textContent,
  interactive:!document.querySelector("#publicRegistrationForm button[type=submit]")?.disabled,
}));
const initialRequests=[...requests];
if(initial.xlsx!=="undefined"||initial.jszip!=="undefined")throw new Error(`Excel libraries loaded on public entry: ${JSON.stringify(initial)}`);
if(initialRequests.some(url=>/fonts\.googleapis|fonts\.gstatic|xlsx\.full|jszip\.min/.test(url)))throw new Error(`Public entry made avoidable requests: ${initialRequests.join("\n")}`);
if(errors.length)throw new Error(`Public entry errors: ${errors.join("; ")}`);

await page.goto("http://127.0.0.1:4173/#settings",{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();});
const download=page.waitForEvent("download");
await page.click("#downloadProjectTemplate");
await download;
await page.waitForFunction(()=>window.XLSX&&window.JSZip);
const lazy=await page.evaluate(()=>({xlsx:typeof window.XLSX,jszip:typeof window.JSZip}));
if(lazy.xlsx!=="object"||lazy.jszip!=="function")throw new Error(`Excel libraries failed to lazy-load: ${JSON.stringify(lazy)}`);
console.log(JSON.stringify({publicEntry:"pass",initialMs:Date.now()-started,initial,lazy,initialRequestCount:initialRequests.length,errors},null,2));
await browser.close();
