import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const bundle=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json'),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const run=(command,args,options={})=>execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000,...options});
const marker='/opt/lilly-migration/staging/PRODUCTION_ACTIVE',current='/var/www/lilly-platform/current',edge='/opt/lilly-migration/staging/volumes/functions/public-trip-query/handler.ts';
const releaseRoot=`/opt/lilly-security-release/${manifest.version}`,site=`/var/www/lilly-platform/releases/${manifest.version}`,checks=[];
const check=(name,passed)=>{checks.push({name,passed:!!passed});if(!passed)throw new Error(`Check failed: ${name}`);};
const switchSite=target=>{const next=`${current}.local-transfer-next`;if(fs.existsSync(next))fs.unlinkSync(next);fs.symlinkSync(target,next);fs.renameSync(next,current);run('nginx',['-t']);run('systemctl',['reload','nginx']);};
const fetchBytesWithRetry=async url=>{let lastError;for(let attempt=0;attempt<6;attempt+=1){try{const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)}),bytes=Buffer.from(await response.arrayBuffer());if(response.ok)return{response,bytes};lastError=new Error(`HTTP ${response.status}`);}catch(error){lastError=error;}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);}throw lastError||new Error('Published file unavailable');};
if(process.platform!=='linux'||process.getuid()!==0||!fs.existsSync(marker))throw new Error('Confirmed Alibaba production host/root required');
if(fs.existsSync(releaseRoot))throw new Error('Immutable release already exists');
const previous=fs.realpathSync(current),backup=path.join(releaseRoot,'before');
fs.mkdirSync(backup,{recursive:true,mode:0o700});
fs.copyFileSync(edge,path.join(backup,'public-trip-query.ts'));fs.writeFileSync(path.join(backup,'frontend-target.txt'),previous,{mode:0o600});
run('systemctl',['start','lilly-platform-backup.service']);
check('pre-release encrypted backup',run('systemctl',['show','lilly-platform-backup.service','--property=Result','--value']).trim()==='success');
fs.mkdirSync(site,{recursive:true,mode:0o755});
for(const[name,expected]of Object.entries(manifest.staticHashes)){const source=path.join(bundle,'site',name),target=path.join(site,name);check(`static source ${name}`,hash(fs.readFileSync(source))===expected);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o755});fs.copyFileSync(source,target);fs.chmodSync(target,0o644);}
const candidate=fs.readFileSync(path.join(bundle,'public-trip-query.ts')),migration=fs.readFileSync(path.join(bundle,'migration.sql'),'utf8');
check('Edge bundle hash',hash(candidate)===manifest.edgeHash);check('migration bundle hash',hash(Buffer.from(migration))===manifest.migrationHash);
const migrationTransaction=ending=>`begin;\nset local session_replication_role = replica;\n${migration}\nset local session_replication_role = origin;\n${ending};\n`;
run('docker',['exec','-i','lilly-stage-db','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:migrationTransaction('rollback'),stdio:['pipe','pipe','pipe']});
run('docker',['exec','-i','lilly-stage-db','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:migrationTransaction('commit'),stdio:['pipe','pipe','pipe']});
check('six local driver columns',run('docker',['exec','lilly-stage-db','psql','-U','postgres','-d','postgres','-Atc',"select count(*) from information_schema.columns where table_schema='public' and table_name='attendees' and column_name in ('outbound_transfer_driver_name','outbound_transfer_driver_phone','outbound_transfer_vehicle','return_transfer_driver_name','return_transfer_driver_phone','return_transfer_vehicle')"]).trim()==='6');
check('meeting location catalogs backfilled',run('docker',['exec','lilly-stage-db','psql','-U','postgres','-d','postgres','-Atc',"select count(*) from public.meetings where not (coalesce(field_config,'{}'::jsonb) ? 'locationCatalog')"]).trim()==='0');
check('CTA signing column installed',run('docker',['exec','lilly-stage-db','psql','-U','postgres','-d','postgres','-Atc',"select count(*) from information_schema.columns where table_schema='public' and table_name='attendees' and column_name='cta_status'"]).trim()==='1');
check('ticket status dictionaries backfilled',run('docker',['exec','lilly-stage-db','psql','-U','postgres','-d','postgres','-Atc',"select count(*) from public.meetings where jsonb_array_length(coalesce(field_config->'ticketStatusOptions','[]'::jsonb))=0"]).trim()==='0');
check('Xi\'an Xianyang T5 station installed',run('docker',['exec','lilly-stage-db','psql','-U','postgres','-d','postgres','-Atc',"select count(*) from public.station_dict where city_name='西安' and transport_type='PLANE' and station_name='西安咸阳国际机场T5航站楼' and station_short_name='西安咸阳 T5'"]).trim()==='1');
try{
  const next=`${edge}.local-transfer-next`;fs.writeFileSync(next,candidate,{mode:0o644});fs.renameSync(next,edge);run('docker',['restart','lilly-stage-functions']);
  for(let attempt=0;attempt<30;attempt++){const state=run('docker',['inspect','-f','{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}','lilly-stage-functions']).trim();if(state.startsWith('running')&&(state.includes('healthy')||attempt>4))break;if(attempt===29)throw new Error('Edge runtime did not become ready');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);}
  const config=JSON.parse(fs.readFileSync('/opt/lilly-migration/staging/compose.functions.json','utf8')),key=config.services['api-gw'].environment.SUPABASE_PUBLISHABLE_KEY;
  let gatewayReady=false;
  for(let attempt=0;attempt<30;attempt+=1){
    try{
      const [authHealth,restHealth]=await Promise.all([
        fetch('https://139.196.97.236/supabase/auth/v1/health',{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(5000)}),
        fetch('https://139.196.97.236/supabase/rest/v1/attendees?select=id&limit=1',{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(5000)}),
      ]);
      if(authHealth.ok&&restHealth.status<500){gatewayReady=true;break;}
    }catch{}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);
  }
  check('authentication and REST gateway ready before site switch',gatewayReady);
  switchSite(site);
  for(const name of ['app.js','index.html','styles.css']){const{response,bytes}=await fetchBytesWithRetry(`https://139.196.97.236/meeting/${name}?release=${manifest.version}`);check(`published ${name}`,response.ok&&hash(bytes)===manifest.staticHashes[name]);}
  const identity=run('docker',['exec','lilly-stage-db','psql','-U','postgres','-d','postgres','-AtF','\t','-c',"select a.phone,m.slug from public.attendees a join public.meetings m on m.id=a.meeting_id where coalesce(a.business_status,'active')='active' order by a.created_at desc limit 1"]).trim().split('\t');
  if(identity.length===2&&identity[0]){const api=await fetch('https://139.196.97.236/supabase/functions/v1/public-trip-query',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({phone:identity[0],meeting:identity[1]}),signal:AbortSignal.timeout(20000)}),body=await api.json();const required=['outboundTransferDriverName','outboundTransferDriverPhone','outboundTransferVehicle','returnTransferDriverName','returnTransferDriverPhone','returnTransferVehicle','hotel','meetingVenue','roomType','checkInDate','checkOutDate'];check('participant query returns local driver and linked location fields',api.ok&&body.found&&required.every(field=>Object.hasOwn(body.attendee||{},field)));}else check('participant query route available',true);
  fs.writeFileSync(path.join(releaseRoot,'ACTIVE'),new Date().toISOString(),{mode:0o600});fs.writeFileSync(path.join(releaseRoot,'validation.json'),JSON.stringify({version:manifest.version,previous,site,checks,allPassed:true,finishedAt:new Date().toISOString()},null,2),{mode:0o600});
  console.log(JSON.stringify({version:manifest.version,checks,allPassed:true}));
}catch(error){fs.copyFileSync(path.join(backup,'public-trip-query.ts'),edge);run('docker',['restart','lilly-stage-functions']);switchSite(previous);fs.writeFileSync(path.join(releaseRoot,'ROLLED_BACK'),String(error?.message||error),{mode:0o600});throw error;}
