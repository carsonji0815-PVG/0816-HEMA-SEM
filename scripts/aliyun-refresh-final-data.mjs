// Replace ONLY the isolated rehearsal database with the final frozen source data.
// Source schema/roles must have been checked before freezing. Atomic, rollback on error.
import { readFileSync, writeFileSync, existsSync, openSync, closeSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
const dir = '/opt/lilly-migration/staging', base = process.env.MIGRATION_BACKUP;
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Migration server only.');
if (existsSync(`${dir}/PRODUCTION_ACTIVE`)) throw new Error('Already serving production; final refresh forbidden.');
if (!/^\/opt\/lilly-migration\/backups\/source-[A-Za-z0-9TZ.-]+$/.test(base || '')) throw new Error('Invalid backup target.');
const config = JSON.parse(readFileSync(`${dir}/compose.functions.json`, 'utf8'));
if (config.name !== 'lilly-stage' || config.services.db.container_name !== 'lilly-stage-db' || config.services['api-gw'].ports.some(p => p.host_ip !== '127.0.0.1')) throw new Error('Target is not isolated staging.');
const freeze = JSON.parse(readFileSync(`${dir}/source-freeze-confirmation.json`, 'utf8'));
if (freeze.projectRef !== 'bupsipicxwyeuxunkvii' || !freeze.frozen || !freeze.schemaCompared) throw new Error('Source freeze/schema confirmation missing.');
const manifest = JSON.parse(readFileSync(`${base}/manifest.json`, 'utf8'));
if (manifest.status !== 'exported-not-yet-restore-tested' || manifest.projectRef !== freeze.projectRef) throw new Error('Invalid final backup.');
if (!freeze.frozenAt || new Date(manifest.createdAt) <= new Date(freeze.frozenAt)) throw new Error('Backup predates source freeze.');
for (const entry of manifest.files) {
  if (!['roles.sql', 'schema.sql', 'data.sql'].includes(entry.name)) throw new Error('Unknown backup artifact.');
  const bytes = readFileSync(`${base}/${entry.name}`);
  if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('Backup hash mismatch.');
}
const lines = readFileSync(`${base}/data.sql`, 'utf8').split('\n'), filtered = [], tables = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^COPY "([^"]+)"\."([^"]+)" /);
  if (!m) { filtered.push(lines[i]); continue; }
  const start = i;
  while (++i < lines.length && lines[i] !== '\\.') {}
  if (i >= lines.length) throw new Error('Invalid COPY input.');
  const name = `${m[1]}.${m[2]}`, expected = i - start - 1;
  if (!/^(public|auth|storage)\.[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Unexpected final data table.');
  tables.push({ name, expected });
  if (expected === 0 && ['auth', 'storage'].includes(m[1])) continue;
  filtered.push(...lines.slice(start, i + 1));
}
if (tables.length < 40 || !tables.some(t => t.name === 'public.attendees') || !tables.some(t => t.name === 'auth.users')) throw new Error('Incomplete final dataset.');
const baseline = readFileSync('/opt/lilly-migration/backups/source-2026-08-31T13-24-09-944Z-KQPM1X/roles.sql', 'utf8');
const normalizedRoles = text => text.split('\n').filter(l => !/^\\(?:un)?restrict\b/.test(l) && !/^--/.test(l)).join('\n').trim();
if (normalizedRoles(readFileSync(`${base}/roles.sql`, 'utf8')) !== normalizedRoles(baseline)) throw new Error('Source roles changed since rehearsal; manual review required.');
const sql = `SET session_replication_role = replica;\nTRUNCATE ${tables.map(t => t.name).join(', ')} RESTART IDENTITY CASCADE;\n${filtered.join('\n')}`;
const attempt = mkdtempSync(`${base}/final-refresh-`);
const out = openSync(`${attempt}/restore.log`, 'wx', 0o600), err = openSync(`${attempt}/restore.errors`, 'wx', 0o600);
let result;
try { result = spawnSync('docker', ['exec', '-i', 'lilly-stage-db', 'psql', '-U', 'supabase_admin', '-d', 'postgres', '--single-transaction', '--set', 'ON_ERROR_STOP=1'], { input: sql, stdio: ['pipe', out, err], timeout: 120000 }); }
finally { closeSync(out); closeSync(err); }
if (result.status !== 0) throw new Error('Final refresh rolled back; private restore logs retained.');
const counts = tables.map(table => {
  const actual = Number(execFileSync('docker', ['exec', 'lilly-stage-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', `select count(*) from ${table.name}`], { encoding: 'utf8' }).trim());
  return { ...table, actual, matches: actual === table.expected };
});
const report = { completedAt: new Date().toISOString(), sourceBackup: base, allCountsMatch: counts.every(c => c.matches), counts, productionSwitched: false };
writeFileSync(`${dir}/final-data-validation.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
writeFileSync(`${base}/rehearsal-validation.json`, JSON.stringify({ target: 'lilly-stage-db', allCountsMatch: report.allCountsMatch, counts: counts.map(({ name, ...values }) => ({ table: name, ...values })), finalSnapshot: true }, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
if (!report.allCountsMatch) process.exitCode = 1;
