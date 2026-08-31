// Only the same-origin parent supplies the authenticated conference context.
// No token, attendee data or meeting identity is trusted from URL parameters.
export const host = (() => {
  try { return window.parent !== window && window.parent.location.origin === window.location.origin ? window.parent.JourneyLuggageHost : null } catch { return null }
})()
export function context() { return host?.context() || null }
export const initialContext = context()
export function requireContext(write = false) {
  const value = context()
  if (!value || value.eventId !== initialContext?.eventId || value.userId !== initialContext?.userId) throw new Error('会议或登录账号已变更，请重新进入行李管理')
  if (write && !value.enabled) throw new Error('本场会议未启用行李管理，仅可查看台账')
  return value
}
