// Local demo only. Production pages retain their existing account authentication.
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../.site-build/',import.meta.url))
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(file!==path.resolve(root)&&!file.startsWith(root)){res.writeHead(403).end();return}
 if((await stat(file)).isDirectory())file=path.join(file,'index.html');
 let body=await readFile(file);if(file.endsWith('.html')&&!file.includes('/luggage/'))body=Buffer.from(body.toString().replace('mode: "production"','mode: "demo"'));
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(body)
}catch{res.writeHead(404).end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('Integrated local demo: http://127.0.0.1:4173/#settings'))
