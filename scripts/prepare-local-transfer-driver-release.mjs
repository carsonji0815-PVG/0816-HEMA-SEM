import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
execFileSync(process.execPath,['scripts/build-site.mjs'],{cwd:root,stdio:'inherit'});
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'local-transfer-driver-'));
fs.cpSync(path.join(root,'.site-build'),path.join(stage,'site'),{recursive:true});
fs.copyFileSync(path.join(root,'supabase/functions/public-trip-query/index.ts'),path.join(stage,'public-trip-query.ts'));
fs.writeFileSync(path.join(stage,'migration.sql'),[
  fs.readFileSync(path.join(root,'supabase/migrations/2026090501_local_transfer_driver_fields.sql'),'utf8'),
  fs.readFileSync(path.join(root,'supabase/migrations/2026090502_meeting_location_catalog.sql'),'utf8'),
  fs.readFileSync(path.join(root,'supabase/migrations/2026090503_ticket_cta_workflow.sql'),'utf8'),
  fs.readFileSync(path.join(root,'supabase/migrations/2026090504_privacy_storage_staff_access.sql'),'utf8'),
  fs.readFileSync(path.join(root,'supabase/migrations/2026090505_xian_xianyang_t5_station.sql'),'utf8'),
  fs.readFileSync(path.join(root,'supabase/migrations/2026090506_guangzhou_baiyun_t3_station.sql'),'utf8'),
  fs.readFileSync(path.join(root,'supabase/migrations/2026090507_dictionary_sync_tracking.sql'),'utf8'),
  fs.readFileSync(path.join(root,'supabase/migrations/2026090508_terminal_name_canonical_cleanup.sql'),'utf8'),
  fs.readFileSync(path.join(root,'supabase/migrations/2026090509_unconfigured_region_quota_passthrough.sql'),'utf8'),
  fs.readFileSync(path.join(root,'supabase/migrations/2026090510_admin_realtime_refresh.sql'),'utf8'),
  fs.readFileSync(path.join(root,'supabase/migrations/2026090511_meeting_live_revision.sql'),'utf8'),
].join('\n\n'));
fs.copyFileSync(path.join(root,'scripts/sync-station-dictionaries.mjs'),path.join(stage,'sync-station-dictionaries.mjs'));
fs.copyFileSync(path.join(root,'scripts/deploy-local-transfer-driver-release.mjs'),path.join(stage,'deploy.mjs'));
const staticHashes={};
const walk=(dir,base='')=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const name=path.posix.join(base,entry.name);if(entry.isDirectory())walk(path.join(dir,entry.name),name);else staticHashes[name]=hash(fs.readFileSync(path.join(dir,entry.name)));}};
walk(path.join(stage,'site'));
const manifest={staticHashes,edgeHash:hash(fs.readFileSync(path.join(stage,'public-trip-query.ts'))),migrationHash:hash(fs.readFileSync(path.join(stage,'migration.sql'))),syncHash:hash(fs.readFileSync(path.join(stage,'sync-station-dictionaries.mjs'))),deployHash:hash(fs.readFileSync(path.join(stage,'deploy.mjs')))};
manifest.version=`local-transfer-driver-20260905-${hash(JSON.stringify(manifest)).slice(0,12)}`;
fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify(manifest,null,2));
const output=path.join(root,'.tmp',`${manifest.version}.tar.gz`);
fs.mkdirSync(path.dirname(output),{recursive:true});
execFileSync('tar',['-czf',output,'-C',stage,'.']);
console.log(JSON.stringify({version:manifest.version,file:output,sha256:hash(fs.readFileSync(output)),bytes:fs.statSync(output).size},null,2));
