(function(root){
  "use strict";
  const suffixes={date:"Date",number:"No",from:"From",to:"To",departure:"Departure",arrival:"Arrival"};
  const labels={date:"日期",number:"航班号/车次号",from:"出发场站",to:"抵达场站",departure:"出发时间",arrival:"到达时间"};
  const keys=segment=>Object.fromEntries(Object.entries(suffixes).map(([key,suffix])=>[key,(segment==="return"?"return":"out")+suffix]));
  const snapshot=(attendee,segment)=>Object.fromEntries(Object.entries(keys(segment)).map(([key,field])=>[key,String(attendee[field]||"").trim()]));
  const fingerprint=(attendee,segment)=>JSON.stringify(snapshot(attendee,segment));
  const stationKey=(value,mode)=>String(value||"").trim().replace(/\s+/g,"").replace(/国际机场|机场/g,"").replace(/(?:T\s*)?(\d+)号?航站楼/g,"T$1").replace(/航站楼/g,"").replace(mode==="train"?/(?:火车)?站$/:/$^/,"").toUpperCase();
  const compare=(field,value,mode)=>field==="from"||field==="to"?stationKey(value,mode):field==="number"?String(value).replace(/\s/g,"").toUpperCase():field==="date"?String(value).slice(0,10):String(value).slice(0,5);
  function localIssues(attendee,segment){
    const data=snapshot(attendee,segment),map=keys(segment),issues=[];
    for(const key of Object.keys(map)){
      if(!data[key])issues.push({field:map[key],message:`${labels[key]}未填写`});
      else if(["departure","arrival"].includes(key)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(data[key]))issues.push({field:map[key],message:`${labels[key]}格式应为 HH:mm`});
      else if(key==="date"&&!/^\d{4}-\d{2}-\d{2}$/.test(data[key]))issues.push({field:map[key],message:"日期格式不正确"});
    }
    return issues;
  }
  function buildCheck(attendee,segment,result){
    const data=snapshot(attendee,segment),map=keys(segment),mode=result?.mode||(/^[GDCSZTKLY]\d/i.test(data.number)?"train":"flight");
    const fieldIssues=localIssues(attendee,segment),notices=[...(Array.isArray(result?.warnings)?result.warnings:[])].map(String);
    const rawMatch=result?.found===false?null:result?.match;
    // Aliyun train returns a date-filtered candidate list, not a date on each row.
    // Only its documented dated-query response may supply this comparison basis.
    const queryDate=mode==="train"&&result?.provider==="aliyun_train"&&result?.found===true
      &&/^\d{4}-\d{2}-\d{2}$/.test(result?.requested?.date||"")?result.requested.date:"";
    const match=rawMatch?{...rawMatch,date:rawMatch.date||rawMatch.departureDate||queryDate}:null;
    if(match){
      for(const key of Object.keys(map)){
        if(match[key]===undefined||match[key]===null||match[key]===""){notices.push(`接口未返回${labels[key]}，暂不能确认通过`);continue;}
        if(data[key]&&compare(key,data[key],mode)!==compare(key,match[key],mode))fieldIssues.push({field:map[key],message:`${labels[key]}与计划不一致`,current:data[key],expected:String(match[key])});
      }
    }else notices.push("未取得有效计划数据，暂不能确认核验通过");
    // Provider-level errors have no reliable field identity: show a banner, never paint an entire row.
    for(const issue of result?.fieldIssues||[]){const field=map[issue.field]||issue.field;if(Object.values(map).includes(field))fieldIssues.push({...issue,field,message:issue.message||"接口返回该字段异常"});}
    for(const notice of notices){
      if(/未返回出发航站楼/.test(notice))fieldIssues.push({field:map.from,message:notice});
      if(/未返回抵达航站楼/.test(notice))fieldIssues.push({field:map.to,message:notice});
    }
    const unique=[...new Map(fieldIssues.map(issue=>[issue.field+issue.message,issue])).values()];
    return{mode,provider:result?.provider||mode,source:result?.source||null,checkedAt:new Date().toISOString(),dateBasis:queryDate&&!rawMatch?.date&&!rawMatch?.departureDate?"provider-dated-query":"provider-field",match:match||null,fieldIssues:unique,notices:[...new Set(notices)],warnings:[...unique.map(issue=>issue.message),...new Set(notices)],status:unique.length?"issues":match&&!notices.length?"verified":"unavailable",fingerprint:fingerprint(attendee,segment)};
  }
  function currentIssues(attendee,segment){
    const check=attendee.customFields?._travelVerification?.[segment];
    if(check?.fingerprint===fingerprint(attendee,segment)&&Array.isArray(check.fieldIssues))return check.fieldIssues;
    if(check?.match&&!check.fingerprint)return buildCheck(attendee,segment,{...check,found:true,warnings:[]}).fieldIssues;
    return localIssues(attendee,segment);
  }
  function verifiedField(attendee,field){
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
  const api={keys,snapshot,fingerprint,localIssues,buildCheck,currentIssues,verifiedField,resolveTerminal};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.TravelVerification=Object.freeze(api);
})(typeof window!=="undefined"?window:globalThis);
