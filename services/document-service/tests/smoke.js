const assert = require('assert');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

async function request(path, options = {}, cookie = '') {
  const response = await fetch(base + path, { ...options, headers: { ...(options.headers || {}), ...(cookie ? { Cookie: cookie } : {}) } });
  const body = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
  return { response, body };
}

(async () => {
  const home = await request('/');
  assert.equal(home.response.status, 200);
  assert.match(home.body, /礼来会务文件中心/);
  assert.match(home.body, /id="meetingTypeSelect"/);
  assert.match(home.body, /id="uploadScenario"/);
  const appScript = await request('/app.js');
  assert.equal(appScript.response.status, 200);
  assert.match(appScript.body, /会务确认单（已签署）/);
  assert.match(appScript.body, /confirmation_signed/);

  const testUser = process.env.TEST_USER || '占慧';
  const testPassword = process.env.TEST_PASSWORD || 'Lilly@2026';
  const login = await request('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: testUser, password: testPassword }) });
  assert.equal(login.response.status, 200);
  const setCookie = login.response.headers.get('set-cookie');
  assert.match(setCookie, /; HttpOnly; Secure; SameSite=Strict;/);
  assert.match(setCookie, /Max-Age=1800/);
  const cookie = setCookie.split(';')[0];

  if (login.body.user.mustChangePassword) {
    const blockedBeforePasswordChange = await request('/api/members', {}, cookie);
    assert.equal(blockedBeforePasswordChange.response.status, 428);
    const changed = await request('/api/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: testPassword, newPassword: 'Temporary!Pass2026' }) }, cookie);
    assert.equal(changed.response.status, 200);
  }

  const members = await request('/api/members', {}, cookie);
  assert.equal(members.response.status, 200);
  assert.equal(members.body.members.length, login.body.user.role === 'admin' ? 7 : 1);

  const folders = await request('/api/folders?member=' + encodeURIComponent(testUser), {}, cookie);
  assert.equal(folders.response.status, 200);
  assert.ok(Array.isArray(folders.body.folders));

  if (login.body.user.role !== 'admin') {
    const forbidden = await request('/api/folders?member=' + encodeURIComponent('沈祥雨'), {}, cookie);
    assert.equal(forbidden.response.status, 403);
  }

  const marker = Date.now().toString(36);
  const created = await request('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member: testUser, meetingType: 'external', identifier: `TEST-${marker}`, activityName: '外部活动测试', owner: testUser, date: '2026-08-20' }) }, cookie);
  assert.equal(created.response.status, 201);
  assert.equal(created.body.folder.name, `TEST-${marker}_${testUser}_2026-08-20`);
  assert.equal(created.body.folder.activityName, '外部活动测试');
  assert.equal(created.body.folder.complianceScenario, 'unclassified');
  const folderId = created.body.folder.id;

  const payload = 'smoke-file-content';
  const pdfPayload = Buffer.from('%PDF-1.4\n% smoke test document\n');
  if (login.body.user.role === 'admin') {
    const missingScenario = await request(`/api/files?folderId=${folderId}&type=po&filename=${encodeURIComponent('缺少场景的采购订单.pdf')}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: pdfPayload }, cookie);
    assert.equal(missingScenario.response.status, 400);
  }
  const adminScenario = login.body.user.role === 'admin' ? '&scenario=signed_confirmation' : '';
  const uploaded = await request(`/api/files?folderId=${folderId}&type=quotation&filename=${encodeURIComponent('测试报价.txt')}${adminScenario}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: payload }, cookie);
  assert.equal(uploaded.response.status, 201);
  const fileId = uploaded.body.file.id;
  const downloaded = await request(`/api/files/${fileId}`, {}, cookie);
  assert.equal(downloaded.response.status, 200);
  assert.equal(downloaded.body, payload);

  const invalidExecutable = await request(`/api/files?folderId=${folderId}&type=quotation&filename=${encodeURIComponent('伪装附件.exe')}${adminScenario}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: payload }, cookie);
  assert.equal(invalidExecutable.response.status, 415);
  const mismatchedPdf = await request(`/api/files?folderId=${folderId}&type=quotation&filename=${encodeURIComponent('伪装附件.pdf')}${adminScenario}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: payload }, cookie);
  assert.equal(mismatchedPdf.response.status, 415);

  const signedAttempt = await request(`/api/files?folderId=${folderId}&type=confirmation&status=signed&filename=${encodeURIComponent('已签署确认单.pdf')}${adminScenario}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: pdfPayload }, cookie);
  if (login.body.user.role === 'admin') {
    assert.equal(signedAttempt.response.status, 201);
    assert.equal(signedAttempt.body.file.documentStatus, 'signed');
    assert.equal(signedAttempt.body.complianceScenario, 'signed_confirmation');
    const refreshed = await request('/api/folders?member=' + encodeURIComponent(testUser), {}, cookie);
    assert.equal(refreshed.body.folders.find((folder) => folder.id === folderId).complianceScenario, 'signed_confirmation');
    const changedStatus = await request(`/api/files/${signedAttempt.body.file.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'pending' }) }, cookie);
    assert.equal(changedStatus.response.status, 200);

    const scenarioOneProject = await request('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member: testUser, meetingType: 'internal', identifier: `HT-${marker}`, activityName: '内部活动测试', owner: testUser, date: '2026-08-21' }) }, cookie);
    assert.equal(scenarioOneProject.response.status, 201);
    assert.equal(scenarioOneProject.body.folder.meetingType, 'internal');
    assert.equal(scenarioOneProject.body.folder.complianceScenario, 'unclassified');
    const poEmail = await request(`/api/files?folderId=${scenarioOneProject.body.folder.id}&type=po_email&scenario=po_email&filename=${encodeURIComponent('供应商PO确认邮件.eml')}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: payload }, cookie);
    assert.equal(poEmail.response.status, 201);
    assert.equal(poEmail.body.complianceScenario, 'po_email');
    const removedScenarioOne = await request(`/api/folders/${scenarioOneProject.body.folder.id}`, { method: 'DELETE' }, cookie);
    assert.equal(removedScenarioOne.response.status, 200);
  } else {
    assert.equal(signedAttempt.response.status, 403);
    const pendingConfirmation = await request(`/api/files?folderId=${folderId}&type=confirmation&status=pending&filename=${encodeURIComponent('未签署确认单.pdf')}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: pdfPayload }, cookie);
    assert.equal(pendingConfirmation.response.status, 201);
    assert.equal(pendingConfirmation.body.file.documentStatus, 'pending');
    const forbiddenPo = await request(`/api/files?folderId=${folderId}&type=po&filename=${encodeURIComponent('采购订单.pdf')}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: pdfPayload }, cookie);
    assert.equal(forbiddenPo.response.status, 403);
    const forbiddenStatusChange = await request(`/api/files/${pendingConfirmation.body.file.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'signed' }) }, cookie);
    assert.equal(forbiddenStatusChange.response.status, 403);
  }

  const removed = await request(`/api/folders/${folderId}`, { method: 'DELETE' }, cookie);
  assert.equal(removed.response.status, 200);

  console.log('Smoke test passed: dropdown markup, deferred scenario selection, role permissions, upload/download and cleanup.');
})().catch((error) => { console.error(error); process.exit(1); });
