import { chromium } from "playwright";
import sharp from "sharp";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto("http://127.0.0.1:4173/#register", { waitUntil: "domcontentloaded" });
await page.evaluate(() => { location.hash = "dashboard"; });
await page.waitForTimeout(150);
await page.waitForSelector("#qrCanvas canvas");
const downloadPromise = page.waitForEvent("download");
await page.click("#downloadQr");
const download = await downloadPromise;
const path = ".tmp/browser/registration-qr.png";
await download.saveAs(path);
const image = sharp(path);
const metadata = await image.metadata();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
const isWhite = (x, y) => {
  const offset = (y * info.width + x) * info.channels;
  return data[offset] > 248 && data[offset + 1] > 248 && data[offset + 2] > 248;
};
const borderPoints = [[0,0],[239,0],[0,239],[239,239],[10,120],[229,120],[120,10],[120,229]];
if (metadata.width !== 240 || metadata.height !== 240) throw new Error(`Unexpected QR size: ${metadata.width}x${metadata.height}`);
if (!borderPoints.every(([x,y]) => isWhite(x,y))) throw new Error("QR quiet zone is not white");
console.log(JSON.stringify({ path, width:metadata.width, height:metadata.height, quietZone:"pass" }, null, 2));
await browser.close();
