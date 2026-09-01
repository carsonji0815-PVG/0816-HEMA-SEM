import { writeFileSync } from "node:fs";

const railUrl="https://kyfw.12306.cn/otn/resources/js/framework/station_name.js";
const caacBase="https://www.caac.gov.cn/GYMH/MHGK/MYJC/";
const output=new URL("../supabase/migrations/2026090104_national_station_seed.sql",import.meta.url);
const clean=value=>String(value||"").replace(/[\u200B-\u200D\uFEFF]/gu,"").replace(/\u3000/gu," ").trim().replace(/\s+/gu," ");
const quote=value=>`'${clean(value).replaceAll("'","''")}'`;

const railText=await (await fetch(railUrl,{signal:AbortSignal.timeout(30000)})).text();
const body=railText.match(/'([\s\S]*)'/)?.[1];
if(!body)throw new Error("12306 station data format changed");
const railRows=body.split("@").slice(1).map(record=>record.split("|")).map(parts=>({name:clean(parts[1]),city:clean(parts[7]).replace(/市$/u,"")})).filter(row=>row.name&&row.city).map(row=>({...row,name:/站$/u.test(row.name)?row.name:`${row.name}站`}));
const cities=[...new Set(railRows.map(row=>row.city))].sort((a,b)=>b.length-a.length);

const airportNames=new Set();
for(let page=0;page<30;page++){
  const url=page?`${caacBase}index_${page}.html`:caacBase;
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)continue;
  const html=await response.text();
  for(const match of html.matchAll(/<td[^>]*>\s*([^<>\r\n]{2,40}机场)\s*<\/td>/gu))airportNames.add(clean(match[1]));
}
if(airportNames.size<200)throw new Error(`CAAC airport scrape incomplete: ${airportNames.size}`);

const airportCityOverrides={
  "阿里昆莎机场":"阿里","阿里普兰机场":"阿里","陇南成县机场":"陇南","黔江武陵山机场":"重庆","重庆仙女山机场":"重庆","重庆巫山机场":"重庆","大兴安岭鄂伦春机场":"大兴安岭","神农架红坪机场":"神农架","湘西边城机场":"湘西","甘孜格萨尔机场":"甘孜","甘孜甘孜机场":"甘孜","甘孜康定机场":"甘孜","甘孜稻城亚丁机场":"甘孜"
};
const terminalOverrides={
  "北京首都国际机场":["T1","T2","T3"],"上海虹桥国际机场":["T1","T2"],"上海浦东国际机场":["T1","T2"],"广州白云国际机场":["T1","T2"],"深圳宝安国际机场":["T3"],"成都双流国际机场":["T1","T2"],"成都天府国际机场":["T1","T2"],"重庆江北国际机场":["T2","T3"],"昆明长水国际机场":["T1"],"西安咸阳国际机场":["T2","T3"],"杭州萧山国际机场":["T3","T4"],"南京禄口国际机场":["T1","T2"],"厦门高崎国际机场":["T3","T4"],"武汉天河国际机场":["T2","T3"],"长沙黄花国际机场":["T1","T2"],"郑州新郑国际机场":["T2"],"青岛胶东国际机场":["T1"],"天津滨海国际机场":["T1","T2"],"沈阳桃仙国际机场":["T3"],"哈尔滨太平国际机场":["T1","T2"],"海口美兰国际机场":["T1","T2"],"三亚凤凰国际机场":["T1","T2"],"乌鲁木齐天山国际机场":["T1","T2","T3","T4"]
};
const cityForAirport=name=>airportCityOverrides[name]||cities.find(city=>name.startsWith(city))||clean(name.replace(/国际机场$|机场$/u,"")).slice(0,12);
const shortAirport=name=>clean(name.replace(/国际机场/gu,"").replace(/机场/gu,"").replace(/T(\d+)航站楼$/u," T$1"));
const airportRows=[...airportNames].flatMap(name=>(terminalOverrides[name]||[""]).map(terminal=>({city:cityForAirport(name),name:terminal?`${name}${terminal}航站楼`:name,shortName:shortAirport(terminal?`${name}${terminal}航站楼`:name)}))).filter(row=>row.city);

const acceptanceRail=[
  {city:"上海",name:"上海松江南站"},{city:"上海",name:"安亭站"},{city:"上海",name:"安亭北站"},
  {city:"成都",name:"成都东站"},{city:"成都",name:"成都南站"},{city:"成都",name:"成都西站"},{city:"成都",name:"犀浦站"},
];
const rows=[...railRows.map(row=>({...row,type:"HIGH_SPEED_RAIL",shortName:row.name})),...acceptanceRail.map(row=>({...row,type:"HIGH_SPEED_RAIL",shortName:row.name})),...airportRows.map(row=>({...row,type:"PLANE"}))];
const unique=[...new Map(rows.map(row=>[[row.city,row.type,row.name].join("|"),row])).values()];
const values=unique.map(row=>`(${quote(row.city)},${quote(row.type)},${quote(row.name)},${quote(row.shortName)})`);
const chunks=[];for(let i=0;i<values.length;i+=400)chunks.push(`insert into public.station_dict(city_name,transport_type,station_name,station_short_name) values\n${values.slice(i,i+400).join(",\n")}\non conflict(city_name,transport_type,station_name) do update set station_short_name=excluded.station_short_name,updated_at=now();`);
const cityValues=[...new Set(unique.map(row=>row.city))].sort().map(city=>`(${quote(`${city}市`)},${quote(city)})`);
const sql=`-- Generated national station seed.\n-- Railway source: China Railway 12306 station_name.js\n-- Airport source: CAAC transport airport directory (as of 2025-12-31)\n-- Generated: ${new Date().toISOString()}\n\n${chunks.join("\n\n")}\n\ninsert into public.city_alias(alias_name,standard_city_name) values\n${cityValues.join(",\n")}\non conflict(alias_name) do update set standard_city_name=excluded.standard_city_name,updated_at=now();\n\nnotify pgrst,'reload schema';\n`;
writeFileSync(output,sql,{mode:0o644});
console.log(JSON.stringify({rail:railRows.length,airports:airportNames.size,airportRows:airportRows.length,total:unique.length,cities:cityValues.length,output:output.pathname}));
