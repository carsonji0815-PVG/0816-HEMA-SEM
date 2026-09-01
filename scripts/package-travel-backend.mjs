import {cp,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const destination=resolve(process.argv[2]||resolve(root,'.tmp/travel-backend'));
await mkdir(destination,{recursive:true});
await cp(resolve(root,'modules/travel-verification/server'),resolve(destination,'travel-verification'),{recursive:true});
await writeFile(resolve(destination,'README.txt'),'行程管理工具 · 核验后端模块\n设置 TRAVEL_VERIFICATION_MODULE 为 travel-verification/index.mjs 的绝对路径。\n仅包含适配代码；不含账户密钥、参会名单、运行数据。服务器需安装兼容的集成接口。\n');
console.log('核验服务模块已打包（不含密钥及名单）：'+destination);
