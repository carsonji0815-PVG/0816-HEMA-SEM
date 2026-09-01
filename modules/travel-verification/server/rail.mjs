import {today,validDate,railStation} from './core.mjs';
export class ProviderError extends Error { constructor(status,message){super(message);this.status=status;} }
async function request(url,headers={},beforeRequest=()=>{}) {
  beforeRequest();
  let r;try{r=await fetch(url,{headers,signal:AbortSignal.timeout(15000),redirect:'error'});}catch{throw new ProviderError('error','数据服务连接失败或超时；没有将查询失败判为行程错误。');}
  if([401,402,403].includes(r.status))throw new ProviderError('credentials',`数据服务拒绝访问（HTTP ${r.status}）：请检查密钥、套餐和历史查询权限。`);
  if(r.status===429)throw new ProviderError('error','数据服务限流，请稍后再试；系统不会连续重试。');
  if(!r.ok)throw new ProviderError('error',`数据服务返回 HTTP ${r.status}，请检查日期范围及接口权限。`);
  return r;
}
let stations=null,railLast=0;
async function stationMap(beforeRequest) {
  if(stations)return stations;
  const r=await request('https://kyfw.12306.cn/otn/resources/js/framework/station_name.js',{},beforeRequest);
  const text=await r.text();const parsed=new Map();
  for(const item of text.split('@')){const p=item.split('|');if(p.length>=3&&/^[A-Z]{3}$/.test(p[2]))parsed.set(railStation(p[1]),p[2]);}
  if(parsed.size<100)throw new ProviderError('error','无法解析 12306 站点表，已停止查询。');
  stations=parsed;return stations;
}
export function mapRailLine(line,map,date) {
  const p=line.split('|');
  if(p.length<14||!/^\d{2}:\d{2}$/.test(p[8]||'')||!/^\d{2}:\d{2}$/.test(p[9]||''))return null;
  const duration=/^(\d+):(\d{2})$/.exec(p[10]||'');if(!duration)return null;
  const departureMinutes=Number(p[8].slice(0,2))*60+Number(p[8].slice(3));
  const days=Math.floor((departureMinutes+Number(duration[1])*60+Number(duration[2]))/1440);
  // The requested date is the passenger's boarding date; p[13] is NOT used as that date.
  return {code:p[3],from:map[p[6]],to:map[p[7]],date,arrivalDate:new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10),depart:p[8],arrive:p[9],basis:'scheduled'};
}
export async function railSchedule(t,beforeRequest) {
  const diff=(Date.parse(t.date)-Date.parse(today()))/86400000;
  if(!validDate(t.date)||diff<0)throw new ProviderError('historical','12306 公共余票接口不用于核验历史行程。');
  if(diff>14)throw new ProviderError('out_of_range','该日期超出适配器的铁路查询窗口。');
  const map=await stationMap(beforeRequest),from=map.get(railStation(t.from)),to=map.get(railStation(t.to));
  if(!from||!to)throw new ProviderError('review','站名不能唯一映射到 12306 车站代码，请确认具体车站。');
  const wait=Math.max(0,1500-(Date.now()-railLast));if(wait)await new Promise(r=>setTimeout(r,wait));railLast=Date.now();
  const init=await request('https://kyfw.12306.cn/otn/leftTicket/init',{},beforeRequest);
  const cookies=init.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const html=await init.text();const path=html.match(/CLeftTicketUrl\s*=\s*['"](leftTicket\/query[A-Za-z]*)['"]/)?.[1]||'leftTicket/query';
  const url=new URL(`https://kyfw.12306.cn/otn/${path}`);
  url.search=new URLSearchParams({'leftTicketDTO.train_date':t.date,'leftTicketDTO.from_station':from,'leftTicketDTO.to_station':to,purpose_codes:'ADULT'}).toString();
  const r=await request(url,cookies?{cookie:cookies}:{},beforeRequest);let data;
  try{data=await r.json();}catch{throw new ProviderError('error','12306 返回了非 JSON 内容，可能需要人工访问或接口已变化。');}
  if(data.status!==true||!Array.isArray(data.data?.result)||!data.data?.map)throw new ProviderError('error','12306 暂未返回可用数据；不推断停运或填写错误。');
  const parsed=data.data.result.map(x=>typeof x==='string'?mapRailLine(x,data.data.map,t.date):null);
  if(parsed.some(x=>!x))throw new ProviderError('error','12306 部分记录字段格式已变化，未完成完整解析，不据此判定无车次。');
  return {source:url.toString(),candidates:parsed.filter(c=>c.code===t.code)};
}
