import {createHash} from 'node:crypto';
import {validDate,normCode,today,railStation} from './core.mjs';
import {airport,terminal} from './airports.mjs';
import {variflightSchedule} from './variflight.mjs';
import {railSchedule} from './rail.mjs';

const CITY={SHA:'上海',PVG:'上海',PEK:'北京',PKX:'北京',TFU:'成都',CTU:'成都',DLC:'大连',FOC:'福州',HGH:'杭州',CAN:'广州',SZX:'深圳',NKG:'南京',XMN:'厦门',CKG:'重庆',WUH:'武汉',XIY:'西安',CSX:'长沙',TAO:'青岛',KMG:'昆明',KHN:'南昌',TSN:'天津'};
const text=value=>String(value??'').trim();
const keyFor=j=>JSON.stringify([j.mode,j.date,normCode(j.number),j.from,j.to]);
function label(code,name,value){const base=airport(code)?.name||name||code;const t=terminal(value);return base+(t?t+'航站楼':'');}
export function chooseMatch(journey,candidates){
  const dated=candidates.filter(c=>normCode(c.code)===normCode(journey.number)&&c.date===journey.date);
  const unique=[...new Map(dated.map(c=>[JSON.stringify(c),c])).values()];
  const from=airport(journey.from)?.code,to=airport(journey.to)?.code;
  const exact=unique.filter(c=>journey.mode==='train'?railStation(c.from)===railStation(journey.from)&&railStation(c.to)===railStation(journey.to):(!from||c.from===from)&&(!to||c.to===to));
  const candidatesToUse=exact.length?exact:unique;
  if(candidatesToUse.length!==1)return {match:null,warnings:[candidatesToUse.length?'同日同班次有多段或多个候选，需人工确认具体行程':'未取得该日期与班次的有效计划，不据此判断填写错误']};
  const c=candidatesToUse[0];
  if(c.cancelled||c.diverted||c.virtual)return {match:null,warnings:['班次存在取消、备降、返航或虚拟标记，请人工核实']};
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.depart||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.arrive||'')||!validDate(c.arrivalDate)||c.arrivalDate<c.date||!c.from||!c.to)return {match:null,warnings:['计划字段不完整，暂不能确认通过']};
  const flight=journey.mode==='flight',warnings=[];
  if(flight&&!c.departureTerminal)warnings.push('接口未返回出发航站楼，航站楼待确认');
  if(flight&&!c.arrivalTerminal)warnings.push('接口未返回抵达航站楼，航站楼待确认');
  return {match:{date:c.date,departureDate:c.date,arrivalDate:c.arrivalDate,number:c.code,
    from:flight?label(c.from,c.fromName,c.departureTerminal):c.from+'站',to:flight?label(c.to,c.toName,c.arrivalTerminal):c.to+'站',
    fromCode:flight?c.from:'',toCode:flight?c.to:'',fromCity:CITY[c.from]||'',toCity:CITY[c.to]||'',
    departure:c.depart,arrival:c.arrive,arrivalDayOffset:Math.round((Date.parse(c.arrivalDate)-Date.parse(c.date))/86400000),
    departureTerminal:c.departureTerminal||'',arrivalTerminal:c.arrivalTerminal||''},warnings};
}

// Only this server module knows provider keys. No names, contact details or attendee IDs
// enter provider requests, cache keys or provider response storage.
export function createTravelProviders(db,{env=process.env,flightQuery=variflightSchedule,trainQuery=railSchedule}={}){
  const flightKey=text(env.VARIFLIGHT_API_KEY),flightEnabled=env.VARIFLIGHT_ENABLED==='true';
  const railEnabled=env.RAIL_12306_ENABLED!=='false';
  const cap=Math.max(0,Math.min(100,Number(env.VARIFLIGHT_DAILY_LIMIT??5)||0));
  db.exec('CREATE TABLE IF NOT EXISTS travel_verification_usage(day TEXT PRIMARY KEY, queries INTEGER NOT NULL DEFAULT 0)');
  const getCache=db.prepare('SELECT * FROM travel_api_cache WHERE cache_key=? AND expires_at>?');
  const putCache=db.prepare(`INSERT INTO travel_api_cache(cache_key,provider,request_json,response_json,status,fetched_at,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET response_json=excluded.response_json,status=excluded.status,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at`);
  const takeQuota=db.prepare('INSERT INTO travel_verification_usage(day,queries) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET queries=queries+1 WHERE queries<?');
  const refundQuota=db.prepare('UPDATE travel_verification_usage SET queries=CASE WHEN queries>0 THEN queries-1 ELSE 0 END WHERE day=?');
  let queue=Promise.resolve();
  const status=()=>({version:2,train:{configured:railEnabled,provider:'12306 公共查询',providerId:'rail_12306'},flight:{configured:!!flightKey&&flightEnabled,provider:'飞常准',providerId:'variflight',dailyLimit:cap},manualReviewOnly:true});
  async function verifyOne(j,allowPaid){
    const provider=j.mode==='flight'?'variflight':'rail_12306',query={mode:j.mode,date:text(j.date),number:normCode(j.number),from:text(j.from),to:text(j.to)};
    const base={mode:j.mode,provider,requested:query,found:false,match:null,cached:false};
    const unavailable=message=>({...base,warnings:[message]});
    if(!validDate(query.date)||!query.from||!query.to||query.from.length>120||query.to.length>120)return unavailable('请确认完整日期及具体出发、到达场站');
    if(j.mode==='flight'&&!/^[A-Z0-9]{2}\d{1,4}$/.test(query.number))return unavailable('航班号格式有歧义，请人工确认');
    if(j.mode==='train'&&(!/^[GDCZTKYSL]\d{1,4}$/.test(query.number)||(/^[A-Z]\d{4}$/.test(query.number)&&!/[站]/.test(query.from+query.to))))return unavailable('车次号或场站有歧义，请人工确认');
    if(j.mode==='train'){
      const offset=(Date.parse(query.date)-Date.parse(today()))/86400000;
      if(offset<0||offset>14)return unavailable(offset<0?'12306 公共查询不用于历史行程核验':'尚未进入本适配器的铁路查询窗口');
      if(!railEnabled)return unavailable('12306 查询尚未启用');
    }else if(!flightKey||!flightEnabled)return unavailable('飞常准尚未在服务器启用；需要配置密钥并确认账户可查询');
    const key=createHash('sha256').update(JSON.stringify({version:2,provider,...query})).digest('hex');
    const cached=getCache.get(key,new Date().toISOString());
    if(cached){try{return {...JSON.parse(cached.response_json),cached:true};}catch{/* Corrupt cache is never evidence. */}}
    let quotaReserved=false;
    if(j.mode==='flight'){
      if(!allowPaid)return unavailable('本次未授权消耗飞常准额度');
      if(!cap||takeQuota.run(today(),cap).changes!==1)return unavailable('已达到服务器每日航班查询上限，未发起收费请求');
      quotaReserved=true;
    }
    let result;
    try{
      const trip={date:query.date,code:query.number,from:query.from,to:query.to,fromCode:airport(query.from)?.code,toCode:airport(query.to)?.code};
      // Search a flight number on its exact date without a possibly mistyped route filter.
      const data=j.mode==='flight'?await flightQuery({date:trip.date,code:trip.code},flightKey):await trainQuery(trip);
      const selected=data.incomplete?{match:null,warnings:['结果不完整，不能确认唯一行程']}:chooseMatch(query,data.candidates||[]);
      const checkedAt=new Date().toISOString();
      result={...base,...selected,found:!!selected.match,source:{provider,label:j.mode==='flight'?'飞常准 · 公布计划时刻':'12306 · 日期限定查询',checkedAt,referenceUrl:j.mode==='flight'?'https://mcp.variflight.com/docs/tripmatch':'https://www.12306.cn/'}};
    }catch(error){if(quotaReserved)refundQuota.run(today());result=unavailable(error?.message||'数据源暂时不可用，未判定行程填写错误');}
    const now=Date.now();putCache.run(key,provider,JSON.stringify(query),JSON.stringify(result),result.found?'ok':'error',new Date(now).toISOString(),new Date(now+(result.found?15:5)*60000).toISOString());
    return result;
  }
  async function run(journeys,{allowPaid=false}={}){
    if(!Array.isArray(journeys)||!journeys.length||journeys.length>200)throw Object.assign(new Error('请提交1至200条待核验行程'),{status:400});
    const groups=new Map(),results=[];
    for(const j of journeys){
      if(!j||!['train','flight'].includes(j.mode)){results.push({attendeeId:text(j?.attendeeId),segment:j?.segment,found:false,warnings:['交通类型有歧义，需人工确认']});continue;}
      const key=keyFor(j);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(j);
    }
    // Frontend sends one unique trip per HTTP request to bound provider latency.
    if(groups.size>1)throw Object.assign(new Error('每次请求只接受一个去重后的行程，请分批核验'),{status:400});
    for(const group of groups.values()){
      const result=await verifyOne(group[0],allowPaid===true);
      group.forEach(j=>results.push({...result,attendeeId:text(j.attendeeId),segment:j.segment==='return'?'return':'outbound'}));
    }
    return {results,usage:{submitted:journeys.length,cacheHits:results.filter(r=>r.cached).length},providers:['rail_12306','variflight']};
  }
  return {status,verifyBatch:(journeys,options)=>{const next=queue.then(()=>run(journeys,options));queue=next.catch(()=>{});return next;}};
}
