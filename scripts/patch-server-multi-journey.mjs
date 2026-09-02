import {readFileSync,writeFileSync} from "node:fs";

const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error("usage: patch-server-multi-journey.mjs <input> <output>");
let source=readFileSync(input,"utf8");
const replacements=[
  ["!['outbound','return'].includes(j.segment)","!/^(outbound|return)(:[a-zA-Z0-9-]{8,80})?$/.test(j.segment || '')"],
  ["'id,business_status,out_date,out_from,out_to,out_no,out_departure,out_arrival,return_date,return_from,return_to,return_no,return_departure,return_arrival'","'id,business_status,custom_fields,depart_city,depart_transport_type,arrive_date,arrive_city,return_depart_city,return_depart_transport_type,return_arrive_date,return_arrive_city,out_date,out_from,out_to,out_no,out_departure,out_arrival,return_date,return_from,return_to,return_no,return_departure,return_arrival'"],
  [
`        const row = roster.find(a => a.id === j.attendeeId), prefix = j.segment === 'return' ? 'return' : 'out';
        return !row || row.business_status === 'cancelled' || Object.entries(mapping).some(([key,column]) => {
          const value = String(row[\`${'${prefix}'}_\${column}\`] || '').trim();`,
`        const row = roster.find(a => a.id === j.attendeeId), extraId=String(j.segment).includes(':')?String(j.segment).split(':').slice(1).join(':'):'',prefix = String(j.segment).startsWith('return') ? 'return' : 'out';
        const extra=extraId?(row?.custom_fields?._journeySegments||[]).find(item=>String(item.id)===extraId):null;
        const extraMapping={date:'departDate',from:'departStation',to:'arriveStation',number:'number',departure:'departure',arrival:'arrival'};
        const detailValues=extra?{departCity:extra.departCity,departTransportType:extra.transportType,arriveDate:extra.arriveDate,arriveCity:extra.arriveCity}:prefix==='return'?{departCity:row?.return_depart_city,departTransportType:row?.return_depart_transport_type,arriveDate:row?.return_arrive_date,arriveCity:row?.return_arrive_city}:{departCity:row?.depart_city,departTransportType:row?.depart_transport_type,arriveDate:row?.arrive_date,arriveCity:row?.arrive_city};
        return !row || row.business_status === 'cancelled' || (extraId&&!extra) || ['departCity','departTransportType','arriveDate','arriveCity'].some(key=>String(j[key]||'').trim()!==String(detailValues[key]||'').trim()) || Object.entries(mapping).some(([key,column]) => {
          const value = String(extra?extra[extraMapping[key]]:row[\`${'${prefix}'}_\${column}\`] || '').trim();`
  ],
];
for(const [before,after] of replacements){
  if(!source.includes(before))throw new Error("production server baseline changed; refusing partial multi-journey patch");
  if(source.indexOf(before)!==source.lastIndexOf(before))throw new Error("production server marker is ambiguous");
  source=source.replace(before,after);
}
writeFileSync(output,source,{mode:0o600});
console.log(JSON.stringify({patched:true,bytes:Buffer.byteLength(source)}));
