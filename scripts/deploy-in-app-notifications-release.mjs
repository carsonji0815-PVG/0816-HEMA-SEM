import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bundle=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json'),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const run=(command,args,options={})=>execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000,...options});
const marker='/opt/lilly-migration/staging/PRODUCTION_ACTIVE';
const current='/var/www/lilly-platform/current';
const edge='/opt/lilly-migration/staging/volumes/functions/public-trip-query/handler.ts';
const releaseRoot=`/opt/lilly-security-release/${manifest.version}`;
const site=`/var/www/lilly-platform/releases/${manifest.version}`;
const result={version:manifest.version,checks:[]};
const check=(name,passed)=>{result.checks.push({name,passed:!!passed});if(!passed)throw new Error(`Check failed: ${name}`);};
const switchSite=target=>{const next=`${current}.notifications-next`;if(fs.existsSync(next))fs.unlinkSync(next);fs.symlinkSync(target,next);fs.renameSync(next,current);};
if(process.platform!=='linux'||process.getuid()!==0||!fs.existsSync(marker))throw new Error('Confirmed Alibaba production host/root required');
if(fs.existsSync(releaseRoot))throw new Error('Immutable release already exists');
const previous=fs.realpathSync(current);
const backup=path.join(releaseRoot,'before');
fs.mkdirSync(backup,{recursive:true,mode:0o700});
fs.copyFileSync(edge,path.join(backup,'public-trip-query.ts'));
fs.writeFileSync(path.join(backup,'frontend-target.txt'),previous,{mode:0o600});
run('systemctl',['start','lilly-platform-backup.service']);
check('pre-release encrypted backup',run('systemctl',['show','lilly-platform-backup.service','--property=Result','--value']).trim()==='success');
fs.mkdirSync(site,{recursive:true,mode:0o755});
for(const [name,expected] of Object.entries(manifest.staticHashes)){
  const source=path.join(bundle,'site',name),target=path.join(site,name);
  if(!source.startsWith(path.join(bundle,'site')+path.sep)||hash(fs.readFileSync(source))!==expected)throw new Error(`Static hash mismatch: ${name}`);
  fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o755});
  fs.copyFileSync(source,target);fs.chmodSync(target,0o644);
}
const candidate=fs.readFileSync(path.join(bundle,'public-trip-query.ts'));
check('Edge bundle hash',hash(candidate)===manifest.edgeHash);
try{
  const next=`${edge}.notifications-next`;
  fs.writeFileSync(next,candidate,{mode:0o644});
  fs.renameSync(next,edge);
  run('docker',['restart','lilly-stage-functions']);
  for(let attempt=0;attempt<30;attempt++){
    const state=run('docker',['inspect','-f','{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}','lilly-stage-functions']).trim();
    if(state.startsWith('running')&&(state.includes('healthy')||attempt>4))break;
    if(attempt===29)throw new Error('Edge runtime did not become ready');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);
  }
  switchSite(site);
  for(const name of ['app.js','index.html','styles.css']){
    const response=await fetch(`https://139.196.97.236/meeting/${name}`,{signal:AbortSignal.timeout(15000)});
    const bytes=Buffer.from(await response.arrayBuffer());
    check(`published ${name}`,response.ok&&hash(bytes)===manifest.staticHashes[name]);
  }
  const config=JSON.parse(fs.readFileSync('/opt/lilly-migration/staging/compose.functions.json','utf8'));
  const key=config.services['api-gw'].environment.SUPABASE_PUBLISHABLE_KEY;
  const api=await fetch('https://139.196.97.236/supabase/functions/v1/public-trip-query',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{"action":"list-projects"}',signal:AbortSignal.timeout(20000)});
  const body=await api.json();
  check('public registration API',api.ok&&Array.isArray(body.projects));
  const liveEdge=fs.readFileSync(edge);
  check('in-app notifications only',hash(liveEdge)===manifest.edgeHash&&!liveEdge.includes(Buffer.from('notification_email_outbox").insert')));
  fs.writeFileSync(path.join(releaseRoot,'ACTIVE'),new Date().toISOString(),{mode:0o600});
  result.allPassed=true;result.previous=previous;result.site=site;result.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(releaseRoot,'validation.json'),JSON.stringify(result,null,2),{mode:0o600});
  console.log(JSON.stringify(result));
}catch(error){
  fs.copyFileSync(path.join(backup,'public-trip-query.ts'),edge);
  run('docker',['restart','lilly-stage-functions']);
  switchSite(previous);
  fs.writeFileSync(path.join(releaseRoot,'ROLLED_BACK'),String(error?.message||error),{mode:0o600});
  throw error;
}
