import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const edge = fs.readFileSync(new URL("../supabase/functions/public-trip-query/index.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

const required = [
  "outboundTransferDriverName",
  "outboundTransferDriverPhone",
  "outboundTransferVehicle",
  "returnTransferDriverName",
  "returnTransferDriverPhone",
  "returnTransferVehicle",
];

for (const field of required) {
  if (!app.includes(field)) throw new Error(`app missing ${field}`);
  if (!edge.includes(field)) throw new Error(`public query missing ${field}`);
}

for (const column of [
  "outbound_transfer_driver_name",
  "outbound_transfer_driver_phone",
  "outbound_transfer_vehicle",
  "return_transfer_driver_name",
  "return_transfer_driver_phone",
  "return_transfer_vehicle",
]) {
  if (!schema.includes(column)) throw new Error(`schema missing ${column}`);
  if (!edge.includes(column)) throw new Error(`edge select missing ${column}`);
}

for (const label of ["去程司机姓名", "返程司机姓名", "车辆 / 车牌", "按照实际航班/车次抵达时间"]) {
  if (!app.includes(label)) throw new Error(`UI/export missing ${label}`);
}

for (const statusRule of ["function localTransferAssignmentState", 'outboundLabel:outbound?"已安排"', 'returningLabel:returning?"已安排"', "去程属地送站", "返程属地接站", "属地接送点位"]) {
  if (!app.includes(statusRule)) throw new Error(`local assignment status rule missing: ${statusRule}`);
}

for (const summaryLabel of ["属地任务", "已安排", "待安排"]) {
  if (!html.includes(summaryLabel)) throw new Error(`local summary label missing: ${summaryLabel}`);
}

for (const pickupQueryFeature of ["机场/高铁站出口处等待", "接机牌样稿缩略图", "placardFileUrl"]) {
  if (!app.includes(pickupQueryFeature)) throw new Error(`participant pickup query feature missing: ${pickupQueryFeature}`);
  if (pickupQueryFeature === "placardFileUrl" && !edge.includes(pickupQueryFeature)) throw new Error("public query does not return placard attachment URL");
}

if (!app.includes('crypto.randomUUID()}${extension}') || !app.includes('name:file.name')) throw new Error("placard storage key must be ASCII-safe while preserving the original filename");

for (const placardColumn of ["placard_file_path", "placard_file_name"]) {
  if (!edge.includes(placardColumn)) throw new Error(`public query missing ${placardColumn}`);
}
if (!edge.includes("publicStorageUrl(data?.signedUrl)") || !edge.includes("`${publicSiteOrigin}${publicPath}${parsed.search}`")) throw new Error("signed placard URL must use the absolute public storage route");
if (!edge.includes("createSignedUrl(item.placard_file_path,86400)")) throw new Error("signed placard URL must remain available for the participant query session");
if (!edge.includes('candidate.name===objectName') || !edge.includes('placardFileMimeType') || !edge.includes('placardFileSize')) throw new Error("public query must verify the exact stored placard before display");
if (!app.includes('lookup-placard-preview ${placardIsPdf?"pdf":"image"}') || !app.includes('type="application/pdf"')) throw new Error("image and PDF placards must both render as uploaded-file previews");

if (!css.includes("Compact admin density")) throw new Error("compact admin density rules missing");
console.log("local transfer driver and compact admin smoke passed");
