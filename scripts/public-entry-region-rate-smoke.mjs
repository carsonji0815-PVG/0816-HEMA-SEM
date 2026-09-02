import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root=new URL("../",import.meta.url);
const[html,legacyHtml,app,edge]=await Promise.all([
  fs.readFile(new URL("index.html",root),"utf8"),
  fs.readFile(new URL("会议行程管理系统.html",root),"utf8"),
  fs.readFile(new URL("app.js",root),"utf8"),
  fs.readFile(new URL("supabase/functions/public-trip-query/index.ts",root),"utf8"),
]);
for(const page of [html,legacyHtml]){
  const registrationForm=page.slice(page.indexOf('<form id="publicRegistrationForm"'),page.indexOf('</form>',page.indexOf('<form id="publicRegistrationForm"')));
  const manageForm=page.slice(page.indexOf('<form id="publicManageForm"'),page.indexOf('</form>',page.indexOf('<form id="publicManageForm"')));
  assert.match(registrationForm,/<select name="region" required>/);
  assert.match(manageForm,/<select name="region" required>/);
  assert.doesNotMatch(registrationForm,/<input name="region"/);
  assert.doesNotMatch(manageForm,/<input name="region"/);
  assert.match(page,/name="registrationRegions"/);
}
assert.match(app,/configuredPublicRegions/);
assert.match(app,/quotaRegions:splitList\(data\.registrationRegions\)/);
assert.match(edge,/registrationRegions\(meeting\)/);
assert.match(edge,/请选择当前会议配置的大区/);
assert.match(edge,/registrant-login:\$\{meeting\.id\}:\$\{employeeNoNorm\}/);
assert.match(edge,/attendee-lookup:\$\{meeting\.id\}:\$\{phone\}/);
assert.doesNotMatch(edge,/eq\("ip_hash", ipHash\)/);
console.log("public region select and scoped rate limits smoke: ok");
