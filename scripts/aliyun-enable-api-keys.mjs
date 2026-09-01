// Enable the upstream asymmetric/opaque API-key wiring in staging only.
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = '/opt/lilly-migration/staging';
if ((await import('node:fs')).existsSync(`${dir}/PRODUCTION_ACTIVE`)) throw new Error('Rehearsal mutation forbidden after production activation.');
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Migration server only.');
const current = JSON.parse(readFileSync(`${dir}/compose.functions.json`, 'utf8'));
if (current.name !== 'lilly-stage' || current.services['api-gw'].ports.some(p => p.host_ip !== '127.0.0.1')) throw new Error('Not an isolated rehearsal.');
const existingKeys = readFileSync(`${dir}/.env`, 'utf8').match(/^JWT_KEYS=(.*)$/m)?.[1]?.trim();
if (!existingKeys || existingKeys === '[]') {
  // Execute the exact upstream crypto program directly. On this server the
  // shell utility returned empty values; direct execution validates all output.
  // Keep all generated material in memory; never emit keys to cloud job output.
  const utility = readFileSync(`${dir}/utils/add-new-auth-keys.sh`, 'utf8');
  const cryptoProgram = utility.split("$node_runner -e '\n")[1]?.split("\n' \"$jwt_secret\" >")[0];
  if (!cryptoProgram) throw new Error('Upstream utility format changed.');
  let envText = readFileSync(`${dir}/.env`, 'utf8');
  const secret = envText.match(/^JWT_SECRET=(.*)$/m)?.[1]?.trim();
  if (!secret) throw new Error('Missing existing legacy secret.');
  let output;
  try { output = execFileSync(process.execPath, ['-e', cryptoProgram, secret], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw new Error('Official key generation failed; secret output suppressed.'); }
  const generated = Object.fromEntries(output.trim().split('\n').map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  for (const name of ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'ANON_KEY_ASYMMETRIC', 'SERVICE_ROLE_KEY_ASYMMETRIC', 'JWT_KEYS', 'JWT_JWKS']) {
    if (!generated[name] || generated[name].length < 30) throw new Error(`Invalid generated value: ${name}`);
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    envText = pattern.test(envText) ? envText.replace(pattern, () => `${name}=${generated[name]}`) : `${envText}\n${name}=${generated[name]}\n`;
  }
  if (!JSON.parse(generated.JWT_KEYS).some(k => k.kty === 'EC' && k.d)) throw new Error('Missing private signing key.');
  writeFileSync(`${dir}/.env`, envText, { mode: 0o600 });
  const yaml = readFileSync(`${dir}/docker-compose.yml`, 'utf8').replace(/^(\s*)#(GOTRUE_JWT_KEYS|API_JWT_JWKS|JWT_JWKS|SUPABASE_JWKS):/gm, '$1$2:');
  writeFileSync(`${dir}/docker-compose.yml`, yaml, { mode: 0o600 });
}
for (const name of ['.env', '.env.old']) if (existsSync(`${dir}/${name}`)) chmodSync(`${dir}/${name}`, 0o600);
const original = JSON.parse(execFileSync('docker', ['compose', '-p', 'lilly-stage', 'config', '--format', 'json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const keys = {
  auth: ['GOTRUE_JWT_KEYS'], rest: ['PGRST_JWT_SECRET'], storage: ['JWT_JWKS'],
  'api-gw': ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'ANON_KEY_ASYMMETRIC', 'SERVICE_ROLE_KEY_ASYMMETRIC'],
  functions: ['SUPABASE_JWKS', 'SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_SECRET_KEYS'],
};
for (const file of ['compose.core.json', 'compose.gateway.json', 'compose.functions.json']) {
  const config = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
  for (const [service, fields] of Object.entries(keys)) {
    if (!config.services[service]) continue;
    for (const field of fields) {
      const value = original.services[service].environment[field];
      if (!value || value === '[]') throw new Error(`Missing key configuration: ${service}.${field}`);
      config.services[service].environment[field] = value;
    }
  }
  writeFileSync(`${dir}/${file}`, JSON.stringify(config, null, 2), { mode: 0o600 });
}
console.log('Official opaque/asymmetric API-key configuration enabled; legacy keys and database credentials preserved.');
