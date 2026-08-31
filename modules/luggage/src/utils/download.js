export function downloadFile(content, filename, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
const columns = [
  ['event_id', '会议编号'], ['attend_id', '参会编号'], ['name', '姓名'], ['dept', '部门'],
  ['mobile', '手机号'], ['luggage_barcode', '寄存编号'], ['storage_row', '排号'], ['storage_slot', '位号'],
  ['status', '状态'], ['checkin_time', '寄存时间(ISO)'], ['checkout_time', '出库时间(ISO)'],
  ['operator_checkin', '寄存操作员'], ['operator_checkout', '出库操作员'], ['sync_status', '同步状态'],
]
export function csvCell(value) {
  let text = String(value ?? '')
  // Prevent spreadsheet formula injection, including whitespace-prefixed formulae.
  if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
export function recordsToCSV(records) {
  return '\uFEFF' + [columns.map(([, title]) => csvCell(title)).join(','),
    ...records.map(record => columns.map(([key]) => csvCell(record[key])).join(',')),
  ].join('\r\n')
}
export function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
export const safeFilename = (name) => String(name).replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_')
