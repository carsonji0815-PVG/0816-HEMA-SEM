// Loopback-only API checks; never prints secrets, user rows, or request bodies.
import { readFileSync, writeFileSync } from 'node:fs';
const dir = '/opt/lilly-migration/staging';
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Migration server only.');
const config = JSON.parse(readFileSync(`${dir}/compose.functions.json`, 'utf8'));
if (config.name !== 'lilly-stage') throw new Error('Wrong target.');
const env = config.services['api-gw'].environment;
const url = 'http://127.0.0.1:18000';
const results = [];
async function check(name, path, options, verify) {
  try {
    const response = await fetch(`${url}${path}`, { ...options, signal: AbortSignal.timeout(45000) });
    const body = await response.text();
    let json; try { json = JSON.parse(body); } catch { json = null; }
    results.push({ name, status: response.status, passed: !!verify(response, json), bodyFormat: json === null ? 'non-json' : 'json' });
  } catch (error) { results.push({ name, passed: false, error: error.name }); }
}
await check('REST requires API key', '/rest/v1/attendees?select=id', {}, r => [401, 403].includes(r.status));
await check('REST rejects invalid API key', '/rest/v1/attendees?select=id', { headers: { apikey: 'invalid-test-key' } }, r => [401, 403].includes(r.status));
await check('Anonymous roster isolated', '/rest/v1/attendees?select=id', { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY } }, (r, b) => r.ok && Array.isArray(b) && b.length === 0);
await check('Service role can read restored roster', '/rest/v1/attendees?select=id', { headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}` } }, (r, b) => r.ok && Array.isArray(b) && b.length === 24);
await check('Auth health', '/auth/v1/health', { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY } }, r => r.ok);
await check('Auth rejects invalid user token', '/auth/v1/user', { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer invalid-test-token' } }, r => [401, 403].includes(r.status));
const functionPath = '/functions/v1/public-trip-query';
const request = key => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { apikey: key } : {}) }, body: JSON.stringify({ action: 'list-projects' }) });
await check('Function rejects missing key', functionPath, request(), r => [401, 403].includes(r.status));
await check('Function rejects invalid key', functionPath, request('invalid-test-key'), r => [401, 403].includes(r.status));
await check('Public function reads project list', functionPath, request(env.SUPABASE_PUBLISHABLE_KEY), (r, b) => r.ok && Array.isArray(b?.projects));
await check('Function preflight', functionPath, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:18000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'apikey,content-type' } }, r => r.ok && r.headers.get('access-control-allow-origin') !== null);
const report = { timestamp: new Date().toISOString(), productionReady: false, allPassed: results.every(r => r.passed), results };
writeFileSync(`${dir}/private-api-validation.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
if (!report.allPassed) process.exitCode = 1;
