export const clean = v => v == null ? '' : String(v).normalize('NFKC').trim();
export const normCode = v => clean(v).toUpperCase().replace(/\s/g, '');
export const railStation = v => clean(v).replace(/站$/, '').replace(/\s/g, '');
export function today() { return localParts(new Date().toISOString(),'Asia/Shanghai').date; }
export function localParts(iso, zone) {
  if (!iso || !zone || !Number.isFinite(Date.parse(iso))) return null;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));
    return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
  } catch { return null; }
}
export function validDate(s) {return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
export function excelDate(v) {
  if(typeof v==='number' && v>0 && v<100000) return new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);
  const s=clean(v).replace(/[年月/.]/g,'-').replace(/日/g,'');
  const m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  const d=m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';
  return validDate(d)?d:'';
}
export function excelTime(v) {
  if(typeof v==='number' && v>=0 && v<100000) {
    const n=Math.round((v%1)*1440)%1440;
    return {time:`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`,embeddedDate:v>=1?excelDate(v):null};
  }
  const s=clean(v);const m=s.match(/^(?:(\d{4}-\d{2}-\d{2})[ T])?(\d{1,2}):(\d{2})(?::\d{2})?$/);
  return m&&+m[2]<24&&+m[3]<60?{time:`${m[2].padStart(2,'0')}:${m[3]}`,embeddedDate:m[1]||null}:{time:'',embeddedDate:null};
}
