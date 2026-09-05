<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppIcon from './components/AppIcon.vue'
import { host, initialContext, requireContext } from './utils/host.js'
import CameraScanner from './components/CameraScanner.vue'
import LuggageDualLabel from './components/LuggageDualLabel.vue'
import BadgeQrExport from './components/BadgeQrExport.vue'
import LabelTemplateEditor from './components/LabelTemplateEditor.vue'
import { initDB, importAttendees, getAttendees, getAttendee, createLuggageRecord, getLuggageRecord, getLuggageByAttendee, findLuggage, nextAvailablePosition, clearMeetingLuggage, getAllLuggage, checkoutLuggage, createBackup, restoreBackup, mergeCloudLuggage } from './utils/db'
import { fetchAttendeeList, fetchCloudLuggage, USE_MOCK } from './utils/api'
import { scheduleSync, startSync } from './utils/sync'
import { downloadFile, recordsToCSV, formatTime, safeFilename } from './utils/download'

const offline = inject('offline')
if (initialContext.offlineUntil) { offline.ready=true; offline.message='离线恢复模式 · 联网后请刷新主页面验证登录并同步' }
const requestedTab=new URLSearchParams(location.search).get('tab')
const tab = ref(['setup','deposit','pickup','ledger'].includes(requestedTab)?requestedTab:(initialContext.enabled ? 'deposit' : 'ledger'))
const enabled = computed(() => !!host.context()?.enabled)
const menuOpen = ref(false)
const menuButton = ref(null)
const pageInfo = computed(() => ({
  setup: { title: '会议初始化', english: 'MEETING SETUP', description: '设置当前会议与操作员，导入名单并检查离线准备状态。', accent: '#7b4f70' },
  deposit: { title: '行李寄存', english: 'LUGGAGE CHECK-IN', description: '识别参会人、确认存放位置，生成一件一签的双联标签。', accent: '#D52B1E' },
  pickup: { title: '取件出库', english: 'LUGGAGE CHECK-OUT', description: '扫描行李牌或胸卡，核对行李后办理出库。', accent: '#397a73' },
  ledger: { title: '台账与备份', english: 'RECORDS & BACKUP', description: '查询当前会议寄存记录，导出台账并保管完整备份。', accent: '#526d88' },
}[tab.value]))
function navigate(next) { if (!busy.value) { tab.value = next; menuOpen.value = false } }
function closeMenu() { menuOpen.value = false; menuButton.value?.focus() }
const ready = ref(false)
const dbError = ref('')
const busy = ref(false)
const online = ref(navigator.onLine)
const eventId = ref('')
const operator = ref('')
const attendees = ref([])
const records = ref([])
const config = ref({enable_luggage:!!initialContext.enabled,total_rows:50,per_row_max_position:50,allow_multi_bag:false,label_template:{preset:'classic',paperWidth:80,paperHeight:120,margin:4,fontSize:12,fields:['name','mobile','position','barcode']}})
const ledgerSource = ref('local')
const ledgerLoadError = ref('')
const badgeInput = ref('')
const selected = ref(null)
const row = ref(1)
const slot = ref(1)
const latest = ref(null)
const depositScanner = ref(null)
const pickupScanner = ref(null)
const label = ref(null)
const pickupInput = ref('')
const pickupRecords = ref([])
const pickupKind = ref('auto')
const pickupSource = ref(null)
const pickupQueried = ref(false)
const filter = ref('')
const statusFilter = ref('全部')
const page = ref(1)
const confirmPickup = ref(null)
const restoreInput = ref(null)
const persistent = ref(false)
const dateText = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
const activeCount = computed(() => records.value.filter(record => record.status === '寄存').length)
const capacity = computed(() => Number(config.value.total_rows||0)*Number(config.value.per_row_max_position||0))
const remaining = computed(() => Math.max(0,capacity.value-activeCount.value))
const pendingCount = computed(() => records.value.filter(record => record.sync_status === 'pending' || (!USE_MOCK && record.sync_status === 'mock')).length)
const filtered = computed(() => {
  const term = filter.value.trim().toLowerCase()
  return records.value.filter(record => (statusFilter.value === '全部' || record.status === statusFilter.value) && (!term || [record.name, record.dept, record.attend_id, record.mobile, record.luggage_barcode].some(value => String(value || '').toLowerCase().includes(term))))
})
const paged = computed(() => filtered.value.slice((page.value - 1) * 10, page.value * 10))
const canWork = computed(() => ready.value && !!eventId.value && !busy.value && !!host.context())
watch([filter, statusFilter], () => { page.value = 1 })
watch(tab, () => { depositScanner.value?.stop(); pickupScanner.value?.stop() })
watch(badgeInput, () => { selected.value = null })
let stopSync = () => {}
let channel
let refreshNumber = 0
async function refresh() {
  if (!ready.value || !eventId.value) return
  const id = eventId.value
  const token = ++refreshNumber
  const peoplePromise = getAttendees(id)
  let cloud = null
  try {
    cloud = await fetchCloudLuggage(id)
    ledgerLoadError.value = ''
  } catch (error) {
    console.warn('[luggage ledger]', error)
    ledgerLoadError.value = error?.message || '服务器行李台账读取失败'
  }
  const people = await peoplePromise
  if (Array.isArray(cloud)) {
    await mergeCloudLuggage(id, cloud)
    ledgerSource.value = 'cloud'
  } else ledgerSource.value = 'local'
  const all = await getAllLuggage(id)
  if (token !== refreshNumber || id !== eventId.value) return
  attendees.value = Array.isArray(people) ? people : []
  records.value = Array.isArray(all) ? all : []
  if (selected.value) selected.value = people.find(person => person.attend_id === selected.value.attend_id) || null
  if (page.value > Math.max(1, Math.ceil(filtered.value.length / 10))) page.value = 1
}
async function safeRefresh() {
  try { await refresh() } catch (error) { console.warn('[refresh]', error) }
}
function announce() { channel?.postMessage('changed') }
function networkChange() { online.value = navigator.onLine }
async function run(work) {
  if (busy.value) return
  busy.value = true
  try { requireContext(); await work() } catch (error) { console.error(error); ElMessage.error(error.message || '操作失败，请重试') }
  finally { busy.value = false }
}
async function initialize() {
  try {
    await initDB()
    eventId.value = initialContext.eventId
    operator.value = initialContext.operator
    try { config.value={...config.value,...await host.config(eventId.value)} } catch(error) { console.warn('[luggage config]',error); ElMessage.warning('暂未读取云端行李配置，现场将使用本机默认配置') }
    ready.value = true
    await refresh()
    void host.prepareOffline().then(cached => { if(cached) {offline.ready=true;offline.message='页面已缓存 · 本机授权12小时内可离线重开'} }).catch(error => console.warn('[offline preparation]',error))
    persistent.value = await navigator.storage?.persisted?.() || false
    if (enabled.value) stopSync = startSync(safeRefresh, eventId.value)
    if (enabled.value) await downloadAttendees()
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(`journey-luggage-${initialContext.userId}`)
      channel.onmessage = safeRefresh
    }
  } catch (error) { dbError.value = `本地数据库无法使用：${error.message}。请使用正常浏览模式并检查剩余空间。`; ready.value = false }
}
onMounted(() => { void initialize(); window.addEventListener('online', networkChange); window.addEventListener('offline', networkChange) })
onBeforeUnmount(() => { stopSync(); channel?.close(); window.removeEventListener('online', networkChange); window.removeEventListener('offline', networkChange) })
async function downloadAttendees() {
  await run(async () => {
    const people = await fetchAttendeeList(eventId.value)
    if (people === null) { ElMessage.warning('下载未成功，本地名单未改变。可导入 JSON 名单继续使用。'); return }
    const count = await importAttendees(eventId.value, people)
    await refresh(); announce()
    ElMessage.success(`已导入 ${count} 位参会人${USE_MOCK ? '（模拟数据）' : ''}`)
  })
}
async function readFile(file) {
  if (!file) return null
  if (file.size > 30 * 1024 * 1024) throw new Error('文件超过 30 MB，请拆分或联系管理员处理')
  try { return JSON.parse((await file.text()).replace(/^\uFEFF/, '')) }
  catch { throw new Error('JSON 文件无法解析，请检查格式与 UTF-8 编码') }
}
async function restoreFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  await run(async () => {
    requireContext(true)
    const result = await restoreBackup(await readFile(file), eventId.value)
    await refresh(); announce(); scheduleSync()
    ElMessage.success(`恢复 ${result.restored} 条记录，跳过 ${result.skipped} 条已有或较旧记录`)
  })
}
async function identify(value = badgeInput.value) {
  if (!canWork.value) return
  selected.value = null
  badgeInput.value = value.trim()
  await run(async () => {
    const person = await getAttendee(eventId.value, badgeInput.value)
    if (!person) { ElMessage.warning('本场会议本地名单未找到该参会人，请检查胸卡或初始化名单'); return }
    // Wait for the input watcher before assigning the successful result.
    await nextTick()
    selected.value = person
    const position=await nextAvailablePosition(eventId.value,Number(config.value.total_rows),Number(config.value.per_row_max_position))
    row.value=position.row;slot.value=position.slot
    ElMessage.success(`已识别 ${person.name}`)
  })
}
async function deposit() {
  if (!canWork.value || !selected.value) return
  await run(async () => {
    requireContext(true)
    const record = await createLuggageRecord({ eventId: eventId.value, person: selected.value, row: row.value, slot: slot.value, operator: operator.value, allowMultiBag:!!config.value.allow_multi_bag })
    latest.value = record
    // Reset selection immediately: double taps cannot create a second bag.
    selected.value = null; badgeInput.value = ''
    scheduleSync(); announce()
    ElMessage.success('寄存已保存到本机。请打印并粘贴 A 联，将 B 联交给客人。')
    await nextTick()
    await label.value?.print()
    await safeRefresh()
  })
}
async function addAnother() {
  if (!latest.value) return
  await identify(latest.value.attend_id)
}
async function searchPickup(value = pickupInput.value, kind = pickupKind.value) {
  if (!canWork.value) return
  pickupInput.value = value.trim()
  pickupRecords.value = []; pickupQueried.value = false
  if (!pickupInput.value) { ElMessage.warning('请扫码或输入编号'); return }
  await run(async () => {
    let resolved = kind
    let list = []
    if (kind !== 'attendee') {
      const record = await getLuggageRecord(eventId.value, pickupInput.value)
      if (record) { list = [record]; resolved = 'barcode' }
    }
    if (!list.length && kind !== 'barcode') {
      list = kind==='auto' ? await findLuggage(eventId.value,pickupInput.value) : await getLuggageByAttendee(eventId.value, pickupInput.value)
      resolved = 'attendee'
    }
    pickupSource.value = { value: pickupInput.value, kind: resolved }
    pickupRecords.value = list
    pickupQueried.value = true
    if (!list.length) ElMessage.warning('本机本场会议未找到寄存记录，请核对编号或前往原寄存终端')
    else ElMessage.success(`找到 ${list.length} 件行李，请核对后办理出库`)
  })
}
async function completePickup() {
  const target = confirmPickup.value
  if (!target || !canWork.value) return
  await run(async () => {
    requireContext(true)
    const updated = await checkoutLuggage(eventId.value, target.luggage_barcode, operator.value)
    pickupRecords.value = pickupRecords.value.map(record => record.luggage_barcode === updated.luggage_barcode ? updated : record)
    confirmPickup.value = null
    scheduleSync(); announce()
    ElMessage.success('已办理出库，本地记录已更新')
    await safeRefresh()
  })
}
async function exportCSV() {
  await run(async () => {
    const all = await getAllLuggage(eventId.value)
    downloadFile(recordsToCSV(all), `行李台账_${safeFilename(eventId.value)}_${Date.now()}.csv`, 'text/csv;charset=utf-8')
    ElMessage.success(`已生成本场会议 ${all.length} 条台账的 CSV`)
  })
}
async function exportJSON() {
  await run(async () => {
    const backup = await createBackup(eventId.value)
    downloadFile(JSON.stringify(backup, null, 2), `行李备份_${safeFilename(eventId.value)}_${Date.now()}.json`, 'application/json;charset=utf-8')
    ElMessage.success('本场会议备份已生成，请妥善保管')
  })
}
async function requestPersistence() {
  try {
    persistent.value = await navigator.storage?.persist?.() || false
    ElMessage[persistent.value ? 'success' : 'warning'](persistent.value ? '浏览器已授予持久存储，请仍定期导出备份' : '浏览器未授予持久存储，请定期导出 JSON 备份')
  } catch { ElMessage.warning('无法申请持久存储，请定期导出备份') }
}
async function refreshCloud() {
  await run(async () => {
    const list = await host.ledger(eventId.value)
    downloadFile(recordsToCSV(list), `云端行李台账_${safeFilename(eventId.value)}.csv`, 'text/csv;charset=utf-8')
    ElMessage.success(`云端台账已导出，共 ${list.length} 条`)
  })
}
function syncLabel(record) { return record.sync_status === 'synced' ? '已同步' : record.sync_status === 'mock' && USE_MOCK ? '模拟成功' : '待同步' }
async function reprint(record) { latest.value = record; tab.value = 'deposit'; await nextTick(); await label.value?.print() }
async function saveConfig(){await run(async()=>{requireContext();const payload={...config.value,enable_luggage:!!config.value.enable_luggage};config.value={...config.value,...await host.saveConfig(eventId.value,payload)};ElMessage.success('行李寄存配置与标签模板已保存')})}
async function resetMeeting(){
  if(!confirm('高风险操作：将清空本场全部云端和本机寄存记录，且无法恢复。确定继续？'))return
  const typed=prompt('请输入 RESET LUGGAGE 确认清空')
  if(typed!=='RESET LUGGAGE')return ElMessage.warning('确认文字不正确，已取消重置')
  await run(async()=>{await host.reset(eventId.value);await clearMeetingLuggage(eventId.value);latest.value=null;pickupRecords.value=[];await refresh();announce();ElMessage.success('本场行李记录和库位计数已重置')})
}
</script>

<template>
  <div :data-business-busy="busy" class="terminal" :style="{ '--page-accent': pageInfo.accent }" @keydown.esc="closeMenu">
    <div class="main-column"><main class="workspace">
      <div class="integrated-context"><span><strong>{{ initialContext.eventName }}</strong> · {{ operator }}</span><span :class="{ 'amber-text': !online }">{{ online ? (USE_MOCK ? '演示数据 · 本机保存' : '已连接会议系统') : '离线办理 · 本机保存' }}</span></div>
      <nav class="integrated-tabs" aria-label="行李业务">
        <button v-for="item in [{id:'deposit',label:'行李寄存'},{id:'pickup',label:'取件出库'},{id:'ledger',label:'台账与备份'},{id:'setup',label:'现场准备'}]" :key="item.id" :disabled="busy || (!enabled && item.id !== 'ledger')" :aria-current="tab === item.id ? 'page' : undefined" :class="{ active: tab === item.id }" @click="navigate(item.id)">{{ item.label }}</button>
      </nav>
      <div v-if="!enabled" class="notice">本场行李管理已关闭，历史台账保留。重新启用请前往会议设置。</div>

      <div v-if="dbError" class="notice error-notice" role="alert"><AppIcon name="shield" />{{ dbError }}</div>
      <section class="stats-grid" aria-label="当前会议统计">
        <article class="stat"><span class="stat-icon"><AppIcon name="user" /></span><div><span>本地参会名单</span><strong>{{ attendees.length.toLocaleString() }}<small>人</small></strong></div><span class="stat-note">已导入本机</span></article>
        <article class="stat"><span class="stat-icon green"><AppIcon name="bag" /></span><div><span>在库行李</span><strong>{{ activeCount.toLocaleString() }}<small>件</small></strong></div><span class="stat-note green-text">妥善保管中</span></article>
        <article class="stat"><span class="stat-icon"><AppIcon name="check" /></span><div><span>已完成取件</span><strong>{{ (records.length - activeCount).toLocaleString() }}<small>件</small></strong></div><span class="stat-note">本场累计</span></article>
        <article class="stat"><span class="stat-icon amber"><AppIcon name="refresh" /></span><div><span>等待后台同步</span><strong>{{ pendingCount.toLocaleString() }}<small>条</small></strong></div><span class="stat-note">本地优先保存</span></article>
        <article class="stat"><span class="stat-icon green"><AppIcon name="database" /></span><div><span>已占用库位</span><strong>{{ activeCount.toLocaleString() }}<small>位</small></strong></div><span class="stat-note">实时计算</span></article>
        <article class="stat"><span class="stat-icon"><AppIcon name="check" /></span><div><span>剩余可用库位</span><strong>{{ remaining.toLocaleString() }}<small>位</small></strong></div><span class="stat-note">总容量 {{ capacity }}</span></article>
      </section>
      <div v-if="!eventId && ready && tab !== 'setup'" class="notice"><AppIcon name="settings" /><span>首次使用，请先设置会议并导入参会名单。</span><el-button link type="primary" @click="tab = 'setup'">前往初始化 <AppIcon name="arrow" :size="16" /></el-button></div>

      <section v-if="tab === 'setup'" class="setup-layout">
        <article class="panel"><div class="panel-heading"><div><span class="section-index">01 / SETUP</span><h2>准备本场会议</h2><p>不同会议独立存储，切换不会删除原有台账。</p></div><AppIcon name="settings" :size="24" /></div>
          <dl class="meeting-context-list"><dt>当前会议</dt><dd>{{ initialContext.eventName }}</dd><dt>会议编号</dt><dd>{{ eventId }}</dd><dt>操作员</dt><dd>{{ operator }}</dd></dl>
          <p class="muted-copy">会议与账号由行程管理工具统一管理。胸卡二维码使用参会名单记录的唯一 ID；手机号、姓名不作为身份编号。</p>
          <el-button class="full-width" :disabled="!canWork || !enabled" @click="downloadAttendees"><AppIcon name="download" />更新本场参会名单</el-button>
          <p class="muted-copy">首次进入时下载名单；失败时保留已有本地名单。请在有网络时完成现场准备。</p>
        </article>
        <div class="setup-aside"><article class="panel readiness-panel"><div class="panel-heading"><div><span class="section-index">READY TO GO</span><h2>现场准备检查</h2></div><AppIcon name="shield" :size="24" /></div>
          <div class="check-row"><span class="check-dot" :class="{ done: ready }"><AppIcon name="check" :size="14" /></span><div><strong>本地数据库</strong><p>{{ ready ? 'IndexedDB 已就绪' : '正在检查存储…' }}</p></div></div>
          <div class="check-row"><span class="check-dot" :class="{ done: attendees.length > 0 }"><AppIcon name="check" :size="14" /></span><div><strong>参会名单</strong><p>{{ attendees.length ? `本场已导入 ${attendees.length} 人` : '请先下载或导入本场名单' }}</p></div></div>
          <div class="check-row"><span class="check-dot" :class="{ done: offline.ready }"><AppIcon name="check" :size="14" /></span><div><strong>离线页面</strong><p>{{ offline.message }}</p></div></div>
          <div class="check-row"><span class="check-dot" :class="{ done: persistent }"><AppIcon name="check" :size="14" /></span><div><strong>持久存储</strong><p>{{ persistent ? '已获授权，仍需定期备份' : '降低浏览器自动回收数据的风险' }}</p></div></div>
          <el-button class="full-width" :disabled="!ready" @click="requestPersistence">申请持久存储</el-button>
        </article><div class="deployment-note"><AppIcon name="bag" :size="30" /><h3>开场前，试寄存一件行李。</h3><p>确认扫码枪、热敏纸张与浏览器打印机，完成一次寄存和取件演练。</p><p>断网时业务会写入 IndexedDB；联网后自动同步。多工位离线期间请按预先划分的排号区域操作，避免占用同一库位。</p><small>{{ USE_MOCK ? '当前为 mock：仅模拟成功，不向真实后端备份。' : '服务器对重复人员、库位冲突和容量执行最终校验。' }}</small></div></div>
        <article class="panel setup-full"><div class="panel-heading"><div><span class="section-index">LUGGAGE CONFIG</span><h2>本场行李寄存配置</h2><p>配置只作用于当前会议，内部、外部会议均可独立设置。</p></div><span class="subtle-badge">{{ activeCount }} / {{ capacity }} 已占用</span></div>
          <el-form label-position="top"><div class="config-grid"><el-form-item label="本场启用行李寄存"><el-switch v-model="config.enable_luggage" /></el-form-item><el-form-item label="允许同一参会人多件寄存"><el-switch v-model="config.allow_multi_bag" /></el-form-item><el-form-item label="库位总排数"><el-input-number v-model="config.total_rows" :min="1" :max="9999" /></el-form-item><el-form-item label="每排最大位置数"><el-input-number v-model="config.per_row_max_position" :min="1" :max="9999" /></el-form-item></div></el-form>
          <LabelTemplateEditor v-model="config.label_template" />
          <div class="config-actions"><el-button type="danger" plain :disabled="busy" @click="resetMeeting">清空本场记录并重置库位</el-button><el-button type="primary" :loading="busy" @click="saveConfig">保存行李配置与打印模板</el-button></div>
        </article>
        <article class="panel setup-full"><BadgeQrExport :attendees="attendees" :event-name="initialContext.eventName" /></article>
      </section>

      <section v-if="tab === 'deposit'" class="register-layout">
        <div class="entry-grid">
          <article class="panel scanner-panel"><div class="panel-heading"><div><span class="section-index">01 / IDENTIFY</span><h2>识别参会人</h2></div><span class="subtle-badge">胸卡扫码</span></div>
            <CameraScanner ref="depositScanner" :disabled="!canWork" @decoded="({ text }) => identify(text)" />
            <div class="or-divider"><span>或输入编号 / 使用扫码枪</span></div>
            <form class="input-action" @submit.prevent="identify()"><el-input v-model="badgeInput" :disabled="!canWork" placeholder="输入胸卡 attend_id" aria-label="胸卡编号" clearable /><el-button :disabled="!canWork || !badgeInput.trim()" @click="identify()">查询</el-button></form>
            <div class="scanner-hint"><AppIcon name="shield" :size="15" /><span>从本机名单识别，无需联网</span></div>
          </article>
          <article class="panel detail-panel"><div class="panel-heading"><div><span class="section-index">02 / CHECK IN</span><h2>确认信息与存放位置</h2></div></div>
            <div class="person-card" :class="{ identified: selected }"><div class="person-avatar">{{ selected?.name?.slice(-2) || '—' }}</div><div><strong>{{ selected?.name || '等待识别参会人' }}</strong><span>{{ selected?.dept || '扫描胸卡后自动显示' }}</span></div><span v-if="selected" class="verified"><AppIcon name="check" :size="14" />已识别</span></div>
            <div class="person-meta"><span>参会编号</span><code>{{ selected?.attend_id || '—' }}</code></div>
            <div class="person-meta"><span>联系电话</span><span>{{ selected?.mobile || '—' }}</span></div>
            <div class="setup-divider" />
            <el-form label-position="top" @submit.prevent="deposit"><div class="position-inputs"><el-form-item label="自动分配排号"><el-input-number v-model="row" :disabled="true" controls-position="right" aria-label="存放排号" /></el-form-item><el-form-item label="自动分配位号"><el-input-number v-model="slot" :disabled="true" controls-position="right" aria-label="存放位号" /></el-form-item></div>
              <div class="location-preview"><AppIcon name="bag" :size="22" /><span>存放位置</span><strong>{{ row || '—' }} 排 / {{ slot || '—' }} 位</strong></div>
              <el-button native-type="submit" type="primary" class="full-width print-primary" :disabled="!canWork || !enabled || !selected" :loading="busy"><AppIcon name="print" />生成并打印双联标签<AppIcon name="arrow" :size="18" /></el-button>
            </el-form>
            <p class="micro-copy">每次生成独立寄存单号 · {{ config.allow_multi_bag ? '允许同一参会人寄存多件' : '同一参会人只允许一件在库行李' }}</p>
            <el-button v-if="latest && !selected && config.allow_multi_bag" class="full-width" :disabled="!canWork" @click="addAnother">为 {{ latest.name }} 再寄存一件</el-button>
          </article>
          <div class="workflow-note"><span><AppIcon name="check" :size="15" />先保存，再打印</span><span><AppIcon name="shield" :size="15" />条码不含人员隐私</span><span><AppIcon name="refresh" :size="15" />后台失败不影响办理</span></div>
        </div>
        <aside class="panel print-panel"><div class="panel-heading"><div><span class="section-index">03 / LABEL</span><h2>双联标签预览</h2></div><span class="subtle-badge">{{ config.label_template.paperWidth || 80 }} × {{ config.label_template.paperHeight || 120 }}</span></div><LuggageDualLabel ref="label" :record="latest" :template="config.label_template" /></aside>
      </section>

      <section v-if="tab === 'pickup'" class="pickup-layout">
        <article class="panel"><div class="panel-heading"><div><span class="section-index">01 / SCAN & VERIFY</span><h2>查找待取行李</h2><p>行李条码查单件，胸卡查本人全部行李。</p></div></div><CameraScanner ref="pickupScanner" mode="both" :disabled="!canWork" @decoded="({ text, kind }) => searchPickup(text, kind)" />
          <div class="or-divider"><span>手动输入 / 扫码枪输入</span></div>
          <el-select v-model="pickupKind" aria-label="编号类型" :disabled="!canWork"><el-option label="自动匹配：寄存单号 / 参会ID / 手机号" value="auto" /><el-option label="行李牌 Code128" value="barcode" /><el-option label="胸卡参会人 ID" value="attendee" /></el-select>
          <form class="input-action pickup-manual" @submit.prevent="searchPickup()"><el-input v-model="pickupInput" :disabled="!canWork" aria-label="取件编号" placeholder="寄存单号、参会人 ID 或手机号" clearable /><el-button type="primary" :disabled="!canWork" @click="searchPickup()">查询</el-button></form>
          <p class="muted-copy">查不到记录？请确认会议编号，并在原寄存终端办理。不要凭名单直接交付行李。</p>
        </article>
        <article class="panel pickup-results"><div class="panel-heading"><div><span class="section-index">02 / CHECK OUT</span><h2>核对并办理出库</h2><p>{{ pickupSource ? `查询编号：${pickupSource.value}` : '请先扫描客人回执或胸卡' }}</p></div><span class="subtle-badge">{{ pickupRecords.length }} 件行李</span></div>
          <el-table v-if="pickupRecords.length" :data="pickupRecords" row-key="luggage_barcode"><el-table-column label="行李 / 参会人" min-width="225"><template #default="{ row: item }"><strong>{{ item.name }}</strong><div class="table-code">{{ item.luggage_barcode }}</div><small>{{ item.dept }}</small></template></el-table-column><el-table-column label="位置" min-width="105"><template #default="{ row: item }">{{ item.storage_row }} 排 {{ item.storage_slot }} 位</template></el-table-column><el-table-column label="状态" width="95"><template #default="{ row: item }"><el-tag :type="item.status === '寄存' ? 'success' : 'info'">{{ item.status }}</el-tag></template></el-table-column><el-table-column label="取件" width="130"><template #default="{ row: item }"><el-button v-if="item.status === '寄存' && enabled" type="primary" :disabled="!canWork" @click="confirmPickup = item">办理出库</el-button><small v-else>{{ formatTime(item.checkout_time) }}</small></template></el-table-column></el-table>
          <div v-else class="empty-state"><AppIcon name="exit" :size="48" /><h3>{{ pickupQueried ? '没有找到寄存记录' : '等待扫描取件凭证' }}</h3><p>{{ pickupQueried ? '核对编号、会议和寄存终端后重新查询。' : '找到行李后，将在这里显示存放位置与状态。' }}</p></div>
          <div class="notice compact"><AppIcon name="shield" :size="18" />出库前请核对回执、姓名与实物；已取行李不能重复出库。</div>
        </article>
      </section>

      <section v-if="tab === 'ledger'" class="panel ledger-panel"><div class="panel-heading ledger-heading"><div><span class="section-index">RECORDS & BACKUP</span><h2>每一件行李，都有记录</h2><p>{{ ledgerSource === 'cloud' ? '已读取当前会议云端台账，并与本机待同步记录合并。' : '当前显示本机缓存；联网后刷新可读取服务器台账。' }}</p></div><div class="ledger-actions"><el-button :disabled="!canWork" @click="run(async () => { await refresh(); ElMessage.success(`台账已刷新，共 ${records.length} 条`) })"><AppIcon name="refresh" />刷新</el-button><el-button :disabled="!canWork" @click="refreshCloud">导出云端台账</el-button><el-button :disabled="!canWork" @click="exportCSV"><AppIcon name="download" />导出 CSV</el-button><el-button type="primary" :disabled="!ready || busy" @click="exportJSON"><AppIcon name="database" />备份本场 JSON</el-button></div></div>
        <div v-if="ledgerLoadError" class="notice compact luggage-ledger-error"><AppIcon name="alert" :size="18" /><span>云端行李台账读取失败：{{ ledgerLoadError }}。当前仅显示本机缓存，请检查网络或会议权限后重试。</span></div>
        <div class="ledger-toolbar"><el-input v-model="filter" placeholder="搜索姓名、手机号、参会编号或行李编号" clearable aria-label="搜索台账" /><el-select v-model="statusFilter" aria-label="台账状态"><el-option v-for="state in ['全部', '寄存', '已取']" :key="state" :label="state === '全部' ? '全部状态' : state" :value="state" /></el-select><span>{{ filtered.length }} 条记录</span></div>
        <el-table :data="paged" row-key="luggage_barcode" empty-text="本场会议还没有寄存记录"><el-table-column label="参会人" min-width="115"><template #default="{ row: item }"><strong>{{ item.name }}</strong><small class="table-subtext">{{ item.dept }}</small></template></el-table-column><el-table-column prop="mobile" label="联系电话" min-width="140" /><el-table-column label="寄存单号 / 胸卡编号" min-width="255"><template #default="{ row: item }"><span class="table-code">{{ item.luggage_barcode }}</span><small class="table-subtext">{{ item.attend_id }}</small></template></el-table-column><el-table-column label="位置" min-width="100"><template #default="{ row: item }">{{ item.storage_row }} 排 {{ item.storage_slot }} 位</template></el-table-column><el-table-column label="状态" width="95"><template #default="{ row: item }"><el-tag :type="item.status === '寄存' ? 'success' : 'info'">{{ item.status === '寄存' ? '未取件' : '已取件' }}</el-tag></template></el-table-column><el-table-column label="操作日志" min-width="210"><template #default="{ row: item }"><span>寄存：{{ item.operator_checkin || '—' }} · {{ formatTime(item.checkin_time) }}</span><small class="table-subtext">取件：{{ item.operator_checkout || '—' }} · {{ formatTime(item.checkout_time) }}</small></template></el-table-column><el-table-column label="同步" min-width="100"><template #default="{ row: item }"><span :class="{ 'amber-text': item.sync_status !== 'synced' }">{{ syncLabel(item) }}</span></template></el-table-column><el-table-column label="操作" width="90" fixed="right"><template #default="{ row: item }"><el-button link type="primary" :disabled="!canWork" @click="reprint(item)">补打</el-button></template></el-table-column></el-table>
        <div class="ledger-bottom"><span>导出文件包含手机号，请仅交由授权工作人员保管。</span><el-pagination v-model:current-page="page" :page-size="10" :total="filtered.length" layout="prev, pager, next" /></div>
        <div class="backup-strip"><div><strong>定期备份，为现场多一份保障</strong><p>恢复采用合并方式，不覆盖已有名单信息，不把已取记录恢复为在库。</p></div><div class="backup-actions"><el-button :disabled="!ready || busy" @click="scheduleSync(); ElMessage.info('已触发后台重试，不影响当前业务')">重试后台同步</el-button><el-button :disabled="!ready || busy" @click="restoreInput.click()"><AppIcon name="upload" />恢复 JSON 备份</el-button></div><input ref="restoreInput" type="file" accept=".json,application/json" hidden @change="restoreFile" /></div>
      </section>
      <footer class="app-footer"><span><i :class="{ cached: offline.ready }" />{{ offline.message }}</span><span>会议现场服务 / 行李管理<span class="footer-separator">·</span>请勿清除浏览器数据</span></footer>
    </main>
    </div>
    <el-dialog :model-value="!!confirmPickup" title="核对行李并出库" width="min(480px, 94vw)" :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy" @update:model-value="value => { if (!value && !busy) confirmPickup = null }">
      <template v-if="confirmPickup"><p class="confirm-person">{{ confirmPickup.name }}<span>{{ confirmPickup.storage_row }} 排 / {{ confirmPickup.storage_slot }} 位</span></p><code class="confirm-code">{{ confirmPickup.luggage_barcode }}</code><p>请确认客人回执与实物一致。确认后将记录取件时间，状态改为「已取」。</p></template>
      <template #footer><el-button :disabled="busy" @click="confirmPickup = null">暂不出库</el-button><el-button type="primary" :disabled="!canWork" :loading="busy" @click="completePickup">确认交付并出库</el-button></template>
    </el-dialog>
  </div>
</template>
