<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AppIcon from './AppIcon.vue'
const props = defineProps({ mode: { type: String, default: 'qr' }, disabled: Boolean })
const emit = defineEmits(['decoded'])
const video = ref(null)
const active = ref(false)
const loading = ref(false)
let controls = null
let stream = null
let generation = 0
function stop() {
  generation++
  controls?.stop(); controls = null
  stream?.getTracks().forEach(track => track.stop()); stream = null
  if (video.value) video.value.srcObject = null
  active.value = false; loading.value = false
}
async function start() {
  if (props.disabled || loading.value || active.value) return
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    ElMessage.warning('摄像头需要 HTTPS 或 localhost。可先使用手输编号或 USB 扫码枪。')
    return
  }
  const token = ++generation
  loading.value = true
  try {
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
    if (token !== generation) return
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, props.mode === 'qr' ? [BarcodeFormat.QR_CODE] : [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128]]])
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 180 })
    const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
    if (token !== generation) { acquired.getTracks().forEach(track => track.stop()); return }
    stream = acquired
    active.value = true
    const started = await reader.decodeFromStream(acquired, video.value, (result, error, scannerControls) => {
      if (token !== generation) { scannerControls.stop(); return }
      if (result) {
        scannerControls.stop()
        const text = result.getText().trim()
        const kind = result.getBarcodeFormat() === BarcodeFormat.CODE_128 ? 'barcode' : 'attendee'
        stop()
        if (!props.disabled) emit('decoded', { text, kind })
      }
    })
    if (token !== generation) started.stop()
    else controls = started
  } catch (error) {
    if (token !== generation) return
    stop()
    const messages = { NotAllowedError: '摄像头权限被拒绝，请在浏览器设置中允许访问', NotFoundError: '未找到摄像头，请使用手输或扫码枪', NotReadableError: '摄像头被其他应用占用，请关闭后重试' }
    ElMessage.warning(messages[error.name] || '无法启动摄像头，请使用手输或扫码枪')
    console.warn('[camera]', error)
  } finally { if (token === generation) loading.value = false }
}
const visibility = () => { if (document.hidden) stop() }
document.addEventListener('visibilitychange', visibility)
onBeforeUnmount(() => { stop(); document.removeEventListener('visibilitychange', visibility) })
defineExpose({ stop })
</script>
<template>
  <div class="camera-preview" :class="{ 'camera-active': active }">
    <video ref="video" v-show="active" autoplay muted playsinline aria-label="摄像头扫码预览" />
    <div v-if="!active" class="camera-placeholder">
      <div class="scan-corners"><AppIcon name="scan" :size="64" /></div>
      <strong>{{ mode === 'qr' ? '将胸卡二维码放入框内' : '扫描行李条码或胸卡二维码' }}</strong>
      <span>识别成功后，摄像头将自动关闭</span>
    </div>
    <div v-else class="live-pill"><i /> 摄像头识别中</div>
  </div>
  <el-button v-if="!active && !loading" class="camera-button" :disabled="disabled" @click="start"><AppIcon name="scan" />开启摄像头扫码</el-button>
  <el-button v-else class="camera-button" @click="stop">{{ loading ? '取消启动摄像头' : '停止扫描' }}</el-button>
</template>
