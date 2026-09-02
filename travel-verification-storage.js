(function(root){
  'use strict';
  const fields={departDate:'depart_date',departCity:'depart_city',departTransportType:'depart_transport_type',departStation:'depart_station',arriveDate:'arrive_date',arriveCity:'arrive_city',arriveTransportType:'arrive_transport_type',arriveStation:'arrive_station',returnDepartDate:'return_depart_date',returnDepartCity:'return_depart_city',returnDepartTransportType:'return_depart_transport_type',returnDepartStation:'return_depart_station',returnArriveDate:'return_arrive_date',returnArriveCity:'return_arrive_city',returnArriveTransportType:'return_arrive_transport_type',returnArriveStation:'return_arrive_station',outDate:'out_date',outFrom:'out_from',outTo:'out_to',outNo:'out_no',outDeparture:'out_departure',outArrival:'out_arrival',returnDate:'return_date',returnFrom:'return_from',returnTo:'return_to',returnNo:'return_no',returnDeparture:'return_departure',returnArrival:'return_arrival'};
  const normalized=(key,value)=>/Departure|Arrival/.test(key)?String(value||'').slice(0,5):String(value||'').trim();
  async function save(backend,meetingId,draft,{baseline=draft,edit=false,operator=''}={}){
    const columns=['id','updated_at','business_status','custom_fields',...Object.values(fields)].join(',');
    const {data:row,error}=await backend.from('attendees').select(columns).eq('meeting_id',meetingId).eq('id',draft.id).single();
    if(error)throw error;
    if(!row||!row.updated_at||row.business_status==='cancelled')throw new Error('记录已删除、取消或缺少版本信息，请刷新名单');
    const staleField=Object.entries(fields).find(([key,column])=>normalized(key,row[column])!==normalized(key,baseline[key]));
    if(staleField)throw new Error(`另一位负责人已修改该行程（${staleField[0]}），请刷新名单后重新核验`);
    if(JSON.stringify(row.custom_fields?._journeySegments||[])!==JSON.stringify(baseline.customFields?._journeySegments||[]))throw new Error('另一位负责人已修改多段行程，请刷新名单后重新核验');
    const custom={...(row.custom_fields||{}),_journeySegments:draft.customFields?._journeySegments||[],_travelVerification:draft.customFields?._travelVerification||{},_travelVerifiedHighlights:draft.customFields?._travelVerifiedHighlights||[]};
    const patch={custom_fields:custom};
    if(edit){
      const changes=[];
      for(const [key,column] of Object.entries(fields))if(normalized(key,draft[key])!==normalized(key,baseline[key])){
        patch[column]=/Station$/.test(key)&&draft[key.replace("Station","TransportType")]==="LOCAL_ATTEND"?null:draft[key]||null;changes.push({field:key,before:baseline[key]||'',after:draft[key]||''});
      }
      const beforeSegments=JSON.stringify(baseline.customFields?._journeySegments||[]),afterSegments=JSON.stringify(draft.customFields?._journeySegments||[]);
      if(beforeSegments!==afterSegments)changes.push({field:'journeySegments',before:beforeSegments,after:afterSegments});
      if(changes.length){patch.approval=draft.approval;patch.risks=draft.risks||[];}
      if(changes.length)custom._travelReviewHistory=[...(custom._travelReviewHistory||[]),{at:new Date().toISOString(),operator,changes}];
      // Travel approval is separate; only invalidate the directions the editor changed.
      for(const [prefix,field] of [['out','outbound_approval_status'],['return','return_approval_status']])if(changes.some(c=>c.field.startsWith(prefix)))patch[field]=prefix==='out'?draft.outboundApproval:draft.returnApproval;
    }
    const saved=await backend.from('attendees').update(patch).eq('meeting_id',meetingId).eq('id',draft.id).eq('updated_at',row.updated_at).select('id');
    if(saved.error)throw saved.error;
    if(saved.data?.length!==1)throw new Error('保存期间名单已变化，未覆盖其他人的修改，请刷新后重试');
    draft.customFields=custom;
  }
  const api={save,fields};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TravelVerificationStorage=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
