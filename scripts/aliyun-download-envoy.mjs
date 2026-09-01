// Download only the official, fixed Envoy release. Range requests are bounded;
// validate the publisher's SHA256 before making any binary executable.
import { mkdirSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = '/opt/lilly-migration/images', name = 'envoy-1.39.0-linux-x86_64';
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Migration server only.');
const releaseResponse = await fetch('https://api.github.com/repos/envoyproxy/envoy/releases/tags/v1.39.0', { headers: { 'User-Agent': 'lilly-migration' }, signal: AbortSignal.timeout(20000) });
if (!releaseResponse.ok) throw new Error('Cannot read official release metadata.');
const release = await releaseResponse.json(), asset = release.assets.find(item => item.name === name);
if (!asset || !asset.browser_download_url.startsWith('https://github.com/envoyproxy/envoy/releases/download/v1.39.0/')) throw new Error('Unexpected release asset.');
let expected = asset.digest?.replace(/^sha256:/, '');
if (!/^[a-f0-9]{64}$/.test(expected || '')) {
  const response = await fetch('https://github.com/envoyproxy/envoy/releases/download/v1.39.0/checksums.txt.asc', { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Missing official checksum.');
  const line = (await response.text()).split('\n').find(line => line.includes(name) && !line.includes('contrib'));
  expected = line?.match(/[a-f0-9]{64}/)?.[0];
}
if (!/^[a-f0-9]{64}$/.test(expected || '')) throw new Error('Official checksum unavailable.');
mkdirSync(`${dir}/envoy-parts`, { recursive: true, mode: 0o700 });
// Resolve the official release redirect once to avoid a new github.com TLS
// connection for every segment. Do not print its short-lived signed URL.
if (!asset.url.startsWith('https://api.github.com/repos/envoyproxy/envoy/releases/assets/')) throw new Error('Unexpected release API asset.');
const head = await fetch(asset.url, { method: 'HEAD', headers: { Accept: 'application/octet-stream', 'User-Agent': 'lilly-migration' }, signal: AbortSignal.timeout(30000) });
if (!head.ok || !new URL(head.url).hostname.endsWith('.githubusercontent.com')) throw new Error('Unexpected official release download host.');
const downloadUrl = head.url;
const chunk = 1024 * 1024, count = Math.ceil(asset.size / chunk);
let cursor = 0, completed = 0;
async function worker() {
  while (cursor < count) {
    const i = cursor++, start = i * chunk, end = Math.min(asset.size - 1, start + chunk - 1);
    const filename = `${dir}/envoy-parts/${expected}-${i}`;
    if (existsSync(filename) && statSync(filename).size === end - start + 1) { completed++; continue; }
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { response = await fetch(downloadUrl, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(180000) }); break; }
      catch { if (attempt === 2) throw new Error(`Release segment ${i} connection failed.`); }
    }
    if (response.status !== 206 || response.headers.get('content-range') !== `bytes ${start}-${end}/${asset.size}`) {
      await response.body?.cancel(); throw new Error('Official download endpoint did not honour the requested byte range.');
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length !== end - start + 1) throw new Error('Incomplete release segment.');
    writeFileSync(filename, data, { mode: 0o600 });
    completed++;
    if (completed % 10 === 0 || completed === count) console.log(`Official release segments: ${completed}/${count}`);
  }
}
const outcomes = await Promise.allSettled(Array.from({ length: 8 }, worker));
if (outcomes.some(x => x.status === 'rejected')) throw new Error(`Release incomplete: ${completed}/${count} segments; validated-length segments retained for retry.`);
const data = Buffer.concat(Array.from({ length: count }, (_, i) => readFileSync(`${dir}/envoy-parts/${expected}-${i}`)));
if (data.length !== asset.size || createHash('sha256').update(data).digest('hex') !== expected) throw new Error('Release checksum mismatch; binary not installed.');
const target = `${dir}/${name}.verified`;
if (existsSync(target)) {
  if (createHash('sha256').update(readFileSync(target)).digest('hex') !== expected) throw new Error('Existing verified binary differs; not overwritten.');
} else writeFileSync(target, data, { mode: 0o755, flag: 'wx' });
console.log(`Official Envoy release verified: ${expected}`);
