import { getAllLuggage, markSynced } from './db'
import { syncLuggageRecord, USE_MOCK } from './api'

let running = false
let requested = false
let stopped = false
let listener = () => {}
let currentEvent = ''
async function drain() {
  if (running || stopped || !currentEvent) return
  running = true
  try {
    do {
      requested = false
      const records = await getAllLuggage(currentEvent)
      for (const record of records) {
        if (stopped || globalThis.navigator?.onLine === false) break
        if (record.sync_status === 'synced' || (USE_MOCK && record.sync_status === 'mock')) continue
        const result = await syncLuggageRecord(record)
        if (!result.ok) break // Avoid thousands of timeouts when the backend is down.
        await markSynced(record, result.mock)
      }
    } while (requested && !stopped)
  } catch (error) {
    console.warn('[sync] 后台队列暂不可用', error)
  } finally {
    running = false
    if (!stopped) listener()
  }
}
// Intentionally returns immediately; callers never await a network operation.
export function scheduleSync() {
  requested = true
  void drain()
}
export function startSync(onUpdate, eventId) {
  currentEvent = eventId
  stopped = false
  listener = onUpdate
  const timer = setInterval(scheduleSync, 30000)
  window.addEventListener('online', scheduleSync)
  scheduleSync()
  return () => { stopped = true; clearInterval(timer); window.removeEventListener('online', scheduleSync) }
}
