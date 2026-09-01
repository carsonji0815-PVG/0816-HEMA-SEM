// Restore only into the empty, isolated lilly-stage-db container. The untouched
// source backup is retained. Never use this script on an existing production DB.
import { readFileSync, writeFileSync, openSync, closeSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
const base = process.env.MIGRATION_BACKUP;
if ((await import('node:fs')).existsSync('/opt/lilly-migration/staging/PRODUCTION_ACTIVE')) throw new Error('Restore rehearsal forbidden after production activation.');
if (!/^\/opt\/lilly-migration\/backups\/source-[A-Za-z0-9TZ.-]+$/.test(base || '')) throw new Error('Expected private migration backup directory.');
const container = 'lilly-stage-db';
const query = sql => execFileSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', sql], { encoding: 'utf8' }).trim();
if (query("select count(*) from pg_tables where schemaname='public'") !== '0') throw new Error('Target has business tables; no restore performed.');
const manifest = JSON.parse(readFileSync(`${base}/manifest.json`, 'utf8'));
if (manifest.status !== 'exported-not-yet-restore-tested' || manifest.projectRef !== 'bupsipicxwyeuxunkvii' || manifest.files.length !== 3) throw new Error('Backup is not a complete source export.');
for (const entry of manifest.files) {
  if (!['roles.sql', 'schema.sql', 'data.sql'].includes(entry.name)) throw new Error('Unexpected backup file.');
  const content = readFileSync(`${base}/${entry.name}`);
  if (content.length !== entry.bytes || createHash('sha256').update(content).digest('hex') !== entry.sha256) throw new Error('Backup checksum mismatch.');
}
const tables = new Set(query("select schemaname||'.'||tablename from pg_tables where schemaname in ('auth','storage')").split('\n'));
const lines = readFileSync(`${base}/data.sql`, 'utf8').split('\n');
const filtered = [], skipped = [], expectedCounts = {};
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^COPY "([^"]+)"\."([^"]+)" /);
  if (!m) { filtered.push(lines[i]); continue; }
  const start = i; while (++i < lines.length && lines[i] !== '\\.') {}
  if (i >= lines.length) throw new Error('Unterminated COPY data.');
  const name = `${m[1]}.${m[2]}`, count = i - start - 1;
  expectedCounts[name] = count;
  // An empty COPY transfers no rows but can reference newer internal columns.
  // Omit only empty Auth/Storage COPY statements; retain the original backup
  // and still verify existing tables are empty after restoration.
  if (['auth', 'storage'].includes(m[1]) && count === 0) { skipped.push(name); continue; }
  if (['auth', 'storage'].includes(m[1]) && !tables.has(name)) {
    if (count !== 0) throw new Error(`Missing nonempty internal table ${name}; restore stopped, no data discarded.`);
    skipped.push(name);
  } else filtered.push(...lines.slice(start, i + 1));
}
// Missing empty internal tables are tracked, not fabricated. Their owning
// services must initialise them and pass final checks before production cutover.
// Verified from source pg_roles: this reserved grant target has every role
// capability false, including LOGIN, INHERIT and BYPASSRLS. It is absent from
// the official self-hosted image; recreate exactly, not as a privileged user.
const compatibility = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN CREATE ROLE supabase_realtime_admin NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOLOGIN NOREPLICATION NOBYPASSRLS; END IF; END $$;\n`;
const sql = compatibility + readFileSync(`${base}/roles.sql`, 'utf8') + '\n' + readFileSync(`${base}/schema.sql`, 'utf8') + '\nSET session_replication_role = replica;\n' + filtered.join('\n');
const attempt = mkdtempSync(`${base}/rehearsal-`);
const stdout = openSync(`${attempt}/restore.log`, 'wx', 0o600), stderr = openSync(`${attempt}/restore.errors`, 'wx', 0o600);
let result;
// The image protects reserved role changes; only this offline restore uses its
// local superuser. Dump ALTER OWNER statements retain the original ownership.
try { result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '--single-transaction', '--set', 'ON_ERROR_STOP=1'], { input: sql, stdio: ['pipe', stdout, stderr], timeout: 120000 }); }
finally { closeSync(stdout); closeSync(stderr); }
if (result.status !== 0) throw new Error(`Rehearsal restore failed and transaction rolled back. Private logs: ${attempt}; source unchanged.`);
const counts = [];
for (const [name, count] of Object.entries(expectedCounts)) {
  if (skipped.includes(name) && !tables.has(name)) continue;
  if (!/^(public|auth|storage)\.[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Unexpected table name.');
  const actual = Number(query(`select count(*) from ${name}`));
  counts.push({ table: name, expected: count, actual, matches: count === actual });
}
const checks = { restoredAt: new Date().toISOString(), target: container, counts, omittedEmptyInternalCopyStatements: skipped,
  allCountsMatch: counts.every(x => x.matches), productionReady: false };
writeFileSync(`${base}/rehearsal-validation.json`, JSON.stringify(checks, null, 2), { mode: 0o600 });
console.log(JSON.stringify(checks, null, 2));
if (!checks.allCountsMatch) process.exitCode = 1;
