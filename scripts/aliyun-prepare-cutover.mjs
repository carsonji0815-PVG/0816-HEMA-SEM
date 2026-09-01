// Build and validate inactive production configuration. Does not reload nginx.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, chmodSync, readdirSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = '/opt/lilly-migration/staging';
if (process.platform !== 'linux' || process.getuid() !== 0 || existsSync(`${dir}/PRODUCTION_ACTIVE`)) throw new Error('Not a pre-cutover server.');
for (const file of ['private-api-validation.json', 'private-auth-validation.json', 'private-registration-validation.json', 'pre-freeze-validation.json']) {
  const report = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
  if (!(report.allPassed || report.allMatch)) throw new Error(`Prerequisite failed: ${file}`);
}
const site = JSON.parse(readFileSync(`${dir}/site-validation.json`, 'utf8'));
if (!/^[a-f0-9]{16}$/.test(site.version)) throw new Error('Invalid frontend version.');
const release = `/var/www/lilly-platform/releases/${site.version}`;
mkdirSync(release, { recursive: true, mode: 0o755 });
cpSync(`${dir}/site-aliyun`, release, { recursive: true });
function permissions(path) {
  chmodSync(path, 0o755);
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory()) permissions(`${path}/${entry.name}`);
    else chmodSync(`${path}/${entry.name}`, 0o644);
  }
}
permissions(release);
if (!existsSync('/var/www/lilly-platform/current')) symlinkSync(release, '/var/www/lilly-platform/current');
const originalFile = '/etc/nginx/sites-available/lilly-meetings';
const original = readFileSync(originalFile, 'utf8');
if (original.includes('LILLY_PLATFORM_ROUTES')) throw new Error('Production routes already present.');
if ((original.match(/client_max_body_size 50M;/g) || []).length !== 1) throw new Error('Unexpected existing nginx layout.');
const routes = `
    # LILLY_PLATFORM_ROUTES -- preserve existing file-service root and ACME.
    location = /meeting { return 302 /meeting/; }
    location ^~ /meeting/ {
        alias /var/www/lilly-platform/current/;
        index index.html;
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
    location = /supabase { return 404; }
    location ^~ /supabase/ {
        if ($uri !~ "^/supabase/(auth/v1|rest/v1|storage/v1|functions/v1)/") { return 404; }
        proxy_pass http://127.0.0.1:18000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Replace client-supplied forwarding headers at the trusted public edge.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 65s;
        proxy_buffering off;
    }
`;
if (existsSync(`${dir}/nginx-original.conf`)) {
  if (readFileSync(`${dir}/nginx-original.conf`, 'utf8') !== original) throw new Error('Original nginx config changed.');
} else writeFileSync(`${dir}/nginx-original.conf`, original, { mode: 0o600, flag: 'wx' });
writeFileSync(`${dir}/nginx-candidate.conf`, original.replace('client_max_body_size 50M;', `client_max_body_size 50M;\n${routes}`), { mode: 0o600 });
const main = readFileSync('/etc/nginx/nginx.conf', 'utf8');
if (!main.includes('include /etc/nginx/sites-enabled/*;')) throw new Error('Unexpected nginx include layout.');
writeFileSync(`${dir}/nginx-test.conf`, main.replace('include /etc/nginx/sites-enabled/*;', `include ${dir}/nginx-candidate.conf;`), { mode: 0o600 });
execFileSync('nginx', ['-t', '-c', `${dir}/nginx-test.conf`], { stdio: ['ignore', 'ignore', 'pipe'] });
const c = JSON.parse(readFileSync(`${dir}/compose.functions.json`, 'utf8'));
c.services.auth.environment.API_EXTERNAL_URL = 'https://139.196.97.236/supabase';
c.services.auth.environment.GOTRUE_SITE_URL = 'https://139.196.97.236/meeting/';
c.services.auth.environment.GOTRUE_URI_ALLOW_LIST = 'https://139.196.97.236/meeting/**';
c.services.auth.environment.GOTRUE_JWT_ISSUER = 'https://139.196.97.236/supabase/auth/v1';
c.services.storage.environment.STORAGE_PUBLIC_URL = 'https://139.196.97.236/supabase';
c.services.functions.environment.SUPABASE_PUBLIC_URL = 'https://139.196.97.236/supabase';
writeFileSync(`${dir}/compose.production.json`, JSON.stringify(c, null, 2), { mode: 0o600 });
writeFileSync(`${dir}/document-supabase.env`, `SUPABASE_URL=http://127.0.0.1:18000\nSUPABASE_ANON_KEY=${c.services['api-gw'].environment.SUPABASE_PUBLISHABLE_KEY}\n`, { mode: 0o600 });
console.log(JSON.stringify({ frontend: release, nginxSyntax: 'passed', publicUrl: 'https://139.196.97.236/meeting/', activated: false }, null, 2));
