(function(root){
  "use strict";
  const TYPES=Object.freeze({PLANE:"飞机",HIGH_SPEED_RAIL:"高铁",LOCAL_ATTEND:"本地参会"});
  const TYPE_ALIASES=new Map([
    ["飞机","PLANE"],["航空","PLANE"],["flight","PLANE"],["plane","PLANE"],["PLANE","PLANE"],
    ["高铁","HIGH_SPEED_RAIL"],["火车","HIGH_SPEED_RAIL"],["动车","HIGH_SPEED_RAIL"],["train","HIGH_SPEED_RAIL"],["rail","HIGH_SPEED_RAIL"],["HIGH_SPEED_RAIL","HIGH_SPEED_RAIL"],
    ["本地参会","LOCAL_ATTEND"],["本地","LOCAL_ATTEND"],["local","LOCAL_ATTEND"],["LOCAL_ATTEND","LOCAL_ATTEND"],
  ]);
  const DEFAULT_DICTIONARY=[
    ["上海","PLANE","上海虹桥机场T1航站楼"],["上海","PLANE","上海虹桥机场T2航站楼"],["上海","PLANE","上海浦东机场T1航站楼"],["上海","PLANE","上海浦东机场T2航站楼"],
    ["上海","HIGH_SPEED_RAIL","上海虹桥站"],["上海","HIGH_SPEED_RAIL","上海站"],["上海","HIGH_SPEED_RAIL","上海西站"],["上海","HIGH_SPEED_RAIL","上海松江南站"],["上海","HIGH_SPEED_RAIL","安亭站"],["上海","HIGH_SPEED_RAIL","安亭北站"],
    ["北京","PLANE","北京首都机场T1航站楼"],["北京","PLANE","北京首都机场T2航站楼"],["北京","PLANE","北京首都机场T3航站楼"],["北京","PLANE","北京大兴机场"],
    ["北京","HIGH_SPEED_RAIL","北京南站"],["北京","HIGH_SPEED_RAIL","北京西站"],["北京","HIGH_SPEED_RAIL","北京站"],["北京","HIGH_SPEED_RAIL","北京朝阳站"],["北京","HIGH_SPEED_RAIL","北京丰台站"],["北京","HIGH_SPEED_RAIL","清河站"],
    ["大连","PLANE","大连周水子机场"],["大连","HIGH_SPEED_RAIL","大连站"],["大连","HIGH_SPEED_RAIL","大连北站"],
    ["福州","PLANE","福州长乐机场"],["福州","HIGH_SPEED_RAIL","福州站"],["福州","HIGH_SPEED_RAIL","福州南站"],
    ["杭州","PLANE","杭州萧山机场T3航站楼"],["杭州","PLANE","杭州萧山机场T4航站楼"],["杭州","HIGH_SPEED_RAIL","杭州东站"],["杭州","HIGH_SPEED_RAIL","杭州西站"],["杭州","HIGH_SPEED_RAIL","杭州南站"],
    ["南京","PLANE","南京禄口机场T1航站楼"],["南京","PLANE","南京禄口机场T2航站楼"],["南京","HIGH_SPEED_RAIL","南京站"],["南京","HIGH_SPEED_RAIL","南京南站"],
    ["厦门","PLANE","厦门高崎机场T3航站楼"],["厦门","PLANE","厦门高崎机场T4航站楼"],["厦门","HIGH_SPEED_RAIL","厦门站"],["厦门","HIGH_SPEED_RAIL","厦门北站"],
    ["苏州","HIGH_SPEED_RAIL","苏州站"],["苏州","HIGH_SPEED_RAIL","苏州北站"],["苏州","HIGH_SPEED_RAIL","苏州园区站"],["苏州","HIGH_SPEED_RAIL","苏州新区站"],
  ].map(([city,type,name])=>({city,type,name}));
  const clean=value=>String(value??"").replace(/[\u200B-\u200D\uFEFF]/gu,"").replace(/\u3000/gu," ").trim().replace(/\s+/g," ");
  const normalizeCity=value=>clean(value).replace(/(?:市|地区)$/u,"");
  const canonicalStation=(value,type)=>normalizeType(type)==="PLANE"?clean(value).replace(/国际机场/gu,"机场"):clean(value);
  function normalizeType(value,number=""){
    const raw=clean(value);if(TYPE_ALIASES.has(raw))return TYPE_ALIASES.get(raw);
    if(/本地参会|本地客户/u.test(raw)||/本地参会/u.test(number))return"LOCAL_ATTEND";
    if(/^[GDCSZTKLY]\d/i.test(clean(number)))return"HIGH_SPEED_RAIL";
    return raw||number?"PLANE":"";
  }
  function normalizeEntry(entry){
    const city=normalizeCity(entry?.city??entry?.city_name),type=normalizeType(entry?.type??entry?.transport_type),name=canonicalStation(entry?.name??entry?.station_name,type);
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
  const filterStationOptions=(items,query)=>{
    const keyword=clean(query).toLocaleLowerCase("zh-CN");
    if(!keyword)return[...(Array.isArray(items)?items:[])];
    return(Array.isArray(items)?items:[]).filter(item=>clean(item?.shortName||displayStation(item?.name,item?.type)).toLocaleLowerCase("zh-CN").includes(keyword));
  };
  function displayStation(value,type="",custom=[]){
    const raw=clean(value);if(!raw)return"";
    const configured=dictionary(custom).find(item=>item.type===normalizeType(type)&&item.name===raw)?.shortName;
    if(configured)return configured;
    if(normalizeType(type)==="HIGH_SPEED_RAIL")return /站$/u.test(raw)?raw:`${raw}站`;
    return raw.replace(/国际机场/gu,"").replace(/机场/gu,"").replace(/(?:T\s*)?(\d+)号?航站楼/giu,"T$1").replace(/航站楼/gu,"").replace(/T(\d+)$/u," T$1").replace(/\s+/g," ").trim();
  }
  function officialStation(value,type,custom){
    const raw=canonicalStation(value,type);if(!raw||normalizeType(type)==="LOCAL_ATTEND")return null;
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
      let requestId=0,matches=[],filtered=[],activeIndex=-1;
      const field=input.closest("label")||input.parentElement;
      const listbox=document.createElement("div");
      const listboxId=`station-list-${side}-${Math.random().toString(36).slice(2,9)}`;
      listbox.id=listboxId;listbox.className="station-search-listbox";listbox.setAttribute("role","listbox");listbox.hidden=true;
      field?.classList.add("station-combobox-field");field?.append(listbox);
      input.classList.add("station-search-input");input.setAttribute("autocomplete","off");input.setAttribute("role","combobox");input.setAttribute("aria-autocomplete","list");input.setAttribute("aria-controls",listboxId);input.setAttribute("aria-expanded","false");
      const closeList=()=>{listbox.hidden=true;input.setAttribute("aria-expanded","false");activeIndex=-1;};
      const openList=()=>{if(input.disabled||!matches.length)return;listbox.hidden=false;input.setAttribute("aria-expanded","true");};
      const setActive=index=>{
        const nodes=[...listbox.querySelectorAll('[role="option"]')];if(!nodes.length)return;
        activeIndex=(index+nodes.length)%nodes.length;nodes.forEach((node,i)=>node.classList.toggle("active",i===activeIndex));nodes[activeIndex].scrollIntoView?.({block:"nearest"});
      };
      const selectStation=item=>{
        select.value=item.name;select.name=`${side}Station`;input.name="";input.value=item.shortName||displayStation(item.name,item.type);input.dataset.stationMode="selected";closeList();input.dispatchEvent(new Event("change",{bubbles:true}));
      };
      const drawOptions=(query="",{clearSelection=true}={})=>{
        filtered=filterStationOptions(matches,query);activeIndex=-1;
        if(clearSelection){select.value="";input.dataset.stationMode="search";}
        if(query&&filtered.length===0){
          select.name="";input.name=`${side}Station`;input.dataset.stationMode="manual";input.placeholder="未查询到对应场站，请手动录入";
          listbox.innerHTML='<div class="station-search-empty">未查询到对应场站，请手动录入</div>';openList();return;
        }
        select.name=`${side}Station`;input.name="";input.placeholder="输入关键词搜索或选择场站";
        listbox.innerHTML=filtered.map((item,index)=>`<button type="button" role="option" data-index="${index}" aria-selected="false"><span>${(item.shortName||displayStation(item.name,item.type)).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</span><small>${item.name.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</small></button>`).join("");
        if(filtered.length)openList();else closeList();
      };
      const onInput=()=>drawOptions(input.value);
      const onFocus=()=>drawOptions(input.dataset.stationMode==="selected"?"":input.value,{clearSelection:input.dataset.stationMode!=="selected"});
      const onKeydown=event=>{
        const optionCount=listbox.querySelectorAll('[role="option"]').length;
        if(event.key==="ArrowDown"&&optionCount){event.preventDefault();openList();setActive(activeIndex+1);}
        else if(event.key==="ArrowUp"&&optionCount){event.preventDefault();openList();setActive(activeIndex-1);}
        else if(event.key==="Enter"&&activeIndex>=0){event.preventDefault();const item=filtered[activeIndex];if(item)selectStation(item);}
        else if(event.key==="Escape")closeList();
      };
      const onOptionClick=event=>{const option=event.target.closest('[role="option"]');if(!option)return;const item=filtered[Number(option.dataset.index)];if(item)selectStation(item);};
      const onOutside=event=>{if(!field?.contains(event.target))closeList();};
      input.addEventListener("input",onInput);input.addEventListener("focus",onFocus);input.addEventListener("keydown",onKeydown);listbox.addEventListener("mousedown",event=>event.preventDefault());listbox.addEventListener("click",onOptionClick);document.addEventListener("mousedown",onOutside);
      const render=async({clear=false}={})=>{
        const currentRequest=++requestId;
        const old=clear?"":clean((select.name?select.value:input.value));
        const local=type.value==="LOCAL_ATTEND";
        matches=local?[]:stationList(customDictionary,city.value,type.value);
        closeList();select.name="";input.name="";select.hidden=true;select.disabled=true;input.hidden=false;input.disabled=true;input.removeAttribute("required");
        if(local){select.value="";input.value="";input.placeholder="本地参会无需填写场站";input.dataset.stationMode="local";return;}
        if(clean(city.value)&&normalizeType(type.value)&&typeof loadStations==="function"){
          input.setAttribute("aria-busy","true");input.placeholder="正在加载场站…";
          try{const loaded=await loadStations(city.value,type.value);if(currentRequest!==requestId)return;if(Array.isArray(loaded))matches=loaded.map(normalizeEntry).filter(Boolean);}catch{/* 本地字典继续兜底 */}
          finally{input.removeAttribute("aria-busy");}
        }
        if(currentRequest!==requestId)return;
        if(matches.length){
          select.innerHTML='<option value="">请选择场站</option>'+matches.map(item=>`<option value="${item.name.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">${(item.shortName||displayStation(item.name,item.type)).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</option>`).join("");
          select.name=`${side}Station`;select.disabled=false;input.disabled=false;
          const official=officialStation(old,type.value,[...customDictionary,...matches]),selected=matches.find(item=>item.name===official);
          if(selected){select.value=selected.name;input.value=selected.shortName||displayStation(selected.name,selected.type);input.dataset.stationMode="selected";input.placeholder="输入关键词搜索或选择场站";}
          else{select.value="";input.value=old;drawOptions(old,{clearSelection:false});if(old&&!filtered.length){select.name="";input.name=`${side}Station`;input.dataset.stationMode="manual";}else closeList();}
        }else{
          input.name=`${side}Station`;input.disabled=false;input.placeholder="未查询到对应场站，请手动录入";input.dataset.stationMode="manual";input.value=old;listbox.innerHTML="";
        }
      };
      const change=()=>void render({clear:true});city.addEventListener("change",change);type.addEventListener("change",change);
      cleanups.push(()=>{city.removeEventListener("change",change);type.removeEventListener("change",change);input.removeEventListener("input",onInput);input.removeEventListener("focus",onFocus);input.removeEventListener("keydown",onKeydown);listbox.removeEventListener("click",onOptionClick);document.removeEventListener("mousedown",onOutside);listbox.remove();field?.classList.remove("station-combobox-field");});
      void render({clear:!preserve});
    }
    return()=>cleanups.forEach(fn=>fn());
  }
  const api={TYPES,DEFAULT_DICTIONARY,clean,normalizeCity,normalizeType,canonicalStation,dictionary,stationList,options,filterStationOptions,displayStation,officialStation,cityForStation,parseDictionary,stringifyDictionary,hydrate,applyLegacy,bindForm};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.TravelFields=Object.freeze(api);
})(typeof window!=="undefined"?window:globalThis);
