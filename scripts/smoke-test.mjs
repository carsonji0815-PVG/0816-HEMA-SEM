import { chromium } from "playwright";
import fs from "node:fs/promises";

await fs.mkdir(".tmp/browser", { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
page.on("console", message => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) errors.push(`console: ${message.text()}`); });

await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
await page.locator("#loginDialog").evaluate(dialog => { if (dialog.open) dialog.close(); });
await page.waitForSelector('[data-page="dashboard"].active');
await page.waitForTimeout(700);
await page.screenshot({ path: ".tmp/browser/dashboard.png", fullPage: true });

const attendeeCount = await page.locator("#attendeeTableBody tr").count();
await page.locator('a[href="#attendees"]').first().click();
await page.waitForSelector('[data-page="attendees"].active');
const visibleRows = await page.locator("#attendeeTableBody tr").count();
if (visibleRows !== attendeeCount) throw new Error(`Roster count mismatch ${attendeeCount}/${visibleRows}`);

await page.selectOption("#userSelect", "u-sales-1");
await page.waitForTimeout(100);
const salesRows = await page.locator("#attendeeTableBody tr").count();
if (salesRows !== 3) throw new Error(`Sales scope failed: ${salesRows}`);
await page.selectOption("#userSelect", "u-ops");

await page.goto("http://127.0.0.1:4173/#registration", { waitUntil: "domcontentloaded" });
const form = page.locator("#registrationForm");
await form.locator('[name="name"]').fill("测试嘉宾");
await form.locator('[name="city"]').fill("上海");
await form.locator('[name="hospital"]').fill("测试医院");
await form.locator('[name="department"]').fill("测试科室");
await form.locator('[name="idNumber"]').fill("TEST20260818001");
await form.locator('[name="phone"]').fill("13800005999");
await form.locator('[name="hcpId"]').fill("HCP-TEST");
await form.locator('[name="outDate"]').fill("2026-09-04");
await form.locator('[name="outFrom"]').fill("上海");
await form.locator('[name="outTo"]').fill("大连");
await form.locator('[name="outNo"]').fill("MU9999");
await form.locator('[name="outDeparture"]').fill("08:00");
await form.locator('[name="outArrival"]').fill("10:00");
await form.locator('[name="returnDate"]').fill("2026-09-06");
await form.locator('[name="returnFrom"]').fill("大连");
await form.locator('[name="returnTo"]').fill("南京");
await form.locator('[name="returnNo"]').fill("MU9998");
await form.locator('[name="returnDeparture"]').fill("18:00");
await form.locator('[name="returnArrival"]').fill("20:00");
await form.locator('button[type="submit"]').click();
await page.waitForURL(/#attendees/);
if (await page.locator("#attendeeTableBody tr").count() !== 6) throw new Error("Registration submission failed");
const downloadPromise = page.waitForEvent("download");
await page.click("#exportExcel");
const download = await downloadPromise;
if (!/\.(xlsx|csv)$/.test(download.suggestedFilename())) throw new Error("Excel export failed");

await page.locator('a[href="#approvals"]').first().click();
await page.waitForSelector('[data-page="approvals"].active');
if (await page.locator("[data-approve]").count() < 1) throw new Error("Expected pending approval");

await page.goto("http://127.0.0.1:4173/#lookup", { waitUntil: "domcontentloaded" });
await page.fill("#lookupPhone", "13800005201");
await page.click('#lookupForm button[type="submit"]');
await page.waitForSelector(".result-card");
const resultText = await page.locator("#lookupResult").innerText();
if (!resultText.includes("刘师傅") || resultText.includes("华东示范医院")) throw new Error("Public query data minimization failed");
await page.screenshot({ path: ".tmp/browser/lookup.png", fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:4173/#dashboard", { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-page="dashboard"].active');
await page.click("#menuButton");
await page.waitForTimeout(350);
if (!await page.locator(".sidebar").evaluate(node => node.classList.contains("open"))) throw new Error("Mobile menu failed");
await page.screenshot({ path: ".tmp/browser/mobile.png", fullPage: true });

console.log(JSON.stringify({ attendeeCount, visibleRows, salesRows, registration: "pass", export: download.suggestedFilename(), publicQuery: "pass", mobileMenu: "pass", errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
