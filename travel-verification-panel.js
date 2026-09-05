(function(root){
  'use strict';

  const labels={verified:'核验通过',difference:'计划有差异',review:'需补全 / 人工确认',pending:'尚未核验',unavailable:'暂无法核验',stale:'行程已修改 · 待重查',blank:'未提供行程'};
  const fieldLabels={date:'出发日期',departCity:'出发城市',departTransportType:'出行方式',from:'出发场站',arriveDate:'抵达日期',arriveCity:'抵达城市',to:'抵达场站',number:'航班 / 车次号',departure:'计划出发时间',arrival:'计划到达时间'};
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const friendlyNotice=value=>/load failed|failed to fetch|networkerror|network request failed|fetch failed/i.test(String(value||''))?'核验服务连接失败，请检查网络后重试':String(value||'');
  const segmentList=(attendee,V)=>typeof V.segments==='function'?V.segments(attendee):['outbound','return'];
  const segmentDirection=(segment,V)=>typeof V.direction==='function'?V.direction(segment):(segment==='return'?'return':'outbound');

  function records(attendees,V){
    return attendees.flatMap(attendee=>segmentList(attendee,V).map(segment=>({attendee,segment,status:V.viewState(attendee,segment),data:V.snapshot(attendee,segment)})));
  }

  function render(attendees,V,{filter='all',query='',canEdit=false,isLocked=()=>false,selected=new Set(),globalFlightEnabled=false,disabledPaid=new Set()}={}){
    const all=records(attendees,V);
    const counts=Object.fromEntries(Object.keys(labels).map(status=>[status,all.filter(item=>item.status===status).length]));
    const list=all.filter(item=>(filter==='all'?item.status!=='blank':filter==='pending'?['pending','stale','unavailable'].includes(item.status):item.status===filter)&&(!query||[item.attendee.name,item.attendee.region,...Object.values(item.data)].join(' ').toLowerCase().includes(query.toLowerCase())));
    const summary=`<div><small>有行程记录</small><strong>${all.length-counts.blank}</strong></div><div><small>核验通过</small><strong>${counts.verified}</strong></div><div><small>计划有差异</small><strong>${counts.difference}</strong></div><div><small>待确认 / 待核验</small><strong>${all.length-counts.blank-counts.verified-counts.difference}</strong></div>`;
    const selectableKeys=all.filter(item=>item.status!=='blank').map(item=>`${item.attendee.id}:${item.segment}`);
    const visibleSelectableKeys=list.filter(item=>item.status!=='blank').map(item=>`${item.attendee.id}:${item.segment}`);

    const body=list.map(({attendee,segment,status,data})=>{
      const saved=attendee.customFields?._travelVerification?.[segment];
      const check=status==='stale'?null:saved;
      const problems=V.currentIssues(attendee,segment);
      const fields=V.keys(segment);
      const detailRows=Object.entries(fieldLabels).map(([key,label])=>{
        const issues=problems.filter(issue=>issue.field===fields[key]);
        const mismatch=issues.some(issue=>issue.expected!==undefined);
        const expected=check?.match?.[key]??({departCity:check?.match?.fromCity,arriveDate:check?.match?.arrivalDate||check?.match?.date,arriveCity:check?.match?.toCity,departTransportType:check?.mode==='flight'?'飞机':check?.mode==='train'?'高铁':check?.mode==='local'?'本地参会':''})[key];
        const offset=key==='arrival'&&Number(check?.match?.arrivalDayOffset)>0?` +${check.match.arrivalDayOffset} 天`:'';
        return `<tr class="${mismatch?'verify-field-difference':issues.length?'verify-field-review':''}"><th scope="row">${label}</th><td>${escape(data[key]||'未填写')}</td><td>${escape(expected?expected+offset:'—')}</td><td>${escape(issues.map(issue=>issue.message).join('；')||(check?.status==='verified'?'一致':'—'))}</td></tr>`;
      }).join('');
      const selectionKey=`${attendee.id}:${segment}`;
      const sameDirection=segmentList(attendee,V).filter(value=>segmentDirection(value,V)===segmentDirection(segment,V));
      const position=sameDirection.indexOf(segment)+1;
      const directionLabel=segmentDirection(segment,V)==='return'?'返程':'去程';
      const segmentLabel=sameDirection.length>1?`${directionLabel}第 ${position} 段`:directionLabel;
      const mode=typeof V.transportMode==='function'?V.transportMode(data):'';
      const isFlight=mode==='flight';
      const flightAllowed=isFlight&&globalFlightEnabled&&!disabledPaid.has(selectionKey);
      const route=[data.from,data.to].filter(Boolean).join(' → ')||'场站待补充';
      const schedule=[data.date,data.number,[data.departure,data.arrival].filter(Boolean).join('–')].filter(Boolean).join(' · ')||'行程信息待补充';
      const flightControl=isFlight
        ?`<label class="verify-flight-toggle ${globalFlightEnabled?'':'is-disabled'}" title="${globalFlightEnabled?'可单独关闭本行飞常准查询':'需由超级管理员开启全局查询'}"><input type="checkbox" data-disable-flight-query="${escape(attendee.id)}" data-disable-segment="${escape(segment)}" ${flightAllowed?'checked':''} ${globalFlightEnabled?'':'disabled'}><span>${flightAllowed?'查询':'不查询'}</span></label>`
        :'<span class="verify-source-na">非航班</span>';
      const source=check?.source?.label||check?.provider||'尚无查询依据';
      const checkedAt=check?.source?.checkedAt||check?.checkedAt;
      const editable=canEdit&&!isLocked(attendee);
      const notice=status==='stale'?'名单已修改，旧核验结果不再适用。':(check?.notices||[]).map(friendlyNotice).join('；');

      return `<tr class="verify-card verify-compact-row ${selected.has(selectionKey)?'verify-card-selected':''} ${isFlight&&!flightAllowed?'verify-flight-disabled':''}" data-verification-attendee="${escape(attendee.id)}" data-verification-segment="${escape(segment)}"><td><label class="verify-row-check" title="选择此段行程"><input type="checkbox" data-select-verification="${escape(attendee.id)}" data-select-segment="${escape(segment)}" ${selected.has(selectionKey)?'checked':''} ${status==='blank'?'disabled':''}></label></td><td><strong>${escape(attendee.name)}</strong><small>${escape(attendee.region||'未填写大区')}</small></td><td><strong>${escape(segmentLabel)} · ${escape(schedule)}</strong><small>${escape(route)}</small></td><td>${flightControl}</td><td><span class="verify-state verify-state-${status}">${labels[status]}</span></td><td><button class="text-button verify-expand-button" type="button" data-toggle-verification-detail="${escape(selectionKey)}" aria-expanded="false">展开详情</button></td></tr><tr class="verify-detail-row" data-verification-detail="${escape(selectionKey)}" hidden><td colspan="6"><div class="verify-detail-panel"><div class="verify-table-scroll"><table class="verify-table"><thead><tr><th>名单字段</th><th>当前名单值</th><th>查询到的计划值</th><th>核验说明</th></tr></thead><tbody>${detailRows}</tbody></table></div><p class="verify-notice">${escape(notice)}</p><footer><small>${escape(source)}${checkedAt?' · '+escape(new Date(checkedAt).toLocaleString('zh-CN',{hour12:false})):''}</small><div><button class="button button-secondary" data-review-travel="${escape(attendee.id)}" data-review-segment="${escape(segment)}" ${editable?'':'disabled'}>${editable?'人工审核 / 修改':'只读 / 名单已锁定'}</button>${check&&editable?`<button class="text-button" data-reset-travel="${escape(attendee.id)}" data-reset-segment="${escape(segment)}">重置核验状态</button>`:''}</div></footer></div></td></tr>`;
    }).join('');

    const html=body?`<div class="verify-compact-table-wrap"><table class="verify-compact-table"><thead><tr><th aria-label="选择"></th><th>参会人员</th><th>航班 / 车次摘要</th><th>飞常准</th><th>核验状态</th><th>详情</th></tr></thead><tbody>${body}</tbody></table></div>`:'<div class="empty-state">没有符合筛选条件的行程。名单新增或修改后会同步显示。</div>';
    return {summary,html,counts,selectableKeys,visibleSelectableKeys};
  }

  const api={render,records,labels};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.TravelVerificationPanel=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
