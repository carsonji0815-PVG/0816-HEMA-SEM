<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import JsBarcode from 'jsbarcode'
import { ElMessage } from 'element-plus'
import { formatTime } from '../utils/download'
import AppIcon from './AppIcon.vue'
const props = defineProps({ record: { type: Object, default: null } })
const barcodeA = ref(null)
const barcodeB = ref(null)
const paper = ref(null)
const printRoot = ref(null)
function preparePrint() {
  if (paper.value && printRoot.value) printRoot.value.replaceChildren(paper.value.cloneNode(true))
}
onMounted(() => window.addEventListener('beforeprint', preparePrint))
onBeforeUnmount(() => window.removeEventListener('beforeprint', preparePrint))
async function renderBarcodes() {
  await nextTick()
  if (!props.record) return
  for (const svg of [barcodeA.value, barcodeB.value]) {
    if (svg) JsBarcode(svg, props.record.luggage_barcode, { format: 'CODE128', displayValue: false, margin: 12, marginTop: 0, marginBottom: 0, height: 50, width: 2, lineColor: '#000', background: '#fff' })
  }
}
watch(() => props.record?.luggage_barcode, () => { void renderBarcodes().catch(() => ElMessage.error('条码渲染失败，请重试打印')) }, { immediate: true, flush: 'post' })
async function print() {
  if (!props.record) return false
  try {
    await renderBarcodes()
    await document.fonts?.ready
    await new Promise(resolve => requestAnimationFrame(resolve))
    preparePrint()
    window.print()
    return true // The browser does not report physical print success or cancel.
  } catch (error) {
    console.warn('[print]', error)
    ElMessage.warning('本地寄存已保存；打印未启动，可点击重新打印')
    return false
  }
}
defineExpose({ print })
</script>
<template>
  <div class="label-preview">
    <div v-if="!record" class="label-empty"><AppIcon name="print" :size="40" /><strong>双联标签将在这里生成</strong><span>先识别参会人，再填写存放位置</span><div class="paper-skeleton"><i /><i /><i /><b>80 × 120 mm</b></div></div>
    <template v-else>
      <div ref="paper" class="paper-label">
        <section class="label-half label-a">
          <header><b>会务服务 / 行李寄存</b><span>A 联 · 行李粘贴</span></header>
          <div class="label-person">{{ record.name }}</div>
          <div class="label-dept">{{ record.dept || '—' }}</div>
          <div class="label-location">{{ record.storage_row }} 排 <strong>{{ record.storage_slot }}</strong> 位</div>
          <p class="label-time">寄存 {{ formatTime(record.checkin_time) }}</p>
          <svg ref="barcodeA" class="label-barcode" role="img" :aria-label="`行李条码 ${record.luggage_barcode}`" />
          <div class="label-code">{{ record.luggage_barcode }}</div>
        </section>
        <div class="tear-line"><span>✂ 沿此线撕开</span></div>
        <section class="label-half label-b">
          <header><b>请妥善保管此回执</b><span>B 联 · 客人留存</span></header>
          <div class="receipt-person"><strong>{{ record.name }}</strong><span>{{ record.storage_row }} 排 {{ record.storage_slot }} 位</span></div>
          <svg ref="barcodeB" class="label-barcode" role="img" :aria-label="`回执条码 ${record.luggage_barcode}`" />
          <div class="label-code">{{ record.luggage_barcode }}</div>
          <p class="label-tip">请凭此回执取件，并与工作人员核对行李。<br>一件一签，请勿遗失。</p>
        </section>
      </div>
      <el-button class="reprint-button" @click="print"><AppIcon name="print" />重新打印此标签</el-button>
      <p class="print-footnote">80 × 120 mm · 双联模切纸 · 不含手机号</p>
    </template>
  </div>
  <Teleport to="body">
    <div v-if="record" id="print-root" ref="printRoot" aria-hidden="true"></div>
  </Teleport>
</template>
<style>
.label-preview { padding: 22px 12px; background: #eef0ec; border: 1px solid #e1e5dd; border-radius: 12px; }
.paper-label { width: 80mm; height: 120mm; padding: 0 4mm; box-sizing: border-box; background: #fff; color: #000; margin: auto; box-shadow: 0 4px 18px #213b2910; font-family: Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.label-half { box-sizing: border-box; overflow: hidden; }
.label-a { height: 60mm; padding: 4mm 0 2mm; }
.label-b { height: 58mm; padding: 4mm 0 3mm; }
.label-half header { display: flex; justify-content: space-between; font-size: 9px; gap: 3mm; border-bottom: 1px solid #000; padding-bottom: 2mm; }
.label-person { margin-top: 2mm; font-size: 23px; line-height: 1.15; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.label-dept { font-size: 11px; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.label-location { font-size: 17px; font-weight: 600; line-height: 1.15; }
.label-location strong { font-size: 27px; }
.label-time { margin: 0 0 2mm; font-size: 9px; }
.label-barcode { display: block; width: 100%; height: 11mm; }
.label-code { font-family: monospace; font-size: 10px; text-align: center; letter-spacing: .2px; white-space: nowrap; margin-top: 1mm; }
.tear-line { height: 2mm; border-top: 1px dashed #555; box-sizing: border-box; text-align: center; font-size: 8px; line-height: 2mm; }
.tear-line span { background: white; padding: 0 2mm; position: relative; top: -1.5mm; }
.receipt-person { display: flex; gap: 3mm; align-items: center; justify-content: space-between; margin: 4mm 0; font-size: 15px; }
.receipt-person strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.receipt-person span { white-space: nowrap; }
.label-tip { margin: 3mm 0 0; font-size: 10px; line-height: 1.7; }
.reprint-button { width: 100%; margin-top: 20px; }
.print-footnote { font-size: 11px; color: #78837c; text-align: center; margin: 12px 0 0; }
.label-empty { min-height: 380px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #7f8e83; gap: 14px; }
.label-empty strong { color: #526558; font-size: 14px; }
.label-empty span { font-size: 12px; }
.paper-skeleton { width: 180px; height: 190px; background: #fff9; margin-top: 12px; border: 1px dashed #b9c5b9; border-radius: 4px; padding: 26px; display: flex; flex-direction: column; gap: 12px; }
.paper-skeleton i { background: #e0e5dd; height: 6px; width: 75%; }
.paper-skeleton i:nth-child(2) { width: 45%; height: 18px; }
.paper-skeleton b { border-top: 1px dashed #ced5c9; padding-top: 20px; margin-top: 15px; font-size: 11px; font-weight: 400; }
#print-root { display: none; }
@page { size: 80mm 120mm; margin: 0; }
@media print {
  html, body { width: 80mm !important; height: 120mm !important; margin: 0 !important; padding: 0 !important; background: white !important; }
  body > :not(#print-root) { display: none !important; }
  #print-root { display: block !important; width: 80mm; height: 120mm; }
  #print-root .paper-label { margin: 0 !important; box-shadow: none !important; break-inside: avoid; }
}
</style>
