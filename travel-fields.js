(function(root){
  "use strict";
  const TYPES=Object.freeze({PLANE:"飞机",HIGH_SPEED_RAIL:"高铁",LOCAL_ATTEND:"本地参会"});
  const TYPE_ALIASES=new Map([
    ["飞机","PLANE"],["航空","PLANE"],["flight","PLANE"],["plane","PLANE"],["PLANE","PLANE"],
    ["高铁","HIGH_SPEED_RAIL"],["火车","HIGH_SPEED_RAIL"],["动车","HIGH_SPEED_RAIL"],["train","HIGH_SPEED_RAIL"],["rail","HIGH_SPEED_RAIL"],["HIGH_SPEED_RAIL","HIGH_SPEED_RAIL"],
    ["本地参会","LOCAL_ATTEND"],["本地","LOCAL_ATTEND"],["local","LOCAL_ATTEND"],["LOCAL_ATTEND","LOCAL_ATTEND"],
  ]);
  const DEFAULT_DICTIONARY=[
    ["上海","PLANE","上海虹桥国际机场T1航站楼"],["上海","PLANE","上海虹桥国际机场T2航站楼"],["上海","PLANE","上海浦东国际机场T1航站楼"],["上海","PLANE","上海浦东国际机场T2航站楼"],
    ["上海","HIGH_SPEED_RAIL","上海虹桥站"],["上海","HIGH_SPEED_RAIL","上海站"],["上海","HIGH_SPEED_RAIL","上海西站"],["上海","HIGH_SPEED_RAIL","上海松江南站"],["上海","HIGH_SPEED_RAIL","安亭站"],["上海","HIGH_SPEED_RAIL","安亭北站"],
    ["北京","PLANE","北京首都国际机场T1航站楼"],["北京","PLANE","北京首都国际机场T2航站楼"],["北京","PLANE","北京首都国际机场T3航站楼"],["北京","PLANE","北京大兴国际机场"],
    ["北京","HIGH_SPEED_RAIL","北京南站"],["北京","HIGH_SPEED_RAIL","北京西站"],["北京","HIGH_SPEED_RAIL","北京站"],["北京","HIGH_SPEED_RAIL","北京朝阳站"],["北京","HIGH_SPEED_RAIL","北京丰台站"],["北京","HIGH_SPEED_RAIL","清河站"],
    ["大连","PLANE","大连周水子国际机场"],["大连","HIGH_SPEED_RAIL","大连站"],["大连","HIGH_SPEED_RAIL","大连北站"],
    ["福州","PLANE","福州长乐国际机场"],["福州","HIGH_SPEED_RAIL","福州站"],["福州","HIGH_SPEED_RAIL","福州南站"],
    ["杭州","PLANE","杭州萧山国际机场T3航站楼"],["杭州","PLANE","杭州萧山国际机场T4航站楼"],["杭州","HIGH_SPEED_RAIL","杭州东站"],["杭州","HIGH_SPEED_RAIL","杭州西站"],["杭州","HIGH_SPEED_RAIL","杭州南站"],
    ["南京","PLANE","南京禄口国际机场T1航站楼"],["南京","PLANE","南京禄口国际机场T2航站楼"],["南京","HIGH_SPEED_RAIL","南京站"],["南京","HIGH_SPEED_RAIL","南京南站"],
    ["厦门","PLANE","厦门高崎国际机场T3航站楼"],["厦门","PLANE","厦门高崎国际机场T4航站楼"],["厦门","HIGH_SPEED_RAIL","厦门站"],["厦门","HIGH_SPEED_RAIL","厦门北站"],
    ["苏州","HIGH_SPEED_RAIL","苏州站"],["苏州","HIGH_SPEED_RAIL","苏州北站"],["苏州","HIGH_SPEED_RAIL","苏州园区站"],["苏州","HIGH_SPEED_RAIL","苏州新区站"],
  ].map(([city,type,name])=>({city,type,name}));
  const clean=value=>String(value??"").replace(/[\u200B-\u200D\uFEFF]/gu,"").replace(/\u3000/gu," ").trim().replace(/\s+/g," ");
  const normalizeCity=value=>clean(value).replace(/(?:市|地区)$/u,"");
  function normalizeType(value,number=""){
    const raw=clean(value);if(TYPE_ALIASES.has(raw))return TYPE_ALIASES.get(raw);
    if(/本地参会|本地客户/u.test(raw)||/本地参会/u.test(number))return"LOCAL_ATTEND";
    if(/^[GDCSZTKLY]\d/i.test(clean(number)))return"HIGH_SPEED_RAIL";
    return raw||number?"PLANE":"";
  }
  function normalizeEntry(entry){
    const city=normalizeCity(entry?.city??entry?.city_name),type=normalizeType(entry?.type??entry?.transport_type),name=clean(entry?.name??entry?.station_name);
    const shortName=clean(entry?.shortName??entry?.short_name??entry?.station_short_name);
    return city&&["PLANE","HIGH_SPEED_RAIL"].includes(type)&&name?{city,type,name,shortName:shortName||displayStation(name,type)}:null;
  }
  function dictionary(custom){
    const items=Array.isArray(custom)?custom.map(normalizeEntry).filter(Boolean):[];
    const all=[...items,...DEFAULT_DICTIONARY],seen=new Set();
    return all.filter(item=>{const key=[item.city,item.type,item.name].join("|");if(seen.has(key))return false;seen.add(key);return true;});
  }
  const stationList=(custom,city,type)=>dictionary(custom).filter(item=>item.city===normalizeCity(city)&&item.type===normalizeType(type));
  const options=(custom,city,type)=>stationList(custom,city,type).map(item=>item.name);
  function displayStation(value,type="",custom=[]){
    const raw=clean(value);if(!raw)return"";
    const configured=dictionary(custom).find(item=>item.type===normalizeType(type)&&item.name===raw)?.shortName;
    if(configured)return configured;
    if(normalizeType(type)==="HIGH_SPEED_RAIL")return /站$/u.test(raw)?raw:`${raw}站`;
    return raw.replace(/国际机场/gu,"").replace(/机场/gu,"").replace(/(?:T\s*)?(\d+)号?航站楼/giu,"T$1").replace(/航站楼/gu,"").replace(/T(\d+)$/u," T$1").replace(/\s+/g," ").trim();
  }
  function officialStation(value,type,custom){
    const raw=clean(value);if(!raw||normalizeType(type)==="LOCAL_ATTEND")return null;
    const found=dictionary(custom).find(item=>item.type===normalizeType(type)&&(item.name===raw||displayStation(item.name,item.type)===raw));
    if(found)return found.name;
    return normalizeType(type)==="HIGH_SPEED_RAIL"&&!/站$/u.test(raw)?`${raw}站`:raw;
  }
  function cityForStation(value,type,custom){
    const raw=clean(value);const found=dictionary(custom).find(item=>item.type===normalizeType(type)&&(item.name===raw||displayStation(item.name,item.type)===raw));
    if(found)return found.city;
    return normalizeCity(raw.replace(/(?:国际)?机场.*$/u,"").replace(/(?:火车|高铁)?站$/u,"").replace(/\s*T\d+$/iu,""));
  }
  function parseDictionary(text){
    const source=clean(text);if(!source)return[];
    if(source.startsWith("[")){const parsed=JSON.parse(source);if(!Array.isArray(parsed))throw new Error("场站字典 JSON 必须是数组");return parsed.map(normalizeEntry).filter(Boolean);}
    return String(text).split(/\r?\n/).map((line,index)=>{if(!line.trim())return null;const [city,type,name,shortName]=line.split("|");const item=normalizeEntry({city,type,name,shortName});if(!item)throw new Error(`场站字典第 ${index+1} 行格式错误`);return item;}).filter(Boolean);
  }
  const stringifyDictionary=items=>dictionary(items).map(item=>`${item.city}|${item.type}|${item.name}|${item.shortName||displayStation(item.name,item.type)}`).join("\n");
  function hydrate(attendee={}){
    const mode=normalizeType(attendee.departTransportType||attendee.outTransportType,attendee.outNo);
    const arrivalMode=normalizeType(attendee.arriveTransportType||mode,attendee.outNo);
    const returnMode=normalizeType(attendee.returnDepartTransportType,attendee.returnNo);
    const returnArrivalMode=normalizeType(attendee.returnArriveTransportType||returnMode,attendee.returnNo);
    return{
      departDate:attendee.departDate||attendee.outDate||"",
      departCity:normalizeCity(attendee.departCity||attendee.outFrom||""),
      departTransportType:mode,
      departStation:mode==="LOCAL_ATTEND"?"":officialStation(attendee.departStation||attendee.outFrom||"",mode)||"",
      arriveDate:attendee.arriveDate||attendee.outDate||"",
      arriveCity:normalizeCity(attendee.arriveCity||attendee.outTo||""),
      arriveTransportType:arrivalMode,
      arriveStation:arrivalMode==="LOCAL_ATTEND"?"":officialStation(attendee.arriveStation||attendee.outTo||"",arrivalMode)||"",
      returnDepartDate:attendee.returnDepartDate||attendee.returnDate||"",
      returnDepartCity:normalizeCity(attendee.returnDepartCity||attendee.returnFrom||""),
      returnDepartTransportType:returnMode,
      returnDepartStation:returnMode==="LOCAL_ATTEND"?"":officialStation(attendee.returnDepartStation||attendee.returnFrom||"",returnMode)||"",
      returnArriveDate:attendee.returnArriveDate||attendee.returnDate||"",
      returnArriveCity:normalizeCity(attendee.returnArriveCity||attendee.returnTo||""),
      returnArriveTransportType:returnArrivalMode,
      returnArriveStation:returnArrivalMode==="LOCAL_ATTEND"?"":officialStation(attendee.returnArriveStation||attendee.returnTo||"",returnArrivalMode)||"",
    };
  }
  function applyLegacy(target){
    const fields=hydrate(target);Object.assign(target,fields);
    target.outDate=fields.departDate;
    target.outFrom=fields.departStation||fields.departCity;
    target.outTo=fields.arriveStation||fields.arriveCity;
    target.returnDate=fields.returnDepartDate;
    target.returnFrom=fields.returnDepartStation||fields.returnDepartCity;
    target.returnTo=fields.returnArriveStation||fields.returnArriveCity;
    target.flight=fields.departTransportType==="PLANE"?"Y":"N";
    return target;
  }
  function bindForm(form,{customDictionary=[],preserve=true,loadStations=null}={}){
    if(!form)return()=>{};
    const cleanups=[];
    for(const side of ["depart","arrive","returnDepart","returnArrive"]){
      const city=form.elements[`${side}City`],type=form.elements[`${side}TransportType`];
      const select=form.querySelector(`[data-station-select="${side}"]`),input=form.querySelector(`[data-station-input="${side}"]`);
      if(!city||!type||!select||!input)continue;
      let requestId=0;
      const render=async({clear=false}={})=>{
        const currentRequest=++requestId;
        const old=clear?"":clean((select.name?select.value:input.value));
        const local=type.value==="LOCAL_ATTEND";
        let matches=local?[]:stationList(customDictionary,city.value,type.value);
        select.name="";input.name="";select.hidden=true;input.hidden=true;select.disabled=true;input.disabled=true;
        if(local){select.value="";input.value="";return;}
        if(clean(city.value)&&normalizeType(type.value)&&typeof loadStations==="function"){
          select.setAttribute("aria-busy","true");
          try{const loaded=await loadStations(city.value,type.value);if(currentRequest!==requestId)return;if(Array.isArray(loaded))matches=loaded.map(normalizeEntry).filter(Boolean);}catch{/* 本地字典继续兜底 */}
          finally{select.removeAttribute("aria-busy");}
        }
        if(currentRequest!==requestId)return;
        if(matches.length){
          select.innerHTML='<option value="">请选择场站</option>'+matches.map(item=>`<option value="${item.name.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">${(item.shortName||displayStation(item.name,item.type)).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</option>`).join("");
          select.name=`${side}Station`;select.disabled=false;select.hidden=false;
          const official=officialStation(old,type.value,[...customDictionary,...matches]);select.value=matches.some(item=>item.name===official)?official:"";
        }else{
          input.name=`${side}Station`;input.disabled=false;input.hidden=false;input.placeholder="未查询到对应场站，请手动录入";
          input.value=old;
        }
      };
      const change=()=>void render({clear:true});city.addEventListener("change",change);type.addEventListener("change",change);
      cleanups.push(()=>{city.removeEventListener("change",change);type.removeEventListener("change",change);});
      void render({clear:!preserve});
    }
    return()=>cleanups.forEach(fn=>fn());
  }
  const api={TYPES,DEFAULT_DICTIONARY,clean,normalizeCity,normalizeType,dictionary,stationList,options,displayStation,officialStation,cityForStation,parseDictionary,stringifyDictionary,hydrate,applyLegacy,bindForm};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.TravelFields=Object.freeze(api);
})(typeof window!=="undefined"?window:globalThis);
