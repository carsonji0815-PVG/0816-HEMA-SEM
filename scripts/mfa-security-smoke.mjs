import {readFileSync} from 'node:fs';
const app=readFileSync('app.js','utf8'),html=readFileSync('index.html','utf8'),sql=readFileSync('supabase/migrations/2026090404_require_staff_mfa.sql','utf8');
const checks={dialog:html.includes('id="mfaDialog"')&&html.includes('id="mfaQrCode"'),domesticAuthenticator:html.includes('阿里云 App → 虚拟 MFA')&&html.includes('请勿截图'),enrollment:app.includes('backend.auth.mfa.enroll')&&app.includes('challengeAndVerify'),beforeSession:app.includes('await requireManagementMfa();await registerStaffSession()'),aal2Database:sql.includes("auth.jwt()->>'aal','')='aal2'")&&sql.includes('staff_login_sessions')};
const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
console.log(JSON.stringify({checks,failed,allPassed:failed.length===0},null,2));
if(failed.length)process.exitCode=1;
