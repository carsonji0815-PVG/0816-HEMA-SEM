import { createApp, reactive } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './style.css'
import './integrated.css'
import { host, context } from './utils/host.js'
if (!host || !context()) {
  document.getElementById('app').textContent = '请登录行程管理工具，并从当前会议的“行李管理”入口进入。'
} else {
  const offline = reactive({ ready: false, message: '已打开的页面可离线办理；刷新或重新登录需要网络' })
  const app = createApp(App)
  app.provide('offline', offline)
  app.use(ElementPlus, { locale: zhCn, size: 'large' })
  app.config.errorHandler = error => { console.error('[luggage]', error); ElMessage.error('操作未完成，请检查本地存储。不要清除浏览器数据。') }
  app.mount('#app')
  host.attach({ canLeave: () => !document.querySelector('[data-business-busy="true"]') })
  const resize = new ResizeObserver(() => host.resize(Math.ceil(document.documentElement.getBoundingClientRect().height)))
  resize.observe(document.body)
  window.addEventListener('pagehide', () => { resize.disconnect(); app.unmount() }, { once: true })
}
