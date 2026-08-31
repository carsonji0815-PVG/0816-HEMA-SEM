import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const A='00000000-0000-0000-0000-000000000001', B='00000000-0000-0000-0000-000000000002'
const U='10000000-0000-0000-0000-000000000001', V='10000000-0000-0000-0000-000000000002'
const P='20000000-0000-0000-0000-000000000001'
test('PostgreSQL migration: authorization, feature gates, idempotency, late retries and history', async () => {
 const db = new PGlite()
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table public.meetings(id uuid primary key,owner_user_id uuid,name text,activity_type text);
 create table public.attendees(id uuid primary key,meeting_id uuid,name text,department text,phone text,business_status text);
 create function public.can_manage_project(m uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from public.meetings where id=m and owner_user_id=auth.uid()) $$;
 insert into auth.users values('${U}'),('${V}');
 insert into public.meetings values('${A}','${U}','内部大会','internal'),('${B}','${V}','外部会议','external');
 insert into public.attendees values('${P}','${A}','张三','市场部','13800138000','active');`)
 const sql = await readFile(new URL('../../../supabase/migrations/2026083101_integrated_luggage.sql',import.meta.url),'utf8')
 await db.exec(sql); await db.exec(sql)
 const rpc=(name,args)=>db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)
 await assert.rejects(rpc('set_meeting_luggage_enabled',[A,true]),/权限/)
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[U])
 await assert.rejects(rpc('luggage_attendees',[A]),/未启用/)
 await assert.rejects(rpc('set_meeting_luggage_enabled',[B,true]),/权限/)
 await rpc('set_meeting_luggage_enabled',[A,true])
 const roster=(await rpc('luggage_attendees',[A])).rows[0].value
 assert.deepEqual(Object.keys(roster[0]).sort(),['attend_id','dept','mobile','name'])
 const bag={event_id:A,attend_id:P,name:'forged',mobile:'forged',luggage_barcode:'LUG1788000000000ABCDE',storage_row:1,storage_slot:2,status:'寄存',checkin_time:'2026-08-31T02:00:00Z',checkout_time:null,revision:1,updated_at:'2026-08-31T02:00:00Z',operator_checkin:'现场人员'}
 await rpc('sync_luggage_record',[A,bag]); await rpc('sync_luggage_record',[A,bag])
 assert.equal((await db.query('select count(*)::int as n from luggage_records')).rows[0].n,1)
 assert.equal((await db.query('select name from luggage_records')).rows[0].name,'张三')
 await assert.rejects(rpc('set_meeting_luggage_enabled',[A,false]),/未领取/)
 await assert.rejects(db.query('update meetings set luggage_enabled=false where id=$1',[A]),/未领取/)
 await assert.rejects(rpc('sync_luggage_record',[A,{...bag,storage_row:2}]),/冲突/)
 const checkout={...bag,status:'已取',checkout_time:'2026-08-31T03:00:00Z',updated_at:'2026-08-31T03:00:00Z',revision:2,operator_checkout:'现场人员'}
 await rpc('sync_luggage_record',[A,checkout]); await rpc('sync_luggage_record',[A,bag])
 assert.equal((await db.query('select status from luggage_records')).rows[0].status,'已取')
 await rpc('set_meeting_luggage_enabled',[A,false])
 assert.equal((await rpc('luggage_ledger_page',[A,''])).rows[0].value.length,1)
 await assert.rejects(rpc('sync_luggage_record',[A,{...bag,luggage_barcode:'LUG1788000000000BCDEF'}]),/已关闭/)
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[V])
 await assert.rejects(rpc('luggage_ledger_page',[A,'']),/权限/)
 await rpc('set_meeting_luggage_enabled',[B,true])
 await assert.rejects(rpc('sync_luggage_record',[B,{...bag,event_id:B,luggage_barcode:'LUG1788000000000CDEFG'}]),/不属于/)
 await db.exec('set role authenticated;')
 assert.equal((await db.query('select count(*)::int as n from luggage_records')).rows[0].n,0)
 await assert.rejects(db.exec('delete from luggage_records'),/permission denied/)
 } finally { await db.close() }
})
