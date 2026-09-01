// Receive the exact locally built manifest; download public static artifacts only.
// Every file must match its local SHA256 before it is used. No live routing here.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const dir = '/opt/lilly-migration/staging';
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Migration server only.');
const manifest = JSON.parse(readFileSync(`${dir}/site-manifest.json`, 'utf8'));
const target = `${dir}/site-original`;
mkdirSync(target, { recursive: true, mode: 0o700 });
const pending = [...manifest.files];
async function worker() {
  while (pending.length) {
    const file = pending.shift();
    if (!file.path || file.path.startsWith('/') || file.path.split('/').includes('..') || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid static manifest path.');
    const output = path.join(target, file.path);
    if (existsSync(output) && createHash('sha256').update(readFileSync(output)).digest('hex') === file.sha256) continue;
    if (file.path === '.nojekyll' && file.size === 0 && file.sha256 === createHash('sha256').update('').digest('hex')) {
      writeFileSync(output, '', { mode: 0o600 }); continue;
    }
    const url = `https://carsonji0815-pvg.github.io/0816-HEMA-SEM/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Static download failed: ${file.path} (${response.status})`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length !== file.size || createHash('sha256').update(body).digest('hex') !== file.sha256) throw new Error(`Published artifact differs from local build: ${file.path}`);
    mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
    writeFileSync(output, body, { mode: 0o600 });
  }
}
const outcomes = await Promise.allSettled(Array.from({ length: 5 }, worker));
const failure = outcomes.find(o => o.status === 'rejected');
if (failure) throw failure.reason;
const config = JSON.parse(readFileSync(`${dir}/compose.functions.json`, 'utf8'));
if (config.name !== 'lilly-stage') throw new Error('Wrong staging configuration.');
const publicKey = config.services['api-gw'].environment.SUPABASE_PUBLISHABLE_KEY;
if (!publicKey?.startsWith('sb_publishable_')) throw new Error('Publishable API key missing.');
const out = `${dir}/site-aliyun`;
mkdirSync(out, { recursive: true, mode: 0o700 });
for (const file of manifest.files) {
  if (file.path === 'journey-sw.js') continue;
  let bytes = readFileSync(path.join(target, file.path));
  if (['index.html', '会议行程管理系统.html'].includes(file.path)) {
    let html = bytes.toString('utf8');
    html = html.replace(/supabaseUrl:\s*"https:\/\/bupsipicxwyeuxunkvii\.supabase\.co"/, 'supabaseUrl: "https://139.196.97.236/supabase"');
    html = html.replace(/supabaseAnonKey:\s*"[^"]+"/, `supabaseAnonKey: ${JSON.stringify(publicKey)}`);
    // Avoid a Google Fonts network dependency; existing CSS system fallbacks apply.
    html = html.replace(/^.*<link[^>]+https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*$/gm, '');
    if (html.includes('bupsipicxwyeuxunkvii.supabase.co') || !html.includes('https://139.196.97.236/supabase')) throw new Error('Frontend endpoint substitution failed.');
    bytes = Buffer.from(html);
  }
  const output = path.join(out, file.path);
  mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
  writeFileSync(output, bytes, { mode: 0o600 });
}
const files = manifest.files.map(f => f.path).filter(f => f !== 'journey-sw.js' && f !== '.nojekyll').sort();
const digest = createHash('sha256');
for (const file of files) digest.update(readFileSync(path.join(out, file)));
const version = digest.digest('hex').slice(0, 16);
let workerSource = readFileSync(path.join(target, 'journey-sw.js'), 'utf8');
workerSource = workerSource.replace(/const CACHE=PREFIX\+'[^']+';/, `const CACHE=PREFIX+'aliyun-${version}';`);
writeFileSync(path.join(out, 'journey-sw.js'), workerSource, { mode: 0o600 });
const forbidden = readdirSync(out).filter(name => /compose|\.env|\.sql|backup|manifest/i.test(name));
if (forbidden.length) throw new Error('Non-public artifact in static directory.');
writeFileSync(`${dir}/site-validation.json`, JSON.stringify({ generatedAt: new Date().toISOString(), sourceRevision: manifest.revision, files: manifest.files.length, version, destination: 'https://139.196.97.236/meeting/', productionSwitched: false }, null, 2), { mode: 0o600 });
console.log(`Alibaba static build prepared: ${manifest.files.length} verified files; version ${version}; not publicly routed.`);
