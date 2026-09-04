// Root-only combined PostgreSQL/config/file-service backup with >=30-day local retention.
// Offsite objects are AES-256-GCM encrypted before they leave the server.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, openSync, closeSync, cpSync, statSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
const dir = '/opt/lilly-migration/staging', root = '/var/backups/lilly-platform';
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Backup server only.');
const config = JSON.parse(readFileSync(`${dir}/compose.functions.json`, 'utf8'));
if (config.name !== 'lilly-stage' || config.services.db.container_name !== 'lilly-stage-db') throw new Error('Unexpected database target.');
const keyFile = '/opt/lilly-migration/backup-encryption.key';
if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: 'wx' });
const key = readFileSync(keyFile);
if (key.length !== 32 || (statSync(keyFile).mode & 0o077)) throw new Error('Backup key permissions invalid.');
mkdirSync(root, { recursive: true, mode: 0o700 });
const destination = mkdtempSync(`${root}/${new Date().toISOString().replace(/[:.]/g, '-')}-`);
const payload = `${destination}/payload`;
mkdirSync(payload, { mode: 0o700 });
const metadata = { version: 1, createdAt: new Date().toISOString(), status: 'incomplete', encryptedOffsite: false, readbackVerified: false };
const manifestPath = `${destination}/manifest.json`;
writeFileSync(manifestPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
function privateOutput(name, command, args) {
  const out = openSync(`${payload}/${name}`, 'wx', 0o600), err = openSync(`${destination}/${name}.errors`, 'wx', 0o600);
  let result;
  try { result = spawnSync(command, args, { stdio: ['ignore', out, err], timeout: 120000 }); }
  finally { closeSync(out); closeSync(err); }
  if (result.status !== 0) throw new Error(`Backup step failed: ${name}; private logs retained.`);
}
privateOutput('postgres.dump', 'docker', ['exec', 'lilly-stage-db', 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc']);
privateOutput('roles.sql', 'docker', ['exec', 'lilly-stage-db', 'pg_dumpall', '-U', 'supabase_admin', '--roles-only']);
const list = spawnSync('docker', ['exec', '-i', 'lilly-stage-db', 'pg_restore', '--list'], { input: readFileSync(`${payload}/postgres.dump`), encoding: 'utf8', timeout: 30000 });
if (list.status !== 0 || !list.stdout.includes('TABLE DATA public attendees')) throw new Error('Database archive validation failed.');
for (const name of ['.env', 'compose.functions.json']) cpSync(`${dir}/${name}`, `${payload}/${name}`);
cpSync(`${dir}/volumes/functions`, `${payload}/functions`, { recursive: true });
cpSync(`${dir}/volumes/api/envoy`, `${payload}/envoy`, { recursive: true });
if (existsSync(`${dir}/volumes/storage`)) cpSync(`${dir}/volumes/storage`, `${payload}/storage`, { recursive: true });
execFileSync('docker', ['cp', 'lilly-stage-db:/etc/postgresql-custom', `${payload}/postgresql-custom`], { stdio: ['ignore', 'ignore', 'pipe'] });
const sqliteCode = `const Database=require('/opt/lilly-meetings/node_modules/better-sqlite3');const db=new Database('/opt/lilly-meetings/data/lilly-meetings.db',{readonly:true});db.backup(${JSON.stringify(`${payload}/lilly-meetings.db`)}).then(()=>db.close()).catch(()=>{db.close();process.exitCode=1});`;
try { execFileSync(process.execPath, ['-e', sqliteCode], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 60000 }); }
catch { throw new Error('File-service SQLite snapshot failed; secret output suppressed.'); }
cpSync('/opt/lilly-meetings/data/files', `${payload}/document-files`, { recursive: true });
// Include operational code/config for disaster recovery, but never the AES key.
cpSync('/opt/lilly-meetings', `${payload}/document-service`, { recursive: true, filter: source => !/\/(data|node_modules|\.git)(\/|$)/.test(source) });
if (existsSync('/etc/lilly-meetings')) cpSync('/etc/lilly-meetings', `${payload}/document-service-config`, { recursive: true });
if (existsSync(`${dir}/site-aliyun`)) cpSync(`${dir}/site-aliyun`, `${payload}/frontend`, { recursive: true });
mkdirSync(`${payload}/host-config`, { mode: 0o700 });
for (const [source, name] of [
  ['/etc/nginx/sites-available/lilly-meetings', 'nginx.conf'],
  ['/etc/systemd/system/lilly-platform.service', 'lilly-platform.service'],
  ['/etc/systemd/system/lilly-meetings.service', 'lilly-meetings.service'],
  ['/etc/systemd/system/lilly-meetings.service.d', 'lilly-meetings.service.d'],
  ['/etc/systemd/system/lilly-platform-backup.service', 'lilly-platform-backup.service'],
  ['/etc/systemd/system/lilly-platform-backup.timer', 'lilly-platform-backup.timer'],
  [`${dir}/PRODUCTION_ACTIVE`, 'PRODUCTION_ACTIVE'],
]) if (existsSync(source)) cpSync(source, `${payload}/host-config/${name}`, { recursive: true });
const archive = `${destination}/platform.tar.gz`;
execFileSync('tar', ['-czf', archive, '-C', destination, 'payload'], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
const bytes = readFileSync(archive), iv = randomBytes(12), aad = Buffer.from('lilly-platform-backup-v1');
const cipher = createCipheriv('aes-256-gcm', key, iv);
cipher.setAAD(aad);
const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
const encrypted = Buffer.concat([Buffer.from('LILLYBKP1'), iv, cipher.getAuthTag(), ciphertext]);
const encryptedFile = `${destination}/platform.tar.gz.enc`;
writeFileSync(encryptedFile, encrypted, { mode: 0o600 });
metadata.archiveSha256 = createHash('sha256').update(bytes).digest('hex');
metadata.encryptedSha256 = createHash('sha256').update(encrypted).digest('hex');
metadata.bytes = encrypted.length;
metadata.status = 'local-archive-verified';
writeFileSync(manifestPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
if (!process.env.OSS_BUCKET || !/^[a-z0-9-]+$/.test(process.env.OSS_BUCKET)) throw new Error('Existing backup bucket not configured.');
const region = process.env.OSS_REGION || 'cn-shanghai', endpoint = process.env.OSS_ENDPOINT || 'oss-cn-shanghai.aliyuncs.com';
const object = `oss://${process.env.OSS_BUCKET}/platform-encrypted/${destination.split('/').pop()}.tar.gz.enc`;
const options = ['--region', region, '--endpoint', endpoint, '--quiet'];
try {
  execFileSync('/usr/local/bin/ossutil', ['cp', encryptedFile, object, ...options], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
  execFileSync('/usr/local/bin/ossutil', ['cp', object, `${destination}/readback.enc`, ...options], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
} catch { throw new Error('Encrypted OSS upload/readback failed; local backup retained.'); }
const readback = readFileSync(`${destination}/readback.enc`);
if (createHash('sha256').update(readback).digest('hex') !== metadata.encryptedSha256) throw new Error('Offsite backup checksum mismatch.');
const decipher = createDecipheriv('aes-256-gcm', key, readback.subarray(9, 21));
decipher.setAAD(aad); decipher.setAuthTag(readback.subarray(21, 37));
const restored = Buffer.concat([decipher.update(readback.subarray(37)), decipher.final()]);
if (createHash('sha256').update(restored).digest('hex') !== metadata.archiveSha256) throw new Error('Offsite decrypted archive differs.');
metadata.status = 'encrypted-offsite-readback-verified';
metadata.encryptedOffsite = true; metadata.readbackVerified = true; metadata.object = object;
writeFileSync(manifestPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
// Keep at least 30 days locally. OSS remains the durable encrypted offsite copy
// and is intentionally not deleted by this job.
const localRetentionDays = Number(process.env.LOCAL_BACKUP_RETENTION_DAYS || 35);
if (!Number.isInteger(localRetentionDays) || localRetentionDays < 30 || localRetentionDays > 365) {
  throw new Error('LOCAL_BACKUP_RETENTION_DAYS must be an integer between 30 and 365.');
}
const cutoff = Date.now() - localRetentionDays * 24 * 60 * 60 * 1000;
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'security') continue;
  const candidate = `${root}/${entry.name}`;
  if (candidate === destination) continue;
  if (/^\d{4}-\d{2}-\d{2}T/.test(entry.name) && statSync(candidate).mtimeMs < cutoff) {
    rmSync(candidate, { recursive: true, force: false });
  }
}
console.log(JSON.stringify({ backup: destination, status: metadata.status, bytes: metadata.bytes, object }, null, 2));
