(function(root){
  "use strict";

  const TYPES=Object.freeze({single:"单间",shared:"标间拼住",twin_single:"标间单住",none:"无需住宿"});
  const DEFAULT_PRIORITIES=Object.freeze(["hospital","city","province","region"]);
  const PRIORITY_LABELS=Object.freeze({hospital:"同一医院",city:"同一城市",province:"同一省份其他城市",region:"同一大区"});
  const clean=value=>String(value??"").trim();
  const normalizeSex=value=>/^(男|male|m)$/i.test(clean(value))?"男":/^(女|female|f)$/i.test(clean(value))?"女":"";

  function normalizeType(value){
    const text=clean(value);
    if(/标间单住|标间独住|双床单住|twin[_\s-]*single/i.test(text))return"twin_single";
    if(/标间拼住|拼住|合住|双人|shared|twin/i.test(text))return"shared";
    if(/单间|大床|single/i.test(text))return"single";
    if(/无需|不住宿|none/i.test(text))return"none";
    if(/^标间$/i.test(text))return"shared";
    return TYPES[text]?text:"";
  }

  const label=value=>TYPES[normalizeType(value)]||clean(value)||"待补录";
  const manualFields=value=>[...new Set(Array.isArray(value)?value.map(String):[])];
  const customValue=(custom,pattern)=>Object.entries(custom||{}).find(([key,value])=>pattern.test(key)&&clean(value))?.[1]||"";

  function record(attendee){
    const saved=attendee?.customFields?._rooming||{};
    const rawNights=saved.actualNights;
    const actualNights=rawNights===""||rawNights===null||rawNights===undefined?"":Math.max(0,Math.trunc(Number(rawNights)||0));
    return{
      requestedType:normalizeType(saved.requestedType||attendee?.customFields?.roomType),
      assignedType:normalizeType(saved.assignedType),
      roommateId:clean(saved.roommateId),roomNumber:clean(saved.roomNumber),
      actualNights,approvalStatus:saved.approvalStatus||"normal",approvalNote:saved.approvalNote||"",
      assignmentSource:saved.assignmentSource||"",roommateSource:saved.roommateSource||"",
      pairingReason:saved.pairingReason||"",pendingManual:!!saved.pendingManual,
      manualFields:manualFields(saved.manualFields),...saved,
      requestedType:normalizeType(saved.requestedType||attendee?.customFields?.roomType),assignedType:normalizeType(saved.assignedType),actualNights,manualFields:manualFields(saved.manualFields)
    };
  }

  function referenceDates(attendee){
    const custom=attendee?.customFields||{};
    return{
      arrival:attendee?.arriveDate||attendee?.outDate||custom.抵达日期||customValue(custom,/抵达日期|arrivaldate/i)||"",
      departure:attendee?.returnDepartDate||attendee?.returnDate||custom.撤离日期||customValue(custom,/撤离日期|departuredate/i)||""
    };
  }

  function lodgingDates(attendee){
    const saved=record(attendee),custom=attendee?.customFields||{},reference=referenceDates(attendee);
    return{
      checkIn:saved.checkInDate||custom.checkInDate||custom.入住日期||customValue(custom,/入住日期|checkin/i)||reference.arrival,
      checkOut:saved.checkOutDate||custom.checkOutDate||custom.退房日期||custom.离店日期||customValue(custom,/退房日期|离店日期|checkout/i)||reference.departure
    };
  }

  function nightsBetween(checkIn,checkOut){
    if(!checkIn||!checkOut)return 0;
    const start=new Date(`${checkIn}T00:00:00`),end=new Date(`${checkOut}T00:00:00`);
    if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))return 0;
    return Math.max(0,Math.round((end-start)/86400000));
  }
  function referenceNights(attendee){const dates=lodgingDates(attendee);return nightsBetween(dates.checkIn,dates.checkOut);}
  function travelReferenceNights(attendee){const dates=referenceDates(attendee);return nightsBetween(dates.arrival,dates.departure);}
  function lodgingDateIssue(attendee){const {checkIn,checkOut}=lodgingDates(attendee);if(!checkIn||!checkOut)return"入住或退房日期待补充";return new Date(`${checkOut}T00:00:00`)<new Date(`${checkIn}T00:00:00`)?"退房日期不能早于入住日期":"";}

  const validIsoDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(clean(value))&&!Number.isNaN(new Date(`${clean(value)}T00:00:00Z`).getTime());
  const addDays=(date,days)=>{const value=new Date(`${date}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);};
  function dailyOccupancy(attendees,range={}){
    const list=(attendees||[]).filter(attendee=>attendee&&attendee.businessStatus!=="cancelled"),byId=new Map(list.map(attendee=>[String(attendee.id),attendee]));
    const completed=[];
    for(const attendee of list){
      const room=record(attendee),type=room.assignedType,checkIn=clean(room.checkInDate),checkOut=clean(room.checkOutDate),actualNights=Number(room.actualNights);
      if(!["single","shared","twin_single"].includes(type)||!validIsoDate(checkIn)||!validIsoDate(checkOut)||!Number.isFinite(actualNights)||actualNights<=0)continue;
      const dateNights=nightsBetween(checkIn,checkOut);if(dateNights<=0)continue;
      let roomKey=`${type}:${attendee.id}`;
      if(type==="shared"){
        const mate=byId.get(String(room.roommateId)),mateRoom=mate&&record(mate);
        if(!mate||mateRoom.assignedType!=="shared"||String(mateRoom.roommateId)!==String(attendee.id))continue;
        roomKey=`shared:${[String(attendee.id),String(mate.id)].sort().join("+")}`;
      }
      completed.push({type,roomKey,checkIn,checkOut,occupiedNights:Math.min(dateNights,Math.trunc(actualNights))});
    }
    if(!completed.length)return{rows:[],from:"",to:"",sourceCount:0};
    const sourceFrom=completed.reduce((value,item)=>!value||item.checkIn<value?item.checkIn:value,""),sourceCheckout=completed.reduce((value,item)=>!value||item.checkOut>value?item.checkOut:value,""),sourceTo=addDays(sourceCheckout,-1);
    const from=validIsoDate(range.from)&&range.from>sourceFrom?range.from:sourceFrom,to=validIsoDate(range.to)&&range.to<sourceTo?range.to:sourceTo;
    if(from>to)return{rows:[],from,to,sourceFrom,sourceTo,sourceCheckout,sourceCount:completed.length};
    const rows=[];
    for(let date=from;date<=to;date=addDays(date,1)){
      const rooms={single:new Set(),shared:new Set(),twin_single:new Set()};
      completed.forEach(item=>{if(date>=item.checkIn&&date<item.checkOut&&date<addDays(item.checkIn,item.occupiedNights))rooms[item.type].add(item.roomKey);});
      rows.push({date,single:rooms.single.size,shared:rooms.shared.size,twinSingle:rooms.twin_single.size});
    }
    return{rows,from,to,sourceFrom,sourceTo,sourceCheckout,sourceCount:completed.length};
  }

  function province(attendee){const custom=attendee?.customFields||{};return clean(attendee?.province||custom.province||custom.省份||customValue(custom,/省份|province/i));}
  function rulesWithDefaults(rules={}){
    const priorities=(Array.isArray(rules.pairingPriorities)?rules.pairingPriorities:DEFAULT_PRIORITIES).filter(key=>PRIORITY_LABELS[key]);
    return{
      singleTitles:Array.isArray(rules.singleTitles)?rules.singleTitles:["主任医师","副主任医师"],
      defaultType:normalizeType(rules.defaultType)||"shared",
      twinSingleKeywords:Array.isArray(rules.twinSingleKeywords)?rules.twinSingleKeywords:["标间单住","标间独住"],
      pairingPriorities:[...new Set(priorities.length?priorities:DEFAULT_PRIORITIES)],
      conflictApproval:rules.conflictApproval!==false
    };
  }

  function recommendation(attendee,rules={}){
    const policy=rulesWithDefaults(rules),title=clean(attendee?.title),remarks=clean(attendee?.remarks);
    const singleTitle=policy.singleTitles.some(item=>item&&title.includes(item));
    if(singleTitle&&policy.twinSingleKeywords.some(item=>item&&remarks.includes(item)))return{type:"twin_single",source:"备注要求标间单住"};
    if(singleTitle)return{type:"single",source:"职称规则"};
    return{type:policy.defaultType,source:"默认房型规则"};
  }

  function matchTier(a,b,priorities){
    const values={hospital:[clean(a.hospital),clean(b.hospital)],city:[clean(a.city),clean(b.city)],province:[province(a),province(b)],region:[clean(a.region),clean(b.region)]};
    for(const key of priorities){
      const [left,right]=values[key]||[];
      if(!left||left!==right)continue;
      if(key==="province"&&clean(a.city)&&clean(a.city)===clean(b.city))continue;
      return key;
    }
    return"";
  }

  function autoAssign(attendees,rules={}){
    const policy=rulesWithDefaults(rules),list=(attendees||[]).filter(Boolean),patches=new Map(),byId=new Map(list.map(item=>[String(item.id),item]));
    for(const attendee of list){
      const room=record(attendee),manual=new Set(room.manualFields),suggestion=recommendation(attendee,policy);
      const patch={...room};
      if(!manual.has("assignedType")){patch.assignedType=suggestion.type;patch.assignmentSource=suggestion.source;}
      if(patch.assignedType!=="shared"){patch.roommateId="";patch.roommateSource="";patch.pairingReason="";}
      if(patch.roommateSource==="auto"&&!manual.has("roommateId")){patch.roommateId="";patch.roommateSource="";patch.pairingReason="";}
      patch.pendingManual=patch.assignedType==="shared"&&!patch.roommateId;
      patches.set(String(attendee.id),patch);
    }
    const taken=new Set();
    for(const attendee of list){
      const room=patches.get(String(attendee.id));
      if(room.assignedType!=="shared"||!room.roommateId)continue;
      const mate=byId.get(String(room.roommateId)),mateRoom=mate&&patches.get(String(mate.id));
      if(mate&&mateRoom?.assignedType==="shared"&&normalizeSex(attendee.sex)&&normalizeSex(attendee.sex)===normalizeSex(mate.sex)){taken.add(String(attendee.id));taken.add(String(mate.id));room.pendingManual=false;}
      else if(!new Set(room.manualFields).has("roommateId")){room.roommateId="";room.pendingManual=true;}
    }
    const pool=list.filter(item=>patches.get(String(item.id)).assignedType==="shared"&&!taken.has(String(item.id)));
    for(const attendee of pool){
      const id=String(attendee.id),room=patches.get(id);if(taken.has(id)||room.roommateId)continue;
      const sex=normalizeSex(attendee.sex);if(!sex){room.pendingManual=true;continue;}
      const candidates=pool.filter(other=>String(other.id)!==id&&!taken.has(String(other.id))&&!patches.get(String(other.id)).roommateId&&normalizeSex(other.sex)===sex)
        .map(other=>({other,tier:matchTier(attendee,other,policy.pairingPriorities)})).filter(item=>item.tier)
        .sort((left,right)=>policy.pairingPriorities.indexOf(left.tier)-policy.pairingPriorities.indexOf(right.tier)||String(left.other.name||"").localeCompare(String(right.other.name||""),"zh-CN"));
      const best=candidates[0];if(!best){room.pendingManual=true;continue;}
      const mateId=String(best.other.id),mateRoom=patches.get(mateId),reason=PRIORITY_LABELS[best.tier];
      Object.assign(room,{roommateId:mateId,roommateSource:"auto",pairingReason:reason,pendingManual:false});
      Object.assign(mateRoom,{roommateId:id,roommateSource:"auto",pairingReason:reason,pendingManual:false});
      taken.add(id);taken.add(mateId);
    }
    return patches;
  }

  const api={TYPES,DEFAULT_PRIORITIES,PRIORITY_LABELS,normalizeType,label,record,referenceDates,lodgingDates,nightsBetween,referenceNights,travelReferenceNights,lodgingDateIssue,dailyOccupancy,province,rulesWithDefaults,recommendation,matchTier,autoAssign};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.RoomingEngine=Object.freeze(api);
})(typeof window!=="undefined"?window:globalThis);
