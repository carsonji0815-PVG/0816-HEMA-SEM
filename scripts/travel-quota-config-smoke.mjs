import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root=new URL("../",import.meta.url);
const [html,app,moduleSource,patcher,css]=await Promise.all([
  readFile(new URL("index.html",root),"utf8"),readFile(new URL("app.js",root),"utf8"),
  readFile(new URL("modules/travel-verification/server/index.mjs",root),"utf8"),readFile(new URL("scripts/patch-server-travel-quota.mjs",root),"utf8"),readFile(new URL("styles.css",root),"utf8"),
]);
for(const id of ["variflightDailyLimit","variflightUnlimited","variflightGlobalEnabled","verificationGlobalFlightEnabled","variflightQuotaStatus"])assert.match(html,new RegExp(`id="${id}"`));
for(const token of ["variflightDailyLimit","variflightUnlimited","variflightGlobalEnabled","disabledVerificationFlightSegments","flightQuota","usedToday"])assert.ok(app.includes(token));
for(const token of ["flightGlobalEnabled","globalEnabled","flightUnlimited","flightDailyLimit","recordQuota","remaining","queued"])assert.ok(moduleSource.includes(token));
assert.ok(patcher.includes("getTravelQuotaPolicy"));assert.ok(patcher.includes("system_configuration"));
assert.match(css,/\.side-nav\s*\{[^}]*overflow-y:\s*auto/s);assert.match(css,/height:\s*100dvh/);
console.log("travel quota configuration and viewport sidebar smoke passed");
