// Store the offsite-backup recovery key on the owner's Mac without displaying it.
// Cloud command history only receives a public RSA key and RSA-encrypted output.
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, privateDecrypt, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync, chmodSync } from 'node:fs';
const cli = process.env.MIGRATION_ALIYUN_CLI;
if (!cli || process.platform !== 'darwin') throw new Error('Run on the owner Mac with the authenticated Alibaba CLI.');
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 });
const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const receiver = `const fs=require('node:fs'),c=require('node:crypto');const k=fs.readFileSync('/opt/lilly-migration/backup-encryption.key');if(k.length!==32)throw Error('Invalid key');console.log(c.publicEncrypt({key:${JSON.stringify(pem)},oaepHash:'sha256'},k).toString('base64'));`;
const quote = s => `'${s.replaceAll("'", "'\\''")}'`;
const base = ['--biz-region-id', 'cn-shanghai', '--region', 'cn-shanghai', '--instance-id', '84650271fb8845f89c4671a6463510f9'];
const call = (op, args) => JSON.parse(execFileSync(cli, ['swas-open', op, ...base, ...args], { encoding: 'utf8' }));
const run = call('run-command', ['--name', 'lilly-encrypted-recovery-key-export', '--type', 'RunShellScript', '--timeout', '30', '--command-content', `node -e ${quote(receiver)}`]);
let ciphertext;
for (let attempt = 0; attempt < 12; attempt++) {
  const result = call('describe-invocation-result', ['--invoke-id', run.InvokeId]).InvocationResult;
  if (result.InvocationStatus === 'Success' && result.ExitCode === 0) { ciphertext = Buffer.from(result.Output, 'base64').toString().trim(); break; }
  if (!['Running', 'Pending', 'Scheduled'].includes(result.InvocationStatus)) throw new Error('Encrypted key export failed.');
  await new Promise(resolve => setTimeout(resolve, 3000));
}
if (!ciphertext || !/^[A-Za-z0-9+/=]+$/.test(ciphertext)) throw new Error('Invalid encrypted key transport.');
const key = privateDecrypt({ key: privateKey, oaepHash: 'sha256' }, Buffer.from(ciphertext, 'base64'));
if (key.length !== 32) throw new Error('Invalid recovery key.');
const directory = '/Users/carson/Documents/礼来平台恢复资料';
mkdirSync(directory, { recursive: true, mode: 0o700 });
const file = `${directory}/139.196.97.236-backup-encryption.key`;
if (existsSync(file)) { if (!readFileSync(file).equals(key)) throw new Error('Existing recovery key differs; not overwritten.'); }
else writeFileSync(file, key, { mode: 0o600, flag: 'wx' });
chmodSync(file, 0o600);
console.log(JSON.stringify({ saved: file, bytes: key.length, fingerprint: createHash('sha256').update(key).digest('hex'), secretPrinted: false }, null, 2));
