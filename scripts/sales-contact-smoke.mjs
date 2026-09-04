import fs from "node:fs";
import assert from "node:assert/strict";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const mirror=fs.readFileSync(new URL("../会议行程管理系统.html",import.meta.url),"utf8");
const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const edge=fs.readFileSync(new URL("../supabase/functions/public-trip-query/index.ts",import.meta.url),"utf8");

assert.equal(html,mirror);
assert.doesNotMatch(html,/id="registrationOwner"|name="ownerId"/);
assert.match(html,/销售联系人姓名 \*<input name="contactName"/);
assert.match(html,/销售联系人联系电话 \*<input name="contactMobile"/);
assert.doesNotMatch(html,/name="contactName" readonly/);
assert.doesNotMatch(app,/details\.contactName=publicAuthSession\.name/);
assert.doesNotMatch(app,/contactName\|\|userName\(a\.ownerId\)/);
assert.match(app,/请填写销售联系人姓名和正确的11位联系电话/);
assert.match(edge,/contact_name:clean\(details\.contactName,50\)/);
assert.doesNotMatch(edge,/contact_name:clean\(registrant\.display_name,50\)/);
console.log("sales contact smoke passed");
