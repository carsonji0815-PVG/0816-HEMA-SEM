// Read-only production probes. Never prints credentials or personal data.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
const dir = '/opt/lilly-migration/staging';
if (process.platform !== 'linux' || process.getuid() !== 0 || !existsSync(`${dir}/PRODUCTION_ACTIVE`)) throw new Error('Production marker required.');
const c = JSON.parse(readFileSync(`${dir}/compose.functions.json`, 'utf8'));
const env = c.services['api-gw'].environment;
const base = 'https://139.196.97.236', api = `${base}/supabase`, results = [];
const publicHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY };
const serviceHeaders = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}` };
async function request(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) });
  const text = await r.text(); let data; try { data = JSON.parse(text); } catch { data = null; }
  return { ok: r.ok, status: r.status, text, data };
}
async function check(name, url, options, test) {
  try { const r = await request(url, options); results.push({ name, status: r.status, passed: !!test(r) }); }
  catch (e) { results.push({ name, passed: false, error: e.name }); }
}
await check('HTTPS meeting frontend', `${base}/meeting/`, {}, r => r.ok && r.text.includes('礼来会议管理平台') && r.text.includes('window.location.origin') && r.text.includes('${productionOrigin}/supabase') && !r.text.includes('bupsipicxwyeuxunkvii.supabase.co'));
for (const file of ['app.js', 'styles.css', 'assets/lilly-logo-red.png', 'assets/vendor/supabase.js', 'luggage/index.html']) {
  await check(`Static asset ${file}`, `${base}/meeting/${file}`, {}, r => r.ok && r.text.length > 50);
}
await check('Original document frontend', `${base}/`, {}, r => r.ok);
await check('REST missing key denied', `${api}/rest/v1/attendees?select=id`, {}, r => [401, 403].includes(r.status));
await check('Anonymous roster isolation', `${api}/rest/v1/attendees?select=id`, { headers: publicHeaders }, r => [401, 403].includes(r.status) || (r.ok && Array.isArray(r.data) && !r.data.length));
await check('Auth health', `${api}/auth/v1/health`, { headers: publicHeaders }, r => r.ok);
await check('Public meeting list', `${api}/functions/v1/public-trip-query`, { method: 'POST', headers: { ...publicHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list-projects' }) }, r => r.ok && Array.isArray(r.data?.projects));
const profiles = await request(`${api}/rest/v1/profiles?select=user_id&limit=1`, { headers: serviceHeaders });
const owner = profiles.data?.[0]?.user_id;
if (!/^[a-f0-9-]{36}$/.test(owner || '')) throw new Error('Migrated operator missing.');
const user = await request(`${api}/auth/v1/admin/users/${owner}`, { headers: serviceHeaders });
if (!user.ok || user.data?.id !== owner) throw new Error('Migrated operator mismatch.');
const now = Math.floor(Date.now() / 1000), encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const signed = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, email: user.data.email, role: 'authenticated', aud: 'authenticated', iss: `${api}/auth/v1`, iat: now, exp: now + 600 })}`;
const token = `${signed}.${createHmac('sha256', c.services.auth.environment.GOTRUE_JWT_SECRET).update(signed).digest('base64url')}`;
const headers = { ...publicHeaders, Authorization: `Bearer ${token}` };
await check('Migrated operator identity', `${api}/auth/v1/user`, { headers }, r => r.ok && r.data?.id === owner);
// A self-signed identity without a server-recorded active login session must not
// bypass the 30-minute session guard, even when it names a migrated operator.
await check('Synthetic operator session cannot read roster', `${api}/rest/v1/attendees?select=id`, { headers }, r => r.ok && Array.isArray(r.data) && r.data.length === 0);
const meetings = await request(`${api}/rest/v1/meetings?select=id`, { headers });
for (const meeting of meetings.data || []) {
  if (!/^[a-f0-9-]{36}$/.test(meeting.id)) throw new Error('Invalid project identifier.');
  await check('Integrated project documents', `${base}/api/integrated/projects/${meeting.id}/documents`, { headers }, r => r.ok);
}
const pid = execFileSync('systemctl', ['show', 'lilly-meetings', '--property=MainPID', '--value'], { encoding: 'utf8' }).trim();
const processEnv = Object.fromEntries(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map(item => { const i = item.indexOf('='); return [item.slice(0, i), item.slice(i + 1)]; }));
results.push({ name: 'Document service uses Alibaba Auth', passed: processEnv.SUPABASE_URL === 'http://127.0.0.1:18000' });
for (const unit of ['nginx', 'lilly-meetings', 'lilly-platform', 'auditd', 'lilly-platform-backup.timer', 'lilly-platform-restore-drill.timer']) {
  results.push({ name: `Service ${unit}`, passed: execFileSync('systemctl', ['is-active', unit], { encoding: 'utf8' }).trim() === 'active' });
}
const freezeCount = execFileSync('docker', ['exec', 'lilly-stage-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', "select count(*) from pg_trigger where tgname='lilly_migration_readonly'"], { encoding: 'utf8' }).trim();
results.push({ name: 'New database not source-frozen', passed: freezeCount === '0' });
const report = { timestamp: new Date().toISOString(), publicUrl: `${base}/meeting/`, allPassed: results.every(r => r.passed), results };
writeFileSync(`${dir}/production-validation.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
if (!report.allPassed) process.exitCode = 1;
