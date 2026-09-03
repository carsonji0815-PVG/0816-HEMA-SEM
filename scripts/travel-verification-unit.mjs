import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {createTravelProviders,chooseMatch} from '../modules/travel-verification/server/index.mjs';
import {today} from '../modules/travel-verification/server/core.mjs';
const require=createRequire(import.meta.url),F=require('../travel-fields.js'),V=require('../travel-verification.js'),P=require('../travel-verification-panel.js'),S=require('../travel-verification-storage.js');
const a=F.applyLegacy({id:'a',name:'测试记录',departDate:today(),departCity:'上海',departTransportType:'PLANE',departStation:'上海虹桥机场T2航站楼',arriveDate:today(),arriveCity:'北京',arriveTransportType:'PLANE',arriveStation:'北京首都机场T3航站楼',outNo:'MU5101',outDeparture:'09:00',outArrival:'11:00'});
const plan=V.snapshot(a,'outbound');
const candidate={code:'MU5101',date:today(),arrivalDate:today(),from:'SHA',to:'PEK',depart:'09:30',arrive:'11:30',departureTerminal:'T2',arrivalTerminal:'T3'};
const j={attendeeId:'a',segment:'outbound',mode:'flight',date:today(),number:'MU5101',from:a.outFrom,to:a.outTo,departure:'09:00',arrival:'11:00'};
function db(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE travel_api_cache(cache_key TEXT PRIMARY KEY,provider TEXT,request_json TEXT,response_json TEXT,status TEXT,fetched_at TEXT,expires_at TEXT)');return db;}
test('blank return is not an error; invalid calendar date is a local issue',()=>{
 assert.deepEqual(V.localIssues(a,'return'),[]);assert.equal(V.viewState(a,'return'),'blank');
 assert.ok(V.localIssues({...a,departDate:'2026-02-31'},'outbound').some(i=>i.field==='departDate'));
});
test('only proven discrepant fields are highlighted, not a whole unavailable row',()=>{
 const check=V.buildCheck(a,'outbound',{found:true,mode:'flight',match:{...plan,departure:'09:30'}});
 assert.deepEqual(check.fieldIssues.map(i=>i.field),['outDeparture']);
 const record={...a,customFields:{_travelVerification:{outbound:check}}};
 assert.equal(V.viewState(record,'outbound'),'difference');
 const html=P.render([record],V).html;assert.equal((html.match(/verify-field-difference/g)||[]).length,1);
 const unavailable=V.buildCheck(a,'outbound',{found:false,warnings:['接口不可用']});
 assert.equal(unavailable.fieldIssues.length,0);assert.equal(unavailable.status,'unavailable');
});
test('city and missing terminal are uncertainty; wrong terminal is a discrepancy',()=>{
 const match={...plan,fromCode:'SHA',fromCity:'上海'};
 assert.equal(V.buildCheck({...a,departStation:'上海'},'outbound',{found:true,match}).fieldIssues.length,0);
 assert.equal(V.buildCheck({...a,departStation:'SHA'},'outbound',{found:true,match}).status,'unavailable');
 assert.equal(V.buildCheck({...a,departStation:'上海虹桥机场T1航站楼'},'outbound',{found:true,match}).fieldIssues[0].field,'departStation');
 const missing=V.buildCheck(a,'outbound',{found:true,match:{...match,from:'上海虹桥机场'},warnings:['接口未返回出发航站楼']});
 assert.equal(missing.fieldIssues.length,0);assert.equal(missing.status,'unavailable');
});
test('an airport without a terminal number is fully matched without a terminal warning',()=>{
 const attendee=F.applyLegacy({id:'d',departDate:today(),departCity:'大连',departTransportType:'PLANE',departStation:'大连周水子机场',arriveDate:today(),arriveCity:'上海',arriveTransportType:'PLANE',arriveStation:'上海虹桥机场T2航站楼',outNo:'MU5698',outDeparture:'18:45',outArrival:'20:55'});
 const match={date:today(),arrivalDate:today(),number:'MU5698',from:'大连周水子机场',to:'上海虹桥机场T2航站楼',fromCode:'DLC',toCode:'SHA',fromCity:'大连',toCity:'上海',departure:'18:45',arrival:'20:55',departureTerminal:'',arrivalTerminal:'T2'};
 assert.equal(V.buildCheck(attendee,'outbound',{found:true,mode:'flight',match,warnings:[]}).status,'verified');
 const selected=chooseMatch({mode:'flight',date:today(),number:'MU5698',from:'大连周水子机场',to:'上海虹桥机场T2航站楼'},[{...candidate,code:'MU5698',from:'DLC',to:'SHA',depart:'18:45',arrive:'20:55',departureTerminal:'',arrivalTerminal:'T2'}]);
 assert.deepEqual(selected.warnings,[]);
});
test('changed direction invalidates prior evidence; unrelated direction remains intact',()=>{
 const check=V.buildCheck(a,'outbound',{found:true,match:plan});
 const changed={...a,outDeparture:'10:00',customFields:{_travelVerification:{outbound:check}}};
 assert.equal(V.viewState(changed,'outbound'),'stale');assert.equal(V.verifiedField(changed,'outNo'),false);
 assert.ok(!P.render([changed],V).html.includes('09:00</td><td>09:00'));
});
test('HTML escapes roster and provider values; read-only mode has no edit action',()=>{
 const html=P.render([{...a,name:'<img src=x onerror=alert(1)>'}],V).html;
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('disabled'));
});
test('ambiguous G54220 and airline-like numbers are not silently treated as trains',()=>{
 const legacy={...plan,departTransportType:'',arriveTransportType:''};
 assert.equal(V.transportMode({...legacy,number:'G54220'}),'unknown');assert.equal(V.transportMode({...legacy,number:'G5123',from:'上海',to:'北京'}),'unknown');
 assert.equal(V.transportMode({...legacy,number:'G123',from:'上海虹桥站'}),'train');
});
test('candidate selection requires exact date and number; multi-leg ambiguity fails closed',()=>{
 assert.equal(chooseMatch(j,[{...candidate,code:'MU5102'}]).match,null);
 assert.equal(chooseMatch({...j,from:'上海',to:'北京'},[candidate,{...candidate,to:'PKX'}]).match,null);
 assert.equal(chooseMatch(j,[candidate]).match.departure,'09:30');
 assert.equal(chooseMatch(j,[{...candidate,cancelled:true}]).match,null);
});
test('provider never queries flights without explicit budget authorization',async()=>{
 const database=db();let calls=0;
 const p=createTravelProviders(database,{env:{VARIFLIGHT_API_KEY:'synthetic',VARIFLIGHT_ENABLED:'true'},flightQuery:async()=>{calls++;return {candidates:[candidate]};}});
 const result=await p.verifyBatch([j]);assert.equal(calls,0);assert.equal(result.results[0].found,false);database.close();
});
test('global flight switch is enforced by the server',async()=>{
 const database=db();let calls=0;
 const p=createTravelProviders(database,{env:{VARIFLIGHT_API_KEY:'synthetic',VARIFLIGHT_ENABLED:'true'},flightQuery:async()=>{calls++;return {candidates:[candidate]};}});
 const result=await p.verifyBatch([j],{allowPaid:true,flightGlobalEnabled:false});
 assert.equal(calls,0);assert.match(result.results[0].warnings[0],/全局查询/);database.close();
});
test('provider deduplicates, shares cache, and transmits only date / number',async()=>{
 const database=db();let calls=0;
 const p=createTravelProviders(database,{env:{VARIFLIGHT_API_KEY:'synthetic',VARIFLIGHT_ENABLED:'true'},flightQuery:async trip=>{calls++;assert.deepEqual(Object.keys(trip).sort(),['code','date']);return {candidates:[candidate]};}});
 const result=await p.verifyBatch([j,{...j,attendeeId:'b'}],{allowPaid:true,flightGlobalEnabled:true});assert.equal(calls,1);assert.equal(result.results.length,2);assert.equal(result.results[1].attendeeId,'b');
 const again=await p.verifyBatch([j],{allowPaid:false});assert.equal(calls,1);assert.equal(again.results[0].cached,true);
 assert.ok(!database.prepare('SELECT request_json FROM travel_api_cache').get().request_json.includes('attendeeId'));database.close();
});
test('failed provider calls release the local quota reservation; successful calls retain it',async()=>{
 const database=db();let calls=0;const options={env:{VARIFLIGHT_API_KEY:'synthetic',VARIFLIGHT_ENABLED:'true',VARIFLIGHT_DAILY_LIMIT:'1'},flightQuery:async trip=>{calls++;if(calls===1)throw new Error('不可用');return {candidates:[{...candidate,code:trip.code}]};}};
 await createTravelProviders(database,options).verifyBatch([j],{allowPaid:true,flightGlobalEnabled:true});
 const success=await createTravelProviders(database,options).verifyBatch([{...j,number:'MU5102'}],{allowPaid:true,flightGlobalEnabled:true});
 const blocked=await createTravelProviders(database,options).verifyBatch([{...j,number:'MU5103'}],{allowPaid:true,flightGlobalEnabled:true});
 assert.equal(calls,2);assert.equal(success.results[0].found,true);assert.match(blocked.results[0].warnings[0],/上限/);database.close();
});
test('runtime quota policy supports a configured limit and unlimited mode',async()=>{
 const database=db();let calls=0;const p=createTravelProviders(database,{env:{VARIFLIGHT_API_KEY:'synthetic',VARIFLIGHT_ENABLED:'true',VARIFLIGHT_DAILY_LIMIT:'5'},flightQuery:async trip=>{calls++;return{candidates:[{...candidate,code:trip.code}]};}});
 await p.verifyBatch([{...j,number:'MU5201'}],{allowPaid:true,flightGlobalEnabled:true,flightDailyLimit:1});
 const blocked=await p.verifyBatch([{...j,number:'MU5202'}],{allowPaid:true,flightGlobalEnabled:true,flightDailyLimit:1});
 assert.match(blocked.results[0].warnings[0],/上限/);
 const unlimited=await p.verifyBatch([{...j,number:'MU5203'}],{allowPaid:true,flightGlobalEnabled:true,flightUnlimited:true});
 assert.equal(unlimited.results[0].found,true);assert.equal(calls,2);assert.equal(p.status({flightGlobalEnabled:true,flightUnlimited:true}).flight.unlimited,true);assert.equal(p.status({flightGlobalEnabled:true}).flight.globalEnabled,true);database.close();
});
test('historical and distant rail dates never hit live provider',async()=>{
 const database=db();let calls=0;const p=createTravelProviders(database,{env:{},trainQuery:async()=>{calls++;return {candidates:[]};}});
 for(const date of ['2020-01-01','2099-01-01']){const r=await p.verifyBatch([{...j,mode:'train',number:'G101',from:'北京南站',to:'上海虹桥站',date}]);assert.equal(r.results[0].found,false);}
 assert.equal(calls,0);database.close();
});
function fakeBackend({stale=false,race=false,error=null}={}){
 const row={id:'a',business_status:'active',updated_at:'v1',custom_fields:{other:'keep'}};
 for(const [key,column] of Object.entries(S.fields))row[column]=a[key]||null;if(stale)row.out_departure='12:00:00';
 let written;const backend={from:()=>{let patch;const q={select:()=>patch?Promise.resolve({data:race?[]:[{id:'a'}],error}):q,eq:()=>q,single:async()=>({data:row}),update:value=>{patch=value;written=value;return q;}};return q;}};
 return {backend,patch:()=>written};
}
test('saving evidence patches metadata only, preserving other columns and metadata',async()=>{
 const f=fakeBackend();await S.save(f.backend,'m',{...a,customFields:{_travelVerification:{outbound:{status:'unavailable'}}}});
 assert.deepEqual(Object.keys(f.patch()),['custom_fields']);assert.equal(f.patch().custom_fields.other,'keep');
});
test('stale source or concurrent write is rejected instead of overwriting',async()=>{
 for(const config of [{stale:true},{race:true}])await assert.rejects(()=>S.save(fakeBackend(config).backend,'m',a),/修改|变化/);
});
test('manual edit saves only changed itinerary columns and an audit record',async()=>{
 const f=fakeBackend();await S.save(f.backend,'m',{...a,outDeparture:'09:30',approval:'normal',outboundApproval:'normal'},{edit:true,baseline:a,operator:'测试负责人'});
 assert.equal(f.patch().out_departure,'09:30');assert.ok(!('name' in f.patch()));assert.ok(!('out_no' in f.patch()));
 assert.equal(f.patch().custom_fields._travelReviewHistory[0].changes[0].before,'09:00');
});
