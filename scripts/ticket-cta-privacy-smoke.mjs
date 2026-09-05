import { chromium } from "playwright";
import fs from "node:fs/promises";

await fs.mkdir(".tmp/browser",{recursive:true});
const base=process.env.TEST_BASE_URL||"http://127.0.0.1:4173";
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];page.on("pageerror",error=>errors.push(error.message));
await page.addInitScript(()=>{localStorage.clear();Object.defineProperty(window,"APP_CONFIG",{value:{mode:"demo"},writable:false,configurable:false});});
await page.goto(`${base}/#settings`,{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();});

await page.selectOption("#meetingCategory","researcher");
await page.locator("#ctaEnabled").evaluate(input=>{input.checked=true;input.dispatchEvent(new Event("change",{bubbles:true}));});
await page.click("#addTicketStatus");
await page.locator('.ticket-status-row [name="ticketStatusLabel"]').last().fill("财务复核中");
await page.locator('.ticket-status-row [name="ticketStatusApproval"]').last().selectOption("none");
await page.locator("#settingsForm").evaluate(form=>form.requestSubmit());
await page.waitForTimeout(200);
await page.screenshot({path:".tmp/browser/ticket-cta-settings.png",fullPage:true});

await page.evaluate(()=>{location.hash="attendees";});await page.waitForTimeout(180);
if(await page.locator("#attendeeTableHead").innerText().then(text=>!text.includes("CTA 签署")))throw new Error("CTA roster column missing");
const ticket=page.locator('[data-progress-field="ticketStatus"]').first();
const ticketLabels=await ticket.locator("option").allTextContents();
for(const label of ["待出票","出票中","已出票（机票）","已出票（高铁）","已出票（机票+高铁）","改签中","已退票","去程已出票+返程待审批","去程待审批+返程已出票","财务复核中"]){if(!ticketLabels.includes(label))throw new Error(`Ticket option missing: ${label}`);}
if(await page.locator('[data-progress-field="ctaStatus"]').count()===0)throw new Error("CTA status control missing");

const privacy=page.locator('[data-progress-field="privacyLetterStatus"]').first();
await privacy.selectOption("paper");
const uploadPort=page.locator('[data-privacy-upload-required]').first();
if(!await uploadPort.isVisible())throw new Error("Paper privacy upload port did not appear after selection");
if(await page.locator('[data-download-privacy-letter]').first().count())throw new Error("Paper privacy status closed before file upload");
await uploadPort.scrollIntoViewIfNeeded();
await page.screenshot({path:".tmp/browser/privacy-paper-upload-port.png"});
await uploadPort.locator('[data-privacy-file-input]').setInputFiles({name:"privacy-letter.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4\n%%EOF")});
await page.waitForTimeout(220);
if(await privacy.inputValue()!=="paper")throw new Error("Paper privacy status was not committed after upload");
if(!await page.locator('[data-download-privacy-letter]').first().count())throw new Error("Paper privacy attachment action missing");
await page.evaluate(()=>{const original=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob.type.includes("sheet")||blob.type.includes("excel"))blob.arrayBuffer().then(buffer=>{const workbook=XLSX.read(buffer,{type:"array"});window.__ticketCtaExport=XLSX.utils.sheet_to_json(workbook.Sheets["报名表"],{header:1,defval:""});});return original(blob);};});
await page.click("#exportExcel");await page.waitForFunction(()=>Array.isArray(window.__ticketCtaExport),null,{timeout:15000});
const exportRows=await page.evaluate(()=>window.__ticketCtaExport),header=exportRows[0],firstRow=exportRows[1];
if(!header.includes("CTA 签署")||!header.includes("出票状态"))throw new Error("CTA or ticket export column missing");
if(firstRow[header.indexOf("CTA 签署")]!=="未完成")throw new Error("CTA export value mismatch");
if(!String(firstRow[header.indexOf("隐私沟通函状态")]).includes("纸质版"))throw new Error("Paper privacy export value mismatch");
await page.screenshot({path:".tmp/browser/ticket-cta-roster.png",fullPage:true});

console.log(JSON.stringify({settings:"pass",ticketStatuses:ticketLabels.length,cta:"pass",paperPrivacyUpload:"pass",export:"pass",errors},null,2));
await browser.close();if(errors.length)process.exitCode=1;
