(function(root){
  'use strict';
  const labels={verified:'核验通过',difference:'计划有差异',review:'需补全 / 人工确认',pending:'尚未核验',unavailable:'暂无法核验',stale:'行程已修改 · 待重查',blank:'未提供行程'};
  const fieldLabels={date:'出发日期',departCity:'出发城市',departTransportType:'出发出行方式',from:'出发场站',arriveDate:'抵达日期',arriveCity:'抵达城市',arriveTransportType:'抵达出行方式',to:'抵达场站',number:'航班 / 车次号',departure:'计划出发时间',arrival:'计划到达时间'};
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function records(attendees,V){return attendees.flatMap(attendee=>['outbound','return'].map(segment=>({attendee,segment,status:V.viewState(attendee,segment),data:V.snapshot(attendee,segment)})));}
  function render(attendees,V,{filter='all',query='',canEdit=false,isLocked=()=>false}={}){
    const all=records(attendees,V),counts=Object.fromEntries(Object.keys(labels).map(status=>[status,all.filter(item=>item.status===status).length]));
    const list=all.filter(item=>(filter==='all'?item.status!=='blank':filter==='pending'?['pending','stale','unavailable'].includes(item.status):item.status===filter)&&(!query||[item.attendee.name,item.attendee.region,...Object.values(item.data)].join(' ').toLowerCase().includes(query.toLowerCase())));
    const summary=`<div><small>有行程记录</small><strong>${all.length-counts.blank}</strong></div><div><small>核验通过</small><strong>${counts.verified}</strong></div><div><small>计划有差异</small><strong>${counts.difference}</strong></div><div><small>待确认 / 待核验</small><strong>${all.length-counts.blank-counts.verified-counts.difference}</strong></div>`;
    const html=list.map(({attendee:a,segment,status,data})=>{
      const saved=a.customFields?._travelVerification?.[segment],check=status==='stale'?null:saved;
      const problems=V.currentIssues(a,segment),fields=V.keys(segment);
      const rows=Object.entries(fieldLabels).map(([key,label])=>{
        const issues=problems.filter(issue=>issue.field===fields[key]);
        const mismatch=issues.some(issue=>issue.expected!==undefined);
        const expected=check?.match?.[key]??({departCity:check?.match?.fromCity,arriveDate:check?.match?.arrivalDate||check?.match?.date,arriveCity:check?.match?.toCity,departTransportType:check?.mode==='flight'?'飞机':check?.mode==='train'?'高铁':check?.mode==='local'?'本地参会':'',arriveTransportType:check?.mode==='flight'?'飞机':check?.mode==='train'?'高铁':check?.mode==='local'?'本地参会':''})[key];
        const offset=key==='arrival'&&Number(check?.match?.arrivalDayOffset)>0?` +${check.match.arrivalDayOffset} 天`:'';
        return `<tr class="${mismatch?'verify-field-difference':issues.length?'verify-field-review':''}"><th scope="row">${label}</th><td>${escape(data[key]||'未填写')}</td><td>${escape(expected?expected+offset:'—')}</td><td>${escape(issues.map(issue=>issue.message).join('；')||(check?.status==='verified'?'一致':'—'))}</td></tr>`;
      }).join('');
      const source=check?.source?.label||check?.provider||'尚无查询依据';
      const at=check?.source?.checkedAt||check?.checkedAt;
      const editable=canEdit&&!isLocked(a);
      return `<article class="verify-card" data-verification-attendee="${escape(a.id)}" data-verification-segment="${segment}"><header><div><strong>${escape(a.name)} · ${segment==='return'?'返程':'去程'}</strong><small>${escape(a.region||'')} · ${escape(data.number)}</small></div><span class="verify-state verify-state-${status}">${labels[status]}</span></header><div class="verify-table-scroll"><table class="verify-table"><thead><tr><th>名单字段</th><th>当前名单值</th><th>查询到的计划值</th><th>核验说明</th></tr></thead><tbody>${rows}</tbody></table></div><p class="verify-notice">${escape(status==='stale'?'名单已修改，旧核验结果不再适用。':(check?.notices||[]).join('；'))}</p><footer><small>${escape(source)}${at?' · '+escape(new Date(at).toLocaleString('zh-CN',{hour12:false})):''}</small><div><button class="button button-secondary" data-review-travel="${escape(a.id)}" ${editable?'':'disabled'}>${editable?'人工审核 / 修改':'只读 / 名单已锁定'}</button>${check&&editable?`<button class="text-button" data-reset-travel="${escape(a.id)}" data-reset-segment="${segment}">重置核验状态</button>`:''}</div></footer></article>`;
    }).join('')||'<div class="empty-state">没有符合筛选条件的行程。名单新增或修改后会同步显示。</div>';
    return {summary,html,counts};
  }
  const api={render,records,labels};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TravelVerificationPanel=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
