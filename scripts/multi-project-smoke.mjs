import { chromium } from "playwright";

const browser = await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page = await browser.newPage({viewport:{width:1280,height:900}});
const errors=[]; page.on("pageerror",error=>errors.push(error.message));
await page.goto("http://127.0.0.1:4173/#projects",{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();});
await page.waitForSelector('[data-page="projects"].active');
if (await page.locator("#projectSelect option").count()<1) throw new Error("Project selector is empty");
await page.click("#newProjectButton");
await page.fill('#projectForm [name="name"]',"新会议项目");
await page.fill('#projectForm [name="slug"]',"new-meeting-2026");
await page.click('#projectForm button[type="submit"]');
await page.waitForFunction(() => [...document.querySelectorAll("#projectSelect option")].some(option => option.textContent.includes("新会议项目")));
if (!await page.locator("#projectGrid").innerText().then(text=>text.includes("新会议项目"))) throw new Error("New project card missing");
const qrLink=await page.locator(".qr-direct-link").getAttribute("href");
if (!qrLink?.includes("event=new-meeting-2026")) throw new Error("Public project link has no event slug");
console.log(JSON.stringify({projectSelector:"pass",createProject:"pass",projectPublicUrl:"pass",errors},null,2));
await browser.close(); if(errors.length)process.exitCode=1;
