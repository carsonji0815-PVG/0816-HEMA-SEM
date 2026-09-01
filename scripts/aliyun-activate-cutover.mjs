// Activate only after final frozen data and content fingerprints are verified.
// After public activation, never automatically unfreeze the old source database.
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = '/opt/lilly-migration/staging';
if (process.platform !== 'linux' || process.getuid() !== 0 || existsSync(`${dir}/PRODUCTION_ACTIVE`)) throw new Error('Invalid activation state.');
const final = JSON.parse(readFileSync(`${dir}/final-data-validation.json`, 'utf8'));
const content = JSON.parse(readFileSync(`${final.sourceBackup}/rehearsal-content-and-rls.json`, 'utf8'));
if (!final.allCountsMatch || !content.allDataMatch || !content.allPermissionChecksPass) throw new Error('Final data/permission validation missing.');
const rollback = `${dir}/cutover-original`;
mkdirSync(rollback, { mode: 0o700 });
for (const name of ['.env', 'compose.functions.json']) cpSync(`${dir}/${name}`, `${rollback}/${name}`, { force: false, errorOnExist: true });
cpSync('/etc/nginx/sites-available/lilly-meetings', `${rollback}/nginx.conf`, { force: false, errorOnExist: true });
let envText = readFileSync(`${dir}/.env`, 'utf8');
for (const [key, value] of Object.entries({ SUPABASE_PUBLIC_URL: 'https://139.196.97.236/supabase', API_EXTERNAL_URL: 'https://139.196.97.236/supabase', SITE_URL: 'https://139.196.97.236/meeting/', ADDITIONAL_REDIRECT_URLS: 'https://139.196.97.236/meeting/**' })) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  envText = pattern.test(envText) ? envText.replace(pattern, () => `${key}=${value}`) : `${envText}\n${key}=${value}\n`;
}
writeFileSync(`${dir}/.env`, envText, { mode: 0o600 });
cpSync(`${dir}/compose.production.json`, `${dir}/compose.functions.json`);
mkdirSync('/etc/lilly-meetings', { recursive: true, mode: 0o700 });
if (existsSync('/etc/lilly-meetings/supabase.env')) cpSync('/etc/lilly-meetings/supabase.env', `${rollback}/document-supabase.env`);
cpSync(`${dir}/document-supabase.env`, '/etc/lilly-meetings/supabase.env');
mkdirSync('/etc/systemd/system/lilly-meetings.service.d', { recursive: true, mode: 0o755 });
const dropin = '/etc/systemd/system/lilly-meetings.service.d/20-aliyun-supabase.conf';
if (existsSync(dropin)) throw new Error('Existing migration drop-in requires review.');
writeFileSync(dropin, '[Service]\nEnvironmentFile=/etc/lilly-meetings/supabase.env\n', { mode: 0o644 });
const service = `[Unit]
Description=Lilly meeting platform self-hosted services
Requires=docker.service
After=docker.service network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${dir}
ExecStart=/usr/bin/docker compose -p lilly-stage -f ${dir}/compose.functions.json up -d --wait --wait-timeout 150
ExecStop=/usr/bin/docker compose -p lilly-stage -f ${dir}/compose.functions.json stop
TimeoutStartSec=180
TimeoutStopSec=120
[Install]
WantedBy=multi-user.target
`;
writeFileSync('/etc/systemd/system/lilly-platform.service', service, { mode: 0o644 });
execFileSync('systemctl', ['daemon-reload']);
execFileSync('systemctl', ['enable', '--now', 'lilly-platform.service'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
execFileSync('systemctl', ['start', 'lilly-meetings'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
// Marker goes in place BEFORE nginx can expose writes. Rehearsal refresh is now forbidden.
writeFileSync(`${dir}/PRODUCTION_ACTIVE`, JSON.stringify({ activatedAt: new Date().toISOString(), sourceBackup: final.sourceBackup, publicUrl: 'https://139.196.97.236/meeting/', sourceRemainsReadOnly: true }, null, 2), { mode: 0o600, flag: 'wx' });
cpSync(`${dir}/nginx-candidate.conf`, '/etc/nginx/sites-available/lilly-meetings');
execFileSync('nginx', ['-t'], { stdio: ['ignore', 'pipe', 'pipe'] });
execFileSync('systemctl', ['reload', 'nginx']);
console.log('Alibaba production routing activated. Source remains read-only. Validate the public endpoint before declaring completion.');
