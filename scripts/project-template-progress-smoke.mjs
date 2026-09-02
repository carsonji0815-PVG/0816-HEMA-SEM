import { chromium } from "playwright";
import fs from "node:fs/promises";

await fs.mkdir(".tmp/browser",{recursive:true});
const templatePath=".tmp/browser/project-template.csv";
await fs.writeFile(templatePath,"\ufeff客户姓名*,手机号*,大区*,医院,饮食禁忌*\n", "utf8");

const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[]; page.on("pageerror",error=>errors.push(error.message));
await page.goto("http://127.0.0.1:4173/#settings",{waitUntil:"domcontentloaded"});
await page.locator("#loginDialog").evaluate(dialog=>{if(dialog.open)dialog.close();});
await page.setInputFiles("#projectTemplateFile",templatePath);
await page.waitForFunction(()=>document.querySelector("#templateStatus")?.textContent?.includes("project-template.csv"));
const templateText=await page.locator("#templateColumns").innerText();
if(!templateText.includes("饮食禁忌")) throw new Error(`Custom template column missing: ${templateText}`);

await page.goto("http://127.0.0.1:4173/#attendees",{waitUntil:"domcontentloaded"});
const privacy=page.locator('[data-progress-field="privacyLetterStatus"]').first();
await privacy.selectOption("electronic");
let guRow=page.locator("#attendeeTableBody tr",{hasText:"顾明远"});
await guRow.locator('[data-progress-field="ticketStatus"]').selectOption("ticketed");
guRow=page.locator("#attendeeTableBody tr",{hasText:"顾明远"});
if(await guRow.locator('[data-progress-field="ticketStatus"]').inputValue()!=="pending") throw new Error("Ticketing was not blocked before approval");
await page.goto("http://127.0.0.1:4173/#approvals",{waitUntil:"domcontentloaded"});
const guApproval=page.locator(".approval-card",{hasText:"顾明远"});
await guApproval.locator('[data-approve][data-segment="return"]').click();
await page.goto("http://127.0.0.1:4173/#attendees",{waitUntil:"domcontentloaded"});
guRow=page.locator("#attendeeTableBody tr",{hasText:"顾明远"});
await guRow.locator('[data-progress-field="ticketStatus"]').selectOption("ticketed");
guRow=page.locator("#attendeeTableBody tr",{hasText:"顾明远"});
if(await guRow.locator('[data-progress-field="ticketStatus"]').inputValue()!=="ticketed" || !(await guRow.innerText()).includes("返程·已审批")) throw new Error("Approved trip did not allow ticketing with both statuses");
if(!(await page.locator("#notificationList").count())) await page.goto("http://127.0.0.1:4173/#notifications",{waitUntil:"domcontentloaded"});
await page.goto("http://127.0.0.1:4173/#notifications",{waitUntil:"domcontentloaded"});
const notices=await page.locator("#notificationList").innerText();
if(!notices.includes("隐私沟通函")||!notices.includes("→")) throw new Error("Detailed progress notification missing");

await page.goto("http://127.0.0.1:4173/#transport",{waitUntil:"domcontentloaded"});
await page.click("#newPickupBatch");
if(!await page.locator("#transportBatchDialog").evaluate(dialog=>dialog.open)) throw new Error("Batch transport dialog did not open");
await page.fill('#transportBatchForm [name="batchName"]',"大连机场测试批次");
await page.fill('#transportBatchForm [name="serviceDate"]',"2026-09-04");
await page.fill('#transportBatchForm [name="terminal"]',"大连");
await page.fill('#transportBatchForm [name="staffName"]',"测试工作人员");
await page.fill('#transportBatchForm [name="staffPhone"]',"13900000000");
await page.fill('#transportBatchForm [name="point"]',"机场到达口");
await page.locator('[name="batchAttendee"]').first().check();
page.once("dialog",dialog=>dialog.accept());
await page.click('#transportBatchForm button[type="submit"]');
if(!await page.locator("#transportBatchList").innerText().then(text=>text.includes("大连机场测试批次"))) throw new Error("Batch transport save failed");

console.log(JSON.stringify({projectTemplate:"pass",customField:"pass",privacyProgress:"pass",ticketApprovalGuard:"pass",approvalAndTicketStatus:"pass",detailedNotification:"pass",batchTransport:"pass",errors},null,2));
await browser.close(); if(errors.length)process.exitCode=1;
