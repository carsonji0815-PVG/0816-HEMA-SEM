import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapVariflight,decodeVariflight,variflightSchedule,probeVariflight,variflightEndpoint} from '../server/variflight.mjs';
const f={FlightNo:'MU1234',FlightDepcode:'SHA',FlightArrcode:'FOC',FlightDeptimePlanDate:'2026-09-01 10:00:00',FlightArrtimePlanDate:'2026-09-01 12:00:00',fcategory:'0',org_timezone:'28800',dst_timezone:'28800',FlightHTerminal:'T1',FlightTerminal:'T2',FlightState:'计划'};
test('VariFlight maps only documented planned fields and preserves terminals',()=>{
 const c=mapVariflight({...f,FlightDeptimeReadyDate:'2026-09-01 11:30:00'});assert.equal(c.depart,'10:00');assert.equal(c.departureTerminal,'T1');
 assert.equal(mapVariflight({...f,FlightDeptimePlanDate:null}).depart,undefined);
 assert.equal(mapVariflight({...f,fcategory:'1'}).depart,undefined);
});
test('VariFlight refuses prose, error payloads, and unrecognized response fields',()=>{
 assert.throws(()=>decodeVariflight({content:[{type:'text',text:'预计10点起飞'}]}));
 assert.throws(()=>decodeVariflight({isError:true}));
 assert.throws(()=>decodeVariflight({structuredContent:{error_code:123,result:[]}}));
 assert.throws(()=>decodeVariflight({structuredContent:{data:[{estimated:'10:00'}]}}));
 assert.equal(decodeVariflight({content:[{type:'text',text:JSON.stringify([f])}]}).length,1);
});
test('VariFlight safely parses its live text envelope and explains no-data responses',()=>{
 const wrapped=`Flight details: {'code': 200, 'message': 'Success', 'data': {'error_code': 0, 'data': [{'FlightNo': 'MU1234', 'FlightDepcode': 'SHA', 'FlightArrcode': 'FOC', 'FlightDeptimePlanDate': '2026-09-01 10:00:00', 'FlightArrtimePlanDate': '2026-09-01 12:00:00', 'fcategory': '0', 'org_timezone': 28800, 'dst_timezone': 28800, 'FlightHTerminal': 'T1', 'FlightTerminal': 'T2', 'FlightState': '计划', 'VirtualFlag': None}]}}`;
 assert.equal(decodeVariflight({content:[{type:'text',text:wrapped}]}).length,1);
 const noData=`Flight details: {'code': 200, 'message': 'Success', 'data': {'error_code': 10, 'error': '暂无数据'}}`;
 assert.throws(()=>decodeVariflight({content:[{type:'text',text:noData}]}),/已连接.*暂无计划数据/);
 assert.throws(()=>decodeVariflight({content:[{type:'text',text:"Flight details: __import__('os')"}]}),/无法安全解析/);
});
test('VariFlight connection probe never calls a chargeable flight tool',async t=>{
 const methods=[];t.mock.method(globalThis,'fetch',async(url,opts)=>{const b=JSON.parse(opts.body);methods.push(b.method);assert.equal(url,variflightEndpoint);assert.equal(opts.headers['X-API-Key'],'synthetic-secret');
  return b.method==='notifications/initialized'?new Response(null,{status:202}):Response.json({jsonrpc:'2.0',id:b.id,result:b.method==='initialize'?{protocolVersion:'2025-03-26'}:{tools:[{name:'searchFlightsByNumber'}]}});
 });assert.equal((await probeVariflight('synthetic-secret')).ok,true);assert.deepEqual(methods,['initialize','notifications/initialized','tools/list']);
});
test('VariFlight query sends only itinerary parameters and exact airport codes',async t=>{
 let calls=0,toolArgs;t.mock.method(globalThis,'fetch',async(url,opts)=>{const b=JSON.parse(opts.body);if(b.method==='notifications/initialized')return new Response(null,{status:202});if(b.method==='tools/call')toolArgs=b.params;
  return Response.json({jsonrpc:'2.0',id:b.id,result:b.method==='initialize'?{protocolVersion:'2025-03-26'}:{content:[{type:'text',text:JSON.stringify([f])}]}});
 });const r=await variflightSchedule({date:'2026-09-01',code:'MU1234',fromCode:'SHA',toCode:'FOC',name:'not transmitted'},'synthetic-secret',()=>{calls++;});
 assert.equal(calls,3);assert.deepEqual(toolArgs,{name:'searchFlightsByNumber',arguments:{fnum:'MU1234',date:'2026-09-01',dep:'SHA',arr:'FOC'}});assert.equal(r.candidates[0].arrive,'12:00');assert.ok(!JSON.stringify(r).includes('synthetic-secret'));
});
test('VariFlight exhausted balance stops without retries or top-up',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('',{status:403});});await assert.rejects(()=>probeVariflight('synthetic-secret'),e=>e.status==='credentials');assert.equal(calls,1);
});
test('VariFlight respects network budget before issuing a flight query',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async(url,opts)=>{calls++;const b=JSON.parse(opts.body);return b.id?Response.json({id:b.id,result:{protocolVersion:'2025-03-26'}}):new Response(null,{status:202});});
 let n=0;await assert.rejects(()=>variflightSchedule({date:'2026-09-01',code:'MU1234'},'synthetic-secret',()=>{if(++n>2)throw new Error('budget');}),/budget/);assert.equal(calls,2);
});
