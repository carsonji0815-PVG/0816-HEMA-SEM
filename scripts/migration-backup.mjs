// Export this project's source database using the Supabase CLI's own filtering.
// No source data changes or restore operations. Credentials never go to stdout.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, openSync, closeSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const expectedRef = 'bupsipicxwyeuxunkvii';
const linkedRef = readFileSync(path.join(root, 'supabase/.temp/project-ref'), 'utf8').trim();
if (linkedRef !== expectedRef) throw new Error('Unexpected linked project; export stopped.');
const defaultClientBins=['/opt/homebrew/opt/postgresql@17/bin','/opt/homebrew/opt/libpq@17/bin'];
const clientBin = process.env.MIGRATION_PG_BIN || defaultClientBins.find(candidate=>existsSync(path.join(candidate,'pg_dump'))) || defaultClientBins[0];
const version = spawnSync(path.join(clientBin, 'pg_dump'), ['--version'], { encoding: 'utf8' });
if (version.status !== 0 || !/\b17\./.test(version.stdout)) throw new Error('PostgreSQL 17 client required.');

const base = path.join(root, '.tmp/aliyun-migration/backups');
mkdirSync(base, { recursive: true, mode: 0o700 });
const destination = mkdtempSync(path.join(base, `${new Date().toISOString().replace(/[:.]/g, '-')}-`));
const manifest = { projectRef: expectedRef, createdAt: new Date().toISOString(), status: 'incomplete',
  method: 'Supabase CLI filtered dump with native PostgreSQL 17 client',
  note: 'Independent rehearsal backup; repeat during a controlled write-free cutover window. Storage files and Edge functions require separate migration.', files: [] };
const saveManifest = () => writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
saveManifest();

for (const [filename, flags] of [['roles.sql', ['--role-only']], ['schema.sql', []], ['data.sql', ['--data-only', '--use-copy']]]) {
  let cli;
  for(let attempt=1;attempt<=3;attempt++){
    cli = spawnSync('npx', ['--no-install', 'supabase', 'db', 'dump', '--linked', '--dry-run', ...flags],
      { cwd: root, encoding: 'utf8', timeout: 90000, maxBuffer: 2 * 1024 * 1024 });
    if(cli.status===0&&cli.stdout.startsWith('#!/usr/bin/env bash')&&cli.stdout.includes('pg_dump'))break;
    if(attempt<3)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000*attempt);
  }
  if (cli.status !== 0 || !cli.stdout.startsWith('#!/usr/bin/env bash') || !cli.stdout.includes('pg_dump')) {
    throw new Error(`Cannot prepare ${filename}; no credentials or raw CLI output displayed.`);
  }
  const target = path.join(destination, filename);
  const output = openSync(target, 'wx', 0o600);
  const errorLog = openSync(`${target}.errors`, 'wx', 0o600);
  let result;
  try {
    result = spawnSync('/bin/bash', ['-s'], { input: cli.stdout, cwd: root,
      env: { ...process.env, PATH: `${clientBin}:${process.env.PATH}`, PGCONNECT_TIMEOUT: '20', PGSSLMODE: 'require', PGOPTIONS: '-c default_transaction_read_only=on' },
      stdio: ['pipe', output, errorLog], timeout: 180000 });
  } finally { closeSync(output); closeSync(errorLog); }
  if (result.status !== 0 || statSync(target).size === 0) throw new Error(`${filename} failed; incomplete backup retained privately at ${destination}`);
  manifest.files.push({ name: filename, bytes: statSync(target).size, sha256: createHash('sha256').update(readFileSync(target)).digest('hex') });
  saveManifest();
  console.log(`${filename}: exported (${statSync(target).size} bytes)`);
}
manifest.status = 'exported-not-yet-restore-tested';
manifest.completedAt = new Date().toISOString();
saveManifest();
console.log(`Private backup: ${destination}`);
