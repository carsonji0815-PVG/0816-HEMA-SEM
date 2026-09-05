import {execFileSync} from 'node:child_process';

const railUrl='https://kyfw.12306.cn/otn/resources/js/framework/station_name.js';
const caacBase='https://www.caac.gov.cn/GYMH/MHGK/MYJC/';
const dryRun=process.argv.includes('--dry-run');
const clean=value=>String(value||'').replace(/[\u200B-\u200D\uFEFF]/gu,'').replace(/\u3000/gu,' ').trim().replace(/\s+/gu,' ');
const quote=value=>`'${clean(value).replaceAll("'","''")}'`;
const runSql=sql=>execFileSync('docker',['exec','-i','lilly-stage-db','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:180000});
const fetchText=async url=>{const response=await fetch(url,{headers:{'User-Agent':'LillyMeetingStationDictionary/1.0'},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);return response.text();};

const airportCityOverrides={
  '阿里昆莎机场':'阿里','阿里普兰机场':'阿里','陇南成县机场':'陇南','黔江武陵山机场':'重庆','重庆仙女山机场':'重庆','重庆巫山机场':'重庆','大兴安岭鄂伦春机场':'大兴安岭','神农架红坪机场':'神农架','湘西边城机场':'湘西','甘孜格萨尔机场':'甘孜','甘孜甘孜机场':'甘孜','甘孜康定机场':'甘孜','甘孜稻城亚丁机场':'甘孜'
};
const terminalOverrides={
  '北京首都机场':['T1','T2','T3'],'上海虹桥机场':['T1','T2'],'上海浦东机场':['T1','T2'],'广州白云机场':['T1','T2','T3'],'深圳宝安机场':['T3'],'成都双流机场':['T1','T2'],'成都天府机场':['T1','T2'],'重庆江北机场':['T2','T3'],'昆明长水机场':['T1'],'西安咸阳机场':['T2','T3','T5'],'杭州萧山机场':['T3','T4'],'南京禄口机场':['T1','T2'],'厦门高崎机场':['T3','T4'],'武汉天河机场':['T2','T3'],'长沙黄花机场':['T1','T2'],'郑州新郑机场':['T2'],'青岛胶东机场':['T1'],'天津滨海机场':['T1','T2'],'沈阳桃仙机场':['T3'],'哈尔滨太平机场':['T1','T2'],'海口美兰机场':['T1','T2'],'三亚凤凰机场':['T1','T2'],'乌鲁木齐天山机场':['T1','T2','T3','T4']
};

let runId='';
try{
  if(!dryRun)runId=runSql("insert into public.dictionary_sync_runs(status) values('running') returning id;\n").trim();
  const railText=await fetchText(railUrl),body=railText.match(/'([\s\S]*)'/)?.[1];
  if(!body)throw new Error('12306 station data format changed');
  const railRows=body.split('@').slice(1).map(record=>record.split('|')).map(parts=>({name:clean(parts[1]),city:clean(parts[7]).replace(/市$/u,'')})).filter(row=>row.name&&row.city).map(row=>({...row,name:/站$/u.test(row.name)?row.name:`${row.name}站`,type:'HIGH_SPEED_RAIL'}));
  if(railRows.length<3000)throw new Error(`12306 station data incomplete: ${railRows.length}`);
  const cities=[...new Set(railRows.map(row=>row.city))].sort((a,b)=>b.length-a.length);
  const airportNames=new Set();let airportSourceAsOf='';
  for(let page=0;page<30;page+=1){
    const url=page?`${caacBase}index_${page}.html`:caacBase,response=await fetch(url,{headers:{'User-Agent':'LillyMeetingStationDictionary/1.0'},signal:AbortSignal.timeout(30000)});
    if(!response.ok)continue;
    const html=await response.text();
    const date=html.match(/截至\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/u);
    if(date)airportSourceAsOf=`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`;
    for(const match of html.matchAll(/<td[^>]*>\s*([^<>\r\n]{2,40}机场)\s*<\/td>/gu))airportNames.add(clean(match[1]).replace(/国际(?=机场)/gu,''));
  }
  if(airportNames.size<250)throw new Error(`CAAC airport data incomplete: ${airportNames.size}`);
  const cityForAirport=name=>airportCityOverrides[name]||cities.find(city=>name.startsWith(city))||clean(name.replace(/机场$/u,'')).slice(0,12);
  const shortAirport=name=>clean(name.replace(/机场/gu,'').replace(/T(\d+)航站楼$/u,' T$1'));
  const airportRows=[...airportNames].flatMap(name=>(terminalOverrides[name]||['']).map(terminal=>({city:cityForAirport(name),type:'PLANE',name:terminal?`${name}${terminal}航站楼`:name,shortName:shortAirport(terminal?`${name}${terminal}航站楼`:name)}))).filter(row=>row.city);
  const rows=[...railRows.map(row=>({...row,shortName:row.name})),...airportRows];
  const unique=[...new Map(rows.map(row=>[[row.city,row.type,row.name].join('|'),row])).values()];
  const values=unique.map(row=>`(${quote(row.city)},${quote(row.type)},${quote(row.name)},${quote(row.shortName)})`);
  const chunks=[];
  for(let index=0;index<values.length;index+=400)chunks.push(`insert into public.station_dict(city_name,transport_type,station_name,station_short_name) values\n${values.slice(index,index+400).join(',\n')}\non conflict(city_name,transport_type,station_name) do update set station_short_name=excluded.station_short_name,updated_at=now();`);
  const cityValues=[...new Set(unique.map(row=>row.city))].sort().map(city=>`(${quote(`${city}市`)},${quote(city)})`);
  const result={runId:runId?Number(runId):null,status:dryRun?'dry-run':'success',railwayCount:railRows.length,airportCount:airportNames.size,stationUpsertCount:unique.length,aliasUpsertCount:cityValues.length,airportSourceAsOf:airportSourceAsOf||null};
  if(dryRun){console.log(JSON.stringify(result));process.exit(0);}
  const sql=`begin;\n${chunks.join('\n')}\ninsert into public.city_alias(alias_name,standard_city_name) values\n${cityValues.join(',\n')}\non conflict(alias_name) do update set standard_city_name=excluded.standard_city_name,updated_at=now();\nupdate public.dictionary_sync_runs set status='success',airport_source_as_of=${airportSourceAsOf?quote(airportSourceAsOf):'null'},railway_count=${railRows.length},airport_count=${airportNames.size},station_upsert_count=${unique.length},alias_upsert_count=${cityValues.length},finished_at=now() where id=${Number(runId)};\ncommit;`;
  runSql(sql);
  console.log(JSON.stringify(result));
}catch(error){
  const message=String(error?.stderr||error?.message||error).slice(0,2000);
  if(runId)try{runSql(`update public.dictionary_sync_runs set status='failed',error_message=${quote(message)},finished_at=now() where id=${Number(runId)};`);}catch{}
  console.error(message);process.exit(1);
}
