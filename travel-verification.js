(function(root){
  "use strict";
  const suffixes={date:"Date",number:"No",from:"From",to:"To",departure:"Departure",arrival:"Arrival"};
  const labels={date:"出发日期",number:"航班号/车次号",from:"出发场站",to:"抵达场站",departure:"出发时间",arrival:"到达时间",departCity:"出发城市",departTransportType:"出发出行方式",arriveDate:"抵达日期",arriveCity:"抵达城市",arriveTransportType:"抵达出行方式"};
  const direction=segment=>String(segment).startsWith("return")?"return":"outbound";
  const extraId=segment=>String(segment).includes(":")?String(segment).split(":").slice(1).join(":"):"";
  const extraSegment=(attendee,segment)=>attendee?.customFields?._journeySegments?.find(item=>String(item.id)===extraId(segment));
  const segments=attendee=>["outbound",...(attendee?.customFields?._journeySegments||[]).filter(item=>item.direction!=="return").map(item=>`outbound:${item.id}`),"return",...(attendee?.customFields?._journeySegments||[]).filter(item=>item.direction==="return").map(item=>`return:${item.id}`)];
  const keys=segment=>{
    if(extraId(segment)){const id=extraId(segment),field=key=>`extra::${id}::${key}`;return{date:field("departDate"),departCity:field("departCity"),departTransportType:field("transportType"),from:field("departStation"),arriveDate:field("arriveDate"),arriveCity:field("arriveCity"),to:field("arriveStation"),number:field("number"),departure:field("departure"),arrival:field("arrival")};}
    return direction(segment)==="return"
      ?{date:"returnDepartDate",departCity:"returnDepartCity",departTransportType:"returnDepartTransportType",from:"returnDepartStation",arriveDate:"returnArriveDate",arriveCity:"returnArriveCity",to:"returnArriveStation",number:"returnNo",departure:"returnDeparture",arrival:"returnArrival"}
      :{date:"departDate",departCity:"departCity",departTransportType:"departTransportType",from:"departStation",arriveDate:"arriveDate",arriveCity:"arriveCity",to:"arriveStation",number:"outNo",departure:"outDeparture",arrival:"outArrival"};
  };
  function getValue(attendee,field){const match=String(field).match(/^extra::(.+?)::(.+)$/);return match?extraSegment(attendee,`outbound:${match[1]}`)?.[match[2]]||"":attendee?.[field]||"";}
  function setValue(attendee,field,value){const match=String(field).match(/^extra::(.+?)::(.+)$/);if(!match){attendee[field]=value;return;}const item=extraSegment(attendee,`outbound:${match[1]}`);if(item)item[match[2]]=value;}
  const snapshot=(attendee,segment)=>{const data=Object.fromEntries(Object.entries(keys(segment)).map(([key,field])=>[key,String(getValue(attendee,field)||"").trim()]));data.arriveTransportType=data.departTransportType;return data;};
  const fingerprint=(attendee,segment)=>JSON.stringify(snapshot(attendee,segment));
  const hasJourney=(attendee,segment)=>Object.values(snapshot(attendee,segment)).some(Boolean);
  function transportMode(data){
    const selected=[data.departTransportType,data.arriveTransportType].map(value=>String(value||"")).filter(Boolean);
    if(selected.includes("LOCAL_ATTEND"))return"local";
    if(selected.includes("PLANE"))return"flight";
    if(selected.includes("HIGH_SPEED_RAIL"))return"train";
    const no=String(data.number||'').replace(/\s/g,'').toUpperCase();
    if(/^[GDCZTKYSL]\d{1,4}$/.test(no))return /^[A-Z]\d{4}$/.test(no)&&!/[站]/.test(data.from+data.to)?'unknown':'train';
    if(/^[GDCZTK]\d{5}$/.test(no))return 'unknown';
    return /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(no)?'flight':'unknown';
  }
  const stationKey=(value,mode)=>String(value||"").trim().replace(/\s+/g,"").replace(/国际机场|机场/g,"").replace(/(?:T\s*)?(\d+)号?航站楼/g,"T$1").replace(/航站楼/g,"").replace(mode==="train"?/(?:火车)?站$/:/$^/,"").toUpperCase();
  const compare=(field,value,mode)=>field==="from"||field==="to"?stationKey(value,mode):field==="number"?String(value).replace(/\s/g,"").toUpperCase():field==="date"?String(value).slice(0,10):["departure","arrival"].includes(field)?String(value).slice(0,5):String(value||"").replace(/\s/g,"").replace(/市$/u,"").toUpperCase();
  function compareAirport(value,match,side){
    const code=String(match[side+'Code']||'').toUpperCase(),city=match[side+'City'];
    const normalize=v=>stationKey(v,'flight');
    const strip=v=>normalize(v).replace(/T\d+[A-Z]?$/,'');
    const declared=normalize(value),expected=normalize(match[side]);
    if(city&&declared===city)return {notice:'名单仅填写城市，具体机场及航站楼需人工确认'};
    const identity=code&&strip(value)===code||strip(value)===strip(match[side]);
    if(!identity)return {different:true};
    const a=declared.match(/T\d+[A-Z]?$/)?.[0],b=expected.match(/T\d+[A-Z]?$/)?.[0];
    if(a&&b&&a!==b)return {different:true};
    if(!a&&!b)return{};
    return !a||!b?{notice:'机场相符，航站楼信息尚未完整确认'}:{};
  }
  function localIssues(attendee,segment){
    if(!hasJourney(attendee,segment))return [];
    const data=snapshot(attendee,segment),map=keys(segment),issues=[];
    const local=transportMode(data)==="local";
    for(const key of Object.keys(map)){
      const stationIsLocal=key==="from"&&data.departTransportType==="LOCAL_ATTEND"||key==="to"&&data.arriveTransportType==="LOCAL_ATTEND";
      if(stationIsLocal){if(data[key])issues.push({field:map[key],message:`${labels[key]}在本地参会时必须为空`,current:data[key],expected:""});continue;}
      if(local&&["number","departure","arrival"].includes(key))continue;
      if(!data[key])issues.push({field:map[key],message:`${labels[key]}未填写`});
      else if(["departure","arrival"].includes(key)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(data[key]))issues.push({field:map[key],message:`${labels[key]}格式应为 HH:mm`});
      else if(["date","arriveDate"].includes(key)&&(!/^\d{4}-\d{2}-\d{2}$/.test(data[key])||!Number.isFinite(Date.parse(data[key]+"T00:00:00Z"))||new Date(data[key]+"T00:00:00Z").toISOString().slice(0,10)!==data[key]))issues.push({field:map[key],message:`${labels[key]}格式不正确`});
      else if(/TransportType$/.test(key)&&!["PLANE","HIGH_SPEED_RAIL","LOCAL_ATTEND"].includes(data[key]))issues.push({field:map[key],message:`${labels[key]}值不正确`});
    }
    return issues;
  }
  function dictionaryIssues(attendee,segment,dictionary=[]){
    if(!root.TravelFields||!Array.isArray(dictionary)||!dictionary.length)return[];
    const data=snapshot(attendee,segment),map=keys(segment),issues=[];
    for(const side of [{city:"departCity",type:"departTransportType",station:"from"},{city:"arriveCity",type:"arriveTransportType",station:"to"}]){
      if(data[side.type]==="LOCAL_ATTEND"||!data[side.city]||!data[side.type]||!data[side.station])continue;
      const choices=root.TravelFields.stationList(dictionary,data[side.city],data[side.type]);
      if(!choices.length)continue;
      const official=root.TravelFields.officialStation(data[side.station],data[side.type],dictionary);
      if(choices.some(item=>item.name===official))continue;
      // A newly opened terminal or a manually entered station may not have
      // reached this browser's dictionary snapshot yet. Only report a
      // mismatch when the same canonical station is positively known under a
      // different city or transport type; an unknown custom value remains
      // valid and can still be checked by the schedule provider.
      const known=root.TravelFields.dictionary(dictionary).find(item=>item.name===official);
      if(known&&(known.city!==root.TravelFields.normalizeCity(data[side.city])||known.type!==root.TravelFields.normalizeType(data[side.type])))issues.push({field:map[side.station],message:`场站与城市、出行方式不匹配`,current:data[side.station],expected:`${known.city} · ${root.TravelFields.TYPES[known.type]||known.type}`});
    }
    return issues;
  }
  function buildCheck(attendee,segment,result){
    if(!hasJourney(attendee,segment))return {status:'blank',fieldIssues:[],notices:[],fingerprint:fingerprint(attendee,segment)};
    const data=snapshot(attendee,segment),map=keys(segment),mode=result?.mode||transportMode(data);
    const fieldIssues=[...localIssues(attendee,segment),...dictionaryIssues(attendee,segment,result?.stationDictionary||[])],notices=[...(Array.isArray(result?.warnings)?result.warnings:[])].map(String);
    if(mode==="local"){return{mode,provider:"local",source:null,checkedAt:new Date().toISOString(),dateBasis:"local",match:null,fieldIssues,notices:[],warnings:fieldIssues.map(issue=>issue.message),status:fieldIssues.length?"issues":"verified",fingerprint:fingerprint(attendee,segment)};}
    const rawMatch=result?.found===false?null:result?.match;
    // Aliyun train returns a date-filtered candidate list, not a date on each row.
    // Only its documented dated-query response may supply this comparison basis.
    const queryDate=mode==="train"&&result?.provider==="aliyun_train"&&result?.found===true
      &&/^\d{4}-\d{2}-\d{2}$/.test(result?.requested?.date||"")?result.requested.date:"";
    const match=rawMatch?{...rawMatch,date:rawMatch.date||rawMatch.departureDate||queryDate}:null;
    if(match){
      for(const key of ["date","from","to","number","departure","arrival"]){
        if(match[key]===undefined||match[key]===null||match[key]===""){notices.push(`接口未返回${labels[key]}，暂不能确认通过`);continue;}
        if(mode==='flight'&&['from','to'].includes(key)&&data[key]){
          const result=compareAirport(data[key],match,key);
          if(result.notice)notices.push(labels[key]+'：'+result.notice);
          if(result.different)fieldIssues.push({field:map[key],message:`${labels[key]}与计划不一致`,current:data[key],expected:String(match[key])});
          continue;
        }
        if(data[key]&&compare(key,data[key],mode)!==compare(key,match[key],mode))fieldIssues.push({field:map[key],message:`${labels[key]}与计划不一致`,current:data[key],expected:String(match[key])});
      }
    }else notices.push("未取得有效计划数据，暂不能确认核验通过");
    if(match){
      const extras=[
        ["departCity",match.fromCity],["arriveDate",match.arrivalDate||match.date],["arriveCity",match.toCity],
        ["departTransportType",mode==="flight"?"PLANE":mode==="train"?"HIGH_SPEED_RAIL":""],["arriveTransportType",mode==="flight"?"PLANE":mode==="train"?"HIGH_SPEED_RAIL":""],
      ];
      for(const [key,expected] of extras)if(expected&&data[key]&&compare(key==="arriveDate"?"date":key,data[key],mode)!==compare(key==="arriveDate"?"date":key,expected,mode))fieldIssues.push({field:map[key],message:`${labels[key]}与计划不一致`,current:data[key],expected:String(expected)});
    }
    // Provider-level errors have no reliable field identity: show a banner, never paint an entire row.
    for(const issue of result?.fieldIssues||[]){const field=map[issue.field]||issue.field;if(Object.values(map).includes(field))fieldIssues.push({...issue,field,message:issue.message||"接口返回该字段异常"});}
    const unique=[...new Map(fieldIssues.map(issue=>[issue.field+issue.message,issue])).values()];
    return{mode,provider:result?.provider||mode,source:result?.source||null,checkedAt:new Date().toISOString(),dateBasis:queryDate&&!rawMatch?.date&&!rawMatch?.departureDate?"provider-dated-query":"provider-field",match:match||null,fieldIssues:unique,notices:[...new Set(notices)],warnings:[...unique.map(issue=>issue.message),...new Set(notices)],status:unique.length?"issues":match&&!notices.length?"verified":"unavailable",fingerprint:fingerprint(attendee,segment)};
  }
  function currentIssues(attendee,segment){
    const check=attendee.customFields?._travelVerification?.[segment];
    if(check?.fingerprint===fingerprint(attendee,segment)&&Array.isArray(check.fieldIssues))return check.fieldIssues.filter(issue=>!(issue?.message===`场站与城市、出行方式不匹配`&&issue.expected===undefined));
    if(check?.match&&!check.fingerprint)return buildCheck(attendee,segment,{...check,found:true,warnings:[]}).fieldIssues;
    return localIssues(attendee,segment);
  }
  function verifiedField(attendee,field){
    if(attendee.customFields?._travelVerifiedHighlights?.includes(field))return true;
    const segment=Object.values(keys("outbound")).includes(field)?"outbound":Object.values(keys("return")).includes(field)?"return":null;
    if(!segment)return false;const check=attendee.customFields?._travelVerification?.[segment];
    return check?.status==="verified"&&check.fingerprint===fingerprint(attendee,segment);
  }
  // Display aliases must never be written into source records or outbound exports.
  function resolveTerminal(input,original,number,candidates,format){
    const value=String(input||"").trim();if(!value)return"";
    if(value===format(original,number))return original;
    if(/^[GDCSZTKLY]\d/i.test(number))return value.endsWith("站")?value:`${value}站`;
    const matches=[...new Set([original,...candidates].filter(item=>item&&/机场/.test(item)&&format(item,number)===value))];
    if(matches.length===1)return matches[0];
    // Changing only the terminal retains the original airport's complete official name.
    const terminal=value.match(/\sT(\d+)$/i),base=value.replace(/\sT\d+$/i,"");
    if(terminal&&/机场/.test(original)&&format(original,number).replace(/\sT\d+$/i,"")===base)return original.replace(/T\s*\d+航站楼?|\d+号?航站楼|T\s*\d+/ig,"").trim()+`T${terminal[1]}航站楼`;
    if(/机场/.test(value))return value;
    throw new Error("该机场简称无法唯一还原，请输入完整机场名称（保存后仍以简称展示）");
  }
  function viewState(attendee,segment){
    if(!hasJourney(attendee,segment))return 'blank';
    const check=attendee.customFields?._travelVerification?.[segment];
    if(check&&check.fingerprint!==fingerprint(attendee,segment))return 'stale';
    const issues=currentIssues(attendee,segment);
    if(issues.some(issue=>issue.expected!==undefined))return 'difference';
    if(issues.length)return 'review';
    return check?.status==='verified'?'verified':check?'unavailable':'pending';
  }
  const api={keys,snapshot,fingerprint,hasJourney,transportMode,viewState,localIssues,dictionaryIssues,buildCheck,currentIssues,verifiedField,resolveTerminal,segments,direction,getValue,setValue};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.TravelVerification=Object.freeze(api);
})(typeof window!=="undefined"?window:globalThis);
