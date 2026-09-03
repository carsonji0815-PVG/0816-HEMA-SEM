import {readFileSync} from "node:fs";

const app=readFileSync("app.js","utf8");
const html=readFileSync("index.html","utf8");
const sql=readFileSync("supabase/migrations/2026090305_admin_access_sessions_readonly.sql","utf8");
const worker=readFileSync("scripts/aliyun-notification-email-worker.py","utf8");
const checks={
  sessionRegistry:sql.includes("staff_login_sessions")&&sql.includes("register_staff_session")&&app.includes("registerStaffSession"),
  deviceLimit:sql.includes("maxConcurrentDevices")&&html.includes("maxConcurrentDevices")&&sql.includes("超出同账号最大在线设备数"),
  temporaryLinks:sql.includes("create_admin_access_link")&&sql.includes("validate_admin_access_link")&&app.includes("createAdminAccessLink")&&html.includes("adminAccessLinkResult"),
  hashedTokens:sql.includes("digest(v_token,'sha256')")&&!sql.includes("token text not null unique"),
  readonlyRole:sql.includes("system_role in ('super_admin','ops','readonly')")&&app.includes("isReadOnlyStaff")&&app.includes("只读账号没有敏感数据导出权限"),
  serverEnforcement:sql.includes("create or replace function public.is_allowed_staff()")&&sql.includes("current_auth_session_id"),
  smtpWorker:worker.includes("notification_email_outbox")&&worker.includes("smtplib")&&worker.includes("status='sent'"),
  smtpSafeMissing:worker.includes("SMTP not configured")&&worker.includes("sys.exit(0)"),
};
const errors=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({checks,errors,allPassed:errors.length===0},null,2));
if(errors.length)process.exitCode=1;
