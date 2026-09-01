// Run on the confirmed Alibaba server only. Creates an isolated, private DB
// rehearsal configuration; never starts containers or touches the live service.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const upstream = '/opt/lilly-migration/supabase-upstream';
const staging = '/opt/lilly-migration/staging';
const revision = '241bb11c0627f2981746d37033f57dbfa81d29b0';
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Run as root on the migration server.');
if (execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== revision) throw new Error('Unexpected upstream revision.');
if (existsSync(staging)) throw new Error('Staging already exists. Inspect it before reusing; no files overwritten.');
mkdirSync(staging, { mode: 0o700 });
cpSync(`${upstream}/docker`, staging, { recursive: true, force: false, errorOnExist: true });
chmodSync(staging, 0o700);
cpSync(`${staging}/.env.example`, `${staging}/.env`, { errorOnExist: true, force: false });
chmodSync(`${staging}/.env`, 0o600);
const generated = spawnSync('sh', ['utils/generate-keys.sh', '--update-env'], { cwd: staging, encoding: 'utf8' });
if (generated.status !== 0) throw new Error('Key generation failed; raw output suppressed.');
const overrides = {
  SUPABASE_PUBLIC_URL: 'http://127.0.0.1:18000', API_EXTERNAL_URL: 'http://127.0.0.1:18000/auth/v1',
  SITE_URL: 'http://127.0.0.1:18000', ADDITIONAL_REDIRECT_URLS: '', DISABLE_SIGNUP: 'true',
  ENABLE_EMAIL_SIGNUP: 'true', ENABLE_ANONYMOUS_USERS: 'false', ENABLE_PHONE_SIGNUP: 'false',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${randomBytes(24).toString('base64url')}`,
  SUPABASE_SECRET_KEY: `sb_secret_${randomBytes(24).toString('base64url')}`,
  POSTGRES_HOST: 'db', POSTGRES_PORT: '5432', POSTGRES_DB: 'postgres',
  PGRST_DB_SCHEMAS: 'public,storage', POOLER_TENANT_ID: 'lilly-stage',
};
let env = readFileSync(`${staging}/.env`, 'utf8');
for (const [key, value] of Object.entries(overrides)) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  env = pattern.test(env) ? env.replace(pattern, `${key}=${value}`) : `${env}\n${key}=${value}\n`;
}
writeFileSync(`${staging}/.env`, env, { mode: 0o600 });
// Resolved configuration contains secrets: keep it root-only, never print it.
const parsed = JSON.parse(execFileSync('docker', ['compose', '-p', 'lilly-stage', 'config', '--format', 'json'], { cwd: staging, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const db = parsed.services.db;
db.container_name = 'lilly-stage-db';
db.image = 'ghcr.io/supabase/postgres@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00';
db.ports = [];
db.mem_limit = '1024m';
db.cpus = 1;
db.logging = { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } };
db.command.push('-c', 'shared_buffers=128MB', '-c', 'max_connections=80');
const config = { name: 'lilly-stage', services: { db }, volumes: parsed.volumes, networks: parsed.networks };
writeFileSync(`${staging}/compose.db.json`, JSON.stringify(config, null, 2), { mode: 0o600 });
writeFileSync(`${staging}/readiness.json`, JSON.stringify({ revision, phase: 'database-rehearsal-only',
  createdAt: new Date().toISOString(), publicPorts: [], memoryLimit: '1024m', productionSwitched: false }, null, 2), { mode: 0o600 });
console.log('Private database rehearsal configuration prepared; no public ports, no production changes.');
