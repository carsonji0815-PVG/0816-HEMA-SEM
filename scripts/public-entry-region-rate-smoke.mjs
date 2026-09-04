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
  assert.match(registrationForm,/data-registrant-identity-field="region"/);
  assert.match(manageForm,/data-registrant-identity-field="region"/);
  assert.match(registrationForm,/name="registrantPhone"/);
  assert.doesNotMatch(registrationForm,/<input name="region"/);
  assert.doesNotMatch(manageForm,/<input name="region"/);
  assert.match(page,/name="registrationRegions"/);
  assert.match(page,/name="registrationIdentityField" value="phone"/);
}
assert.match(app,/configuredPublicRegions/);
assert.match(app,/configuredRegistrantIdentityFields/);
assert.match(app,/大区待确认，可自行填写或暂不填写/);
assert.match(app,/quotaRegions:splitList\(data\.registrationRegions\)/);
assert.match(app,/registrationIdentityFields:state\.settings\.fieldConfig\.registrationIdentityFields/);
assert.match(edge,/registrationRegions\(meeting\)/);
assert.match(edge,/请选择当前会议配置的大区/);
assert.match(edge,/const requestedRegion=identityFields\.includes\("region"\)/);
assert.match(edge,/registrant-login:\$\{meeting\.id\}:\$\{identityValue\}/);
assert.match(edge,/attendee-lookup:\$\{meeting\.id\}:\$\{phone\}/);
assert.doesNotMatch(edge,/eq\("ip_hash", ipHash\)/);
console.log("public region select and scoped rate limits smoke: ok");
