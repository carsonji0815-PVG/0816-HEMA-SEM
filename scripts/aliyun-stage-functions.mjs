// Source payload must already be placed in the root-only staging directory.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
const dir = '/opt/lilly-migration/staging';
if ((await import('node:fs')).existsSync(`${dir}/PRODUCTION_ACTIVE`)) throw new Error('Rehearsal mutation forbidden after production activation.');
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Migration server only.');
const base = JSON.parse(readFileSync(`${dir}/compose.gateway.json`, 'utf8'));
if (base.name !== 'lilly-stage' || base.services.db.container_name !== 'lilly-stage-db') throw new Error('Wrong target.');
const source = readFileSync(`${dir}/public-trip-query.source.ts`, 'utf8');
if (createHash('sha256').update(source).digest('hex') !== process.env.MIGRATION_FUNCTION_SHA256) throw new Error('Function source checksum mismatch.');
const path = `${dir}/volumes/functions/public-trip-query`;
mkdirSync(path, { recursive: true, mode: 0o700 });
writeFileSync(`${path}/handler.ts`, source, { mode: 0o600 });
// Managed Supabase accepts a default fetch export. The self-hosted user worker
// entrypoint needs Deno.serve; the original handler/auth/business logic is intact.
writeFileSync(`${path}/index.ts`, 'import handler from "./handler.ts";\nDeno.serve(handler.fetch);\n', { mode: 0o600 });
const original = JSON.parse(execFileSync('docker', ['compose', '-p', 'lilly-stage', 'config', '--format', 'json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const service = original.services.functions;
service.container_name = 'lilly-stage-functions';
service.image = 'public.ecr.aws/supabase/edge-runtime@sha256:2781daf92394db91f7e94129cc3d04ec474ad16a8fe64b3fbeef6e7d557ab120';
service.ports = [];
service.mem_limit = '384m';
service.cpus = 0.5;
// The original withSupabase wrapper validates publishable/secret API keys.
// Generic JWT middleware cannot validate sb_publishable keys. Invalid/missing
// API keys must be tested before production; do not remove the handler wrapper.
service.environment.VERIFY_JWT = 'false';
service.environment.QUERY_RATE_SALT = randomBytes(32).toString('hex');
service.logging = { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } };
base.services.functions = service;
writeFileSync(`${dir}/compose.functions.json`, JSON.stringify(base, null, 2), { mode: 0o600 });
console.log('Original public-trip-query handler staged with self-hosted entrypoint; no public exposure.');
