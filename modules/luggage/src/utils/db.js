import localforage from 'localforage'
import { initialContext } from './host.js'
const storageName = `journey-luggage-${initialContext?.userId || 'locked'}`

// Only IndexedDB: do not silently fall back to localStorage or WebSQL.
export const attendeeStore = localforage.createInstance({
  name: storageName, storeName: 'attendee', driver: localforage.INDEXEDDB,
})
export const luggageStore = localforage.createInstance({
  name: storageName, storeName: 'luggage', driver: localforage.INDEXEDDB,
})
const eventKey = (eventId) => `event:${JSON.stringify(eventId)}`
const luggageKey = (eventId, barcode) => JSON.stringify([eventId, barcode])
let localQueue = Promise.resolve()

// Web Locks serializes writes across tabs on Android Chrome/HTTPS. The queue is
// a same-tab fallback; older browsers without Web Locks must use only one tab.
function exclusive(work) {
  if (globalThis.navigator?.locks) return navigator.locks.request('stow-write', work)
  const next = localQueue.then(work, work)
  localQueue = next.catch(() => {})
  return next
}
export async function initDB() {
  await Promise.all([attendeeStore.ready(), luggageStore.ready()])
  if (attendeeStore.driver() !== localforage.INDEXEDDB || luggageStore.driver() !== localforage.INDEXEDDB) {
    throw new Error('浏览器不支持 IndexedDB，请使用正常模式的 Chrome')
  }
}
function required(value, title, max = 64) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) {
    throw new Error(`${title}必须是 1–${max} 位有效字符串`)
  }
  return value.trim()
}
export const validateEventId = (value) => required(value, '会议编号')
function optional(value, title, max = 100) {
  if (value == null) return ''
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`${title}格式无效`)
  return value.trim()
}
export function validateAttendees(list) {
  if (!Array.isArray(list) || list.length > 100000) throw new Error('参会名单应为 JSON 数组，最多 100000 人')
  const ids = new Set()
  return list.map((person, index) => {
    if (!person || typeof person !== 'object') throw new Error(`第 ${index + 1} 位参会人格式错误`)
    const attend_id = required(person.attend_id, 'attend_id')
    if (ids.has(attend_id)) throw new Error(`参会编号重复：${attend_id}`)
    ids.add(attend_id)
    return { attend_id, name: required(person.name, '姓名', 100), dept: optional(person.dept, '部门'), mobile: optional(person.mobile, '手机号', 40) }
  })
}
export async function importAttendees(eventId, list) {
  const id = validateEventId(eventId)
  const people = validateAttendees(list)
  // A single atomic snapshot replaces this event's directory; no partial imports.
  await exclusive(() => attendeeStore.setItem(eventKey(id), { event_id: id, attendees: people, imported_at: new Date().toISOString() }))
  return people.length
}
export async function getAttendees(eventId) {
  return (await attendeeStore.getItem(eventKey(eventId)))?.attendees || []
}
export async function getAttendee(eventId, attendId) {
  return (await getAttendees(eventId)).find(person => person.attend_id === attendId) || null
}
export const saveSettings = (settings) => exclusive(() => attendeeStore.setItem('settings', settings))
export const getSettings = () => attendeeStore.getItem('settings')
export const getLuggageRecord = (eventId, barcode) => luggageStore.getItem(luggageKey(eventId, barcode))
export async function getAllLuggage(eventId) {
  const records = []
  await luggageStore.iterate(value => {
    if (!eventId || value.event_id === eventId) records.push(value)
    // No return value: localforage terminates iteration on non-undefined returns.
  })
  return records.sort((a, b) => b.checkin_time.localeCompare(a.checkin_time) || a.luggage_barcode.localeCompare(b.luggage_barcode))
}
// Merge the authoritative meeting ledger into this browser. A stale server
// response must never overwrite a newer checkout that is still pending sync.
export async function mergeCloudLuggage(eventId, list) {
  const id = validateEventId(eventId)
  if (!Array.isArray(list)) return 0
  let merged = 0
  const cloudCodes = new Set(list.filter(item => item?.event_id === id).map(item => item.luggage_barcode))
  await exclusive(async () => {
    for (const raw of list) {
      if (!raw || raw.event_id !== id || typeof raw.luggage_barcode !== 'string') continue
      const key = luggageKey(id, raw.luggage_barcode)
      const local = await luggageStore.getItem(key)
      const cloudRevision = Number(raw.revision) || 1
      const localRevision = Number(local?.revision) || 0
      if (local && (local.sync_status !== 'synced' || localRevision > cloudRevision)) continue
      await luggageStore.setItem(key, { ...raw, event_id:id, revision:cloudRevision, sync_status:'synced', synced_at:raw.synced_at || new Date().toISOString() })
      merged++
    }
    // A successful full-ledger response is authoritative for already-synced
    // cache rows. Never remove local pending rows, which may contain newer on-site actions.
    const staleKeys = []
    await luggageStore.iterate((value, key) => {
      if (value?.event_id === id && value.sync_status === 'synced' && !cloudCodes.has(value.luggage_barcode)) staleKeys.push(key)
    })
    for (const key of staleKeys) await luggageStore.removeItem(key)
  })
  return merged
}
export async function getLuggageByAttendee(eventId, attendId) {
  return (await getAllLuggage(eventId)).filter(record => record.attend_id === attendId)
}
export async function findLuggage(eventId, value) {
  const term=String(value||'').trim().toLowerCase()
  if(!term)return []
  return (await getAllLuggage(eventId)).filter(record=>[record.luggage_barcode,record.attend_id,record.mobile].some(item=>String(item||'').toLowerCase()===term))
}
export async function nextAvailablePosition(eventId,totalRows,perRow) {
  positiveInt(totalRows,'排数'); positiveInt(perRow,'每排位置数')
  const occupied=new Set((await getAllLuggage(eventId)).filter(item=>item.status==='寄存').map(item=>`${item.storage_row}:${item.storage_slot}`))
  for(let index=0;index<totalRows*perRow;index++){
    const row=Math.floor(index/perRow)+1,slot=index%perRow+1
    if(!occupied.has(`${row}:${slot}`))return {row,slot}
  }
  throw new Error('本场行李库位已满，请先办理取件或由管理员扩充容量')
}
export async function clearMeetingLuggage(eventId) {
  const keys=[]
  await luggageStore.iterate((value,key)=>{if(value?.event_id===eventId)keys.push(key)})
  await exclusive(async()=>{for(const key of keys)await luggageStore.removeItem(key)})
  return keys.length
}
function positiveInt(value, title) {
  if (!Number.isInteger(value) || value < 1 || value > 9999) throw new Error(`${title}需为 1–9999 的整数`)
  return value
}
function barcode() {
  // 48 random bits + millisecond timestamp; checked against existing local keys.
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return `LUG${Date.now()}${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}
export async function createLuggageRecord({ eventId, person, row, slot, operator = '', allowMultiBag = false }) {
  const id = validateEventId(eventId)
  const attendee = validateAttendees([person])[0]
  positiveInt(row, '排号'); positiveInt(slot, '位号')
  return exclusive(async () => {
    const current=await getAllLuggage(id)
    if(current.some(item=>item.status==='寄存'&&item.storage_row===row&&item.storage_slot===slot))throw new Error('该库位已被占用，请重新分配')
    if(!allowMultiBag&&current.some(item=>item.status==='寄存'&&item.attend_id===attendee.attend_id))throw new Error('该参会人已有未取行李，本场未开启多件寄存')
    let code
    do { code = barcode() } while (await getLuggageRecord(id, code))
    const time = new Date().toISOString()
    const record = {
      event_id: id, ...attendee, luggage_barcode: code,
      storage_row: row, storage_slot: slot, bag_count:1, status: '寄存',
      checkin_time: time, checkout_time: null,
      operator_checkin: optional(operator, '操作员', 64), operator_checkout: '',
      revision: 1, updated_at: time, sync_status: 'pending', synced_at: null,
    }
    await luggageStore.setItem(luggageKey(id, code), record)
    return record
  })
}
export async function checkoutLuggage(eventId, code, operator = '') {
  return exclusive(async () => {
    const record = await getLuggageRecord(eventId, code)
    if (!record) throw new Error('本机没有这条寄存记录，请到原寄存终端办理')
    if (record.status === '已取') throw new Error('该行李已取件，请勿重复出库')
    const now = new Date().toISOString()
    const next = { ...record, status: '已取', checkout_time: now, operator_checkout: optional(operator, '操作员', 64), revision: record.revision + 1, updated_at: now, sync_status: 'pending', synced_at: null }
    await luggageStore.setItem(luggageKey(eventId, code), next)
    return next
  })
}
export async function markSynced(record, mock = false) {
  return exclusive(async () => {
    const current = await getLuggageRecord(record.event_id, record.luggage_barcode)
    // A late check-in response must never acknowledge a newer checkout.
    if (!current || current.revision !== record.revision || current.updated_at !== record.updated_at) return false
    await luggageStore.setItem(luggageKey(record.event_id, record.luggage_barcode), {
      ...current, sync_status: mock ? 'mock' : 'synced', synced_at: new Date().toISOString(),
    })
    return true
  })
}
export async function createBackup(eventId) {
  const events = []
  await attendeeStore.iterate((value, key) => { if (key.startsWith('event:') && (!eventId || value.event_id === eventId)) events.push(value) })
  return { format: 'stow-backup', version: 1, exported_at: new Date().toISOString(), events, luggage: await getAllLuggage(eventId) }
}
function validTime(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) }
export function validateBackup(data) {
  if (data?.format !== 'stow-backup' || data.version !== 1 || !Array.isArray(data.events) || !Array.isArray(data.luggage)) throw new Error('备份格式错误，请导入本系统导出的完整 JSON 备份')
  const eventsSeen = new Set()
  const events = data.events.map(event => {
    const id = validateEventId(event.event_id)
    if (eventsSeen.has(id)) throw new Error('备份存在重复会议')
    eventsSeen.add(id)
    return { event_id: id, attendees: validateAttendees(event.attendees), imported_at: validTime(event.imported_at) ? event.imported_at : new Date().toISOString() }
  })
  const recordsSeen = new Set()
  const luggage = data.luggage.map(record => {
    const event_id = validateEventId(record.event_id)
    const code = required(record.luggage_barcode, '寄存编号')
    if (!/^LUG[0-9A-Z]+$/.test(code)) throw new Error('寄存编号格式错误')
    const key = luggageKey(event_id, code)
    if (recordsSeen.has(key)) throw new Error('备份中寄存编号重复')
    recordsSeen.add(key)
    if (!['寄存', '已取'].includes(record.status) || !validTime(record.checkin_time) || !validTime(record.updated_at) || !Number.isSafeInteger(record.revision) || record.revision < 1) throw new Error(`记录状态、版本或时间错误：${code}`)
    if ((record.status === '已取' && !validTime(record.checkout_time)) || (record.status === '寄存' && record.checkout_time !== null)) throw new Error(`出库时间错误：${code}`)
    return {
      event_id, ...validateAttendees([record])[0], luggage_barcode: code,
      storage_row: positiveInt(record.storage_row, '排号'), storage_slot: positiveInt(record.storage_slot, '位号'),
      bag_count: Number.isInteger(record.bag_count) ? record.bag_count : 1,
      status: record.status, checkin_time: new Date(record.checkin_time).toISOString(),
      checkout_time: record.checkout_time ? new Date(record.checkout_time).toISOString() : null,
      operator_checkin: optional(record.operator_checkin, '操作员', 64), operator_checkout: optional(record.operator_checkout, '操作员', 64),
      revision: record.revision, updated_at: new Date(record.updated_at).toISOString(), sync_status: 'pending', synced_at: null,
    }
  })
  return { events, luggage }
}
export async function restoreBackup(data, eventId) {
  const validated = validateBackup(data)
  if (eventId && (validated.events.some(e => e.event_id !== eventId) || validated.luggage.some(r => r.event_id !== eventId))) throw new Error('备份含其他会议的数据，请分别进入对应会议恢复')
  return exclusive(async () => {
    const writes = []
    let skipped = 0
    // Check every collision before writing. Older backups cannot undo checkout.
    for (const record of validated.luggage) {
      const current = await getLuggageRecord(record.event_id, record.luggage_barcode)
      if (current) {
        if (['attend_id', 'checkin_time', 'storage_row', 'storage_slot'].some(key => current[key] !== record[key])) throw new Error(`编号冲突，恢复已取消：${record.luggage_barcode}`)
        if (current.status === '已取' || current.revision >= record.revision) { skipped++; continue }
      }
      writes.push(record)
    }
    for (const event of validated.events) {
      const current = await attendeeStore.getItem(eventKey(event.event_id))
      const people = new Map(event.attendees.map(person => [person.attend_id, person]))
      for (const person of current?.attendees || []) people.set(person.attend_id, person)
      await attendeeStore.setItem(eventKey(event.event_id), { ...event, attendees: [...people.values()] })
    }
    for (const record of writes) await luggageStore.setItem(luggageKey(record.event_id, record.luggage_barcode), record)
    return { restored: writes.length, skipped }
  })
}
