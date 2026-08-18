import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.goto("http://127.0.0.1:4173/#portal", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#publicPortalView:not(.is-hidden)");
const fields = await page.locator("#publicRegistrationForm input").evaluateAll(nodes => nodes.map(node => node.name));
const loginOpen = await page.locator("#loginDialog").evaluate(node => node.open);
if (loginOpen) throw new Error("Public registration unexpectedly requires login");
if (fields.join(",") !== "region,name,phone") throw new Error(`Unexpected public fields: ${fields.join(",")}`);
if (await page.locator('[data-portal-tab]').count() !== 2) throw new Error("Unified portal tabs missing");
await page.click('[data-portal-tab="lookup"]');
await page.waitForSelector('[data-portal-panel="lookup"]:not(.is-hidden)');
await page.click('[data-portal-tab="register"]');
await page.waitForSelector('[data-portal-panel="register"]:not(.is-hidden)');
await page.fill('#publicRegistrationForm [name="region"]', "华东大区");
await page.fill('#publicRegistrationForm [name="name"]', "测试人员");
await page.fill('#publicRegistrationForm [name="phone"]', "123");
await page.click('#publicRegistrationForm button[type="submit"]');
const validation = await page.locator("#publicRegistrationResult").innerText();
if (!validation.includes("正确的 11 位手机号")) throw new Error("Phone validation failed");
console.log(JSON.stringify({ route: "#portal", tabs:2, fields, loginOpen, validation, errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 1;
