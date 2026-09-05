import { chromium } from 'playwright'
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('luggage')
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' }
const context = { eventId:'meeting-ui-smoke', eventName:'UI 测试会议', userId:'user-ui-smoke', operator:'测试管理员', enabled:true, mode:'production' }
const attendee = { attend_id:'A-001', name:'季凡希', dept:null, mobile:'13003240331' }

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (url.pathname === '/') {
      response.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' })
      response.end(`<!doctype html><html><body><iframe id="luggage" src="/luggage/index.html?tab=setup"></iframe><script>
        const context=${JSON.stringify(context)};
        Object.defineProperty(window,'JourneyLuggageHost',{value:Object.freeze({
          context:()=>context,
          config:async()=>({enable_luggage:true,total_rows:50,per_row_max_position:50,allow_multi_bag:false,label_template:{preset:'classic',paperWidth:80,paperHeight:120,margin:4,fontSize:12,fields:['name','mobile','position','barcode']}}),
          attendees:async()=>[${JSON.stringify(attendee)}], ledger:async()=>[], prepareOffline:async()=>false,
          attach:()=>{}, resize:()=>{}, saveConfig:async(_id,value)=>value, reset:async()=>true, sync:async()=>({mock:false})
        })});
      </script></body></html>`)
      return
    }
    const relative = decodeURIComponent(url.pathname.replace(/^\/luggage\/?/, '')) || 'index.html'
    const file = path.resolve(root, relative)
    if (!file.startsWith(`${root}${path.sep}`) && file !== root) throw new Error('invalid path')
    if (!(await stat(file)).isFile()) throw new Error('not a file')
    response.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' })
    response.end(await readFile(file))
  } catch {
    response.writeHead(404).end('Not found')
  }
})

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
const browser = await chromium.launch({ headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const page = await browser.newPage({ viewport:{ width:1440, height:1000 } })
const pageErrors = []
const consoleErrors = []
page.on('pageerror', error => pageErrors.push(error.message))
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })

try {
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil:'domcontentloaded' })
  const luggage = page.frameLocator('#luggage')
  await luggage.getByText('已导入 1 位参会人', { exact:false }).waitFor()
  await luggage.getByText('参会名单', { exact:true }).waitFor()
  await page.waitForTimeout(1200)
  const errorMessages = await luggage.locator('.el-message--error').allTextContents()
  if (errorMessages.length) throw new Error(`Unexpected error message: ${errorMessages.join(' | ')}`)
  if (pageErrors.length || consoleErrors.some(value => /Maximum recursive updates|\[luggage ui\]/.test(value))) {
    throw new Error(`Luggage UI errors: ${[...pageErrors, ...consoleErrors].join(' | ')}`)
  }
  console.log(JSON.stringify({ importNotice:'pass', recursiveUpdate:'pass', visibleErrorToast:false }, null, 2))
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
