// Runs only from a prepared bundle on the existing Alibaba production host.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const bundle=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json'),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const run=(command,args,options={})=>execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000,...options});
const marker='/opt/lilly-migration/staging/PRODUCTION_ACTIVE';
const current='/var/www/lilly-platform/current';
const expectedSite='/var/www/lilly-platform/releases/travel-20260831-761cc510ee01';
const edge='/opt/lilly-migration/staging/volumes/functions/public-trip-query/handler.ts';
const expectedEdge='5867092dfccb134b4b8fbddc28e8c3cbbed9be630852863187a77f2e265a318b';
const releaseRoot=`/opt/lilly-field-release/${manifest.version}`;
const site=`/var/www/lilly-platform/releases/${manifest.version}`;
const backup=path.join(releaseRoot,'before');
const result={version:manifest.version,checks:[],databaseWrites:'schema-and-backfill-only',attendeeAuditNotifications:0};
const check=(name,passed)=>{result.checks.push({name,passed:!!passed});if(!passed)throw new Error(`Check failed: ${name}`);};
const switchSite=target=>{const next=`${current}.journey-next`;if(fs.existsSync(next))fs.unlinkSync(next);fs.symlinkSync(target,next);fs.renameSync(next,current);};
if(process.platform!=='linux'||process.getuid()!==0||!fs.existsSync(marker))throw new Error('Confirmed Alibaba production host/root required');
if(fs.existsSync(releaseRoot))throw new Error('This immutable release was already prepared');
check('known frontend baseline',fs.realpathSync(current)===expectedSite);
check('known Edge baseline',fs.existsSync(edge)&&hash(fs.readFileSync(edge))===expectedEdge);
check('journey columns absent before migration',run('docker',['exec','lilly-stage-db','psql','-U','postgres','-d','postgres','-Atc',"select count(*) from information_schema.columns where table_schema='public' and table_name='attendees' and column_name='depart_date'"]).trim()==='0');
fs.mkdirSync(backup,{recursive:true,mode:0o700});
fs.copyFileSync(edge,path.join(backup,'public-trip-query.ts'));
fs.writeFileSync(path.join(backup,'frontend-target.txt'),expectedSite,{mode:0o600});
// The installed backup job creates an encrypted offsite PostgreSQL/object snapshot.
run('systemctl',['start','lilly-platform-backup.service']);
check('pre-release encrypted backup',run('systemctl',['show','lilly-platform-backup.service','--property=Result','--value']).trim()==='success');
fs.mkdirSync(site,{recursive:true,mode:0o755});
for(const [name,expected] of Object.entries(manifest.staticHashes)){
  const source=path.join(bundle,'site',name),target=path.join(site,name);
  if(!source.startsWith(path.join(bundle,'site')+path.sep)||!fs.existsSync(source)||hash(fs.readFileSync(source))!==expected)throw new Error(`Static bundle mismatch: ${name}`);
  fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o755});fs.copyFileSync(source,target);fs.chmodSync(target,0o644);
}
const migration=fs.readFileSync(path.join(bundle,'migration.sql'),'utf8');
// Compile and execute all DDL/backfill in a rolled-back transaction first.
run('docker',['exec','-i','lilly-stage-db','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:`begin;\n${migration}\nrollback;\n`,stdio:['pipe','pipe','pipe']});
run('docker',['exec','-i','lilly-stage-db','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:`begin;\n${migration}\ncommit;\n`,stdio:['pipe','pipe','pipe']});
check('eight canonical journey columns',run('docker',['exec','lilly-stage-db','psql','-U','postgres','-d','postgres','-Atc',"select count(*) from information_schema.columns where table_schema='public' and table_name='attendees' and column_name in ('depart_date','depart_city','depart_transport_type','depart_station','arrive_date','arrive_city','arrive_transport_type','arrive_station')"]).trim()==='8');
check('local station invariant',run('docker',['exec','lilly-stage-db','psql','-U','postgres','-d','postgres','-Atc',"select count(*) from public.attendees where (depart_transport_type='LOCAL_ATTEND' and depart_station is not null) or (arrive_transport_type='LOCAL_ATTEND' and arrive_station is not null)"]).trim()==='0');
const candidate=fs.readFileSync(path.join(bundle,'public-trip-query.ts'));
check('Edge bundle hash',hash(candidate)===manifest.edgeHash);
try{
  const next=`${edge}.journey-next`;fs.writeFileSync(next,candidate,{mode:0o644});fs.renameSync(next,edge);
  run('docker',['restart','lilly-stage-functions']);
  // Runtime must stay healthy before the frontend starts requiring the new fields.
  for(let attempt=0;attempt<30;attempt++){
    const state=run('docker',['inspect','-f','{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}','lilly-stage-functions']).trim();
    if(/^running (healthy)?$/.test(state)){if(state.includes('healthy')||attempt>4)break;}
    if(attempt===29)throw new Error('Edge runtime did not become ready');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);
  }
  switchSite(site);
  const front=await fetch('https://139.196.97.236/meeting/',{signal:AbortSignal.timeout(15000)});const html=await front.text();
  check('new frontend active',front.ok&&html.includes('travel-fields.js')&&html.includes('departTransportType'));
  for(const name of ['app.js','travel-fields.js','travel-verification.js']){
    const response=await fetch(`https://139.196.97.236/meeting/${name}`,{signal:AbortSignal.timeout(15000)});const bytes=Buffer.from(await response.arrayBuffer());
    check(`published ${name}`,response.ok&&hash(bytes)===manifest.staticHashes[name]);
  }
  const configuration=JSON.parse(fs.readFileSync('/opt/lilly-migration/staging/compose.functions.json','utf8'));const publicKey=configuration.services['api-gw'].environment.SUPABASE_PUBLISHABLE_KEY;
  const api=await fetch('https://139.196.97.236/supabase/functions/v1/public-trip-query',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:'{"action":"list-projects"}',signal:AbortSignal.timeout(20000)});
  const body=await api.json();check('public registration Edge function',api.ok&&Array.isArray(body.projects));
  fs.writeFileSync(path.join(releaseRoot,'ACTIVE'),new Date().toISOString(),{mode:0o600});
  result.allPassed=true;result.site=site;result.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(releaseRoot,'validation.json'),JSON.stringify(result,null,2),{mode:0o600});
  console.log(JSON.stringify(result));
}catch(error){
  fs.copyFileSync(path.join(backup,'public-trip-query.ts'),edge);run('docker',['restart','lilly-stage-functions']);switchSite(expectedSite);
  fs.writeFileSync(path.join(releaseRoot,'ROLLED_BACK'),String(error?.message||error),{mode:0o600});throw error;
}
