import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import { IDBFactory } from 'fake-indexeddb'
const root=new URL('../../../',import.meta.url)
const pause=()=>new Promise(resolve=>setTimeout(resolve,40))
test('host UI: default-off, enable internally, one shell, authorized roster, switching and role isolation',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',root),'utf8'),{url:'http://localhost/#settings',runScripts:'outside-only',pretendToBeVisual:true})
 const w=dom.window
 try {
 w.APP_CONFIG={mode:'demo'};w.scrollTo=()=>{};w.confirm=()=>true;w.indexedDB=new IDBFactory();w.matchMedia=()=>({matches:false,addEventListener(){}})
 w.eval(await readFile(new URL('luggage-integration.js',root),'utf8'))
 w.eval(await readFile(new URL('travel-fields.js',root),'utf8'))
 w.eval(await readFile(new URL('travel-verification.js',root),'utf8'))
 w.eval(await readFile(new URL('travel-verification-panel.js',root),'utf8'))
 w.eval(await readFile(new URL('travel-verification-storage.js',root),'utf8'))
 w.eval(await readFile(new URL('rooming-engine.js',root),'utf8'))
 w.eval(await readFile(new URL('app.js',root),'utf8'))
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'))
 await pause()
 const toggle=w.document.getElementById('luggageSwitch')
 assert.equal(toggle.checked,false)
 assert.equal(w.document.querySelector('iframe'),null)
 toggle.checked=true;toggle.dispatchEvent(new w.Event('change')); await pause()
 assert.equal(toggle.checked,true)
 assert.equal(w.document.getElementById('luggageNav').classList.contains('is-hidden'),false, w.document.getElementById('luggageFeatureHint').textContent + ' / ' + w.document.body.textContent.slice(-1200))
 w.location.hash='luggage';await pause()
 assert.equal(w.document.querySelectorAll('#luggageFrame').length,1)
 assert.ok(w.document.getElementById('luggageFrame').src.endsWith('/luggage/index.html'))
 const context=w.JourneyLuggageHost.context()
 const attendees=await w.JourneyLuggageHost.attendees(context.eventId)
 assert.equal(attendees.length,5)
 assert.deepEqual(Object.keys(attendees[0]).sort(),['attend_id','dept','mobile','name'])
 await assert.rejects(w.JourneyLuggageHost.attendees('another-meeting'),/变更/)
 w.location.hash='settings';await pause()
 assert.equal(w.document.querySelector('#luggageFrame'),null)
 toggle.checked=false;toggle.dispatchEvent(new w.Event('change'));await pause()
 assert.equal(toggle.checked,false)
 // History link remains but cannot perform check-in.
 w.location.hash='luggage';await pause()
 assert.equal(w.JourneyLuggageHost.context().enabled,false)
 await assert.rejects(w.JourneyLuggageHost.attendees(context.eventId),/未启用/)
 const user=w.document.getElementById('userSelect');user.value='u-sales-1';user.dispatchEvent(new w.Event('change'));await pause()
 assert.equal(w.document.querySelector('#luggageFrame'),null)
 assert.equal(w.JourneyLuggageHost.context(),null)
 assert.equal(toggle.disabled,true)
 } finally { w.close() }
})

test('offline grant: scoped account, finite expiry, mode separation and sign-out revocation',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',root),'utf8'),{url:'http://localhost/#luggage',runScripts:'outside-only'})
 const w=dom.window
 try {
 w.indexedDB=new IDBFactory();let production=true,allowed=true;
 const value={eventId:'event-one',userId:'operator-one',eventName:'内部大会',operator:'工作人员',enabled:true,used:true,configured:true}
 await new Promise((resolve,reject)=>{const q=w.indexedDB.open('journey-luggage-operator-one');q.onupgradeneeded=()=>q.result.createObjectStore('attendee');q.onerror=reject;q.onsuccess=()=>{q.result.close();resolve()}})
 Object.defineProperty(w.navigator,'serviceWorker',{value:{register:async()=>({}),ready:Promise.resolve({})}})
 w.eval(await readFile(new URL('luggage-integration.js',root),'utf8'))
 const controller=w.createJourneyLuggage({current:()=>value,canManage:()=>allowed,isProduction:()=>production,authenticated:()=>allowed,backend:()=>({}),toast(){},attendees:()=>[],markUsed(){},setEnabled(){}})
 w.document.querySelector('[data-page="luggage"]').classList.add('active');controller.render()
 assert.equal(await w.JourneyLuggageHost.prepareOffline(),true)
 Object.defineProperty(w.navigator,'onLine',{configurable:true,value:false})
 assert.equal((await controller.resume(value.userId)).eventId,value.eventId)
 assert.equal(await controller.resume('other-operator'),null)
 production=false;assert.equal(await controller.resume(value.userId),null);production=true
 const clock=w.Date.now;w.Date.now=()=>clock()+13*60*60*1000
 assert.equal(await controller.resume(value.userId),null);w.Date.now=clock
 await controller.clearAccess();assert.equal(await controller.resume(value.userId),null)
 allowed=false;controller.render();assert.equal(w.JourneyLuggageHost.context(),null)
 }finally{w.close()}
})

test('saved meeting feature survives reload; normalization is safe during bootstrap',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',root),'utf8'),{url:'http://localhost/#luggage',runScripts:'outside-only',pretendToBeVisual:true})
 const w=dom.window
 try {
 w.APP_CONFIG={mode:'demo'};w.scrollTo=()=>{};w.confirm=()=>true;w.indexedDB=new IDBFactory();w.matchMedia=()=>({matches:false,addEventListener(){}})
 w.localStorage.setItem('journey-desk-state-v1',JSON.stringify({currentUserId:'u-ops',activeProjectId:'saved-meeting',projects:[{id:'saved-meeting',name:'2500人内部会议',slug:'internal-large',luggageEnabled:true,registrationOpen:true}],settings:{eventName:'2500人内部会议',luggageEnabled:true,luggageUsed:true,registrationOpen:true},attendees:[{id:'saved-attendee',name:'测试参会人',phone:'13800138000',ownerId:'u-ops',privacyLetterStatus:'sent',transport:{pickup:{},dropoff:{}}}]}))
 w.eval(await readFile(new URL('luggage-integration.js',root),'utf8'));w.eval(await readFile(new URL('travel-fields.js',root),'utf8'));w.eval(await readFile(new URL('travel-verification.js',root),'utf8'));w.eval(await readFile(new URL('travel-verification-panel.js',root),'utf8'));w.eval(await readFile(new URL('travel-verification-storage.js',root),'utf8'));w.eval(await readFile(new URL('rooming-engine.js',root),'utf8'));w.eval(await readFile(new URL('app.js',root),'utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await pause()
 assert.equal(w.document.querySelectorAll('#luggageFrame').length,1)
 assert.equal(w.JourneyLuggageHost.context().eventId,'saved-meeting')
 assert.equal((await w.JourneyLuggageHost.attendees('saved-meeting'))[0].attend_id,'saved-attendee')
 }finally{w.close()}
})
