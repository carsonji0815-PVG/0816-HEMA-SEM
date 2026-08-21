import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

const clean = (value: unknown, max = 200) => String(value || "").trim().slice(0, max);
const yes = (value: unknown) => ["Y", "true", "1", "是"].includes(String(value));
const registrationView = (row: Record<string, unknown>) => ({
  attendeeType: row.attendee_type || "HCP", name: row.name || "", city: row.city || "", hospital: row.hospital || "", department: row.department || "", title: row.title || "", venue: row.venue || "", sex: row.sex || "",
  idNumber: row.id_number === "待补充" ? "" : row.id_number || "", phone: row.phone || "", hcpId: String(row.hcp_id || "").startsWith("WEB-") ? "" : row.hcp_id || "", accommodation: row.accommodation ? "Y" : "N", flight: row.is_flight ? "Y" : "N",
  outDate: row.out_date || "", outFrom: row.out_from || "", outTo: row.out_to || "", outNo: row.out_no || "", outDeparture: String(row.out_departure || "").slice(0, 5), outArrival: String(row.out_arrival || "").slice(0, 5),
  returnDate: row.return_date || "", returnFrom: row.return_from || "", returnTo: row.return_to || "", returnNo: row.return_no || "", returnDeparture: String(row.return_departure || "").slice(0, 5), returnArrival: String(row.return_arrival || "").slice(0, 5),
  region: row.region || "", contactName: row.contact_name || "", contactMobile: row.contact_mobile || "", mslContact: row.msl_contact || "", remarks: row.remarks === "公开报名认证，待填写完整信息" ? "" : row.remarks || "",
  customFields: row.custom_fields || {},
});
const projectView = (meeting: Record<string, unknown>) => ({
  slug: meeting.slug || "", name: meeting.name || "参会服务", clientName: meeting.client_name || "", venues: meeting.venues || [], servicePhone: meeting.service_phone || "", brandColor: meeting.brand_color || "#5267d9", fieldConfig: meeting.field_config || {}, flightLeadMinutes: meeting.flight_lead_minutes || 120, trainLeadMinutes: meeting.train_lead_minutes || 90,
  startDate: meeting.start_date || "", endDate: meeting.end_date || "", deadline: meeting.deadline || "", masterLocked: !!meeting.master_locked, archiveReady: !!meeting.archive_ready,
  templateName: meeting.template_name || "标准31列报名模板", registrationTemplate: meeting.registration_template || {},
});

export default {
fetch: withSupabase({ auth: ["publishable", "secret"] }, async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return reply({ error: "Service unavailable" }, 503);

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = await hash(`${forwarded}:${Deno.env.get("QUERY_RATE_SALT") || "journey-desk"}`);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await db.from("public_query_logs").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count || 0) >= 20) return reply({ error: "查询过于频繁，请稍后再试" }, 429);
  await db.from("public_query_logs").insert({ ip_hash: ipHash });

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return reply({ error: "Invalid request" }, 400); }
  const action = clean(payload.action, 50);
  const slug = clean(payload.meeting, 100);
  if (action === "list-projects") {
    const { data:meetings, error } = await db.from("meetings").select("id,slug,name,client_name,start_date,end_date,venues,service_phone,brand_color,field_config,template_name,registration_template,flight_lead_minutes,train_lead_minutes,deadline,master_locked,archive_ready").eq("archive_ready",true).order("start_date",{ascending:false}).limit(50);
    if (error) return reply({ error:"读取项目列表失败" }, 500);
    return reply({ projects:(meetings || []).map(projectView) });
  }
  if (!slug) return reply({ error: "报名链接缺少项目编号，请使用项目专属二维码或链接" }, 400);

  const { data: meeting } = await db.from("meetings").select("id,slug,name,client_name,start_date,end_date,venues,service_phone,brand_color,field_config,template_name,registration_template,flight_lead_minutes,train_lead_minutes,deadline,master_locked,archive_ready,allowed_departure_cities,check_city_mismatch,check_departure_city").eq("slug", slug).maybeSingle();
  if (!meeting) return reply({ error: "未找到会议" }, 404);
  if (!meeting.archive_ready) return reply({ error:"项目尚未完成前置文件归档，报名暂未开放" }, 423);
  if (action === "project-info") return reply({ project:projectView(meeting) });

  const phone = clean(payload.phone).replace(/\D/g, "").slice(-11);
  if (!/^1\d{10}$/.test(phone)) return reply({ error: "请输入正确的手机号" }, 400);

  if (action === "register") return reply({ error:"报名页面已更新，请刷新后重新填写" }, 426);

  if (action === "registrant-login") {
    const name = clean(payload.name, 50);
    const region = clean(payload.region, 50);
    if (!name || !region) return reply({ error:"请填写大区和报名负责人姓名" }, 400);
    const { data: attendees, error } = await db.from("attendees").select("*")
      .eq("meeting_id", meeting.id).eq("contact_mobile", phone).eq("contact_name", name).eq("region", region).order("created_at", { ascending:false });
    if (error) return reply({ error:"读取报名名单失败，请稍后重试" }, 500);
    return reply({ authenticated:true, project:projectView(meeting), attendees:(attendees || []).map(row => ({ id:row.id, rowLocked:!!row.row_locked, approval:row.approval || "normal", ticketStatus:row.ticket_status || "pending", ...registrationView(row) })) });
  }

  if (action === "save-attendee") {
    const registrantName = clean(payload.registrantName, 50);
    const registrantRegion = clean(payload.registrantRegion, 50);
    const details = payload.details && typeof payload.details === "object" && !Array.isArray(payload.details) ? payload.details as Record<string,unknown> : {};
    const attendeeId = clean(payload.attendeeId, 100);
    const attendeeName = clean(details.name, 50);
    const attendeePhone = clean(details.phone, 20).replace(/\D/g, "").slice(-11);
    if (!registrantName || !registrantRegion) return reply({ error:"报名负责人信息已失效，请重新进入" }, 401);
    if (!attendeeName || !/^1\d{10}$/.test(attendeePhone)) return reply({ error:"请填写参会人员姓名和正确的手机号" }, 400);
    if (meeting.master_locked) return reply({ error:"项目名单已锁定，不能新增或修改" }, 423);
    if (meeting.deadline && new Date(meeting.deadline).getTime() < Date.now()) return reply({ error:"报名已截止，请联系会务负责人" }, 410);

    let attendee: Record<string,unknown> | null = null;
    if (attendeeId) {
      const { data } = await db.from("attendees").select("*").eq("id",attendeeId).eq("meeting_id",meeting.id).maybeSingle();
      attendee = data;
      if (!attendee || clean(attendee.contact_mobile,20) !== phone || clean(attendee.contact_name,50) !== registrantName || clean(attendee.region,50) !== registrantRegion) return reply({ error:"您无权修改该参会人员" }, 403);
      if (attendee.row_locked) return reply({ error:"该参会人员信息已锁定，不能修改" }, 423);
    }

    const requestedCustom = details.customFields && typeof details.customFields === "object" && !Array.isArray(details.customFields) ? details.customFields as Record<string,unknown> : {};
    const allowedCustom = new Set(((meeting.registration_template as {columns?:Array<{key?:string,custom?:boolean}>})?.columns || []).filter(column=>column.custom).map(column=>clean(column.key,80)));
    const customFields = Object.fromEntries(Object.entries(requestedCustom).filter(([key])=>allowedCustom.has(key)).slice(0,50).map(([key,value])=>[key,clean(value,500)]));
    const values: Record<string,unknown> = {
      attendee_type:clean(details.attendeeType,30) || "HCP", name:attendeeName, city:clean(details.city,50), hospital:clean(details.hospital,100), department:clean(details.department,100), title:clean(details.title,50), venue:clean(details.venue,50), sex:clean(details.sex,10), id_number:clean(details.idNumber,100), phone:attendeePhone, hcp_id:clean(details.hcpId,100), accommodation:yes(details.accommodation), is_flight:yes(details.flight), region:registrantRegion,
      out_date:clean(details.outDate,10) || null, out_from:clean(details.outFrom,50), out_to:clean(details.outTo,50), out_no:clean(details.outNo,30), out_departure:clean(details.outDeparture,5) || null, out_arrival:clean(details.outArrival,5) || null,
      return_date:clean(details.returnDate,10) || null, return_from:clean(details.returnFrom,50), return_to:clean(details.returnTo,50), return_no:clean(details.returnNo,30), return_departure:clean(details.returnDeparture,5) || null, return_arrival:clean(details.returnArrival,5) || null,
      contact_name:registrantName, contact_mobile:phone, msl_contact:clean(details.mslContact,50), remarks:clean(details.remarks,500), custom_fields:customFields,
    };
    const keyToDb:Record<string,string>={attendeeType:"attendee_type",name:"name",city:"city",hospital:"hospital",department:"department",title:"title",venue:"venue",sex:"sex",idNumber:"id_number",phone:"phone",hcpId:"hcp_id",accommodation:"accommodation",flight:"is_flight",region:"region",outDate:"out_date",outFrom:"out_from",outTo:"out_to",outNo:"out_no",outDeparture:"out_departure",outArrival:"out_arrival",returnDate:"return_date",returnFrom:"return_from",returnTo:"return_to",returnNo:"return_no",returnDeparture:"return_departure",returnArrival:"return_arrival",contactName:"contact_name",contactMobile:"contact_mobile",mslContact:"msl_contact",remarks:"remarks"};
    const configuredColumns=((meeting.registration_template as {columns?:Array<{key?:string,required?:boolean,custom?:boolean}>})?.columns || []);
    const templateColumns=configuredColumns.length ? configuredColumns : ["name","phone","region","idNumber","outDate","outFrom","outTo","outNo","outDeparture","outArrival","returnDate","returnFrom","returnTo","returnNo","returnDeparture","returnArrival","contactName","contactMobile"].map(key=>({key,required:true,custom:false}));
    const missingRequired=templateColumns.filter(column=>column.required).some(column=>{ const value=column.custom ? customFields[clean(column.key,80)] : values[keyToDb[clean(column.key,80)]]; return value === null || value === undefined || value === ""; });
    if (missingRequired) return reply({ error:"请完整填写当前项目报名模板中的必填信息" }, 400);

    if (attendee) {
      const { data:locks } = await db.from("column_locks").select("field_group").eq("meeting_id",meeting.id).eq("locked",true);
      const groups:Record<string,string[]>={identity:["attendee_type","name","city","hospital","department","title","venue","sex","id_number","phone","hcp_id","region"],contact:["contact_name","contact_mobile"],outbound:["out_date","out_from","out_to","out_no","out_departure","out_arrival"],return:["return_date","return_from","return_to","return_no","return_departure","return_arrival"],accommodation:["accommodation","is_flight"],remarks:["msl_contact","remarks"]};
      const lockedChange=(locks || []).find(lock=>(groups[lock.field_group] || []).some(key=>String(attendee?.[key] ?? "") !== String(values[key] ?? "")));
      if (lockedChange) return reply({ error:`${lockedChange.field_group} 相关字段已锁定，不能修改` }, 423);
    }

    const outboundRisks:string[]=[]; const returnRisks:string[]=[];
    if (meeting.check_city_mismatch && values.out_from !== values.return_to) returnRisks.push("去程出发城市与返程到达城市不一致");
    if (meeting.check_departure_city && values.out_from && !(meeting.allowed_departure_cities || []).includes(values.out_from)) outboundRisks.push(`出发城市“${values.out_from}”不在预设范围`);
    const outboundChanged=!attendee || ["out_date","out_from","out_to","out_no","out_departure","out_arrival"].some(key=>String(attendee?.[key]??"")!==String(values[key]??""));
    const returnChanged=!attendee || ["return_date","return_from","return_to","return_no","return_departure","return_arrival"].some(key=>String(attendee?.[key]??"")!==String(values[key]??""));
    const outboundApproval=outboundRisks.length?(outboundChanged?"pending":attendee?.outbound_approval_status||"pending"):"normal";
    const returnApproval=returnRisks.length?(returnChanged?"pending":attendee?.return_approval_status||"pending"):"normal";
    const aggregateApproval=[outboundApproval,returnApproval].some(status=>["pending","rejected"].includes(String(status)))?"pending":[outboundApproval,returnApproval].some(status=>status==="approved")?"approved":"normal";
    const updateValues={...values,outbound_approval_status:outboundApproval,return_approval_status:returnApproval,approval:aggregateApproval,risks:[...outboundRisks,...returnRisks]};
    let saved:Record<string,unknown>|null=null; let saveError;
    if (attendee) ({ data:saved, error:saveError } = await db.from("attendees").update(updateValues).eq("id",attendee.id).select("*").single());
    else {
      const { data:owner } = await db.from("meeting_members").select("user_id").eq("meeting_id",meeting.id).eq("role","ops").order("created_at",{ascending:true}).limit(1).maybeSingle();
      if (!owner) return reply({ error:"会务负责人尚未配置，请稍后再试" }, 503);
      ({ data:saved, error:saveError } = await db.from("attendees").insert({...updateValues,meeting_id:meeting.id,owner_id:owner.user_id,privacy_letter_status:"pending",ticket_status:"pending"}).select("*").single());
    }
    if (saveError || !saved) return reply({ error:String(saveError?.message || "").includes("duplicate") ? "该参会人员手机号已在本项目中报名" : "报名保存失败，请稍后重试" }, 500);
    return reply({ saved:true, attendee:{id:saved.id,rowLocked:!!saved.row_locked,approval:saved.approval||"normal",ticketStatus:saved.ticket_status||"pending",...registrationView(saved)}, needsApproval:aggregateApproval==="pending", project:projectView(meeting) });
  }

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
      return reply({ authenticated: true, existing: existing.id_number !== "待补充", attendee: registrationView(existing), project:projectView(meeting) });
    }
    const { data: owner } = await db.from("meeting_members").select("user_id").eq("meeting_id", meeting.id).eq("role", "ops").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!owner) return reply({ error: "会务负责人尚未配置，请稍后再试" }, 503);
    const reference = `WEB-${phone.slice(-4)}-${Date.now().toString(36).toUpperCase()}`;
    const { data: created, error: insertError } = await db.from("attendees").insert({ meeting_id:meeting.id, owner_id:owner.user_id, attendee_type:"HCP", name, region, phone, id_number:"待补充", hcp_id:reference, approval:"normal", risks:[], remarks:"公开报名认证，待填写完整信息" }).select("*").single();
    if (insertError || !created) return reply({ error: "身份验证失败，请稍后重试" }, 500);
    return reply({ authenticated:true, existing:false, attendee:registrationView(created), project:projectView(meeting) });
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
    return reply({ completed:true, needsApproval:aggregateApproval==="pending", project:projectView(meeting) });
  }

  const { data: attendee } = await db.from("attendees")
    .select("id,name,out_date,out_from,out_to,out_no,out_departure,out_arrival,return_date,return_from,return_to,return_no,return_departure,return_arrival")
    .eq("meeting_id", meeting.id).eq("phone", phone).maybeSingle();
  if (!attendee) return reply({ found: false });
  const { data: transports } = await db.from("transports")
    .select("direction,driver_name,staff_name,driver_phone,vehicle,service_time,meeting_point,service_mode,batch_id,batch_name,terminal,placard,capacity,notes,time_strategy")
    .eq("attendee_id", attendee.id);

  return reply({
    found: true,
    meeting: meeting.name,
    project: projectView(meeting),
    attendee: { name: `${attendee.name.slice(0, 1)}${"*".repeat(Math.max(attendee.name.length - 1, 1))}` },
    outbound: { date: attendee.out_date, from: attendee.out_from, to: attendee.out_to, number: attendee.out_no, departure: attendee.out_departure, arrival: attendee.out_arrival },
    returnTrip: { date: attendee.return_date, from: attendee.return_from, to: attendee.return_to, number: attendee.return_no, departure: attendee.return_departure, arrival: attendee.return_arrival },
    transports: (transports || []).map(item => ({ direction:item.direction, driver:item.driver_name, staffName:item.staff_name, phone:item.driver_phone, vehicle:item.vehicle, time:item.service_time, point:item.meeting_point, mode:item.service_mode, batchId:item.batch_id, batchName:item.batch_name, terminal:item.terminal, placard:item.placard, capacity:item.capacity, notes:item.notes, timeStrategy:item.time_strategy })),
  });
}),
};
