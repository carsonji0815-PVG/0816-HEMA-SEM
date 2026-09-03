import {readFileSync,writeFileSync} from "node:fs";

const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error("usage: patch-server-travel-quota.mjs <input> <output>");
let source=readFileSync(input,"utf8");
const loader=`function loadTravelModule() {
  if (!fs.existsSync(travelModulePath)) throw Object.assign(new Error('新版行程核验服务尚未部署，请配置 TRAVEL_VERIFICATION_MODULE'), { status: 503 });
  return travelModulePromise ||= import(pathToFileURL(travelModulePath).href).then(module => module.createTravelProviders(db));
}`;
const quotaReader=`${loader}

async function getTravelQuotaPolicy(authHeaders) {
  const configUrl = new URL(\`\${SUPABASE_URL}/rest/v1/system_configuration\`);
  configUrl.searchParams.set('select', 'settings'); configUrl.searchParams.set('singleton', 'eq.true'); configUrl.searchParams.set('limit', '1');
  try {
    const response = await fetch(configUrl, { headers: { ...authHeaders, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return {};
    const settings = (await response.json())?.[0]?.settings || {};
    return { flightGlobalEnabled: settings.variflightGlobalEnabled === true, flightUnlimited: settings.variflightUnlimited === true, flightDailyLimit: Math.max(1, Math.min(10000, Math.trunc(Number(settings.variflightDailyLimit) || 5))) };
  } catch { return {}; }
}`;
const replacements=[
  [loader,quotaReader],
  ["    const verifier = await loadTravelModule();\n    if (action === 'status' && req.method === 'GET') return json(res, 200, verifier.status());","    const verifier = await loadTravelModule();\n    const quotaPolicy = await getTravelQuotaPolicy(authHeaders);\n    if (action === 'status' && req.method === 'GET') return json(res, 200, verifier.status(quotaPolicy));"],
  ["      const result = await verifier.verifyBatch(journeys, { allowPaid: body.allowPaid === true });","      const result = await verifier.verifyBatch(journeys, { allowPaid: body.allowPaid === true, ...quotaPolicy });"],
];
for(const [before,after] of replacements){
  if(!source.includes(before))throw new Error("production server integration baseline changed; refusing partial patch");
  if(source.indexOf(before)!==source.lastIndexOf(before))throw new Error("production server integration marker is ambiguous");
  source=source.replace(before,after);
}
writeFileSync(output,source,{mode:0o600});
console.log(JSON.stringify({patched:true,bytes:Buffer.byteLength(source)}));
