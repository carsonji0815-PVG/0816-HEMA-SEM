// Regression on a synthetic meeting only. Real restored meetings are read-only.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
const dir = '/opt/lilly-migration/staging';
if ((await import('node:fs')).existsSync(`${dir}/PRODUCTION_ACTIVE`)) throw new Error('Rehearsal mutation forbidden after production activation.');
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Migration server only.');
const c = JSON.parse(readFileSync(`${dir}/compose.functions.json`, 'utf8'));
if (c.name !== 'lilly-stage' || c.services.db.container_name !== 'lilly-stage-db') throw new Error('Wrong target.');
const env = c.services['api-gw'].environment, url = 'http://127.0.0.1:18000';
let id = randomUUID();
const slug = `migration-rehearsal-${id}`, results = [];
const serviceHeaders = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
let created = false, cleanup = false;
let adminHeaders = serviceHeaders;
async function request(path, body, method = 'POST', headers = serviceHeaders) {
  const response = await fetch(`${url}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
  let data; try { data = await response.json(); } catch { data = null; }
  return { status: response.status, ok: response.ok, data };
}
async function must(path, body, method, headers) {
  const r = await request(path, body, method, headers);
  if (!r.ok) throw new Error(`Setup/control request failed at ${path.split('?')[0]} (${r.status}, ${r.data?.code || 'no code'}): ${String(r.data?.message || 'body suppressed').slice(0, 240)}`);
  return r.data;
}
async function action(body, expected = 200, predicate = () => true) {
  const r = await request('/functions/v1/public-trip-query', { meeting: slug, ...body }, 'POST', { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' });
  if (r.status !== expected || !predicate(r.data)) throw new Error(`Registration check ${body.action} failed (${r.status}; expected ${expected}); body suppressed.`);
  return r.data;
}
try {
  const profiles = await must('/rest/v1/profiles?select=user_id&limit=1', undefined, 'GET');
  const owner = profiles?.[0]?.user_id;
  if (!/^[a-f0-9-]{36}$/.test(owner || '')) throw new Error('Restored operator unavailable.');
  const ownerUser = await must(`/auth/v1/admin/users/${owner}`, undefined, 'GET');
  if (!ownerUser?.email || ownerUser.id !== owner) throw new Error('Restored operator identity mismatch.');
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signed = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, email: ownerUser.email, role: 'authenticated', aud: 'authenticated', iss: 'supabase', iat: now, exp: now + 600 })}`;
  const token = `${signed}.${createHmac('sha256', c.services.auth.environment.GOTRUE_JWT_SECRET).update(signed).digest('base64url')}`;
  adminHeaders = { ...serviceHeaders, apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
  id = await must('/rest/v1/rpc/create_meeting_project', { p_name: 'MIGRATION_REHEARSAL_ONLY', p_slug: slug, p_activity_type: 'external', p_identifier: slug, p_activity_owner: '迁移测试负责人', p_activity_date: '2030-01-01', p_source_id: null }, 'POST', adminHeaders);
  if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Synthetic project ID invalid.');
  created = true;
  const premature = await request('/rest/v1/rpc/set_registration_open', { p_meeting_id: id, p_open: true }, 'POST', adminHeaders);
  if (premature.ok) throw new Error('Registration opened without template.');
  results.push('template required before opening registration');
  await must('/rest/v1/rpc/save_project_registration_template', { p_meeting_id: id, p_template_name: '迁移测试模板', p_template: { columns: [{ key: 'name', required: true }, { key: 'phone', required: true }] } }, 'POST', adminHeaders);
  await must('/rest/v1/rpc/set_registration_open', { p_meeting_id: id, p_open: true }, 'POST', adminHeaders);
  await must(`/rest/v1/meetings?id=eq.${id}`, { check_city_mismatch: false, check_departure_city: false }, 'PATCH', adminHeaders);
  const login = await action({ action: 'registrant-login', region: '迁移测试大区', name: '测试填报人甲', employeeNo: `TEST-A-${id}` }, 200, d => d.authenticated && d.attendees.length === 0);
  const other = await action({ action: 'registrant-login', region: '迁移测试大区', name: '测试填报人乙', employeeNo: `TEST-B-${id}` }, 200, d => d.authenticated && d.attendees.length === 0);
  results.push('registrant identity login');
  const details = { name: '迁移测试参会者', phone: '19900000001', idNumber: 'MIGRATION-TEST-NOT-A-REAL-ID', hcpId: `TEST-${id}`, remarks: 'before' };
  const saved = await action({ action: 'save-attendee', sessionToken: login.sessionToken, details }, 200, d => d.saved);
  const attendeeId = saved.attendee.id;
  results.push('new registration saved');
  await action({ action: 'save-attendee', attendeeId, sessionToken: other.sessionToken, details }, 403);
  results.push('other registrant cannot edit');
  await must('/rest/v1/rpc/set_registration_open', { p_meeting_id: id, p_open: false }, 'POST', adminHeaders);
  await action({ action: 'save-attendee', sessionToken: login.sessionToken, details: { ...details, phone: '19900000002' } }, 423);
  results.push('closed registration rejects new attendee');
  await action({ action: 'save-attendee', attendeeId, sessionToken: login.sessionToken, details: { ...details, remarks: 'after' } }, 200, d => d.saved);
  results.push('closed registration allows existing edit');
  details.remarks = 'after';
  await must(`/rest/v1/attendees?id=eq.${attendeeId}&meeting_id=eq.${id}`, { row_locked: true }, 'PATCH', adminHeaders);
  await action({ action: 'save-attendee', attendeeId, sessionToken: login.sessionToken, details }, 423);
  results.push('row lock rejects edit');
  await must(`/rest/v1/attendees?id=eq.${attendeeId}&meeting_id=eq.${id}`, { row_locked: false }, 'PATCH', adminHeaders);
  await must('/rest/v1/column_locks', { meeting_id: id, field_group: 'remarks', locked: true }, 'POST', adminHeaders);
  await action({ action: 'save-attendee', attendeeId, sessionToken: login.sessionToken, details: { ...details, remarks: 'locked change' } }, 423);
  results.push('column-group lock rejects edit');
  await must(`/rest/v1/column_locks?meeting_id=eq.${id}&field_group=eq.remarks`, { locked: false }, 'PATCH', adminHeaders);
  await action({ action: 'query', phone: details.phone }, 200, d => d.found && !('idNumber' in d.attendee) && !('hospital' in d.attendee));
  results.push('public attendee query minimizes fields');
  await action({ action: 'cancel-attendee', attendeeId, sessionToken: other.sessionToken }, 403);
  results.push('other registrant cannot cancel');
  await action({ action: 'cancel-attendee', attendeeId, sessionToken: login.sessionToken }, 200, d => d.cancelled);
  const remaining = await must(`/rest/v1/attendees?id=eq.${attendeeId}&select=id,business_status`, undefined, 'GET');
  if (remaining.length !== 1 || remaining[0].business_status !== 'cancelled') throw new Error('Cancellation did not retain history.');
  results.push('cancellation preserves record');
  await action({ action: 'query', phone: details.phone }, 200, d => d.found === false);
  results.push('cancelled attendee excluded from public query');
  const audit = await must(`/rest/v1/operation_audit_logs?meeting_id=eq.${id}&select=action,before_data,after_data`, undefined, 'GET');
  if (!audit.some(a => a.before_data?.remarks === 'before' && a.after_data?.remarks === 'after')) throw new Error('Field-level audit comparison absent.');
  results.push('audit preserves old/new field values');
} catch (error) { results.push({ failed: error.message }); }
finally {
  if (created) {
    const meeting = await must(`/rest/v1/meetings?id=eq.${id}&select=id,slug,name`, undefined, 'GET');
    if (meeting.length !== 1 || meeting[0].slug !== slug || meeting[0].name !== 'MIGRATION_REHEARSAL_ONLY') throw new Error('Synthetic meeting cleanup guard failed.');
    await must(`/rest/v1/meetings?id=eq.${id}&slug=eq.${slug}`, undefined, 'DELETE', adminHeaders);
    cleanup = true;
  }
  const report = { timestamp: new Date().toISOString(), productionReady: false, results, cleanup, allPassed: cleanup && !results.some(r => typeof r === 'object') };
  writeFileSync(`${dir}/private-registration-validation.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
  if (!report.allPassed) process.exitCode = 1;
}
