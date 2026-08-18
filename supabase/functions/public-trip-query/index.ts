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
  const phone = clean(payload.phone).replace(/\D/g, "").slice(-11);
  const slug = clean(payload.meeting, 100);
  if (!/^1\d{10}$/.test(phone) || !slug) return reply({ error: "请输入正确的手机号" }, 400);

  const { data: meeting } = await db.from("meetings").select("id,name,deadline,master_locked,allowed_departure_cities,check_city_mismatch,check_departure_city").eq("slug", slug).maybeSingle();
  if (!meeting) return reply({ error: "未找到会议" }, 404);

  if (clean(payload.action) === "register") return reply({ error:"报名页面已更新，请刷新后重新填写" }, 426);

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
      return reply({ authenticated: true, existing: existing.id_number !== "待补充", attendee: registrationView(existing) });
    }
    const { data: owner } = await db.from("profiles").select("user_id").eq("meeting_id", meeting.id).eq("role", "ops").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!owner) return reply({ error: "会务负责人尚未配置，请稍后再试" }, 503);
    const reference = `WEB-${phone.slice(-4)}-${Date.now().toString(36).toUpperCase()}`;
    const { data: created, error: insertError } = await db.from("attendees").insert({ meeting_id:meeting.id, owner_id:owner.user_id, attendee_type:"HCP", name, region, phone, id_number:"待补充", hcp_id:reference, approval:"normal", risks:[], remarks:"公开报名认证，待填写完整信息" }).select("*").single();
    if (insertError || !created) return reply({ error: "身份验证失败，请稍后重试" }, 500);
    return reply({ authenticated:true, existing:false, attendee:registrationView(created) });
  }

  if (clean(payload.action) === "complete-registration") {
    const name = clean(payload.name, 50); const region = clean(payload.region, 50);
    if (!name || !region) return reply({ error:"报名认证已失效，请重新验证" }, 401);
    if (meeting.master_locked) return reply({ error:"报名已锁定，不能修改" }, 423);
    if (meeting.deadline && new Date(meeting.deadline).getTime() < Date.now()) return reply({ error:"报名已截止，请联系会务负责人" }, 410);
    const { data: attendee } = await db.from("attendees").select("*").eq("meeting_id",meeting.id).eq("phone",phone).maybeSingle();
    if (!attendee || clean(attendee.name,50) !== name || clean(attendee.region,50) !== region) return reply({ error:"身份验证失败，请重新验证" }, 403);
    if (attendee.row_locked) return reply({ error:"该报名已锁定，不能修改" }, 423);
    const values = {
      attendee_type:clean(payload.attendeeType,30), city:clean(payload.city,50), hospital:clean(payload.hospital,100), department:clean(payload.department,100), title:clean(payload.title,50), venue:clean(payload.venue,50), sex:clean(payload.sex,10), id_number:clean(payload.idNumber,100), hcp_id:clean(payload.hcpId,100), accommodation:yes(payload.accommodation), is_flight:yes(payload.flight),
      out_date:clean(payload.outDate,10) || null, out_from:clean(payload.outFrom,50), out_to:clean(payload.outTo,50), out_no:clean(payload.outNo,30), out_departure:clean(payload.outDeparture,5) || null, out_arrival:clean(payload.outArrival,5) || null,
      return_date:clean(payload.returnDate,10) || null, return_from:clean(payload.returnFrom,50), return_to:clean(payload.returnTo,50), return_no:clean(payload.returnNo,30), return_departure:clean(payload.returnDeparture,5) || null, return_arrival:clean(payload.returnArrival,5) || null,
      contact_name:clean(payload.contactName,50), contact_mobile:clean(payload.contactMobile,20).replace(/\D/g,""), msl_contact:clean(payload.mslContact,50), remarks:clean(payload.remarks,500),
    };
    const required = [values.attendee_type,values.city,values.hospital,values.department,values.venue,values.sex,values.id_number,values.hcp_id,values.out_date,values.out_from,values.out_to,values.out_no,values.out_departure,values.out_arrival,values.return_date,values.return_from,values.return_to,values.return_no,values.return_departure,values.return_arrival,values.contact_name];
    if (required.some(value => !value) || !/^1\d{10}$/.test(values.contact_mobile)) return reply({ error:"请完整填写报名表中的必填信息" }, 400);
    if (attendee.id_number !== "待补充") {
      const { data:locks } = await db.from("column_locks").select("field_group").eq("meeting_id",meeting.id).eq("locked",true);
      const groups: Record<string, string[]> = { identity:["attendee_type","city","hospital","department","title","venue","sex","id_number","hcp_id"], contact:["contact_name","contact_mobile"], outbound:["out_date","out_from","out_to","out_no","out_departure","out_arrival"], return:["return_date","return_from","return_to","return_no","return_departure","return_arrival"], accommodation:["accommodation","is_flight"], remarks:["msl_contact","remarks"] };
      const lockedChange = (locks || []).find(lock => (groups[lock.field_group] || []).some(key => String(attendee[key] ?? "") !== String(values[key as keyof typeof values] ?? "")));
      if (lockedChange) return reply({ error:`${lockedChange.field_group} 相关字段已锁定，不能修改` }, 423);
    }
    const risks: string[] = [];
    if (meeting.check_city_mismatch && values.out_from !== values.return_to) risks.push("去程出发城市与返程到达城市不一致");
    if (meeting.check_departure_city && values.out_from && !(meeting.allowed_departure_cities || []).includes(values.out_from)) risks.push(`出发城市“${values.out_from}”不在预设范围`);
    const { error:updateError } = await db.from("attendees").update({ ...values, approval:risks.length ? "pending" : "normal", risks }).eq("id",attendee.id);
    if (updateError) return reply({ error:updateError.message.includes("锁定") ? "报名已锁定，不能修改" : "报名保存失败，请稍后重试" }, 500);
    return reply({ completed:true, needsApproval:risks.length > 0 });
  }

  const { data: attendee } = await db.from("attendees")
    .select("id,name,out_date,out_from,out_to,out_no,out_departure,out_arrival,return_date,return_from,return_to,return_no,return_departure,return_arrival")
    .eq("meeting_id", meeting.id).eq("phone", phone).maybeSingle();
  if (!attendee) return reply({ found: false });
  const { data: transports } = await db.from("transports")
    .select("direction,driver_name,driver_phone,vehicle,service_time,meeting_point")
    .eq("attendee_id", attendee.id);

  return reply({
    found: true,
    meeting: meeting.name,
    attendee: { name: `${attendee.name.slice(0, 1)}${"*".repeat(Math.max(attendee.name.length - 1, 1))}` },
    outbound: { date: attendee.out_date, from: attendee.out_from, to: attendee.out_to, number: attendee.out_no, departure: attendee.out_departure, arrival: attendee.out_arrival },
    returnTrip: { date: attendee.return_date, from: attendee.return_from, to: attendee.return_to, number: attendee.return_no, departure: attendee.return_departure, arrival: attendee.return_arrival },
    transports: (transports || []).map(item => ({ direction: item.direction, driver: item.driver_name, phone: item.driver_phone, vehicle: item.vehicle, time: item.service_time, point: item.meeting_point })),
  });
}),
};
