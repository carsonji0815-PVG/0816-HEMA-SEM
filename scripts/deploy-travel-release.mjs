// Bundled by prepare-travel-release.mjs. Run only on the existing production host.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
const payload=JSON.parse(gunzipSync(Buffer.from('__RELEASE_PAYLOAD__','base64')));
const hash=b=>createHash('sha256').update(b).digest('hex');
const run=(command,args)=>execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:45000});
const root='/opt/lilly-verification',dir=path.join(root,payload.version),app='/opt/lilly-meetings';
const current='/var/www/lilly-platform/current',site=`/var/www/lilly-platform/releases/${payload.version}`,moduleDir=`${app}/travel-releases/${payload.version}`;
const dropin='/etc/systemd/system/lilly-meetings.service.d/30-travel-verification.conf';
const baseline=()=>JSON.parse(fs.readFileSync(path.join(dir,'baseline.json'),'utf8'));
const write=(file,content,mode=0o600)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content,{mode});};
if(process.platform!=='linux'||process.getuid()!==0||!fs.existsSync('/opt/lilly-migration/staging/PRODUCTION_ACTIVE'))throw new Error('Existing production host/root required; no database migration is performed.');
async function prepare(){
 if(fs.existsSync(dir))throw new Error('Release already prepared; inspect it rather than overwriting.');
 const old=fs.readFileSync(`${app}/server.js`,'utf8');
 if(hash(old)!==payload.expectedServerHash)throw new Error('Backend changed since inspection; stop before touching production.');
 if(fs.realpathSync(current)!==payload.expectedSite)throw new Error('Frontend changed since inspection.');
 if(fs.existsSync(dropin))throw new Error('Verification service configuration already exists; review before replacement.');
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 write(`${dir}/server.previous.js`,old);
 write(`${dir}/baseline.json`,JSON.stringify({site:fs.realpathSync(current),serverHash:hash(old),preparedAt:new Date().toISOString(),version:payload.version},null,2));
 let changed=old;
 const imports="const { createTrainProvider } = require('./travel-provider');\nconst { createFlightProvider } = require('./flight-provider');";
 const instances='const trainProvider = createTrainProvider(db);\nconst flightProvider = createFlightProvider(db);';
 if(!old.includes(imports)||!old.includes(instances))throw new Error('Unexpected backend integration imports.');
 changed=changed.replace(imports,"const { pathToFileURL } = require('url');").replace(instances,payload.loader);
 const start=changed.indexOf('  const travelRoute ='),end=changed.indexOf('  const projectRoute =',start);
 if(start<0||end<start)throw new Error('Backend integration boundary missing.');
 changed=changed.slice(0,start)+payload.route+changed.slice(end);
 write(`${dir}/server.candidate.js`,changed);run('/snap/bin/node',['--check',`${dir}/server.candidate.js`]);
 const config=JSON.parse(fs.readFileSync('/opt/lilly-migration/staging/compose.functions.json','utf8'));
 const publicKey=config.services['api-gw'].environment.SUPABASE_PUBLISHABLE_KEY;
 if(!publicKey?.startsWith('sb_publishable_'))throw new Error('Production public API key missing.');
 for(const [name,value] of Object.entries(payload.staticFiles)){
   if(name.startsWith('/')||name.split('/').includes('..')||/\.env|\.sql|backup|server\.mjs/.test(name))throw new Error('Unexpected static path');
   let bytes=Buffer.from(value,'base64');
   if(name.endsWith('.html')&&!name.startsWith('luggage/')){
     let html=bytes.toString();
     if(!html.includes('mode: "production"')||!html.includes('https://139.196.97.236/supabase')||!html.includes(publicKey)||!html.includes('data-page="verification"'))throw new Error('Wrong frontend production configuration');
     html=html.replace(/^.*<link[^>]+https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*$/gm,'');bytes=Buffer.from(html);
   }
   write(path.join(site,name),bytes,0o644);
 }
 for(const [name,value] of Object.entries(payload.moduleFiles)){
   if(!/^[a-z-]+\.mjs$/.test(name))throw new Error('Unexpected module path');
   write(path.join(moduleDir,name),Buffer.from(value,'base64'),0o644);run('/snap/bin/node',['--check',path.join(moduleDir,name)]);
 }
 // The database remains live. SQLite online backup is consistent without a stop or restore.
 const require=createRequire(`${app}/package.json`),Database=require('better-sqlite3');
 const db=new Database(`${app}/data/lilly-meetings.db`,{readonly:true});
 await db.backup(`${dir}/documents-before.sqlite`);db.close();
 fs.chmodSync(`${dir}/documents-before.sqlite`,0o600);
 write(`${dir}/PREPARED`,JSON.stringify({candidateHash:hash(changed),site,moduleDir,at:new Date().toISOString()}));
 console.log(JSON.stringify({prepared:true,version:payload.version,productionChanged:false,sqliteBackup:true}));
}
async function request(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});const text=await r.text();let data;try{data=JSON.parse(text);}catch{}return {status:r.status,ok:r.ok,text,data};}
async function verify(){
 const checks=[];const check=(name,passed)=>checks.push({name,passed:!!passed});
 check('service active',run('systemctl',['is-active','lilly-meetings']).trim()==='active');
 const front=await request('https://139.196.97.236/meeting/');
 check('published verification page',front.ok&&front.text.includes('data-page="verification"')&&front.text.includes('https://139.196.97.236/supabase'));
 for(const file of ['app.js','travel-verification.js','travel-verification-panel.js','travel-verification-storage.js']){
  const r=await request(`https://139.196.97.236/meeting/${file}`);check(file,r.ok&&hash(r.text)===hash(Buffer.from(payload.staticFiles[file],'base64')));
 }
 const c=JSON.parse(fs.readFileSync('/opt/lilly-migration/staging/compose.functions.json','utf8')),env=c.services['api-gw'].environment;
 const base='http://127.0.0.1:18000',service={apikey:env.SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SERVICE_ROLE_KEY}`};
 const projects=await request(`${base}/rest/v1/meetings?select=id,owner_user_id`,{headers:service});
 if(!Array.isArray(projects.data)||!projects.data.length)throw new Error('Cannot verify existing project access');
 const project=projects.data.find(p=>p.owner_user_id);if(!project)throw new Error('Project owner unavailable');
 const user=await request(`${base}/auth/v1/admin/users/${project.owner_user_id}`,{headers:service});
 if(!user.ok||user.data?.id!==project.owner_user_id)throw new Error('Existing operator identity check failed');
 // Short-lived diagnostic token, never output or persisted. Read-only authorization checks.
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
 const signed=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.data.id,email:user.data.email,role:'authenticated',aud:'authenticated',iss:'https://139.196.97.236/supabase/auth/v1',iat:now,exp:now+120})}`;
 const token=`${signed}.${createHmac('sha256',c.services.auth.environment.GOTRUE_JWT_SECRET).update(signed).digest('base64url')}`;
 const headers={apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`};
 const url=`https://139.196.97.236/api/integrated/projects/${project.id}/travel`;
 const status=await request(url+'/status',{headers});
 check('authorized status v2',status.ok&&status.data?.version===2);
 check('rail enabled',status.data?.train?.configured===true);
 check('flight charged queries disabled',status.data?.flight?.configured===false);
 const anonymous=await request(url+'/status');check('anonymous denied',[401,403].includes(anonymous.status));
 const invalid=await request(url+'/verify',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{"journeys":[],"allowPaid":false}'});check('invalid input denied before provider call',invalid.status===400);
 const roster=await request(`${base}/rest/v1/attendees?select=id&limit=1`,{headers});check('existing roster readable',roster.ok&&Array.isArray(roster.data));
 const hidden=await request(`${base}/rest/v1/attendees?select=id&limit=1`,{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY}});check('anonymous roster isolation',hidden.ok&&Array.isArray(hidden.data)&&hidden.data.length===0);
 const docs=await request(`https://139.196.97.236/api/integrated/projects/${project.id}/documents`,{headers});check('existing project documents',docs.ok);
 const report={version:payload.version,at:new Date().toISOString(),allPassed:checks.every(c=>c.passed),checks,paidQueries:0,rosterWrites:0};
 write(`${dir}/validation.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(!report.allPassed)throw new Error('Post-deploy verification failed');
}
function switchSite(target){const link=`${current}.travel-next`;if(fs.existsSync(link))throw new Error('Pending release link already exists');fs.symlinkSync(target,link);fs.renameSync(link,current);}
function restore(){
 const before=baseline();fs.copyFileSync(`${dir}/server.previous.js`,`${app}/server.js`);fs.chmodSync(`${app}/server.js`,0o644);
 if(fs.existsSync(dropin))fs.unlinkSync(dropin);switchSite(before.site);run('systemctl',['daemon-reload']);run('systemctl',['restart','lilly-meetings']);
 write(`${dir}/ROLLED_BACK`,new Date().toISOString());console.log('Code rollback complete. No database restore or data deletion.');
}
async function activate(){
 const before=baseline();if(!fs.existsSync(`${dir}/PREPARED`)||fs.existsSync(`${dir}/ACTIVE`))throw new Error('Release is not in a prepared inactive state');
 if(hash(fs.readFileSync(`${app}/server.js`))!==before.serverHash||fs.realpathSync(current)!==before.site)throw new Error('Production changed after preparation');
 if(fs.existsSync(dropin))throw new Error('Unexpected existing drop-in');
 try{
  const temp=`${app}/server.travel-next.js`;fs.copyFileSync(`${dir}/server.candidate.js`,temp);fs.chmodSync(temp,0o644);fs.renameSync(temp,`${app}/server.js`);
  write(dropin,`[Service]\nEnvironment=TRAVEL_VERIFICATION_MODULE=${moduleDir}/index.mjs\nEnvironment=VARIFLIGHT_ENABLED=false\nEnvironment=VARIFLIGHT_DAILY_LIMIT=5\nEnvironment=RAIL_12306_ENABLED=true\n`,0o644);
  run('systemctl',['daemon-reload']);run('systemctl',['restart','lilly-meetings']);
  // systemd active precedes Node's listen event; wait for the existing service's HTTP readiness.
  for(let attempt=0;attempt<20;attempt++){
    try{const health=await fetch('http://127.0.0.1:8787/',{signal:AbortSignal.timeout(1000)});if(health.ok){await health.arrayBuffer();break;}}catch{}
    if(attempt===19)throw new Error('Backend did not become ready');
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  switchSite(site);await verify();write(`${dir}/ACTIVE`,new Date().toISOString());
  console.log('RELEASE_ACTIVE '+payload.version);
 }catch(error){restore();throw error;}
}
const action=process.argv[2];
try{if(action==='prepare')await prepare();else if(action==='activate')await activate();else if(action==='verify')await verify();else throw new Error('Use prepare, activate or verify');}
catch(error){console.error('Release stopped: '+error.message);process.exitCode=1;}
