/* First-party integration. This script does not load Vue, scanners or IndexedDB until requested. */
window.createJourneyLuggage = function createJourneyLuggage(deps) {
  let frame = null, frameContext = null, hooks = null, toggling = false, requestedTab = '';
  const $ = id => document.getElementById(id);
  function authorized() {
    return deps.canManage() && (!deps.isProduction() || (deps.backend() && deps.authenticated()));
  }
  function context() {
    if (!frame || !authorized()) return null;
    const value = deps.current();
    if (value.offlineUntil && Date.now() > value.offlineUntil) return null;
    if (frameContext.eventId !== value.eventId || frameContext.userId !== value.userId) return null;
    return { ...value, mode: deps.isProduction() ? 'production' : 'demo' };
  }
  function guard(eventId, write = false) {
    const value = context();
    if (!value || value.eventId !== eventId) throw new Error('会议或登录权限已变更，请重新进入行李管理');
    if (write && !value.enabled) throw new Error('本场行李管理未启用');
    return value;
  }
  async function rpc(name, args) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let result;
    try { result = await deps.backend().rpc(name, args).abortSignal(controller.signal); }
    finally { clearTimeout(timer); }
    const { data, error } = result;
    if (error) throw new Error(/schema cache|does not exist|PGRST202/.test(error.message || '') ? '行李数据服务尚未升级，请管理员完成数据库升级后使用' : error.message);
    return data;
  }
  const api = Object.freeze({
    context,
    async prepareOffline() {
      const value = context();
      if (!value || !value.enabled || value.offlineUntil) return false;
      await accessSnapshot(value.userId, 'put', { ...value, expiresAt:Date.now()+12*60*60*1000 });
      if (!('serviceWorker' in navigator)) return false;
      await navigator.serviceWorker.register(new URL('journey-sw.js', document.baseURI), { scope:new URL('./', document.baseURI).pathname });
      await navigator.serviceWorker.ready;
      return true;
    },
    attach(value) { if (context()) hooks = value; },
    resize(height) { if (frame && Number.isFinite(height)) frame.style.height = `${Math.max(650, Math.min(16000, height + 4))}px`; },
    async attendees(eventId) {
      guard(eventId, true);
      if (deps.isProduction()) {
        const result = await rpc('luggage_attendees', { p_meeting_id: eventId });
        guard(eventId, true);
        return result;
      }
      return deps.attendees().filter(a => a.businessStatus !== 'cancelled').map(a => ({ attend_id: a.id, name: a.name, dept: a.department || '', mobile: a.phone || '' }));
    },
    async config(eventId) {
      guard(eventId);
      if (deps.isProduction()) return rpc('luggage_config', { p_meeting_id:eventId });
      const saved = JSON.parse(localStorage.getItem(`luggage-config:${eventId}`) || 'null');
      return saved || { meeting_id:eventId,enable_luggage:!!deps.current().enabled,total_rows:50,per_row_max_position:50,allow_multi_bag:false,label_template:{paperWidth:80,paperHeight:120,margin:4,fontSize:12,fields:['barcode','position','name']} };
    },
    async saveConfig(eventId, config) {
      guard(eventId);
      let saved;
      if (deps.isProduction()) saved = await rpc('save_luggage_config', { p_meeting_id:eventId,p_config:config });
      else { saved={...config,meeting_id:eventId};localStorage.setItem(`luggage-config:${eventId}`,JSON.stringify(saved)); }
      deps.setEnabled(!!saved.enable_luggage);
      return saved;
    },
    async reset(eventId) {
      guard(eventId,true);
      if (deps.isProduction()) await rpc('reset_meeting_luggage',{p_meeting_id:eventId,p_confirmation:'RESET LUGGAGE'});
      return true;
    },
    async sync(eventId, payload) {
      guard(eventId);
      if (payload.event_id !== eventId) throw new Error('会议不匹配');
      if (deps.current().offlineUntil) throw new Error('网络恢复后请刷新主页面，重新验证登录并同步');
      if (!deps.isProduction()) return { mock: true };
      await rpc('sync_luggage_record', { p_meeting_id: eventId, p_record: payload });
      guard(eventId);
      deps.markUsed();
      return { mock: false };
    },
    async ledger(eventId) {
      guard(eventId);
      if (!deps.isProduction()) throw new Error('演示模式没有云端台账，请导出本机台账');
      const result = []; let after = '';
      for (;;) {
        const batch = await rpc('luggage_ledger_page', { p_meeting_id: eventId, p_after: after });
        guard(eventId);
        result.push(...batch);
        if (batch.length < 500) break;
        after = batch[batch.length - 1].luggage_barcode;
      }
      return result;
    },
  });
  Object.defineProperty(window, 'JourneyLuggageHost', { value: api });
  function canLeave() { return !hooks || hooks.canLeave(); }
  function unmount() {
    frame?.remove(); frame = null; hooks = null; frameContext = null;
  }
  function render() {
    const value = deps.current(), allowed = authorized();
    const available = allowed && (value.enabled || value.used);
    $('luggageNav').classList.toggle('is-hidden', !available);
    $('luggageSwitch').checked = value.enabled;
    $('luggageSwitch').disabled = toggling || !allowed || !value.eventId || (deps.isProduction() && !value.configured);
    $('luggageFeatureStatus').textContent = value.enabled ? '已启用' : '未启用';
    $('luggageFeatureStatus').className = `status ${value.enabled ? 'status-normal' : 'status-locked'}`;
    $('luggageFeatureHint').textContent = deps.isProduction() && !value.configured ? '需先完成行李数据库升级，当前不会产生行李请求。' : '内部、外部会议均可按需启用；关闭后保留历史台账。';
    $('luggageSettingsEntry').classList.toggle('is-hidden', !available);
    $('luggageNavLabel').textContent = value.enabled ? '行李管理' : '行李历史台账';
    $('luggagePageHint').textContent = value.enabled ? '使用当前会议名单 · 一人多件 · 本地保存后后台同步' : '功能已关闭 · 仅查看和导出历史台账';
    const visible = document.querySelector('[data-page="luggage"].active');
    if (!visible || !available) { unmount(); return; }
    if (frame && (!context() || frameContext.enabled !== value.enabled)) unmount();
    if (!frame) {
      frameContext = { ...value };
      frame = document.createElement('iframe');
      frame.id = 'luggageFrame'; frame.title = '本场会议行李管理';
      const frameUrl = new URL('luggage/index.html', document.baseURI);
      if (requestedTab) frameUrl.searchParams.set('tab',requestedTab);
      requestedTab = '';
      frame.src = frameUrl.href;
      frame.setAttribute('allow', "camera 'self'");
      $('luggageMount').replaceChildren(frame);
    }
  }
  async function toggle(enabled) {
    const value = deps.current();
    if (!authorized() || toggling) { render(); return; }
    if (value.offlineUntil) { deps.toast('请联网并重新验证登录后修改会议开关','error'); render(); return; }
    if (!enabled && !confirm('关闭前请确认所有寄存终端已联网、完成同步并取清行李。离线终端尚未上传的记录无法由云端检查。关闭后仅保留历史台账，确定继续？')) { render(); return; }
    toggling = true; render();
    try {
      // Read-only local check, loaded on demand; no IndexedDB open for disabled meetings at startup.
      const local = await localStatus(value);
      if (!enabled && (local.active || local.pending)) throw new Error('本机还有未领取或未同步记录，请处理完成后关闭');
      if (deps.isProduction()) await rpc('set_meeting_luggage_enabled', { p_meeting_id: value.eventId, p_enabled: enabled });
      if (deps.current().eventId !== value.eventId) throw new Error('会议已切换，请刷新会议设置');
      if (!enabled) await accessSnapshot(value.userId, 'delete');
      deps.setEnabled(enabled);
      deps.toast(enabled ? '本场会议已启用行李管理' : '行李管理已关闭，历史台账保留');
    } catch (error) { deps.toast(error.message || '行李设置未保存', 'error'); }
    finally { toggling = false; render(); }
  }
  async function localStatus(value) {
    if (!window.indexedDB) throw new Error('当前浏览器不支持离线存储');
    // Opening an existing DB does not read or alter other projects' data.
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`journey-luggage-${value.userId}`);
      request.onerror = () => reject(new Error('本机存储检查失败，设置未更改'));
      request.onblocked = () => reject(new Error('请关闭同一浏览器中的其他行李页面后重试'));
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('luggage')) { db.close(); resolve({ active: 0, pending: 0 }); return; }
        const tx = db.transaction('luggage', 'readonly');
        let active = 0, pending = 0;
        tx.objectStore('luggage').openCursor().onsuccess = event => {
          const cursor = event.target.result;
          if (!cursor) return;
          const record = cursor.value;
          if (record.event_id === value.eventId) { if (record.status === '寄存') active++; if (!['synced', ...(deps.isProduction() ? [] : ['mock'])].includes(record.sync_status)) pending++; }
          cursor.continue();
        };
        tx.oncomplete = () => { db.close(); resolve({ active, pending }); };
        tx.onerror = () => { db.close(); reject(new Error('本机台账检查失败')); };
      };
    });
  }
  $('luggageSwitch').addEventListener('change', e => void toggle(e.target.checked));
  $('luggageSettingsEntry').addEventListener('click',()=>{requestedTab='setup';});
  window.addEventListener('beforeunload', e => { if (!canLeave()) { e.preventDefault(); e.returnValue = ''; } });
  async function accessSnapshot(userId, action, value) {
    if (!userId || !window.indexedDB) return null;
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(`journey-luggage-${userId}`);
      request.onerror=()=>reject(new Error('离线授权存储不可用'));
      request.onsuccess=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('attendee')) {db.close();resolve(null);return;}
        const tx=db.transaction('attendee',action==='get'?'readonly':'readwrite');
        const store=tx.objectStore('attendee');
        const op=action==='put'?store.put(value,'host-offline-context'):action==='delete'?store.delete('host-offline-context'):store.get('host-offline-context');
        tx.oncomplete=()=>{db.close();resolve(op.result||null);};
        tx.onerror=()=>{db.close();reject(new Error('离线授权存储失败'));};
      };
    });
  }
  async function resume(userId) {
    if (navigator.onLine !== false) return null;
    try { const saved=await accessSnapshot(userId,'get');return saved?.userId===userId&&saved.mode===(deps.isProduction()?'production':'demo')&&saved.enabled&&saved.expiresAt>Date.now()?saved:null; }
    catch {return null;}
  }
  const clearAccess = () => accessSnapshot(deps.current().userId,'delete').catch(()=>{});
  return { render, canLeave, unmount, resume, clearAccess, available: () => authorized() && (deps.current().enabled || deps.current().used) };
};
