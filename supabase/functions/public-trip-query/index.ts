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

  let payload: { action?: string; phone?: string; meeting?: string; region?: string; name?: string };
  try { payload = await request.json(); } catch { return reply({ error: "Invalid request" }, 400); }
  const phone = String(payload.phone || "").replace(/\D/g, "").slice(-11);
  const slug = String(payload.meeting || "").trim();
  if (!/^1\d{10}$/.test(phone) || !slug) return reply({ error: "请输入正确的手机号" }, 400);

  const { data: meeting } = await db.from("meetings").select("id,name,deadline,master_locked").eq("slug", slug).maybeSingle();
  if (!meeting) return reply({ error: "未找到会议" }, 404);

  if (payload.action === "register") {
    const name = String(payload.name || "").trim().slice(0, 50);
    const region = String(payload.region || "").trim().slice(0, 50);
    if (!name || !region) return reply({ error: "请填写大区和姓名" }, 400);
    if (meeting.master_locked) return reply({ error: "报名已关闭，请联系会务负责人" }, 423);
    if (meeting.deadline && new Date(meeting.deadline).getTime() < Date.now()) return reply({ error: "报名已截止，请联系会务负责人" }, 410);
    const { data: duplicate } = await db.from("attendees").select("id").eq("meeting_id", meeting.id).eq("phone", phone).maybeSingle();
    if (duplicate) return reply({ error: "该手机号已完成报名，请勿重复提交" }, 409);
    const { data: owner } = await db.from("profiles").select("user_id").eq("meeting_id", meeting.id).eq("role", "ops").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!owner) return reply({ error: "会务负责人尚未配置，请稍后再试" }, 503);
    const reference = `WEB-${phone.slice(-4)}-${Date.now().toString(36).toUpperCase()}`;
    const { error: insertError } = await db.from("attendees").insert({
      meeting_id: meeting.id,
      owner_id: owner.user_id,
      attendee_type: "公开报名",
      name,
      region,
      phone,
      id_number: "待补充",
      hcp_id: reference,
      approval: "normal",
      risks: [],
      remarks: "公开报名入口提交，待会务补充完整信息",
    });
    if (insertError) return reply({ error: "报名提交失败，请稍后重试" }, 500);
    return reply({ registered: true, reference });
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
