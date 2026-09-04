const state = { user: null, members: [], currentMember: null, folders: [], meetingType: 'external', uploadFolderId: null };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : response;
  if (!response.ok) {
    if (response.status === 401 && url !== '/api/login') showLogin();
    throw new Error(data.error || '操作失败，请稍后再试');
  }
  return data;
}

function showLogin() {
  state.user = null;
  $('#appView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
}

function initials(name) { return name.slice(-1); }
function formatDate(value) { return new Intl.DateTimeFormat('zh-CN').format(new Date(value)); }
function formatSize(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }

function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

async function initializeApp(user) {
  state.user = user;
  $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  $('#userName').textContent = user.name; $('#userAvatar').textContent = initials(user.name);
  $('#userRole').textContent = user.role === 'admin' ? '系统管理员' : '部门成员';
  const { members } = await api('/api/members'); state.members = members;
  state.currentMember = user.name; renderMemberNav(); await loadFolders();
  if (user.mustChangePassword) { openModal('passwordModal'); toast('首次登录，请及时修改密码'); }
}

function renderMemberNav() {
  const isAdmin = state.user.role === 'admin';
  $('#adminSpaces').classList.toggle('hidden', !isAdmin);
  if (!isAdmin) return;
  $('#memberNav').innerHTML = state.members.map((member) => `<button class="nav-item member-button ${member.name === state.currentMember ? 'active' : ''}" data-member="${escapeHtml(member.name)}"><span class="mini-avatar">${initials(member.name)}</span>${escapeHtml(member.name)}</button>`).join('');
  $$('#memberNav [data-member]').forEach((button) => button.addEventListener('click', async () => {
    state.currentMember = button.dataset.member; renderMemberNav(); await loadFolders(); $('.sidebar').classList.remove('open');
  }));
}

async function loadFolders() {
  const { folders } = await api(`/api/folders?member=${encodeURIComponent(state.currentMember)}`);
  state.folders = folders;
  $('#currentSpaceLabel').textContent = `${state.currentMember}的空间`;
  $('#pageTitle').textContent = state.currentMember === state.user.name ? '我的会议文件' : `${state.currentMember}的会议文件`;
  renderFolders();
}

function renderFolders() {
  const query = $('#searchInput').value.trim().toLowerCase();
  const type = $('#typeFilter').value;
  const folders = state.folders.filter((folder) => (type === 'all' || folder.meetingType === type) && `${folder.activityName} ${folder.name} ${folder.owner}`.toLowerCase().includes(query));
  const allFiles = state.folders.flatMap((folder) => folder.files);
  $('#folderCount').textContent = state.folders.length;
  $('#quotationCount').textContent = allFiles.filter((file) => file.type === 'quotation').length;
  $('#confirmationCount').textContent = allFiles.filter((file) => file.type === 'confirmation').length;
  $('#poCount').textContent = allFiles.filter((file) => file.type === 'po').length;
  $('#emptyState').classList.toggle('hidden', folders.length > 0);
  $('#folderList').innerHTML = folders.map((folder) => {
    const hasPo = folder.files.some((file) => file.type === 'po');
    const hasPoEmail = folder.files.some((file) => file.type === 'po_email');
    const confirmations = folder.files.filter((file) => file.type === 'confirmation');
    const isSigned = confirmations.some((file) => file.documentStatus === 'signed');
    const scenarioOne = folder.complianceScenario === 'po_email';
    const scenarioTwo = folder.complianceScenario === 'signed_confirmation';
    const canDeleteFolder = state.user.role === 'admin' || folder.files.every((file) => file.uploadedBy === state.user.name && (file.type === 'quotation' || (file.type === 'confirmation' && file.documentStatus !== 'signed')));
    const finalDocumentStatus = scenarioOne
      ? `<span class="status-pill ${hasPoEmail ? 'success' : 'missing'}"><i></i>PO确认邮件 ${hasPoEmail ? '已有' : '待上传'}</span>`
      : scenarioTwo
        ? `<span class="status-pill ${isSigned ? 'success' : (confirmations.length ? 'warning' : 'missing')}"><i></i>确认单 ${isSigned ? '已签署' : (confirmations.length ? '待签署' : '未上传')}</span>`
        : '<span class="status-pill warning"><i></i>上传时选择场景</span>';
    const adminStatuses = state.user.role === 'admin' ? `<div class="document-statuses">
      <span class="status-pill ${hasPo ? 'success' : 'missing'}"><i></i>PO ${hasPo ? '已有' : '待上传'}</span>
      ${finalDocumentStatus}
    </div>` : '';
    return `
    <article class="folder-card">
      <div class="folder-summary">
        <span class="folder-icon">▱</span>
        <div class="folder-info"><h3 title="${escapeHtml(folder.activityName)}">${escapeHtml(folder.activityName)}</h3><div class="folder-key">${folder.meetingType === 'internal' ? '合同编号' : '会议编码'}：${escapeHtml(folder.identifier)}</div><div class="folder-meta"><span class="type-badge ${folder.meetingType}">${folder.meetingType === 'internal' ? '内部活动' : '外部活动'}</span><span class="scenario-badge">${scenarioOne ? '场景一 · PO确认邮件' : scenarioTwo ? '场景二 · 签署确认单' : '场景待管理员选择'}</span><span>负责人：${escapeHtml(folder.owner)}</span><span>活动日期：${escapeHtml(folder.date)}</span></div></div>
        ${adminStatuses}
        <span class="file-count">${folder.files.length} 个文件</span>
        <div class="card-actions"><button class="action-button" data-toggle-folder="${folder.id}">展开</button><button class="action-button" data-upload-folder="${folder.id}">＋ 上传</button>${canDeleteFolder ? `<button class="action-button danger" data-delete-folder="${folder.id}">删除</button>` : ''}</div>
      </div>
      <div class="file-panel hidden" data-file-panel="${folder.id}">${renderFiles(folder.files)}</div>
    </article>`;
  }).join('');
  bindFolderActions();
}

function renderFiles(files) {
  if (!files.length) return '<div class="no-files">暂无文件。成员上传报价和未签署确认单，管理员补充最终采购材料。</div>';
  return files.map((file) => {
    const isConfirmation = file.type === 'confirmation';
    const signed = file.documentStatus === 'signed';
    const memberMayDelete = file.uploadedBy === state.user.name && (file.type === 'quotation' || (file.type === 'confirmation' && !signed));
    const canDelete = state.user.role === 'admin' || memberMayDelete;
    const status = isConfirmation ? `<span class="inline-status ${signed ? 'signed' : 'pending'}">${signed ? '已签署' : '待签署'}</span>` : '';
    const statusAction = isConfirmation && state.user.role === 'admin' && file.uploadedBy === state.user.name ? `<button class="link-button" data-file-status="${file.id}" data-next-status="${signed ? 'pending' : 'signed'}">${signed ? '改为待签署' : '标记已签署'}</button>` : '';
    return `<div class="file-row"><span class="file-type">${escapeHtml(file.typeLabel)} ${status}</span><span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span><span class="file-note">${formatSize(file.size)}</span><span class="file-note">${escapeHtml(file.uploadedBy)} · ${formatDate(file.uploadedAt)}</span><span class="file-actions">${statusAction}<a class="link-button" href="/api/files/${file.id}">下载</a>${canDelete ? `<button class="link-button danger" data-delete-file="${file.id}">删除</button>` : ''}</span></div>`;
  }).join('');
}

function bindFolderActions() {
  $$('[data-toggle-folder]').forEach((button) => button.addEventListener('click', () => {
    const panel = $(`[data-file-panel="${button.dataset.toggleFolder}"]`); panel.classList.toggle('hidden'); button.textContent = panel.classList.contains('hidden') ? '展开' : '收起';
  }));
  $$('[data-upload-folder]').forEach((button) => button.addEventListener('click', () => openUpload(button.dataset.uploadFolder)));
  $$('[data-delete-folder]').forEach((button) => button.addEventListener('click', async () => {
    const folder = state.folders.find((item) => item.id === button.dataset.deleteFolder);
    if (!confirm(`确认删除“${folder.name}”及其中的全部文件？此操作不可撤销。`)) return;
    await api(`/api/folders/${folder.id}`, { method: 'DELETE' }); toast('文件夹已删除'); await loadFolders();
  }));
  $$('[data-delete-file]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('确认删除这个文件？')) return;
    await api(`/api/files/${button.dataset.deleteFile}`, { method: 'DELETE' }); toast('文件已删除'); await loadFolders();
  }));
  $$('[data-file-status]').forEach((button) => button.addEventListener('click', async () => {
    const signed = button.dataset.nextStatus === 'signed';
    if (!confirm(signed ? '确认该会务确认单已经签署完成？' : '确认将该会务确认单改为待签署？')) return;
    await api(`/api/files/${button.dataset.fileStatus}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:button.dataset.nextStatus}) });
    toast(signed ? '已标记为签署完成' : '已改为待签署'); await loadFolders();
  }));
}

function openModal(id) {
  $('#modalBackdrop').classList.remove('hidden'); $$('.modal').forEach((modal) => modal.classList.add('hidden')); $(`#${id}`).classList.remove('hidden');
}
function closeModal() { $('#modalBackdrop').classList.add('hidden'); $$('.modal').forEach((modal) => modal.classList.add('hidden')); }
function openNewFolder() {
  state.meetingType = 'external'; $('#newFolderForm').reset(); $('#meetingTypeSelect').value = 'external'; $('#ownerInput').value = state.currentMember; $('#dateInput').value = new Date().toISOString().slice(0,10); updateFolderMode(); openModal('newFolderModal');
}
function updateFolderMode() {
  state.meetingType = $('#meetingTypeSelect').value;
  const external = state.meetingType === 'external'; $('#identifierLabel').textContent = external ? '会议编码' : '合同编号'; $('#identifierInput').placeholder = external ? '例如：EL2026-0820' : '例如：HT2026-0188'; updatePreview();
}
function updatePreview() {
  $('#namePreview').textContent = `${$('#identifierInput').value.trim() || (state.meetingType === 'external' ? '会议编码' : '合同编号')}_${$('#ownerInput').value.trim() || '负责人'}_${$('#dateInput').value || '会议日期'}`;
}
function openUpload(folderId) {
  state.uploadFolderId = folderId; const folder = state.folders.find((item) => item.id === folderId); $('#uploadForm').reset(); $('#selectedFileName').textContent = ''; $('#uploadFolderName').textContent = `${folder.activityName} · ${folder.name}`; $('#uploadError').textContent = '';
  const isAdmin = state.user.role === 'admin';
  $('#uploadScenarioField').classList.toggle('hidden', !isAdmin);
  $('#uploadScenario').value = isAdmin && ['po_email', 'signed_confirmation'].includes(folder.complianceScenario) ? folder.complianceScenario : '';
  if (!isAdmin) $('#uploadType').innerHTML = '<option value="quotation">报价</option><option value="confirmation">未签署会务确认单</option>';
  updateUploadOptions(); openModal('uploadModal');
}
function updateUploadOptions() {
  const isAdmin = state.user.role === 'admin';
  if (!isAdmin) {
    $('#uploadRoleHint').textContent = '成员仅上传报价和未签署会务确认单；最终采购材料由管理员上传。';
    $('#confirmationStatus').innerHTML = '<option value="pending">待签署</option>';
    return updateConfirmationStatusField();
  }
  const scenario = $('#uploadScenario').value;
  const options = scenario === 'po_email'
    ? [['quotation', '报价'], ['confirmation_pending', '会务确认单（待签署）'], ['po', '采购订单（PO）'], ['po_email', '供应商PO确认邮件'], ['other', '其他']]
    : scenario === 'signed_confirmation'
      ? [['quotation', '报价'], ['confirmation_pending', '会务确认单（待签署）'], ['confirmation_signed', '会务确认单（已签署）'], ['po', '采购订单（PO）'], ['other', '其他']]
      : [['', '请先选择项目场景']];
  $('#uploadType').innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  $('#confirmationStatus').innerHTML = scenario === 'signed_confirmation'
    ? '<option value="pending">待签署</option><option value="signed">已签署完成</option>'
    : '<option value="pending">待签署</option>';
  $('#uploadRoleHint').textContent = scenario === 'po_email'
    ? '场景一：请补齐采购订单（PO）和供应商PO确认邮件。'
    : scenario === 'signed_confirmation'
      ? '场景二：请补齐采购订单（PO）和已签署会务确认单。'
      : '请先选择场景，系统将显示对应的最终材料类型。';
  updateConfirmationStatusField();
}
function updateConfirmationStatusField() { $('#confirmationStatusField').classList.toggle('hidden', $('#uploadType').value !== 'confirmation'); }

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); $('#loginError').textContent = '';
  try { const { user } = await api('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:$('#loginName').value, password:$('#loginPassword').value }) }); $('#loginForm').reset(); await initializeApp(user); }
  catch (error) { $('#loginError').textContent = error.message; }
});
$$('[data-toggle-password]').forEach((button) => button.addEventListener('click', () => { const input = $('#loginPassword'); input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? '显示' : '隐藏'; }));
$('#logoutButton').addEventListener('click', async () => { await api('/api/logout', { method:'POST' }); showLogin(); });
$('#newFolderButton').addEventListener('click', openNewFolder); $$('[data-open-new]').forEach((button) => button.addEventListener('click', openNewFolder));
$$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
$('#modalBackdrop').addEventListener('click', (event) => { if (event.target === $('#modalBackdrop')) closeModal(); });
$('#meetingTypeSelect').addEventListener('change', updateFolderMode);
['identifierInput','ownerInput','dateInput'].forEach((id) => $(`#${id}`).addEventListener('input', updatePreview));
$('#searchInput').addEventListener('input', renderFolders); $('#typeFilter').addEventListener('change', renderFolders);
$('#newFolderForm').addEventListener('submit', async (event) => {
  event.preventDefault(); $('#folderError').textContent = '';
  try { await api('/api/folders', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ member:state.currentMember, meetingType:state.meetingType, identifier:$('#identifierInput').value, activityName:$('#activityNameInput').value, owner:$('#ownerInput').value, date:$('#dateInput').value }) }); closeModal(); toast('活动项目创建成功'); await loadFolders(); }
  catch (error) { $('#folderError').textContent = error.message; }
});
$('#fileInput').addEventListener('change', () => { $('#selectedFileName').textContent = $('#fileInput').files[0]?.name || ''; });
$('#uploadType').addEventListener('change', updateConfirmationStatusField);
$('#uploadScenario').addEventListener('change', updateUploadOptions);
$('#uploadForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const file = $('#fileInput').files[0]; if (!file) return; $('#uploadError').textContent = '';
  const selectedType = $('#uploadType').value; if (!selectedType) return $('#uploadError').textContent = '请先选择项目场景和文件类型'; const type = selectedType.startsWith('confirmation_') ? 'confirmation' : selectedType; const confirmationStatus = selectedType === 'confirmation_signed' ? 'signed' : selectedType === 'confirmation_pending' ? 'pending' : $('#confirmationStatus').value; const status = type === 'confirmation' ? `&status=${encodeURIComponent(confirmationStatus)}` : ''; const scenario = state.user.role === 'admin' ? `&scenario=${encodeURIComponent($('#uploadScenario').value)}` : ''; $('#uploadProgress').classList.remove('hidden');
  try { await api(`/api/files?folderId=${state.uploadFolderId}&type=${encodeURIComponent(type)}&filename=${encodeURIComponent(file.name)}${status}${scenario}`, { method:'POST', headers:{'Content-Type':'application/octet-stream'}, body:file }); closeModal(); toast('文件上传成功'); await loadFolders(); }
  catch (error) { $('#uploadError').textContent = error.message; }
  finally { $('#uploadProgress').classList.add('hidden'); }
});
$('#changePasswordButton').addEventListener('click', () => { $('#passwordForm').reset(); $('#passwordError').textContent=''; openModal('passwordModal'); });
$('#passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault(); $('#passwordError').textContent='';
  try { await api('/api/change-password', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({currentPassword:$('#currentPassword').value,newPassword:$('#newPassword').value}) }); state.user.mustChangePassword=false; closeModal(); toast('密码修改成功'); }
  catch (error) { $('#passwordError').textContent=error.message; }
});
$('#menuButton').addEventListener('click', () => $('.sidebar').classList.toggle('open'));

(async () => { try { const { user } = await api('/api/me'); await initializeApp(user); } catch { showLogin(); } })();
