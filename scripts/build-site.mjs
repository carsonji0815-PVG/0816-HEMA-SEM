import { cp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root=fileURLToPath(new URL('../',import.meta.url)), out=path.join(root,'.site-build')
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true})
for(const file of ['index.html','会议行程管理系统.html','app.js','styles.css','luggage-integration.js','assets','luggage']) await cp(path.join(root,file),path.join(out,file),{recursive:true})
await writeFile(path.join(out,'.nojekyll'),'')
async function walk(dir='') {const files=[];for(const e of await readdir(path.join(out,dir),{withFileTypes:true})){const f=path.posix.join(dir,e.name);if(e.isDirectory())files.push(...await walk(f));else files.push(f)}return files}
const files=(await walk()).filter(f=>f!=='.nojekyll')
const hash=createHash('sha256');for(const f of files.sort())hash.update(await readFile(path.join(out,f)))
const version=hash.digest('hex').slice(0,16)
await writeFile(path.join(out,'journey-sw.js'),`
const PREFIX='journey-shell-'+new URL(self.registration.scope).pathname;
const CACHE=PREFIX+'${version}';
const FILES=${JSON.stringify(files)};
const URLS=FILES.map(f=>new URL(f,self.registration.scope).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(URLS))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url),scope=new URL(self.registration.scope);
 if(r.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname))return;
 // Only static application files. Never cache Supabase/auth/document APIs or roster responses.
 const clean=new URL(u.pathname,u.origin).href;
 const isRoot=u.pathname===scope.pathname||u.pathname===scope.pathname+'index.html'||u.pathname===scope.pathname+'会议行程管理系统.html';
 if(!URLS.includes(clean)&&!isRoot)return;
 const key=isRoot?new URL('index.html',scope).href:clean;
 e.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   if(r.mode!=='navigate' && u.pathname.includes('/luggage/assets/'))return (await cache.match(key))||fetch(r);
   try {const response=await fetch(r,{signal:AbortSignal.timeout(3500)});if(response.ok)return response;throw new Error('offline')} catch {return (await cache.match(key))||Response.error()}
 })());
});`)
console.log(`Site ready: ${files.length} static files; no source, SQL or node_modules published`)
