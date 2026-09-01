// Extend only the existing private rehearsal stack, without a public gateway.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = '/opt/lilly-migration/staging';
if ((await import('node:fs')).existsSync(`${dir}/PRODUCTION_ACTIVE`)) throw new Error('Rehearsal mutation forbidden after production activation.');
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Server-only staging preparation.');
const base = JSON.parse(readFileSync(`${dir}/compose.db.json`, 'utf8'));
if (base.name !== 'lilly-stage' || base.services.db.container_name !== 'lilly-stage-db') throw new Error('Unexpected staging configuration.');
const original = JSON.parse(execFileSync('docker', ['compose', '-p', 'lilly-stage', 'config', '--format', 'json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const images = {
  // Official stable v2.196.0 / v1.72.2 add internal columns present in source.
  auth: 'ghcr.io/supabase/gotrue@sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232',
  rest: 'ghcr.io/supabase/postgrest@sha256:54000f24847d01a2c2302e0041cf0618b875c57fb48507d743cfa9aaa50bf43c',
  storage: 'public.ecr.aws/supabase/storage-api@sha256:2258f9fb4d3dc0b1c6aaedd0d6e1da2af6c6591b592cd0c9099f3e90fd3fc569',
};
for (const name of Object.keys(images)) {
  const service = original.services[name];
  service.container_name = `lilly-stage-${name}`;
  service.image = images[name];
  service.ports = [];
  service.mem_limit = name === 'storage' ? '384m' : '256m';
  service.cpus = 0.5;
  service.logging = { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } };
  if (name === 'storage') {
    delete service.depends_on.imgproxy;
    service.environment.ENABLE_IMAGE_TRANSFORMATION = 'false';
  }
  base.services[name] = service;
}
writeFileSync(`${dir}/compose.core.json`, JSON.stringify(base, null, 2), { mode: 0o600 });
console.log('Private DB/Auth/REST/Storage rehearsal configuration ready. Public gateway not enabled.');
