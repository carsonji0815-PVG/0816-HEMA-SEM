<script setup>
import { computed, ref, watch } from 'vue'
const props=defineProps({modelValue:{type:Object,default:()=>({})}})
const emit=defineEmits(['update:modelValue'])
const fields=[['barcode','一维条码'],['position','排号 / 位号'],['name','参会人姓名'],['mobile','手机号']]
const presets=[
  {id:'classic',name:'经典双联',description:'信息均衡，适合80×120mm',paperWidth:80,paperHeight:120,margin:4,fontSize:12,fields:['name','mobile','position','barcode']},
  {id:'position',name:'大号库位',description:'排号位号醒目，便于快速找件',paperWidth:80,paperHeight:120,margin:4,fontSize:13,fields:['position','name','mobile','barcode']},
  {id:'compact',name:'紧凑吊牌',description:'适合宽度较窄的热敏纸',paperWidth:70,paperHeight:110,margin:3,fontSize:11,fields:['barcode','position','name','mobile']},
]
const local=ref(normalize(props.modelValue))
function normalize(value){const order=Array.isArray(value?.fields)?value.fields.filter(id=>fields.some(field=>field[0]===id)):[];for(const [id] of fields)if(!order.includes(id))order.push(id);return {preset:value?.preset||'custom',paperWidth:Number(value?.paperWidth)||80,paperHeight:Number(value?.paperHeight)||120,margin:Number(value?.margin)||4,fontSize:Number(value?.fontSize)||12,fields:order}}
function signature(value){return JSON.stringify(normalize(value))}
watch(()=>props.modelValue,value=>{
  const next=normalize(value)
  if(signature(local.value)!==JSON.stringify(next))local.value=next
},{deep:true})
watch(local,value=>{
  const next=normalize(value)
  if(signature(props.modelValue)!==JSON.stringify(next))emit('update:modelValue',structuredClone(next))
},{deep:true})
const ordered=computed(()=>local.value.fields.map(id=>fields.find(item=>item[0]===id)).filter(Boolean))
function drop(event,target){const source=event.dataTransfer.getData('text/plain');const list=[...local.value.fields],from=list.indexOf(source),to=list.indexOf(target);if(from<0||to<0)return;list.splice(to,0,list.splice(from,1)[0]);local.value.fields=list}
function applyPreset(preset){local.value=normalize({...preset,preset:preset.id})}
</script>
<template>
  <div class="template-editor">
    <div class="template-controls">
      <div class="preset-list"><button v-for="preset in presets" :key="preset.id" type="button" :class="{active:local.preset===preset.id}" @click="applyPreset(preset)"><strong>{{ preset.name }}</strong><small>{{ preset.description }}</small></button></div>
      <el-form label-position="top"><div class="template-grid"><el-form-item label="纸张宽度(mm)"><el-input-number v-model="local.paperWidth" :min="40" :max="210" /></el-form-item><el-form-item label="纸张高度(mm)"><el-input-number v-model="local.paperHeight" :min="60" :max="300" /></el-form-item><el-form-item label="边距(mm)"><el-input-number v-model="local.margin" :min="0" :max="20" /></el-form-item><el-form-item label="基础字体(px)"><el-input-number v-model="local.fontSize" :min="8" :max="30" /></el-form-item></div></el-form>
      <p class="muted-copy">拖动字段调整布局顺序；姓名、手机号、排号、位号和一维码均为必填打印字段，不可删除。上下联始终使用同一个寄存单号。</p>
      <div class="field-sort"><button v-for="field in ordered" :key="field[0]" type="button" draggable="true" @dragstart="$event.dataTransfer.setData('text/plain',field[0]);local.preset='custom'" @dragover.prevent @drop="drop($event,field[0])">⋮⋮ {{ field[1] }} <span>必填</span></button></div>
    </div>
    <div class="template-mini" :style="{aspectRatio:`${local.paperWidth}/${local.paperHeight}`,padding:`${Math.min(local.margin,10)}px`,fontSize:`${local.fontSize}px`}"><b>行李寄存 · A 联</b><template v-for="field in ordered" :key="field[0]"><div v-if="field[0]==='name'">张三</div><div v-else-if="field[0]==='mobile'">138 **** 8000</div><strong v-else-if="field[0]==='position'">2 排 18 位</strong><div v-else class="fake-barcode">|||| ||| || ||||</div></template><hr><b>客人留存 · B 联</b><div class="fake-barcode">|||| ||| || ||||</div></div>
  </div>
</template>
<style scoped>.template-editor{display:grid;grid-template-columns:1fr 190px;gap:22px}.preset-list{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:16px}.preset-list button{border:1px solid #dfd5d0;background:#fff;padding:11px;text-align:left;border-radius:10px}.preset-list button.active{border-color:#d52b1e;background:#fff1ed}.preset-list strong,.preset-list small{display:block}.preset-list small{color:#8b7b72;margin-top:4px}.template-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.field-sort{display:flex;flex-direction:column;gap:8px}.field-sort button{border:1px solid #dfd5d0;background:#fff;padding:10px;text-align:left;border-radius:8px;cursor:grab}.field-sort span{float:right;color:#b44b3d;font-size:11px}.template-mini{width:150px;max-height:290px;background:#fff;border:1px solid #bbb;box-shadow:0 5px 20px #0001;overflow:hidden;display:flex;flex-direction:column;gap:8px}.fake-barcode{font-family:monospace;letter-spacing:1px;font-size:18px}@media(max-width:650px){.template-editor{grid-template-columns:1fr}.template-mini{margin:auto}.preset-list{grid-template-columns:1fr}}</style>
