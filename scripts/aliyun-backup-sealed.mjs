// Backup directly on the confirmed Alibaba host. Only encrypted temporary DB
// credentials enter Cloud Assistant command history. No restore or source writes.
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, createCipheriv, publicEncrypt } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = process.env.MIGRATION_ALIYUN_CLI;
if (!cli) throw new Error('Set MIGRATION_ALIYUN_CLI to the authenticated Alibaba CLI.');
if (readFileSync(`${root}/supabase/.temp/project-ref`, 'utf8').trim() !== 'bupsipicxwyeuxunkvii') throw new Error('Unexpected source project.');
const instance = '84650271fb8845f89c4671a6463510f9';
const args = ['--biz-region-id', 'cn-shanghai', '--region', 'cn-shanghai', '--instance-id', instance];
const call = (operation, more) => JSON.parse(execFileSync(cli, ['swas-open', operation, ...args, ...more], { encoding: 'utf8', maxBuffer: 2e6 }));
const quote = text => `'${text.replaceAll("'", "'\\''")}'`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function result(id) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const i = call('describe-invocation-result', ['--invoke-id', id]).InvocationResult;
    if (i.InvocationStatus === 'Success' && i.ExitCode === 0) return Buffer.from(i.Output || '', 'base64').toString();
    if (i.InvocationStatus !== 'Running' && i.InvocationStatus !== 'Pending' && i.InvocationStatus !== 'Scheduled') throw new Error(`Remote operation ${id} failed; inspect private error files on server.`);
    await sleep(5000);
  }
  throw new Error(`Remote operation ${id} is not complete; check it before retrying.`);
}
const publicKeyRun = call('run-command', ['--name', 'lilly-migration-read-transfer-public-key', '--type', 'RunShellScript', '--timeout', '30', '--command-content', 'test -f /opt/lilly-migration/transfer/private.pem && sed -n "1,30p" /opt/lilly-migration/transfer/public.pem']);
const publicKey = await result(publicKeyRun.InvokeId);
if (!publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) throw new Error('Missing migration transfer public key.');

const scripts = [];
for (const [file, flags] of [['roles.sql', ['--role-only']], ['schema.sql', []], ['data.sql', ['--data-only', '--use-copy']]]) {
  const r = spawnSync('npx', ['--no-install', 'supabase', 'db', 'dump', '--linked', '--dry-run', ...flags], { cwd: root, encoding: 'utf8', timeout: 90000, maxBuffer: 2e6 });
  if (r.status !== 0 || !r.stdout.startsWith('#!/usr/bin/env bash') || !r.stdout.includes('pg_dump')) throw new Error(`Cannot prepare ${file}; raw credentials suppressed.`);
  scripts.push({ file, script: r.stdout });
}
// Each CLI dry run may rotate the same temporary login role's password. Use
// the final connection block for all three scripts, not the superseded ones.
const connection = new Map([...scripts.at(-1).script.matchAll(/^export (PG[A-Z_]+)=([^\n]*)$/gm)].map(match => [match[1], match[0]]));
if (!connection.has('PGPASSWORD') || !connection.has('PGHOST')) throw new Error('Unexpected CLI connection format; export stopped.');
// The source direct endpoint is IPv6-only; this Alibaba host uses IPv4. Use
// the linked project's session pooler, preserving the final temporary password.
const pooler = new URL(readFileSync(`${root}/supabase/.temp/pooler-url`, 'utf8').trim());
if (!pooler.hostname.endsWith('.pooler.supabase.com') || pooler.port !== '5432') throw new Error('Expected session pooler connection.');
let user = connection.get('PGUSER').slice('export PGUSER='.length);
if ((user.startsWith('"') && user.endsWith('"')) || (user.startsWith("'") && user.endsWith("'"))) user = user.slice(1, -1);
if (!/^cli_login_postgres(?:\.bupsipicxwyeuxunkvii)?$/.test(user)) throw new Error('Unexpected temporary export role.');
connection.set('PGHOST', `export PGHOST=${quote(pooler.hostname)}`);
connection.set('PGPORT', "export PGPORT='5432'");
connection.set('PGUSER', "export PGUSER='cli_login_postgres.bupsipicxwyeuxunkvii'");
for (const item of scripts) item.script = item.script.replace(/^export (PG[A-Z_]+)=[^\n]*$/gm, (line, name) => connection.get(name) || line);
const key = randomBytes(32), iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const data = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(scripts)))), cipher.final()]);
const envelope = Buffer.from(JSON.stringify({ key: publicEncrypt({ key: publicKey, oaepHash: 'sha256' }, key).toString('base64'),
  iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') })).toString('base64');
const receiver = String.raw`
const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process');
const e=JSON.parse(Buffer.from(process.argv[1],'base64').toString());
const key=crypto.privateDecrypt({key:fs.readFileSync('/opt/lilly-migration/transfer/private.pem'),oaepHash:'sha256'},Buffer.from(e.key,'base64'));
const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(e.iv,'base64'));d.setAuthTag(Buffer.from(e.tag,'base64'));
const scripts=JSON.parse(require('node:zlib').gunzipSync(Buffer.concat([d.update(Buffer.from(e.data,'base64')),d.final()])).toString());
const image='ghcr.io/supabase/postgres@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00';
if(cp.spawnSync('docker',['image','inspect',image],{stdio:'ignore'}).status!==0)throw Error('Image not downloaded');
const base='/opt/lilly-migration/backups';fs.mkdirSync(base,{recursive:true,mode:448});
const dir=fs.mkdtempSync(base+'/source-'+new Date().toISOString().replace(/[:.]/g,'-')+'-');
const manifest={projectRef:'bupsipicxwyeuxunkvii',createdAt:new Date().toISOString(),status:'incomplete',files:[]};
const save=()=>fs.writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2),{mode:384});save();
for(const item of scripts){if(!['roles.sql','schema.sql','data.sql'].includes(item.file))throw Error('Unexpected filename');
 const target=dir+'/'+item.file,out=fs.openSync(target,'wx',384),err=fs.openSync(target+'.errors','wx',384);
 let r;try{r=cp.spawnSync('docker',['run','--rm','--network','host','--memory','256m','--cpus','0.5','--entrypoint','/bin/bash','-i',image,'-s'],{input:'export PGOPTIONS="-c default_transaction_read_only=on"\nexport PGSSLMODE=require\n'+item.script,stdio:['pipe',out,err],timeout:75000});}finally{fs.closeSync(out);fs.closeSync(err);}
 if(r.status!==0||fs.statSync(target).size===0)throw Error('Backup failed; private directory '+dir);
 manifest.files.push({name:item.file,bytes:fs.statSync(target).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')});save();console.log(item.file+' exported');
}
manifest.status='exported-not-yet-restore-tested';manifest.completedAt=new Date().toISOString();save();console.log('Private backup: '+dir);
`;
new Script(receiver); // Validate remote JavaScript before sending encrypted input.
const command = `node -e ${quote(receiver)} ${quote(envelope)}`;
if (Buffer.byteLength(command) > 16000) throw new Error('Encrypted command exceeds safe Cloud Assistant size; nothing submitted.');
const run = call('run-command', ['--name', 'lilly-migration-sealed-source-backup', '--type', 'RunShellScript', '--timeout', '270', '--command-content', command]);
console.log(`Backup operation: ${run.InvokeId}`);
console.log(await result(run.InvokeId));
