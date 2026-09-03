<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
const props=defineProps({attendees:{type:Array,default:()=>[]},eventName:{type:String,default:'会议'}})
const busy=ref(false)
const selected=ref([])
function ids(){return selected.value.length?selected.value:props.attendees.map(item=>item.attend_id)}
async function pngData(id){const {default:QRCode}=await import('qrcode');return QRCode.toDataURL(String(id),{errorCorrectionLevel:'M',margin:2,width:420})}
async function exportZip(){
  if(!ids().length)return ElMessage.warning('当前会议没有可导出的参会人')
  busy.value=true
  try{const {default:JSZip}=await import('jszip');const zip=new JSZip();for(const id of ids()){const data=await pngData(id);zip.file(`${id}.png`,data.split(',')[1],{base64:true})}const blob=await zip.generateAsync({type:'blob'});download(blob,`胸卡二维码_${Date.now()}.zip`);ElMessage.success(`已生成 ${ids().length} 张二维码图片`)}finally{busy.value=false}
}
async function exportPdf(){
  if(!ids().length)return ElMessage.warning('当前会议没有可导出的参会人')
  busy.value=true
  try{const {jsPDF}=await import('jspdf');const pdf=new jsPDF({unit:'mm',format:'a4'});let i=0;for(const id of ids()){if(i&&i%12===0)pdf.addPage();const cell=i%12,x=15+(cell%3)*62,y=16+Math.floor(cell/3)*68;pdf.addImage(await pngData(id),'PNG',x,y,42,42);pdf.setFontSize(8);pdf.text(String(id),x+21,y+47,{align:'center',maxWidth:54});i++}pdf.save(`胸卡二维码_${Date.now()}.pdf`);ElMessage.success(`已生成 ${ids().length} 人胸卡二维码 PDF`)}finally{busy.value=false}
}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000)}
</script>
<template>
  <section class="badge-export">
    <div class="panel-heading"><div><span class="section-index">BADGE QR</span><h2>胸卡二维码批量导出</h2><p>二维码仅包含参会人唯一 ID，不包含姓名、手机号等隐私信息。</p></div><span class="subtle-badge">{{ attendees.length }} 人</span></div>
    <el-select v-model="selected" multiple filterable collapse-tags collapse-tags-tooltip placeholder="默认导出全部；也可选择部分人员" style="width:100%">
      <el-option v-for="person in attendees" :key="person.attend_id" :label="`${person.name} · ${person.attend_id}`" :value="person.attend_id" />
    </el-select>
    <div class="badge-actions"><el-button :loading="busy" @click="exportZip">导出 PNG 压缩包</el-button><el-button type="primary" :loading="busy" @click="exportPdf">导出印刷 PDF</el-button></div>
  </section>
</template>
<style scoped>.badge-export{margin-top:18px;padding-top:18px;border-top:1px solid #e8ddd8}.badge-actions{display:flex;gap:10px;margin-top:12px}.badge-actions>*{flex:1}</style>
