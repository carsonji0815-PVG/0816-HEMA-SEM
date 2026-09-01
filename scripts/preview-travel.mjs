import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../.site-build/',import.meta.url));
const port=Number(process.env.TRAVEL_PREVIEW_PORT||4340);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root.endsWith(sep)?root:root+sep))throw new Error();
  let body=await readFile(file);
  if(extname(file)==='.html')body=Buffer.from(body.toString().replace('mode: "production"','mode: "demo"'));
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`行程管理工具 · 本地演示预览 http://127.0.0.1:${port}/#verification（仅示例数据，不连接正式名单）`));
