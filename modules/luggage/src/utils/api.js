import { host, initialContext, requireContext } from './host.js'
export const USE_MOCK = initialContext?.mode !== 'production'
export async function fetchAttendeeList(eventId) {
  try { requireContext(true); return await host.attendees(eventId) }
  catch (error) { console.warn('[luggage roster]', error); return null }
}
export function toSyncPayload(record) {
  const { sync_status, synced_at, ...payload } = record
  return payload
}
export async function syncLuggageRecord(record) {
  try {
    requireContext()
    const result = await host.sync(record.event_id, toSyncPayload(record))
    return { ok: true, mock: USE_MOCK, ...result }
  } catch (error) { console.warn('[luggage sync] 本地记录保留，稍后重试', error); return { ok: false, mock: USE_MOCK } }
}
