// Restore the latest verified encrypted backup into an isolated, networkless database.
// This never connects to, stops, or writes to the production database.
import { createDecipheriv, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync,
  statSync, writeFileSync,
} from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const Database = require('/opt/lilly-meetings/node_modules/better-sqlite3');
const backupRoot = '/var/backups/lilly-platform';
const reportRoot = `${backupRoot}/restore-drills`;
const keyFile = '/opt/lilly-migration/backup-encryption.key';
const image = execFileSync('docker', ['inspect', 'lilly-stage-db', '--format', '{{.Config.Image}}'], { encoding: 'utf8' }).trim();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const work = mkdtempSync(`${backupRoot}/restore-drill-work-${stamp}-`);
const container = `lilly-restore-drill-${process.pid}`;
const report = { version: 1, startedAt: new Date().toISOString(), status: 'failed' };
mkdirSync(reportRoot, { recursive: true, mode: 0o700 });

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { timeout: 180000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} failed during isolated restore drill`);
  return result;
}
function query(sql) {
  return execFileSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-Atc', sql], { encoding: 'utf8', timeout: 30000 }).trim();
}

try {
  if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Restore drill is server-root only');
  if (!existsSync(keyFile) || statSync(keyFile).mode & 0o077) throw new Error('Backup key missing or permissions invalid');
  const candidates = readdirSync(backupRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map(entry => {
      const directory = `${backupRoot}/${entry.name}`;
      const manifestFile = `${directory}/manifest.json`;
      if (!existsSync(manifestFile)) return null;
      const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
      return { directory, manifest };
    })
    .filter(item => item?.manifest?.status === 'encrypted-offsite-readback-verified')
    .sort((a, b) => Date.parse(b.manifest.createdAt) - Date.parse(a.manifest.createdAt));
  if (!candidates.length) throw new Error('No verified encrypted backup is available');
  const selected = candidates[0];
  report.backupCreatedAt = selected.manifest.createdAt;
  report.backupDirectory = selected.directory;

  const encrypted = readFileSync(`${selected.directory}/readback.enc`);
  if (sha256(encrypted) !== selected.manifest.encryptedSha256) throw new Error('Encrypted OSS readback checksum mismatch');
  if (encrypted.subarray(0, 9).toString() !== 'LILLYBKP1') throw new Error('Unknown backup format');
  const decipher = createDecipheriv('aes-256-gcm', readFileSync(keyFile), encrypted.subarray(9, 21));
  decipher.setAAD(Buffer.from('lilly-platform-backup-v1'));
  decipher.setAuthTag(encrypted.subarray(21, 37));
  const archive = Buffer.concat([decipher.update(encrypted.subarray(37)), decipher.final()]);
  if (sha256(archive) !== selected.manifest.archiveSha256) throw new Error('Decrypted archive checksum mismatch');
  const archiveFile = `${work}/platform.tar.gz`;
  writeFileSync(archiveFile, archive, { mode: 0o600 });
  run('tar', ['-xzf', archiveFile, '-C', work], { stdio: ['ignore', 'ignore', 'pipe'] });
  const payload = `${work}/payload`;
  const compose = JSON.parse(readFileSync(`${payload}/compose.functions.json`, 'utf8'));
  if (compose.services?.db?.container_name !== 'lilly-stage-db') throw new Error('Recovered platform configuration is invalid');

  const sqlite = new Database(`${payload}/lilly-meetings.db`, { readonly: true, fileMustExist: true });
  const sqliteIntegrity = sqlite.pragma('integrity_check', { simple: true });
  const sqliteTables = sqlite.prepare("select count(*) as count from sqlite_master where type='table'").get().count;
  sqlite.close();
  if (sqliteIntegrity !== 'ok') throw new Error('Recovered SQLite database failed integrity check');

  run('docker', [
    'run', '-d', '--rm', '--name', container, '--network', 'none',
    '--cpus', '1', '--memory', '1g', '--pids-limit', '256',
    '--user', '100:101', '--entrypoint', 'sh',
    '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,uid=100,gid=101,size=768m',
    image, '-c',
    'initdb -D /var/lib/postgresql/data -A trust >/tmp/init.log && exec postgres -D /var/lib/postgresql/data -c shared_preload_libraries=pg_stat_statements,pgaudit,plpgsql,plpgsql_check,pg_cron,pg_net,pgsodium,auto_explain,pg_tle,plan_filter,supabase_vault',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const probe = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Isolated PostgreSQL did not become ready');

  // The only expected roles import warning is that the clean cluster already owns role postgres.
  spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=0'], {
    input: readFileSync(`${payload}/roles.sql`), stdio: ['pipe', 'ignore', 'ignore'], timeout: 30000,
  });
  const restoreLog = `${reportRoot}/${stamp}.pg-restore.log`;
  const restored = spawnSync('docker', ['exec', '-i', container, 'pg_restore', '-U', 'postgres', '-d', 'postgres', '--no-owner', '--no-privileges'], {
    input: readFileSync(`${payload}/postgres.dump`), encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024,
  });
  writeFileSync(restoreLog, restored.stderr || '', { mode: 0o600 });
  if (restored.status !== 0) throw new Error('PostgreSQL archive could not be restored cleanly');

  const publicTables = Number(query("select count(*) from information_schema.tables where table_schema='public'"));
  const attendees = Number(query('select count(*) from public.attendees'));
  const authUsers = Number(query('select count(*) from auth.users'));
  const invalidForeignKeys = Number(query("select count(*) from pg_constraint where contype='f' and not convalidated"));
  if (!Number.isInteger(publicTables) || publicTables < 1 || invalidForeignKeys !== 0) throw new Error('Recovered PostgreSQL validation failed');
  const documentFiles = existsSync(`${payload}/document-files`)
    ? readdirSync(`${payload}/document-files`, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).length
    : 0;

  report.status = 'passed';
  report.finishedAt = new Date().toISOString();
  report.postgres = { publicTables, attendees, authUsers, invalidForeignKeys };
  report.sqlite = { integrity: sqliteIntegrity, tables: sqliteTables };
  report.documentFiles = documentFiles;
} catch (error) {
  report.finishedAt = new Date().toISOString();
  report.error = String(error?.message || error).slice(0, 500);
  process.exitCode = 1;
} finally {
  spawnSync('docker', ['stop', '--time', '10', container], { stdio: 'ignore', timeout: 30000 });
  rmSync(work, { recursive: true, force: false });
  const reportFile = `${reportRoot}/${stamp}.json`;
  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ report: reportFile, status: report.status, backupCreatedAt: report.backupCreatedAt }, null, 2));
}
