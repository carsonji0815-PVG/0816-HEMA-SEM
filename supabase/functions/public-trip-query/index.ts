import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://139.196.97.236",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

const hash = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
};

const clean = (value: unknown, max = 200) => String(value || "").replace(/[\u200B-\u200D\uFEFF]/gu,"").replace(/\u3000/gu," ").trim().replace(/\s+/gu," ").slice(0, max);
const normalized = (value: unknown, max = 200) => clean(value, max).replace(/\s+/g, "").toLowerCase();
const yes = (value: unknown) => ["Y", "true", "1", "是"].includes(String(value));
const transportType = (value: unknown) => ({飞机:"PLANE",高铁:"HIGH_SPEED_RAIL",本地参会:"LOCAL_ATTEND",PLANE:"PLANE",HIGH_SPEED_RAIL:"HIGH_SPEED_RAIL",LOCAL_ATTEND:"LOCAL_ATTEND"}[clean(value,30)] || "");
const notificationLabels:Record<string,string>={
  phone:"手机号",email:"邮箱",hospital:"单位 / 医院",title:"职称",depart_city:"去程出发城市",depart_station:"去程出发场站",
  out_departure:"去程出发时间",arrive_city:"去程抵达城市",arrive_station:"去程抵达场站",out_no:"去程航班 / 车次号",
  return_depart_city:"返程出发城市",return_depart_station:"返程出发场站",return_departure:"返程出发时间",
  return_arrive_city:"返程抵达城市",return_arrive_station:"返程抵达场站",return_no:"返程航班 / 车次号",
  outbound_transfer_origin:"去程接送地点",outbound_transfer_time:"去程接送时间",outbound_transfer_notes:"去程接送备注",
  return_transfer_destination:"返程接送地点",return_transfer_time:"返程接送时间",return_transfer_notes:"返程接送备注",
};
const displayValue=(value:unknown)=>value===null||value===undefined||value===""?"未填写":typeof value==="object"?JSON.stringify(value):String(value);
const publicChangeDetails=(before:Record<string,unknown>,after:Record<string,unknown>)=>{
  const changes=Object.keys(notificationLabels).filter(key=>displayValue(before[key])!==displayValue(after[key])).map(key=>({field:key,label:notificationLabels[key],before:displayValue(before[key]),after:displayValue(after[key])}));
  const beforeCustom=(before.custom_fields||{}) as Record<string,unknown>,afterCustom=(after.custom_fields||{}) as Record<string,unknown>;
  for(const key of new Set([...Object.keys(beforeCustom),...Object.keys(afterCustom)])){
    if(key.startsWith("_"))continue;
    if(displayValue(beforeCustom[key])!==displayValue(afterCustom[key]))changes.push({field:`custom_fields.${key}`,label:`自定义字段：${key}`,before:displayValue(beforeCustom[key]),after:displayValue(afterCustom[key])});
  }
  return changes;
};
const registrationView = (row: Record<string, unknown>) => ({
  attendeeType: row.attendee_type || "HCP", name: row.name || "", city: row.city || "", hospital: row.hospital || "", department: row.department || "", title: row.title || "", venue: row.venue || "", sex: row.sex || "",
  idNumber: row.id_number === "待补充" ? "" : row.id_number || "", phone: row.phone || "", hcpId: String(row.hcp_id || "").startsWith("WEB-") ? "" : row.hcp_id || "", accommodation: row.accommodation ? "Y" : "N", flight: row.is_flight ? "Y" : "N",
  departDate:row.depart_date||row.out_date||"",departCity:row.depart_city||row.out_from||"",departTransportType:row.depart_transport_type||"",departStation:row.depart_station||"",
  arriveDate:row.arrive_date||row.out_date||"",arriveCity:row.arrive_city||row.out_to||"",arriveTransportType:row.arrive_transport_type||"",arriveStation:row.arrive_station||"",
  returnDepartDate:row.return_depart_date||row.return_date||"",returnDepartCity:row.return_depart_city||row.return_from||"",returnDepartTransportType:row.return_depart_transport_type||"",returnDepartStation:row.return_depart_station||"",
  returnArriveDate:row.return_arrive_date||row.return_date||"",returnArriveCity:row.return_arrive_city||row.return_to||"",returnArriveTransportType:row.return_arrive_transport_type||"",returnArriveStation:row.return_arrive_station||"",
  outDate: row.out_date || "", outFrom: row.out_from || "", outTo: row.out_to || "", outNo: row.out_no || "", outDeparture: String(row.out_departure || "").slice(0, 5), outArrival: String(row.out_arrival || "").slice(0, 5),
  returnDate: row.return_date || "", returnFrom: row.return_from || "", returnTo: row.return_to || "", returnNo: row.return_no || "", returnDeparture: String(row.return_departure || "").slice(0, 5), returnArrival: String(row.return_arrival || "").slice(0, 5),
  outboundTransferOrigin:row.outbound_transfer_origin||"",outboundTransferTime:String(row.outbound_transfer_time||"").slice(0,16),outboundTransferNotes:row.outbound_transfer_notes||"",outboundTransferDriverName:row.outbound_transfer_driver_name||"",outboundTransferDriverPhone:row.outbound_transfer_driver_phone||"",outboundTransferVehicle:row.outbound_transfer_vehicle||"",returnTransferDestination:row.return_transfer_destination||"",returnTransferTime:String(row.return_transfer_time||"").slice(0,16),returnTransferNotes:row.return_transfer_notes||"",returnTransferDriverName:row.return_transfer_driver_name||"",returnTransferDriverPhone:row.return_transfer_driver_phone||"",returnTransferVehicle:row.return_transfer_vehicle||"",
  region: row.region || "", contactName: row.contact_name || "", contactMobile: row.contact_mobile || "", mslContact: row.msl_contact || "", remarks: row.remarks === "公开报名认证，待填写完整信息" ? "" : row.remarks || "",
  customFields: row.custom_fields || {},
});
const projectView = (meeting: Record<string, unknown>, systemSettings:Record<string,unknown>={}) => ({
  slug: meeting.slug || "", name: meeting.name || "参会服务", clientName: meeting.client_name || "", venues: meeting.venues || [], servicePhone: meeting.service_phone || "", brandColor: meeting.brand_color || "#5267d9", fieldConfig: meeting.field_config || {}, flightLeadMinutes: meeting.flight_lead_minutes || 120, trainLeadMinutes: meeting.train_lead_minutes || 90,
  startDate: meeting.start_date || "", endDate: meeting.end_date || "", deadline: meeting.deadline || "", masterLocked: !!meeting.master_locked, archiveReady: !!meeting.archive_ready,
  templateName: meeting.template_name || "", registrationTemplate: meeting.registration_template || {}, templateImported:!!meeting.template_imported_at,
  registrationOpen:!!meeting.registration_open, newRegistrationAllowed:!!meeting.registration_open,
  managementOpen:true, managerEditEnabled:!!meeting.manager_attendee_edit_enabled, activityType:meeting.activity_type||"external", meetingType:meeting.activity_type==="internal"?"INTERNAL":"EXTERNAL", transferCollectionEnabled:!!meeting.transfer_collection_enabled, transferCollectionRoles:Array.isArray(meeting.transfer_collection_roles)?meeting.transfer_collection_roles:[],
  stationDictionary:Array.isArray(systemSettings.stationDictionary)?systemSettings.stationDictionary:[],
});
const registrationRegions = (meeting:Record<string,unknown>) => {
  const fieldConfig=(meeting.field_config||{}) as Record<string,unknown>;
  const values=Array.isArray(fieldConfig.quotaRegions)?fieldConfig.quotaRegions:[];
  return [...new Set(values.map(value=>clean(value,50)).filter(value=>value&&value!=="未填写大区"))];
};
const registrantIdentityFields=(meeting:Record<string,unknown>)=>{
  const config=(meeting.field_config||{}) as Record<string,unknown>,allowed=["region","name","employeeNo","phone"];
  const configured=Array.isArray(config.registrationIdentityFields)?config.registrationIdentityFields.map(String).filter(field=>allowed.includes(field)):[];
  return configured.length&&configured.some(field=>field==="employeeNo"||field==="phone")?[...new Set(configured)]:["region","name","employeeNo"];
};

export default {
fetch: withSupabase({ auth: ["publishable", "secret"] }, async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET","POST"].includes(request.method)) return reply({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return reply({ error: "Service unavailable" }, 503);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let payload: Record<string, unknown>;
  try { payload = request.method==="GET"?Object.fromEntries(new URL(request.url).searchParams.entries()):await request.json(); } catch { return reply({ error: "Invalid request" }, 400); }
  const action = clean(payload.action, 50);
  if(action==="station-list"){
    const cityName=clean(payload.cityName,50),type=transportType(payload.transportType||payload.transport_type);
    if(!cityName||!["PLANE","HIGH_SPEED_RAIL"].includes(type))return reply({success:true,data:[]});
    const{data,error}=await db.rpc("get_station_list",{p_city_name:cityName,p_transport_type:type});
    return error?reply({success:false,error:"读取场站失败"},500):reply({success:true,data:data||[]});
  }
  if(action==="station-cities"){
    const{data,error}=await db.rpc("get_station_cities");
    return error?reply({success:false,error:"读取城市失败"},500):reply({success:true,data:(data||[]).map((item:Record<string,unknown>)=>item.city_name)});
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = await hash(`${forwarded}:${Deno.env.get("QUERY_RATE_SALT") || "journey-desk"}`);
  const {data:systemConfiguration}=await db.from("system_configuration").select("settings").eq("singleton",true).maybeSingle();
  const systemSettings=(systemConfiguration?.settings||{}) as Record<string,unknown>;
  systemSettings.stationDictionary=[];
  const viewProject=(meeting:Record<string,unknown>)=>projectView(meeting,systemSettings);
  const enforceRateLimit=async(key:string,limit:number)=>{const scopedHash=await hash(`${forwarded}:${key}:${Deno.env.get("QUERY_RATE_SALT")||"journey-desk"}`);const since=new Date(Date.now()-10*60*1000).toISOString();const{count}=await db.from("public_query_logs").select("id",{count:"exact",head:true}).eq("ip_hash",scopedHash).gte("created_at",since);if((count||0)>=limit)return false;await db.from("public_query_logs").insert({ip_hash:scopedHash});return true;};

  const slug = clean(payload.meeting, 100);
  if (action === "list-projects") {
    const { data:meetings, error } = await db.from("meetings").select("id,slug,name,client_name,start_date,end_date,venues,service_phone,brand_color,field_config,template_name,registration_template,template_imported_at,flight_lead_minutes,train_lead_minutes,deadline,master_locked,registration_open,manager_attendee_edit_enabled,activity_type,transfer_collection_enabled,transfer_collection_roles").is("archived_at",null).or("registration_open.eq.true,template_imported_at.not.is.null").order("start_date",{ascending:false}).limit(50);
    if (error) return reply({ error:"读取项目列表失败" }, 500);
    return reply({ projects:(meetings || []).map(viewProject) });
  }
  if (!slug) return reply({ error: "报名链接缺少项目编号，请使用项目专属二维码或链接" }, 400);

  const { data: meeting } = await db.from("meetings").select("id,slug,name,client_name,start_date,end_date,venues,service_phone,brand_color,field_config,template_name,registration_template,template_imported_at,flight_lead_minutes,train_lead_minutes,deadline,master_locked,registration_open,manager_attendee_edit_enabled,allowed_departure_cities,check_city_mismatch,check_departure_city,activity_type,transfer_collection_enabled,transfer_collection_roles").eq("slug", slug).is("archived_at",null).maybeSingle();
  if (!meeting) return reply({ error: "未找到会议" }, 404);
  if (action === "project-info") return reply({ project:viewProject(meeting) });

  if (action === "register") return reply({ error:"报名页面已更新，请刷新后重新填写" }, 426);

  if (action === "registrant-login") {
    const identityFields=registrantIdentityFields(meeting);
    const name = clean(payload.name, 50);
    const regionInput = clean(payload.region, 50);
    const employeeNo = clean(payload.employeeNo, 50);
    const employeeNoNorm = normalized(employeeNo, 50);
    const phone=clean(payload.registrantPhone,20).replace(/\D/g,"").slice(-11);
    const mode = clean(payload.mode, 20) === "manage" ? "manage" : "register";
    const values:Record<string,string>={region:regionInput,name,employeeNo:employeeNoNorm,phone};
    const regions=registrationRegions(meeting);
    const missing=identityFields.filter(field=>!(field==="region"&&!regions.length)&&!values[field]);
    if(missing.length)return reply({error:`请填写${missing.map(field=>({region:"大区",name:"姓名",employeeNo:"员工编号",phone:"手机号"} as Record<string,string>)[field]).join("、")}`},400);
    if(identityFields.includes("phone")&&!/^1\d{10}$/.test(phone))return reply({error:"请填写正确的11位手机号"},400);
    const configuredRegion=regions.find(value=>normalized(value,50)===normalized(regionInput,50));
    if(identityFields.includes("region")&&regions.length&&!configuredRegion)return reply({error:"请选择当前会议配置的大区"},400);
    const requestedRegion=identityFields.includes("region")?(regions.length?configuredRegion||"":regionInput):"";
    const identityColumn=identityFields.includes("employeeNo")?"employee_no_norm":"phone_norm",identityValue=identityColumn==="employee_no_norm"?employeeNoNorm:phone;
    if(!await enforceRateLimit(`registrant-login:${meeting.id}:${identityValue}`,30))return reply({error:"身份进入尝试过于频繁，请10分钟后重试"},429);
    let { data:registrant, error:registrantError } = await db.from("registrants").select("*").eq("meeting_id",meeting.id).eq(identityColumn,identityValue).maybeSingle();
    if (registrantError) return reply({ error:"身份校验暂不可用，请稍后重试" },500);
    if (registrant) {
      if(identityFields.includes("name")&&normalized(registrant.display_name,50)!==normalized(name,50)) return reply({ error:"填报人身份信息不匹配，请核对后重试" },403);
      if(identityFields.includes("phone")&&registrant.phone_norm&&registrant.phone_norm!==phone)return reply({error:"填报人身份信息不匹配，请核对后重试"},403);
      if(requestedRegion&&registrant.region&&normalized(registrant.region,50)!==normalized(requestedRegion,50))return reply({error:"填报人身份信息不匹配，请核对后重试"},403);
      if (!registrant.active) return reply({ error:"该填报人账号已停用，请联系会务负责人" },403);
      const additions:Record<string,string>={};if(requestedRegion&&!registrant.region)additions.region=requestedRegion;if(identityFields.includes("phone")&&!registrant.phone_norm){additions.phone=phone;additions.phone_norm=phone;}if(Object.keys(additions).length){const updated=await db.from("registrants").update(additions).eq("id",registrant.id).select("*").single();if(updated.error||!updated.data)return reply({error:"填报人信息保存失败，请稍后重试"},500);registrant=updated.data;}
    } else {
      const createResult=await db.from("registrants").insert({meeting_id:meeting.id,region:requestedRegion,display_name:name,employee_no:employeeNo,employee_no_norm:employeeNoNorm,phone:identityFields.includes("phone")?phone:null,phone_norm:identityFields.includes("phone")?phone:null}).select("*").single();
      if (createResult.error || !createResult.data) return reply({ error:"填报人身份建立失败，请稍后重试" },500);
      registrant=createResult.data;
    }
    await db.from("operation_audit_logs").insert({ meeting_id:meeting.id, actor_label:[name,employeeNo||phone].filter(Boolean).join("（")+(name&&(employeeNo||phone)?"）":""), action:"registrant_login", target_type:"registrant", metadata:{ region:registrant.region||"", name, employeeNo, phone, identityFields, mode, ipHash } });
    const tokenBytes=crypto.getRandomValues(new Uint8Array(32));
    const sessionToken=[...tokenBytes].map(byte=>byte.toString(16).padStart(2,"0")).join("");
    const tokenHash=await hash(sessionToken);
    const expiresAt=new Date(Date.now()+60*60*1000).toISOString();
    const { error:sessionError }=await db.from("public_registration_sessions").insert({meeting_id:meeting.id,registrant_id:registrant.id,token_hash:tokenHash,expires_at:expiresAt});
    if (sessionError) return reply({ error:"登录会话创建失败，请稍后重试" },500);
    const { data: attendees, error } = await db.from("attendees").select("*")
      .eq("meeting_id", meeting.id).eq("registrant_id",registrant.id).order("created_at", { ascending:false });
    if (error) return reply({ error:"读取报名名单失败，请稍后重试" }, 500);
    return reply({ authenticated:true, sessionToken, expiresAt, mode, project:viewProject(meeting), registrant:{id:registrant.id,region:registrant.region,name:registrant.display_name,employeeNo:registrant.employee_no,phone:registrant.phone||""}, attendees:(attendees || []).map(row => ({ id:row.id, rowLocked:!!row.row_locked, approval:row.approval || "normal", ticketStatus:row.ticket_status || "pending", businessStatus:row.business_status||"active", ...registrationView(row) })) });
  }

  if (action === "save-attendee") {
    const sessionToken=clean(payload.sessionToken,200);
    if (!sessionToken) return reply({error:"报名会话已失效，请重新进入"},401);
    const sessionHash=await hash(sessionToken);
    const { data:session }=await db.from("public_registration_sessions").select("id,registrant_id,expires_at,registrants(*)").eq("meeting_id",meeting.id).eq("token_hash",sessionHash).gt("expires_at",new Date().toISOString()).maybeSingle();
    const registrantRaw=Array.isArray(session?.registrants)?session?.registrants[0]:session?.registrants;
    const registrant=registrantRaw as Record<string,unknown>|null;
    if (!session || !registrant || !registrant.active) return reply({error:"报名会话已过期，请重新进入"},401);
    const refreshedExpiry=new Date(Date.now()+60*60*1000).toISOString();
    await db.from("public_registration_sessions").update({last_used_at:new Date().toISOString(),expires_at:refreshedExpiry}).eq("id",session.id);
    const details = payload.details && typeof payload.details === "object" && !Array.isArray(payload.details) ? payload.details as Record<string,unknown> : {};
    const attendeeId = clean(payload.attendeeId, 100);
    const attendeeName = clean(details.name, 50);
    const attendeePhone = clean(details.phone, 20).replace(/\D/g, "").slice(-11);
    if (!attendeeName || !/^1\d{10}$/.test(attendeePhone)) return reply({ error:"请填写参会人员姓名和正确的手机号" }, 400);
    if (meeting.master_locked) return reply({ error:"项目名单已锁定，不能新增或修改" }, 423);

    let attendee: Record<string,unknown> | null = null;
    if (attendeeId) {
      const { data } = await db.from("attendees").select("*").eq("id",attendeeId).eq("meeting_id",meeting.id).maybeSingle();
      attendee = data;
      if (!attendee || attendee.registrant_id !== session.registrant_id) return reply({ error:"您无权修改该参会人员" }, 403);
      if (attendee.business_status === "cancelled") return reply({ error:"该报名已取消，不能继续修改" },409);
      if (attendee.row_locked) return reply({ error:"该参会人员信息已锁定，不能修改" }, 423);
    } else {
      if (!meeting.registration_open) return reply({error:"当前项目已暂停新增报名，您仍可更改已报名或查询参会信息"},423);
      if (!meeting.template_imported_at) return reply({error:"项目尚未导入报名表模板，暂不能新增报名"},423);
      if (meeting.deadline && new Date(meeting.deadline).getTime() < Date.now()) return reply({ error:"报名已截止，请联系会务负责人" }, 410);
    }

    const requestedCustom = details.customFields && typeof details.customFields === "object" && !Array.isArray(details.customFields) ? details.customFields as Record<string,unknown> : {};
    const allowedCustom = new Set(((meeting.registration_template as {columns?:Array<{key?:string,custom?:boolean}>})?.columns || []).filter(column=>column.custom).map(column=>clean(column.key,80)));
    if(meeting.activity_type==="internal")["businessUnit","internalPosition","employeeNo"].forEach(key=>allowedCustom.add(key));
    if(((meeting.field_config||{}) as Record<string,unknown>).clothingSize===true)allowedCustom.add("clothingSize");
    const internalCustom=Object.fromEntries(Object.entries((attendee?.custom_fields as Record<string,unknown>)||{}).filter(([key])=>key.startsWith("_")));
    const rawJourneySegments=Array.isArray(details.journeySegments)?details.journeySegments:[];
    if(rawJourneySegments.length>18)return reply({error:"单个参会人员最多可增加18段行程"},400);
    const journeySegments=rawJourneySegments.map((raw,index)=>{const item=(raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{}) as Record<string,unknown>,type=transportType(item.transportType);return{id:/^[a-zA-Z0-9-]{8,80}$/.test(clean(item.id,80))?clean(item.id,80):crypto.randomUUID(),direction:item.direction==="return"?"return":"outbound",order:index+2,departDate:clean(item.departDate,10),departCity:clean(item.departCity,50),transportType:type,departStation:type==="LOCAL_ATTEND"?"":clean(item.departStation,120),arriveDate:clean(item.arriveDate,10),arriveCity:clean(item.arriveCity,50),arriveStation:type==="LOCAL_ATTEND"?"":clean(item.arriveStation,120),number:clean(item.number,30),departure:clean(item.departure,5),arrival:clean(item.arrival,5)};});
    const customFields = {...internalCustom,...Object.fromEntries(Object.entries(requestedCustom).filter(([key])=>allowedCustom.has(key)).slice(0,50).map(([key,value])=>[key,clean(value,500)])),_journeySegments:journeySegments};
    const departType=transportType(details.departTransportType),arriveType=departType,returnDepartType=transportType(details.returnDepartTransportType),returnArriveType=returnDepartType;
    let departStation=departType==="LOCAL_ATTEND"?null:clean(details.departStation,120)||null,arriveStation=arriveType==="LOCAL_ATTEND"?null:clean(details.arriveStation,120)||null;
    let returnDepartStation=returnDepartType==="LOCAL_ATTEND"?null:clean(details.returnDepartStation,120)||null,returnArriveStation=returnArriveType==="LOCAL_ATTEND"?null:clean(details.returnArriveStation,120)||null;
    const stationChecks=[
      {label:"出发场站",city:details.departCity,type:departType,value:departStation,set:(value:string)=>departStation=value},
      {label:"抵达场站",city:details.arriveCity,type:arriveType,value:arriveStation,set:(value:string)=>arriveStation=value},
      {label:"返程出发场站",city:details.returnDepartCity,type:returnDepartType,value:returnDepartStation,set:(value:string)=>returnDepartStation=value},
      {label:"返程抵达场站",city:details.returnArriveCity,type:returnArriveType,value:returnArriveStation,set:(value:string)=>returnArriveStation=value},
      ...journeySegments.flatMap((segment,index)=>[
        {label:`${segment.direction==="return"?"返程":"去程"}新增第${index+2}段出发场站`,city:segment.departCity,type:segment.transportType,value:segment.departStation,set:(value:string)=>segment.departStation=value},
        {label:`${segment.direction==="return"?"返程":"去程"}新增第${index+2}段抵达场站`,city:segment.arriveCity,type:segment.transportType,value:segment.arriveStation,set:(value:string)=>segment.arriveStation=value},
      ]),
    ].filter(item=>item.type!=="LOCAL_ATTEND"&&item.city&&item.value);
    const stationResults=await Promise.all(stationChecks.map(item=>db.rpc("get_station_list",{p_city_name:clean(item.city,50),p_transport_type:item.type})));
    for(let index=0;index<stationChecks.length;index++){
      const item=stationChecks[index],rows=(stationResults[index].data||[]) as Array<Record<string,unknown>>;
      if(stationResults[index].error)continue;
      const matched=rows.find(row=>normalized(row.station_name,150)===normalized(item.value,150)||normalized(row.station_short_name,150)===normalized(item.value,150));
      if(rows.length&&!matched)return reply({error:`${item.label}与城市、出行方式不匹配，请重新选择`},400);
      if(matched)item.set(clean(matched.station_name,120));
    }
    const requestedAttendeeType=clean(details.attendeeType,30)||"HCP";const transferRole=/赞助商|sponsor/i.test(requestedAttendeeType)?"赞助商":/主席|主持|讲者|讨论嘉宾|组长|嘉宾|chair|moderator|speaker|panelist/i.test(requestedAttendeeType)?"角色嘉宾":"听众";const transferAllowed=!!meeting.transfer_collection_enabled&&Array.isArray(meeting.transfer_collection_roles)&&(meeting.transfer_collection_roles as unknown[]).map(String).includes(transferRole);const transferValue=(key:string,value:unknown,max:number)=>transferAllowed?(clean(value,max)||null):(attendee?.[key]||null);
    const values: Record<string,unknown> = {
      attendee_type:clean(details.attendeeType,30) || "HCP", name:attendeeName, city:clean(details.city,50), hospital:clean(details.hospital,100), department:clean(details.department,100), title:clean(details.title,50), venue:clean(details.venue,50), sex:clean(details.sex,10), id_number:clean(details.idNumber,100), phone:attendeePhone, hcp_id:clean(details.hcpId,100), accommodation:yes(details.accommodation), is_flight:yes(details.flight), region:clean(registrant.region,50),
      depart_date:clean(details.departDate,10)||null,depart_city:clean(details.departCity,50),depart_transport_type:departType||null,depart_station:departStation,
      arrive_date:clean(details.arriveDate,10)||null,arrive_city:clean(details.arriveCity,50),arrive_transport_type:arriveType||null,arrive_station:arriveStation,
      return_depart_date:clean(details.returnDepartDate,10)||null,return_depart_city:clean(details.returnDepartCity,50),return_depart_transport_type:returnDepartType||null,return_depart_station:returnDepartStation,
      return_arrive_date:clean(details.returnArriveDate,10)||null,return_arrive_city:clean(details.returnArriveCity,50),return_arrive_transport_type:returnArriveType||null,return_arrive_station:returnArriveStation,
      out_date:clean(details.departDate,10) || null, out_from:departStation||clean(details.departCity,50), out_to:arriveStation||clean(details.arriveCity,50), out_no:clean(details.outNo,30), out_departure:clean(details.outDeparture,5) || null, out_arrival:clean(details.outArrival,5) || null,
      return_date:clean(details.returnDepartDate,10) || null, return_from:returnDepartStation||clean(details.returnDepartCity,50), return_to:returnArriveStation||clean(details.returnArriveCity,50), return_no:clean(details.returnNo,30), return_departure:clean(details.returnDeparture,5) || null, return_arrival:clean(details.returnArrival,5) || null,
      contact_name:clean(details.contactName,50), contact_mobile:clean(details.contactMobile,20).replace(/\D/g,"").slice(-11), msl_contact:clean(details.mslContact,50), remarks:clean(details.remarks,500), custom_fields:customFields,
      outbound_transfer_origin:transferValue("outbound_transfer_origin",details.outboundTransferOrigin,200),outbound_transfer_time:transferValue("outbound_transfer_time",details.outboundTransferTime,30),outbound_transfer_notes:transferValue("outbound_transfer_notes",details.outboundTransferNotes,500),return_transfer_destination:transferValue("return_transfer_destination",details.returnTransferDestination,200),return_transfer_time:attendee?.return_transfer_time||null,return_transfer_notes:transferValue("return_transfer_notes",details.returnTransferNotes,500),
    };
    if(meeting.activity_type==="internal")Object.assign(values,{attendee_type:"内部员工",city:null,hospital:null,department:null,title:null,hcp_id:null,contact_name:null,contact_mobile:null,msl_contact:null});
    const keyToDb:Record<string,string>={attendeeType:"attendee_type",name:"name",city:"city",hospital:"hospital",department:"department",title:"title",venue:"venue",sex:"sex",idNumber:"id_number",phone:"phone",hcpId:"hcp_id",accommodation:"accommodation",flight:"is_flight",region:"region",departDate:"depart_date",departCity:"depart_city",departTransportType:"depart_transport_type",departStation:"depart_station",arriveDate:"arrive_date",arriveCity:"arrive_city",arriveTransportType:"arrive_transport_type",arriveStation:"arrive_station",returnDepartDate:"return_depart_date",returnDepartCity:"return_depart_city",returnDepartTransportType:"return_depart_transport_type",returnDepartStation:"return_depart_station",returnArriveDate:"return_arrive_date",returnArriveCity:"return_arrive_city",returnArriveTransportType:"return_arrive_transport_type",returnArriveStation:"return_arrive_station",outDate:"out_date",outFrom:"out_from",outTo:"out_to",outNo:"out_no",outDeparture:"out_departure",outArrival:"out_arrival",returnDate:"return_date",returnFrom:"return_from",returnTo:"return_to",returnNo:"return_no",returnDeparture:"return_departure",returnArrival:"return_arrival",contactName:"contact_name",contactMobile:"contact_mobile",mslContact:"msl_contact",remarks:"remarks"};
    const configuredColumns=((meeting.registration_template as {columns?:Array<{key?:string,required?:boolean,custom?:boolean}>})?.columns || []);
    const templateColumns=meeting.activity_type==="internal"?["name","phone","region","businessUnit","internalPosition","employeeNo"].map(key=>({key,required:true,custom:["businessUnit","internalPosition","employeeNo"].includes(key)})):configuredColumns.length ? configuredColumns : ["name","phone","region","idNumber","outDate","outFrom","outTo","outNo","outDeparture","outArrival","returnDate","returnFrom","returnTo","returnNo","returnDeparture","returnArrival","contactName","contactMobile"].map(key=>({key,required:true,custom:false}));
    const missingRequired=templateColumns.filter(column=>column.required).some(column=>{ const value=column.custom ? customFields[clean(column.key,80)] : values[keyToDb[clean(column.key,80)]]; return value === null || value === undefined || value === ""; });
    const validDate=(value:unknown)=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
    const validTime=(value:unknown)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||""));
    const extraJourneyMissing=journeySegments.some(item=>!validDate(item.departDate)||!item.departCity||!item.transportType||!validDate(item.arriveDate)||!item.arriveCity||!item.number||!validTime(item.departure)||!validTime(item.arrival)||(item.transportType!=="LOCAL_ATTEND"&&(!item.departStation||!item.arriveStation)));
    const journeyMissing=!validDate(values.depart_date)||!values.depart_city||!departType||!validDate(values.arrive_date)||!values.arrive_city||!arriveType||(departType!=="LOCAL_ATTEND"&&!departStation)||(arriveType!=="LOCAL_ATTEND"&&!arriveStation)||!validDate(values.return_depart_date)||!values.return_depart_city||!returnDepartType||!validDate(values.return_arrive_date)||!values.return_arrive_city||!returnArriveType||(returnDepartType!=="LOCAL_ATTEND"&&!returnDepartStation)||(returnArriveType!=="LOCAL_ATTEND"&&!returnArriveStation)||extraJourneyMissing;
    if (missingRequired||journeyMissing) return reply({ error:"请完整填写当前项目报名模板和行程信息" }, 400);

    if (attendee) {
      const { data:locks } = await db.from("column_locks").select("field_group").eq("meeting_id",meeting.id).eq("locked",true);
      const groups:Record<string,string[]>={identity:["attendee_type","name","city","hospital","department","title","venue","sex","id_number","phone","hcp_id","region"],contact:["contact_name","contact_mobile"],outbound:["depart_date","depart_city","depart_transport_type","depart_station","arrive_date","arrive_city","arrive_transport_type","arrive_station","out_date","out_from","out_to","out_no","out_departure","out_arrival"],return:["return_depart_date","return_depart_city","return_depart_transport_type","return_depart_station","return_arrive_date","return_arrive_city","return_arrive_transport_type","return_arrive_station","return_date","return_from","return_to","return_no","return_departure","return_arrival"],accommodation:["accommodation","is_flight"],remarks:["msl_contact","remarks"]};
      const oldSegments=Array.isArray((attendee.custom_fields as Record<string,unknown>)?._journeySegments)?((attendee.custom_fields as Record<string,unknown>)._journeySegments as Array<Record<string,unknown>>):[];
      const lockedChange=(locks || []).find(lock=>(groups[lock.field_group] || []).some(key=>String(attendee?.[key] ?? "") !== String(values[key] ?? ""))||["outbound","return"].includes(lock.field_group)&&JSON.stringify(oldSegments.filter(item=>(item.direction==="return"?"return":"outbound")===lock.field_group))!==JSON.stringify(journeySegments.filter(item=>item.direction===lock.field_group)));
      if (lockedChange) return reply({ error:`${lockedChange.field_group} 相关字段已锁定，不能修改` }, 423);
    }

    const outboundRisks:string[]=[]; const returnRisks:string[]=[];
    const meetingConfig=(meeting.field_config||{}) as Record<string,unknown>;
    const approvalRules=(meetingConfig.travelApprovalRules||{}) as Record<string,unknown>;
    const externalMeeting=meeting.activity_type!=="internal";
    if (externalMeeting && (approvalRules.mismatchEnabled ?? meeting.check_city_mismatch) && values.depart_city !== values.return_arrive_city) returnRisks.push("去程出发城市与返程抵达城市不一致");
    if (externalMeeting && approvalRules.timeEnabled) {
      const arrivalAt=values.arrive_date?new Date(`${values.arrive_date}T${values.out_arrival||"00:00"}:00+08:00`).getTime():NaN;
      const departureAt=values.return_depart_date?new Date(`${values.return_depart_date}T${values.return_departure||"00:00"}:00+08:00`).getTime():NaN;
      const earliest=Date.parse(String(approvalRules.earliestArrival||approvalRules.arrivalStart||""));
      const latest=Date.parse(String(approvalRules.latestDeparture||approvalRules.returnEnd||""));
      if(Number.isFinite(arrivalAt)&&Number.isFinite(earliest)&&arrivalAt<earliest)outboundRisks.push("去程抵达早于会议允许最早抵达时间");
      if(Number.isFinite(departureAt)&&Number.isFinite(latest)&&departureAt>latest)returnRisks.push("返程撤离晚于会议允许最晚撤离时间");
    }
    const outboundChanged=!attendee || ["depart_date","depart_city","depart_transport_type","depart_station","arrive_date","arrive_city","arrive_transport_type","arrive_station","out_date","out_from","out_to","out_no","out_departure","out_arrival"].some(key=>String(attendee?.[key]??"")!==String(values[key]??""));
    const returnChanged=!attendee || ["return_depart_date","return_depart_city","return_depart_transport_type","return_depart_station","return_arrive_date","return_arrive_city","return_arrive_transport_type","return_arrive_station","return_date","return_from","return_to","return_no","return_departure","return_arrival"].some(key=>String(attendee?.[key]??"")!==String(values[key]??""));
    const outboundApproval=outboundRisks.length?(outboundChanged?"pending":attendee?.outbound_approval_status||"pending"):"normal";
    const returnApproval=returnRisks.length?(returnChanged?"pending":attendee?.return_approval_status||"pending"):"normal";
    const aggregateApproval=[outboundApproval,returnApproval].some(status=>["pending","rejected"].includes(String(status)))?"pending":[outboundApproval,returnApproval].some(status=>status==="approved")?"approved":"normal";
    const updateValues={...values,outbound_approval_status:outboundApproval,return_approval_status:returnApproval,approval:aggregateApproval,risks:[...outboundRisks,...returnRisks]};
    let saved:Record<string,unknown>|null=null; let saveError;
    if (attendee) ({ data:saved, error:saveError } = await db.from("attendees").update(updateValues).eq("id",attendee.id).select("*").single());
    else {
      const { data:owner } = await db.from("meeting_members").select("user_id").eq("meeting_id",meeting.id).eq("role","ops").order("created_at",{ascending:true}).limit(1).maybeSingle();
      if (!owner) return reply({ error:"会务负责人尚未配置，请稍后再试" }, 503);
      ({ data:saved, error:saveError } = await db.from("attendees").insert({...updateValues,meeting_id:meeting.id,owner_id:owner.user_id,registrant_id:session.registrant_id,business_status:"active",privacy_letter_status:"pending",ticket_status:"pending"}).select("*").single());
    }
    if (saveError || !saved) {const message=String(saveError?.message||"");if(message.includes("名额"))return reply({error:message},409);return reply({ error:message.includes("duplicate") ? "该参会人员手机号已在本项目中报名" : "报名保存失败，请稍后重试" }, 500);}
    const changes=attendee?publicChangeDetails(attendee,saved):[];
    if(!attendee||changes.length){
      const message=!attendee?`【新报名提交】${saved.name}`:`${saved.name}发生报名信息变更（${changes.length}项）`;
      await db.from("notifications").insert({meeting_id:meeting.id,attendee_id:saved.id,recipient_id:null,type:attendee?"change":"create",message,actor_label:`${registrant.display_name}（报名端）`,source:"public_registration",change_details:changes,email_requested:false});
    }
    return reply({ saved:true, attendee:{id:saved.id,rowLocked:!!saved.row_locked,approval:saved.approval||"normal",ticketStatus:saved.ticket_status||"pending",businessStatus:saved.business_status||"active",...registrationView(saved)}, needsApproval:aggregateApproval==="pending", project:viewProject(meeting) });
  }

  if (action === "cancel-attendee") {
    const sessionToken=clean(payload.sessionToken,200); const attendeeId=clean(payload.attendeeId,100);
    if (!sessionToken || !attendeeId) return reply({error:"请求信息不完整"},400);
    const sessionHash=await hash(sessionToken);
    const { data:session }=await db.from("public_registration_sessions").select("id,registrant_id,expires_at").eq("meeting_id",meeting.id).eq("token_hash",sessionHash).gt("expires_at",new Date().toISOString()).maybeSingle();
    if (!session) return reply({error:"报名会话已过期，请重新进入"},401);
    const { data:attendee }=await db.from("attendees").select("*").eq("id",attendeeId).eq("meeting_id",meeting.id).eq("registrant_id",session.registrant_id).maybeSingle();
    if (!attendee) return reply({error:"您无权取消该报名"},403);
    if (attendee.business_status==="cancelled") return reply({cancelled:true});
    if (meeting.master_locked || attendee.row_locked) return reply({error:"名单已锁定，不能取消报名"},423);
    const {error}=await db.from("attendees").update({business_status:"cancelled",cancelled_at:new Date().toISOString(),cancelled_by_registrant_id:session.registrant_id}).eq("id",attendee.id);
    if (error) return reply({error:"取消报名失败，请稍后重试"},500);
    return reply({cancelled:true});
  }

  const phone = clean(payload.phone).replace(/\D/g, "").slice(-11);
  if (["authenticate","complete-registration"].includes(action)) return reply({error:"旧版报名入口已停用，请刷新页面后使用员工编号进入"},410);
  if (!/^1\d{10}$/.test(phone)) return reply({ error: "请输入正确的手机号" }, 400);
  if(!await enforceRateLimit(`attendee-lookup:${meeting.id}:${phone}`,20))return reply({error:"该手机号查询过于频繁，请10分钟后重试"},429);

  if (clean(payload.action) === "authenticate") {
    const name = clean(payload.name, 50);
    const region = clean(payload.region, 50);
    if (!name || !region) return reply({ error: "请填写大区和姓名" }, 400);
    if (meeting.master_locked) return reply({ error: "报名已关闭，请联系会务负责人" }, 423);
    if (meeting.deadline && new Date(meeting.deadline).getTime() < Date.now()) return reply({ error: "报名已截止，请联系会务负责人" }, 410);
    const { data: existing } = await db.from("attendees").select("*").eq("meeting_id", meeting.id).eq("phone", phone).maybeSingle();
    if (existing) {
      if (clean(existing.name, 50) !== name || clean(existing.region, 50) !== region) return reply({ error: "大区、姓名或手机号不匹配，请核对后重试" }, 403);
      if (existing.row_locked) return reply({ error: "该报名已锁定，不能修改" }, 423);
      return reply({ authenticated: true, existing: existing.id_number !== "待补充", attendee: registrationView(existing), project:viewProject(meeting) });
    }
    const { data: owner } = await db.from("meeting_members").select("user_id").eq("meeting_id", meeting.id).eq("role", "ops").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!owner) return reply({ error: "会务负责人尚未配置，请稍后再试" }, 503);
    const reference = `WEB-${phone.slice(-4)}-${Date.now().toString(36).toUpperCase()}`;
    const { data: created, error: insertError } = await db.from("attendees").insert({ meeting_id:meeting.id, owner_id:owner.user_id, attendee_type:"HCP", name, region, phone, id_number:"待补充", hcp_id:reference, approval:"normal", risks:[], remarks:"公开报名认证，待填写完整信息" }).select("*").single();
    if (insertError || !created) return reply({ error: "身份验证失败，请稍后重试" }, 500);
    return reply({ authenticated:true, existing:false, attendee:registrationView(created), project:viewProject(meeting) });
  }

  if (clean(payload.action) === "complete-registration") {
    const name = clean(payload.name, 50); const region = clean(payload.region, 50);
    if (!name || !region) return reply({ error:"报名认证已失效，请重新验证" }, 401);
    if (meeting.master_locked) return reply({ error:"报名已锁定，不能修改" }, 423);
    if (meeting.deadline && new Date(meeting.deadline).getTime() < Date.now()) return reply({ error:"报名已截止，请联系会务负责人" }, 410);
    const { data: attendee } = await db.from("attendees").select("*").eq("meeting_id",meeting.id).eq("phone",phone).maybeSingle();
    if (!attendee || clean(attendee.name,50) !== name || clean(attendee.region,50) !== region) return reply({ error:"身份验证失败，请重新验证" }, 403);
    if (attendee.row_locked) return reply({ error:"该报名已锁定，不能修改" }, 423);
    const requestedCustom = payload.customFields && typeof payload.customFields === "object" && !Array.isArray(payload.customFields) ? payload.customFields as Record<string,unknown> : {};
    const allowedCustom = new Set(((meeting.registration_template as {columns?:Array<{key?:string,custom?:boolean}>})?.columns || []).filter(column=>column.custom).map(column=>clean(column.key,80)));
    const customFields = Object.fromEntries(Object.entries(requestedCustom).filter(([key])=>allowedCustom.has(key)).slice(0,50).map(([key,value])=>[key,clean(value,500)]));
    const values = {
      attendee_type:clean(payload.attendeeType,30), city:clean(payload.city,50), hospital:clean(payload.hospital,100), department:clean(payload.department,100), title:clean(payload.title,50), venue:clean(payload.venue,50), sex:clean(payload.sex,10), id_number:clean(payload.idNumber,100), hcp_id:clean(payload.hcpId,100), accommodation:yes(payload.accommodation), is_flight:yes(payload.flight),
      out_date:clean(payload.outDate,10) || null, out_from:clean(payload.outFrom,50), out_to:clean(payload.outTo,50), out_no:clean(payload.outNo,30), out_departure:clean(payload.outDeparture,5) || null, out_arrival:clean(payload.outArrival,5) || null,
      return_date:clean(payload.returnDate,10) || null, return_from:clean(payload.returnFrom,50), return_to:clean(payload.returnTo,50), return_no:clean(payload.returnNo,30), return_departure:clean(payload.returnDeparture,5) || null, return_arrival:clean(payload.returnArrival,5) || null,
      contact_name:clean(payload.contactName,50), contact_mobile:clean(payload.contactMobile,20).replace(/\D/g,""), msl_contact:clean(payload.mslContact,50), remarks:clean(payload.remarks,500), custom_fields:customFields,
    };
    const keyToDb:Record<string,string>={attendeeType:"attendee_type",city:"city",hospital:"hospital",department:"department",title:"title",venue:"venue",sex:"sex",idNumber:"id_number",hcpId:"hcp_id",accommodation:"accommodation",flight:"is_flight",outDate:"out_date",outFrom:"out_from",outTo:"out_to",outNo:"out_no",outDeparture:"out_departure",outArrival:"out_arrival",returnDate:"return_date",returnFrom:"return_from",returnTo:"return_to",returnNo:"return_no",returnDeparture:"return_departure",returnArrival:"return_arrival",contactName:"contact_name",contactMobile:"contact_mobile",mslContact:"msl_contact",remarks:"remarks"};
    const configuredColumns=((meeting.registration_template as {columns?:Array<{key?:string,required?:boolean,custom?:boolean}>})?.columns || []);
    const templateColumns=configuredColumns.length ? configuredColumns : ["attendeeType","city","hospital","department","venue","sex","idNumber","hcpId","outDate","outFrom","outTo","outNo","outDeparture","outArrival","returnDate","returnFrom","returnTo","returnNo","returnDeparture","returnArrival","contactName","contactMobile"].map(key=>({key,required:true,custom:false}));
    const missingRequired=templateColumns.filter(column=>column.required).some(column=>column.custom ? !customFields[clean(column.key,80)] : keyToDb[clean(column.key,80)] && !values[keyToDb[clean(column.key,80)] as keyof typeof values]);
    const contactRequired=templateColumns.some(column=>column.key==="contactMobile"&&column.required);
    if (missingRequired || (contactRequired && !/^1\d{10}$/.test(values.contact_mobile))) return reply({ error:"请完整填写报名表中的必填信息" }, 400);
    if (attendee.id_number !== "待补充") {
      const { data:locks } = await db.from("column_locks").select("field_group").eq("meeting_id",meeting.id).eq("locked",true);
      const groups: Record<string, string[]> = { identity:["attendee_type","city","hospital","department","title","venue","sex","id_number","hcp_id"], contact:["contact_name","contact_mobile"], outbound:["out_date","out_from","out_to","out_no","out_departure","out_arrival"], return:["return_date","return_from","return_to","return_no","return_departure","return_arrival"], accommodation:["accommodation","is_flight"], remarks:["msl_contact","remarks"] };
      const lockedChange = (locks || []).find(lock => (groups[lock.field_group] || []).some(key => String(attendee[key] ?? "") !== String(values[key as keyof typeof values] ?? "")));
      if (lockedChange) return reply({ error:`${lockedChange.field_group} 相关字段已锁定，不能修改` }, 423);
    }
    const outboundRisks:string[]=[]; const returnRisks:string[]=[];
    if (meeting.check_city_mismatch && values.out_from !== values.return_to) returnRisks.push("去程出发城市与返程到达城市不一致");
    if (meeting.check_departure_city && values.out_from && !(meeting.allowed_departure_cities || []).includes(values.out_from)) outboundRisks.push(`出发城市“${values.out_from}”不在预设范围`);
    const risks=[...outboundRisks,...returnRisks];
    const outboundChanged=["out_date","out_from","out_to","out_no","out_departure","out_arrival"].some(key=>String(attendee[key]??"")!==String(values[key as keyof typeof values]??""));
    const returnChanged=["return_date","return_from","return_to","return_no","return_departure","return_arrival"].some(key=>String(attendee[key]??"")!==String(values[key as keyof typeof values]??""));
    const outboundApproval=outboundRisks.length?(outboundChanged?"pending":attendee.outbound_approval_status||"pending"):"normal";
    const returnApproval=returnRisks.length?(returnChanged?"pending":attendee.return_approval_status||"pending"):"normal";
    const aggregateApproval=[outboundApproval,returnApproval].some(status=>["pending","rejected"].includes(status))?"pending":[outboundApproval,returnApproval].some(status=>status==="approved")?"approved":"normal";
    const { error:updateError } = await db.from("attendees").update({ ...values, outbound_approval_status:outboundApproval, return_approval_status:returnApproval, approval:aggregateApproval, risks }).eq("id",attendee.id);
    if (updateError) return reply({ error:updateError.message.includes("锁定") ? "报名已锁定，不能修改" : "报名保存失败，请稍后重试" }, 500);
    return reply({ completed:true, needsApproval:aggregateApproval==="pending", project:viewProject(meeting) });
  }

  const { data: attendee } = await db.from("attendees")
    .select("id,name,venue,accommodation,custom_fields,depart_date,depart_city,depart_transport_type,depart_station,arrive_date,arrive_city,arrive_transport_type,arrive_station,return_depart_date,return_depart_city,return_depart_transport_type,return_depart_station,return_arrive_date,return_arrive_city,return_arrive_transport_type,return_arrive_station,out_date,out_from,out_to,out_no,out_departure,out_arrival,return_date,return_from,return_to,return_no,return_departure,return_arrival,outbound_transfer_origin,outbound_transfer_time,outbound_transfer_notes,outbound_transfer_driver_name,outbound_transfer_driver_phone,outbound_transfer_vehicle,return_transfer_destination,return_transfer_notes,return_transfer_driver_name,return_transfer_driver_phone,return_transfer_vehicle")
    .eq("meeting_id", meeting.id).eq("phone", phone).eq("business_status","active").maybeSingle();
  if (!attendee) return reply({ found: false });
  const { data: transports } = await db.from("transports")
    .select("direction,driver_name,staff_name,driver_phone,vehicle,service_time,meeting_point,service_mode,batch_id,batch_name,terminal,placard,placard_file_path,placard_file_name,capacity,notes,time_strategy")
    .eq("attendee_id", attendee.id);
  const publicTransports=await Promise.all((transports || []).map(async item=>{
    let placardFileUrl="";
    if(item.direction==="pickup"&&item.placard_file_path){
      const {data}=await db.storage.from("transport-placards").createSignedUrl(item.placard_file_path,900);
      placardFileUrl=data?.signedUrl||"";
    }
    return { direction:item.direction, driver:item.driver_name, staffName:item.staff_name, phone:item.driver_phone, vehicle:item.vehicle, time:item.service_time, point:item.meeting_point, mode:item.service_mode, batchId:item.batch_id, batchName:item.batch_name, terminal:item.terminal, placard:item.placard, placardFileName:item.placard_file_name||"", placardFileUrl, capacity:item.capacity, notes:item.notes, timeStrategy:item.time_strategy };
  }));

  return reply({
    found: true,
    meeting: meeting.name,
    project: viewProject(meeting),
    attendee: { name: `${attendee.name.slice(0, 1)}${"*".repeat(Math.max(attendee.name.length - 1, 1))}`, venue:attendee.venue||"待公布", accommodation:attendee.accommodation?"需要住宿":"无需住宿", hotel:(attendee.custom_fields as Record<string,unknown> || {}).hotel || (attendee.custom_fields as Record<string,unknown> || {}).酒店 || "待公布", outboundTransferOrigin:attendee.outbound_transfer_origin||"", outboundTransferTime:String(attendee.outbound_transfer_time||"").slice(0,16), outboundTransferNotes:attendee.outbound_transfer_notes||"", outboundTransferDriverName:attendee.outbound_transfer_driver_name||"", outboundTransferDriverPhone:attendee.outbound_transfer_driver_phone||"", outboundTransferVehicle:attendee.outbound_transfer_vehicle||"", returnTransferDestination:attendee.return_transfer_destination||"", returnTransferNotes:attendee.return_transfer_notes||"", returnTransferDriverName:attendee.return_transfer_driver_name||"", returnTransferDriverPhone:attendee.return_transfer_driver_phone||"", returnTransferVehicle:attendee.return_transfer_vehicle||"" },
    outbound: { date: attendee.depart_date || attendee.out_date, from: attendee.depart_city || attendee.out_from, fromStation:attendee.depart_station, fromTransportType:attendee.depart_transport_type, to: attendee.arrive_city || attendee.out_to, toStation:attendee.arrive_station, toTransportType:attendee.arrive_transport_type, number: attendee.out_no, departure: attendee.out_departure, arrival: attendee.out_arrival },
    returnTrip: { date: attendee.return_depart_date || attendee.return_date, from: attendee.return_depart_city || attendee.return_from, fromStation:attendee.return_depart_station || attendee.return_from, fromTransportType:attendee.return_depart_transport_type, to: attendee.return_arrive_city || attendee.return_to, toStation:attendee.return_arrive_station || attendee.return_to, toTransportType:attendee.return_arrive_transport_type, number: attendee.return_no, departure: attendee.return_departure, arrival: attendee.return_arrival, arrivalDate:attendee.return_arrive_date || attendee.return_date },
    transports: publicTransports,
  });
}),
};
