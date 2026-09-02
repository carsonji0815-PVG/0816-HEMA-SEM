import {validDate,excelTime,normCode} from './core.mjs';

export const variflightEndpoint='https://ai.variflight.com/servers/tripmatch/mcp';
function fail(status,message){const e=new Error(message);e.status=status;throw e;}
async function rpc(key,method,params,beforeRequest=()=>{},id=1){
 if(!key)fail('credentials','请在数据源设置中配置飞常准 API Key。');
 beforeRequest();let r;
 try{r=await fetch(variflightEndpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','X-API-Key':key,'MCP-Protocol-Version':'2025-03-26'},body:JSON.stringify({jsonrpc:'2.0',...(id===null?{}:{id}),method,params})});}
 catch{fail('error','飞常准连接失败或超时，未自动重试，也未判定行程错误。');}
 if([401,402,403].includes(r.status))fail('credentials',`飞常准拒绝访问（HTTP ${r.status}），请检查密钥、试用额度和账号权限；不会自动充值。`);
 if(!r.ok)fail('error',`飞常准返回 HTTP ${r.status}，已停止此次查询。`);
 if(id===null)return null;
 let data;try{data=await r.json();}catch{fail('unavailable','飞常准未返回文档所述 JSON 格式；需检查接口版本，不尝试猜测。');}
 if(data.error)fail('error','飞常准 MCP 请求失败，请核对账号权限和接口版本。');
 if(data.id!==id||!data.result)fail('unavailable','飞常准 MCP 响应结构不符合预期。');
 return data.result;
}
async function initialize(key,beforeRequest){
 const result=await rpc(key,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'conference-travel-schedules',version:'0.1.0'}},beforeRequest);
 if(result.protocolVersion!=='2025-03-26')fail('unavailable','飞常准 MCP 协议版本不匹配。');
 await rpc(key,'notifications/initialized',{},beforeRequest,null);
}
export async function probeVariflight(key){
 await initialize(key);
 const result=await rpc(key,'tools/list',{},undefined,2);
 if(!result.tools?.some(t=>t.name==='searchFlightsByNumber'))fail('unavailable','连接成功，但账号未返回所需航班查询工具。');
 return {ok:true,message:'飞常准 MCP 已连接，航班查询工具可用。未查询航班、未验证覆盖；协议级连接与工具列表按官方文档免费。',checkedAt:new Date().toISOString()};
}
function clock(v){
 const m=String(v||'').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/);
 return m&&validDate(m[1])&&excelTime(m[2]).time?{date:m[1],time:m[2]}:null;
}
// Only documented PlanDate fields; the currently supported local-time mapping is mainland domestic.
export function mapVariflight(f){
 const dep=clock(f.FlightDeptimePlanDate),arr=clock(f.FlightArrtimePlanDate);
 const domestic=String(f.fcategory)==='0'&&Number(f.org_timezone)===28800&&Number(f.dst_timezone)===28800;
 return {code:normCode(f.FlightNo),date:domestic?dep?.date:undefined,arrivalDate:domestic?arr?.date:undefined,depart:domestic?dep?.time:undefined,arrive:domestic?arr?.time:undefined,from:normCode(f.FlightDepcode),to:normCode(f.FlightArrcode),fromName:f.FlightDepAirport||'',toName:f.FlightArrAirport||'',departureTerminal:f.FlightHTerminal||'',arrivalTerminal:f.FlightTerminal||'',basis:'scheduled',cancelled:/取消/.test(f.FlightState||''),diverted:/备降|返航/.test(f.FlightState||'')||['1','2'].includes(String(f.LegFlag)),virtual:String(f.VirtualFlag)==='1'};
}
function parsePythonLiteral(source){
 let i=0;const failParse=()=>fail('unavailable','飞常准返回文本结构无法安全解析；未据此判定行程。');const ws=()=>{while(/\s/.test(source[i]||''))i++;};
 const string=()=>{const quote=source[i++];let out='';while(i<source.length){const ch=source[i++];if(ch===quote)return out;if(ch==='\\'){const next=source[i++];if(next==='n')out+='\n';else if(next==='r')out+='\r';else if(next==='t')out+='\t';else if(next==='b')out+='\b';else if(next==='f')out+='\f';else if(next==='u'){const hex=source.slice(i,i+4);if(!/^[0-9a-f]{4}$/i.test(hex))failParse();out+=String.fromCharCode(parseInt(hex,16));i+=4;}else out+=next??'';}else out+=ch;}failParse();};
 const value=()=>{ws();const ch=source[i];if(ch==="'"||ch==='"')return string();if(ch==='['){i++;const out=[];ws();if(source[i]===']'){i++;return out;}while(i<source.length){out.push(value());ws();if(source[i]===']'){i++;return out;}if(source[i++]!==',')failParse();}failParse();}if(ch==='{'){i++;const out={};ws();if(source[i]==='}'){i++;return out;}while(i<source.length){ws();if(source[i]!=="'"&&source[i]!=='"')failParse();const key=string();ws();if(source[i++]!==':')failParse();out[key]=value();ws();if(source[i]==='}'){i++;return out;}if(source[i++]!==',')failParse();}failParse();}const rest=source.slice(i);for(const[token,result]of[['True',true],['False',false],['None',null]])if(rest.startsWith(token)){i+=token.length;return result;}const number=rest.match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i)?.[0];if(number){i+=number.length;return Number(number);}failParse();};
 const parsed=value();ws();if(i!==source.length)failParse();return parsed;
}
function parseToolText(text){const raw=String(text||'').trim();try{return JSON.parse(raw);}catch{/* VariFlight currently wraps a Python-literal payload in a text block. */}const match=raw.match(/^Flight details:\s*([\s\S]+)$/);if(!match)return null;return parsePythonLiteral(match[1]);}
export function decodeVariflight(result){
 if(result.isError)fail('error','飞常准工具执行失败；未自动重试。请核对账号额度、日期和机场。');
 let payload=result.structuredContent;
 if(!payload){const blocks=result.content?.filter(c=>c.type==='text')||[];if(blocks.length!==1)fail('unavailable','飞常准返回非单一结构化结果；不从自然语言猜测时刻。');
  payload=parseToolText(blocks[0].text);if(!payload)fail('unavailable','飞常准未返回可核验的结构化航班数据；请检查返回格式或账号权限。');}
 // Envelope support is explicit and shallow; never recursively hunt for apparent schedule fields.
 if(!payload||typeof payload!=='object')fail('unavailable','飞常准返回空值或非结构化内容。');
 if(Number(payload.code)===200&&payload.data&&typeof payload.data==='object')payload=payload.data;
 if(payload.has_more||payload.hasMore||payload.next||payload.incomplete)fail('unavailable','飞常准结果不完整，不能证明唯一匹配。');
 if(payload.error_code!==undefined&&Number(payload.error_code)!==0){if(Number(payload.error_code)===10||/暂无数据/.test(String(payload.error||'')))fail('unavailable','飞常准已连接，但该日期与航班暂无计划数据；暂不能确认核验通过。');fail('error','飞常准上游返回业务错误，未将其转换为无航班。');}
 const rows=Array.isArray(payload)?payload:Array.isArray(payload.data)?payload.data:Array.isArray(payload.result)?payload.result:null;
 if(!rows)fail('unavailable','飞常准返回结构尚未匹配适配器；需用账号真实响应联调，不能自动修正。');
 if(rows.length>2000)fail('unavailable','飞常准候选过多，未证明唯一匹配。');
 if(rows.some(f=>!f||typeof f!=='object'||!f.FlightNo||!f.FlightDepcode||!f.FlightArrcode))fail('unavailable','飞常准响应字段与已核对的文档不一致，已停止自动比对。');
 return rows.map(mapVariflight);
}
export async function variflightSchedule(t,key,beforeRequest){
 if(!validDate(t.date)||!/^[A-Z0-9]{2,3}\d{1,4}$/.test(normCode(t.code)))fail('review','请确认完整日期和航班号。');
 const args={fnum:normCode(t.code),date:t.date};
 for(const [side,name] of [['from','dep'],['to','arr']]){const code=t[side+'Code']||t[side];if(/^[A-Z]{3}$/.test(code))args[name]=code;}
 await initialize(key,beforeRequest);
 const result=await rpc(key,'tools/call',{name:'searchFlightsByNumber',arguments:args},beforeRequest,2);
 const candidates=decodeVariflight(result);
 if(candidates.some(c=>!c.date||!c.arrivalDate||!c.depart||!c.arrive))fail('unavailable','缺少公布计划时刻或已确认的国内时区字段；国际/港澳台映射尚未联调，不自动修正。');
 if(candidates.some(c=>c.virtual))fail('review','返回虚拟航班，需人工确认；未自动修正。');
 return {source:variflightEndpoint+'#searchFlightsByNumber',candidates};
}
