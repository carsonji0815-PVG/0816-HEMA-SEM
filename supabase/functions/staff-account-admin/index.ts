import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const clean=(value:unknown,max=200)=>String(value||"").trim().slice(0,max);

export default {fetch:withSupabase({auth:["publishable","secret"]},async request=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(request.method!=="POST")return reply({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const callerKey=Deno.env.get("SUPABASE_ANON_KEY")||request.headers.get("apikey"),authorization=request.headers.get("authorization");
  if(!url||!serviceKey||!callerKey)return reply({error:"账号服务配置不完整"},503);
  if(!authorization)return reply({error:"请先登录管理端"},401);
  const caller=createClient(url,callerKey,{auth:{persistSession:false},global:{headers:{Authorization:authorization}}});
  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  const [{data:userData,error:userError},{data:access,error:accessError}]=await Promise.all([caller.auth.getUser(),caller.rpc("get_staff_access")]);
  const accessRow=Array.isArray(access)?access[0]:access;
  if(userError||!userData.user||accessError||!accessRow?.allowed||accessRow.system_role!=="super_admin")return reply({error:"仅超级管理员可创建登录账号"},403);

  let body:Record<string,unknown>;try{body=await request.json();}catch{return reply({error:"请求格式不正确"},400);}
  const accountType=body.accountType==="client"?"client":"staff";
  const email=clean(body.email,254).toLowerCase(),displayName=clean(body.displayName,80),password=String(body.password||""),meetingId=clean(body.meetingId,50);
  if(!email||!displayName||!meetingId)return reply({error:"账号、姓名和当前项目不能为空"},400);
  if(password.length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!(/[^A-Za-z0-9]/.test(password)))return reply({error:"临时密码不符合安全要求"},400);
  const{data:allowed}=accountType==="staff"?await admin.from("system_staff_allowlist").select("email,display_name,system_role,active").eq("email",email).eq("active",true).maybeSingle():{data:null};
  if(accountType==="staff"&&!allowed)return reply({error:"该邮箱不在内部会务团队白名单"},400);
  if(accountType==="client"){
    const{data:meeting}=await admin.from("meetings").select("id").eq("id",meetingId).maybeSingle();
    if(!meeting)return reply({error:"当前项目不存在"},404);
  }
  const{data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:displayName,must_change_password:true}});
  if(createError)return reply({error:/already|registered|exists/i.test(createError.message)?"该邮箱登录账号已经存在，请刷新页面":createError.message},409);
  const role=accountType==="client"?"client":allowed!.system_role==="readonly"?"sales":"ops";
  const{error:profileError}=await admin.from("profiles").upsert({user_id:created.user.id,meeting_id:null,display_name:displayName,role},{onConflict:"user_id"});
  if(profileError){await admin.auth.admin.deleteUser(created.user.id);return reply({error:"账号资料创建失败"},500);}
  if(accountType==="client"){
    const{error:clientError}=await admin.from("project_client_accounts").insert({meeting_id:meetingId,email,user_id:created.user.id,display_name:displayName,active:true,created_by:userData.user.id});
    const{error:memberError}=clientError?{error:null}:await admin.from("meeting_members").upsert({meeting_id:meetingId,user_id:created.user.id,display_name:displayName,role:"client"},{onConflict:"meeting_id,user_id"});
    if(clientError||memberError){await admin.auth.admin.deleteUser(created.user.id);return reply({error:`客户项目账号授权失败：${clientError?.message||memberError?.message}`},500);}
  }else if(body.assignProject!==false){
    const{error:assignError}=await caller.rpc("set_project_staff_member",{p_meeting_id:meetingId,p_email:email,p_enabled:true});
    if(assignError){await admin.auth.admin.deleteUser(created.user.id);return reply({error:`项目委任失败：${assignError.message}`},500);}
  }
  const projectAssigned=accountType==="client"||body.assignProject!==false;
  await admin.from("operation_audit_logs").insert({meeting_id:meetingId,actor_user_id:userData.user.id,actor_label:accessRow.display_name||"超级管理员",action:accountType==="client"?"client_login_account_created":"staff_login_account_created",target_type:accountType==="client"?"client_account":"staff",target_id:email,metadata:{email,displayName,accountType,projectAssigned,passwordLogged:false}});
  return reply({success:true,email,accountType,projectAssigned,mustChangePassword:true});
})};
