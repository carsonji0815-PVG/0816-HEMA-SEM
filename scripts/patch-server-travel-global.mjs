import {readFileSync,writeFileSync} from "node:fs";

const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error("usage: patch-server-travel-global.mjs <input> <output>");
let source=readFileSync(input,"utf8");
const before="return { flightUnlimited: settings.variflightUnlimited === true, flightDailyLimit: Math.max(1, Math.min(10000, Math.trunc(Number(settings.variflightDailyLimit) || 5))) };";
const after="return { flightGlobalEnabled: settings.variflightGlobalEnabled === true, flightUnlimited: settings.variflightUnlimited === true, flightDailyLimit: Math.max(1, Math.min(10000, Math.trunc(Number(settings.variflightDailyLimit) || 5))) };";
if(!source.includes(before))throw new Error("production travel quota integration baseline changed; refusing partial patch");
if(source.indexOf(before)!==source.lastIndexOf(before))throw new Error("production travel quota policy marker is ambiguous");
source=source.replace(before,after);
writeFileSync(output,source,{mode:0o600});
console.log(JSON.stringify({patched:true,bytes:Buffer.byteLength(source)}));
