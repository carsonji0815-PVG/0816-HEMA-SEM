import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initDB, attendeeStore, luggageStore, importAttendees, getAttendee, getAttendees, createLuggageRecord, getLuggageByAttendee, getAllLuggage, getLuggageRecord, checkoutLuggage, markSynced, createBackup, restoreBackup } from '../src/utils/db.js'
import { recordsToCSV, csvCell } from '../src/utils/download.js'
import { fetchAttendeeList, syncLuggageRecord, toSyncPayload } from '../src/utils/api.js'

const person = { attend_id: 'ATT202609010001', name: '张三', dept: '市场部', mobile: '13800138000' }
await initDB()
await attendeeStore.clear()
await luggageStore.clear()

test('2500-person import, event isolation, invalid import leaves original snapshot intact', async () => {
  const people = Array.from({ length: 2500 }, (_, i) => ({ ...person, attend_id: `ATT${i}` }))
  assert.equal(await importAttendees('A', people), 2500)
  assert.equal((await getAttendee('A', 'ATT2499')).mobile, person.mobile)
  await importAttendees('B', [{ ...person, attend_id: 'ATT0', name: '李四' }])
  assert.equal((await getAttendee('A', 'ATT0')).name, '张三')
  assert.equal((await getAttendee('B', 'ATT0')).name, '李四')
  await assert.rejects(importAttendees('A', [person, person]), /重复/)
  assert.equal((await getAttendees('A')).length, 2500)
})

test('multiple bags, unique codes, exactly one concurrent checkout, late sync ACK cannot lose checkout', async () => {
  const input = { eventId: 'C', person, row: 1, slot: 3 }
  const bags = await Promise.all(Array.from({ length: 30 }, () => createLuggageRecord(input)))
  assert.equal(new Set(bags.map(b => b.luggage_barcode)).size, 30)
  assert.equal((await getLuggageByAttendee('C', person.attend_id)).length, 30)
  assert.equal((await getLuggageByAttendee('B', person.attend_id)).length, 0)
  const old = bags[0]
  const results = await Promise.allSettled([checkoutLuggage('C', old.luggage_barcode), checkoutLuggage('C', old.luggage_barcode)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter(r => r.status === 'rejected').length, 1)
  assert.equal(await markSynced(old), false)
  const current = await getLuggageRecord('C', old.luggage_barcode)
  assert.equal(current.status, '已取')
  assert.equal(current.revision, 2)
  assert.equal(current.sync_status, 'pending')
  assert.ok(current.checkout_time)
  assert.equal(await markSynced(current, true), true)
  assert.equal((await getLuggageRecord('C', old.luggage_barcode)).sync_status, 'mock')
})

test('failed validation writes nothing; zero/fractional/missing locations rejected', async () => {
  const before = (await getAllLuggage()).length
  for (const row of [0, -1, 1.5, undefined, 10000]) {
    await assert.rejects(createLuggageRecord({ eventId: 'C', person, row, slot: 1 }))
  }
  assert.equal((await getAllLuggage()).length, before)
})

test('backup round trip, old backups cannot revert checkout, conflicts abort before writes', async () => {
  const newBag = await createLuggageRecord({ eventId: 'D', person, row: 2, slot: 5 })
  const oldBackup = await createBackup()
  await checkoutLuggage('D', newBag.luggage_barcode)
  await restoreBackup(oldBackup)
  assert.equal((await getLuggageRecord('D', newBag.luggage_barcode)).status, '已取')
  const backup = await createBackup()
  await attendeeStore.clear(); await luggageStore.clear()
  const result = await restoreBackup(backup)
  assert.equal(result.restored, backup.luggage.length)
  assert.equal((await getAttendees('A')).length, 2500)
  assert.equal((await getLuggageRecord('D', newBag.luggage_barcode)).status, '已取')
  assert.equal((await getLuggageRecord('D', newBag.luggage_barcode)).sync_status, 'pending')
  const malformed = structuredClone(backup)
  malformed.luggage[malformed.luggage.length - 1].status = '无效状态'
  await assert.rejects(restoreBackup(malformed), /错误/)
  const collision = structuredClone(backup)
  collision.luggage[0].attend_id = 'OTHER'
  await assert.rejects(restoreBackup(collision), /冲突/)
  assert.equal((await getAllLuggage()).length, backup.luggage.length)
})

test('CSV quotes commas/newlines, preserves Chinese and blocks formula injection', () => {
  const csv = recordsToCSV([{ ...person, name: '张,三\n"测试"', mobile: '=HYPERLINK("bad")' }])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"张,三\n""测试"""'))
  assert.ok(csv.includes("'=HYPERLINK"))
  assert.equal(csvCell('  =1+1'), '"\'  =1+1"')
  assert.equal(csvCell('@SUM(A1)'), '"\'@SUM(A1)"')
})

test('mock and offline APIs resolve safely; payload excludes local bookkeeping', async () => {
  assert.equal(await fetchAttendeeList('DEMO'), null) // No standalone host: fail closed.
  const record = (await getAllLuggage())[0]
  assert.deepEqual(await syncLuggageRecord(record), { ok: false, mock: true })
  const payload = toSyncPayload(record)
  assert.equal('sync_status' in payload, false)
  assert.equal('synced_at' in payload, false)
  assert.equal(payload.luggage_barcode, record.luggage_barcode)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } })
  try {
    assert.equal(await fetchAttendeeList('DEMO'), null)
    assert.deepEqual(await syncLuggageRecord(record), { ok: false, mock: true })
    const saved = await createLuggageRecord({ eventId: 'OFFLINE', person, row: 2, slot: 2 })
    assert.equal((await getLuggageRecord('OFFLINE', saved.luggage_barcode)).status, '寄存')
    assert.equal((await checkoutLuggage('OFFLINE', saved.luggage_barcode)).status, '已取')
  } finally { Object.defineProperty(globalThis, 'navigator', descriptor) }
})

test('storage failures never report success or mutate existing checkout state', async () => {
  const input = { eventId: 'DISK', person, row: 1, slot: 1 }
  const record = await createLuggageRecord(input)
  const original = luggageStore.setItem
  luggageStore.setItem = async () => { throw new Error('QuotaExceededError') }
  try {
    await assert.rejects(createLuggageRecord(input), /QuotaExceeded/)
    await assert.rejects(checkoutLuggage('DISK', record.luggage_barcode), /QuotaExceeded/)
  } finally { luggageStore.setItem = original }
  assert.equal((await getLuggageRecord('DISK', record.luggage_barcode)).status, '寄存')
  assert.equal((await getAllLuggage('DISK')).length, 1)
})

test('integrated backups export one meeting and reject cross-meeting restore', async () => {
  const backup = await createBackup('C')
  assert.ok(backup.luggage.every(r => r.event_id === 'C'))
  assert.ok(backup.events.every(e => e.event_id === 'C'))
  await assert.rejects(restoreBackup(backup, 'B'), /其他会议/)
})
