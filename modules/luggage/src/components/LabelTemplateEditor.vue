<script setup>
import { computed, ref, watch } from 'vue'
const props=defineProps({modelValue:{type:Object,default:()=>({})}})
const emit=defineEmits(['update:modelValue'])
const fields=[['barcode','一维条码'],['position','排号 / 位号'],['name','参会人姓名']]
const local=ref(normalize(props.modelValue))
function normalize(value){return {paperWidth:Number(value?.paperWidth)||80,paperHeight:Number(value?.paperHeight)||120,margin:Number(value?.margin)||4,fontSize:Number(value?.fontSize)||12,fields:Array.isArray(value?.fields)?[...value.fields]:fields.map(x=>x[0])}}
watch(()=>props.modelValue,value=>{local.value=normalize(value)},{deep:true})
watch(local,value=>emit('update:modelValue',structuredClone(value)),{deep:true})
const ordered=computed(()=>local.value.fields.map(id=>fields.find(item=>item[0]===id)).filter(Boolean))
function drop(event,target){const source=event.dataTransfer.getData('text/plain');const list=[...local.value.fields],from=list.indexOf(source),to=list.indexOf(target);if(from<0||to<0)return;list.splice(to,0,list.splice(from,1)[0]);local.value.fields=list}
</script>
<template>
  <div class="template-editor">
    <div class="template-controls">
      <el-form label-position="top"><div class="template-grid"><el-form-item label="纸张宽度(mm)"><el-input-number v-model="local.paperWidth" :min="40" :max="210" /></el-form-item><el-form-item label="纸张高度(mm)"><el-input-number v-model="local.paperHeight" :min="60" :max="300" /></el-form-item><el-form-item label="边距(mm)"><el-input-number v-model="local.margin" :min="0" :max="20" /></el-form-item><el-form-item label="基础字体(px)"><el-input-number v-model="local.fontSize" :min="8" :max="30" /></el-form-item></div></el-form>
      <p class="muted-copy">拖动字段调整标签内容顺序；上下两联始终使用同一个 Code128 条码。</p>
      <div class="field-sort"><button v-for="field in ordered" :key="field[0]" draggable="true" @dragstart="$event.dataTransfer.setData('text/plain',field[0])" @dragover.prevent @drop="drop($event,field[0])">⋮⋮ {{ field[1] }}</button></div>
    </div>
    <div class="template-mini" :style="{aspectRatio:`${local.paperWidth}/${local.paperHeight}`,padding:`${Math.min(local.margin,10)}px`,fontSize:`${local.fontSize}px`}"><b>行李寄存 · A 联</b><template v-for="field in ordered" :key="field[0]"><div v-if="field[0]==='name'">张三</div><strong v-else-if="field[0]==='position'">2 排 18 位</strong><div v-else class="fake-barcode">|||| ||| || ||||</div></template><hr><b>客人留存 · B 联</b><div class="fake-barcode">|||| ||| || ||||</div></div>
  </div>
</template>
<style scoped>.template-editor{display:grid;grid-template-columns:1fr 190px;gap:22px}.template-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.field-sort{display:flex;flex-direction:column;gap:8px}.field-sort button{border:1px solid #dfd5d0;background:#fff;padding:10px;text-align:left;border-radius:8px;cursor:grab}.template-mini{width:150px;max-height:260px;background:#fff;border:1px solid #bbb;box-shadow:0 5px 20px #0001;overflow:hidden;display:flex;flex-direction:column;gap:9px}.fake-barcode{font-family:monospace;letter-spacing:1px;font-size:18px}@media(max-width:650px){.template-editor{grid-template-columns:1fr}.template-mini{margin:auto}}</style>
