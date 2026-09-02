// Secure one-time Variflight credential installer for the existing Alibaba host.
// Reads the key from stdin, encrypts it to the server's existing RSA public key,
// and never prints or persists the plaintext on this Mac.
import {execFileSync} from "node:child_process";
import {publicEncrypt} from "node:crypto";

const cli=process.env.MIGRATION_ALIYUN_CLI;
if(!cli)throw new Error("MIGRATION_ALIYUN_CLI is required");
const key=(await new Promise((resolve,reject)=>{const chunks=[];process.stdin.on("data",chunk=>chunks.push(chunk));process.stdin.on("end",()=>resolve(Buffer.concat(chunks).toString().trim()));process.stdin.on("error",reject);}));
if(!/^[\x21-\x7e]{12,512}$/.test(key))throw new Error("密钥格式无效：仅接受12至512位、无空格的可见字符");
const base=["--profile","DocPodDeploy","--biz-region-id","cn-shanghai","--region","cn-shanghai","--instance-id","84650271fb8845f89c4671a6463510f9"];
const call=(operation,args)=>JSON.parse(execFileSync(cli,["swas-open",operation,...base,...args],{encoding:"utf8",maxBuffer:2e6}));
const wait=async invokeId=>{for(let i=0;i<40;i++){const item=call("describe-invocation-result",["--invoke-id",invokeId]).InvocationResult;if(item.InvocationStatus==="Success"&&item.ExitCode===0)return Buffer.from(item.Output||"","base64").toString();if(!["Running","Pending","Scheduled"].includes(item.InvocationStatus))throw new Error("服务器安全配置操作失败");await new Promise(resolve=>setTimeout(resolve,1500));}throw new Error("服务器安全配置操作超时");};
const quote=value=>`'${String(value).replaceAll("'","'\\''")}'`;
const publicKeyRun=call("run-command",["--name","read-variflight-transfer-public-key","--type","RunShellScript","--timeout","30","--command-content","test -f /opt/lilly-migration/transfer/private.pem && sed -n '1,30p' /opt/lilly-migration/transfer/public.pem"]);
const publicKey=await wait(publicKeyRun.InvokeId);
if(!publicKey.startsWith("-----BEGIN PUBLIC KEY-----"))throw new Error("服务器安全传输公钥不可用");
const encrypted=publicEncrypt({key:publicKey,oaepHash:"sha256"},Buffer.from(key)).toString("base64");
const receiver=String.raw`
const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process'),{pathToFileURL}=require('node:url');
(async()=>{const secret=crypto.privateDecrypt({key:fs.readFileSync('/opt/lilly-migration/transfer/private.pem'),oaepHash:'sha256'},Buffer.from(process.argv[1],'base64')).toString();
if(!/^[\x21-\x7e]{12,512}$/.test(secret))throw Error('密钥格式无效');
const conf=fs.readFileSync('/etc/systemd/system/lilly-meetings.service.d/30-travel-verification.conf','utf8');const match=conf.match(/TRAVEL_VERIFICATION_MODULE=([^\n]+)/);if(!match)throw Error('飞常准适配器路径不存在');
const modulePath=match[1].trim().replace(/index\.mjs$/,'variflight.mjs');const provider=await import(pathToFileURL(modulePath));const probe=await provider.probeVariflight(secret);
fs.mkdirSync('/etc/lilly-meetings',{recursive:true,mode:448});const temp='/etc/lilly-meetings/.variflight.env.next';fs.writeFileSync(temp,'VARIFLIGHT_API_KEY='+secret+'\n',{mode:384});fs.renameSync(temp,'/etc/lilly-meetings/variflight.env');fs.chmodSync('/etc/lilly-meetings/variflight.env',384);
fs.writeFileSync('/etc/systemd/system/lilly-meetings.service.d/40-variflight-secret.conf','[Service]\nEnvironmentFile=/etc/lilly-meetings/variflight.env\nEnvironment=VARIFLIGHT_ENABLED=true\n',{mode:420});
cp.execFileSync('systemctl',['daemon-reload']);cp.execFileSync('systemctl',['restart','lilly-meetings']);console.log(JSON.stringify({configured:true,accountProbe:probe.ok===true,service:cp.execFileSync('systemctl',['is-active','lilly-meetings'],{encoding:'utf8'}).trim()}));})().catch(error=>{console.error(error.message);process.exitCode=1});`;
const command=`node -e ${quote(receiver)} ${quote(encrypted)}`;
const install=call("run-command",["--name","configure-variflight-secret","--type","RunShellScript","--timeout","90","--command-content",command]);
console.log(await wait(install.InvokeId));
