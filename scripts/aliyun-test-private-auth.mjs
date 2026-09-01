// Real password-login smoke test using ONE synthetic account in staging.
// Never resets an existing user's password or sends email.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
const dir = '/opt/lilly-migration/staging';
if ((await import('node:fs')).existsSync(`${dir}/PRODUCTION_ACTIVE`)) throw new Error('Rehearsal mutation forbidden after production activation.');
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Migration server only.');
const c = JSON.parse(readFileSync(`${dir}/compose.functions.json`, 'utf8'));
if (c.name !== 'lilly-stage' || c.services.db.container_name !== 'lilly-stage-db') throw new Error('Wrong target.');
const env = c.services['api-gw'].environment;
const url = 'http://127.0.0.1:18000';
const email = `migration-${randomUUID()}@invalid.example`;
const password = randomBytes(32).toString('base64url');
const serviceHeaders = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
const publicHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
let userId;
const report = { timestamp: new Date().toISOString(), productionReady: false, created: false, passwordLogin: false, userLookup: false, unauthorizedRosterIsolated: false, cleanup: false };
async function api(path, options) {
  const response = await fetch(`${url}${path}`, { ...options, signal: AbortSignal.timeout(20000) });
  let json; try { json = await response.json(); } catch { json = null; }
  if (!response.ok) throw new Error(`Private auth check failed (${response.status}); response body suppressed.`);
  return json;
}
try {
  const created = await api('/auth/v1/admin/users', { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { migration_test: true } }) });
  userId = created?.id;
  if (!/^[a-f0-9-]{36}$/.test(userId || '') || created.email !== email) throw new Error('Synthetic account identity mismatch.');
  report.created = true;
  const login = await api('/auth/v1/token?grant_type=password', { method: 'POST', headers: publicHeaders, body: JSON.stringify({ email, password }) });
  report.passwordLogin = !!login?.access_token && login.user?.id === userId;
  if (!report.passwordLogin) throw new Error('Password-login check failed.');
  const headers = { ...publicHeaders, Authorization: `Bearer ${login.access_token}` };
  const user = await api('/auth/v1/user', { headers });
  report.userLookup = user?.id === userId;
  const rows = await api('/rest/v1/attendees?select=id', { headers });
  report.unauthorizedRosterIsolated = Array.isArray(rows) && rows.length === 0;
} catch (error) { report.error = error.message; }
finally {
  if (userId) {
    // Exact ID AND synthetic email/metadata guard. Never touches restored users.
    const user = await api(`/auth/v1/admin/users/${userId}`, { headers: serviceHeaders });
    if (user?.id !== userId || user.email !== email || !user.app_metadata?.migration_test) throw new Error('Cleanup identity guard failed.');
    await api(`/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: serviceHeaders });
    report.cleanup = true;
  }
  report.allPassed = report.created && report.passwordLogin && report.userLookup && report.unauthorizedRosterIsolated && report.cleanup;
  writeFileSync(`${dir}/private-auth-validation.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
}
if (!report.allPassed) process.exitCode = 1;
