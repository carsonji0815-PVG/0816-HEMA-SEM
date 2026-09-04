const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { db, DATA_DIR, transaction, audit } = require('./database');
const { scheduleAutomaticBackups } = require('./backup');
const { pathToFileURL } = require('url');

const PUBLIC_DIR = path.join(__dirname, 'public');
const FILES_DIR = path.join(DATA_DIR, 'files');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const DEFAULT_PASSWORD = process.env.INITIAL_PASSWORD || crypto.randomBytes(32).toString('base64url');
const SESSION_TTL_MS = 30 * 60 * 1000;
const ALLOWED_ORIGINS = new Set(String(process.env.ALLOWED_ORIGINS || 'https://139.196.97.236').split(',').map(value => value.trim()).filter(Boolean));
const ALLOWED_FILE_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.webp', '.eml', '.msg', '.txt']);
const SUPABASE_URL = String(process.env.SUPABASE_URL || 'https://bupsipicxwyeuxunkvii.supabase.co').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_grWeE2d8EPmAozkMurNRDA_GTFJC-h-';
const INTEGRATED_ADMIN_NAME = process.env.INTEGRATED_ADMIN_NAME || '季亮亮';
const INTEGRATED_ADMIN_NAMES = new Set(
  String(process.env.INTEGRATED_ADMIN_NAMES || `${INTEGRATED_ADMIN_NAME},JLL`)
    .split(',')
    .map((name) => name.trim().replace(/\s+/g, '').toUpperCase())
    .filter(Boolean)
);
const memberSeed = [
  { name: '季亮亮', role: 'admin' }, { name: '占慧', role: 'member' },
  { name: '沈祥雨', role: 'member' }, { name: '朱冰焰', role: 'member' },
  { name: '陈艳', role: 'member' }, { name: '易敏丽', role: 'member' },
  { name: '朱宸玥', role: 'member' }
];
const sessions = new Map();
// Canonical verification source lives in Journey Desk. Deploy a packaged server module
// and set TRAVEL_VERIFICATION_MODULE to its absolute index.mjs path in production.
const travelModulePath = process.env.TRAVEL_VERIFICATION_MODULE || path.join(__dirname, '../行程管理工具/modules/travel-verification/server/index.mjs');
let travelModulePromise;
function loadTravelModule() {
  if (!fs.existsSync(travelModulePath)) throw Object.assign(new Error('新版行程核验服务尚未部署，请配置 TRAVEL_VERIFICATION_MODULE'), { status: 503 });
  return travelModulePromise ||= import(pathToFileURL(travelModulePath).href).then(module => module.createTravelProviders(db));
}

async function getTravelQuotaPolicy(authHeaders) {
  const configUrl = new URL(`${SUPABASE_URL}/rest/v1/system_configuration`);
  configUrl.searchParams.set('select', 'settings'); configUrl.searchParams.set('singleton', 'eq.true'); configUrl.searchParams.set('limit', '1');
  try {
    const response = await fetch(configUrl, { headers: { ...authHeaders, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return {};
    const settings = (await response.json())?.[0]?.settings || {};
    return { flightGlobalEnabled: settings.variflightGlobalEnabled === true, flightUnlimited: settings.variflightUnlimited === true, flightDailyLimit: Math.max(1, Math.min(10000, Math.trunc(Number(settings.variflightDailyLimit) || 5))) };
  } catch { return {}; }
}

function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function safeEqual(a, b) { const x = Buffer.from(a, 'hex'); const y = Buffer.from(b, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); }

function ensureData() {
  fs.mkdirSync(FILES_DIR, { recursive: true });
  const insert = db.prepare('INSERT OR IGNORE INTO users(name,role,salt,password_hash,must_change_password,sort_order,created_at) VALUES(?,?,?,?,?,?,?)');
  transaction(() => memberSeed.forEach((member, index) => {
    const salt = crypto.randomBytes(16).toString('hex');
    insert.run(member.name, member.role, salt, hashPassword(DEFAULT_PASSWORD, salt), 1, index, new Date().toISOString());
    fs.mkdirSync(path.join(FILES_DIR, member.name), { recursive: true });
  }));
}

function mapUser(row) { return row && { name: row.name, role: row.role, salt: row.salt, passwordHash: row.password_hash, mustChangePassword: Boolean(row.must_change_password) }; }
function publicUser(user) { return { name: user.name, role: user.role, mustChangePassword: user.mustChangePassword }; }
function mapFolder(row) { return { id: row.id, member: row.member, meetingType: row.meeting_type, identifier: row.identifier, activityName: row.activity_name, complianceScenario: row.compliance_scenario, owner: row.owner, date: row.meeting_date, name: row.name, createdBy: row.created_by, createdAt: row.created_at, externalProjectId: row.external_project_id || null }; }
function mapFile(row, includeStorage = false) {
  const file = { id: row.id, folderId: row.folder_id, name: row.name, type: row.type, typeLabel: row.type_label, documentStatus: row.document_status, size: row.size, uploadedBy: row.uploaded_by, uploadedAt: row.uploaded_at, statusUpdatedBy: row.status_updated_by, statusUpdatedAt: row.status_updated_at };
  if (includeStorage) file.storageName = row.storage_name;
  return file;
}
function getUserByName(name) { return mapUser(db.prepare('SELECT * FROM users WHERE name=?').get(name)); }
function json(res, status, data, headers = {}) { const body = JSON.stringify(data); res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...headers }); res.end(body); }
function error(res, status, message) { json(res, status, { error: message }); }
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((part) => { const i = part.indexOf('='); return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1))]; })); }
function getUser(req) {
  const token = parseCookies(req).lilly_session;
  if (!token || !sessions.has(token)) return null;
  const session = sessions.get(token);
  if (session.expiresAt < Date.now()) { sessions.delete(token); return null; }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return getUserByName(session.name);
}
async function readBody(req, max = 1024 * 1024) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > max) throw Object.assign(new Error('请求内容过大'), { status: 413 }); chunks.push(chunk); } return Buffer.concat(chunks); }
async function readJsonBody(req) { const raw = await readBody(req); try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { throw Object.assign(new Error('请求格式不正确'), { status: 400 }); } }
function cleanSegment(value, fieldName) { const text = String(value || '').trim(); if (!text) throw Object.assign(new Error(`请填写${fieldName}`), { status: 400 }); if (text.length > 80 || /[\\/:*?"<>|\u0000-\u001f]/.test(text) || text === '.' || text === '..') throw Object.assign(new Error(`${fieldName}包含不允许的字符`), { status: 400 }); return text.replace(/\s+/g, ' '); }
function canManage(user, member) { return user.role === 'admin' || user.name === member; }
function parseUrl(req) { return new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
function contentDisposition(filename) { const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_'); return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`; }
function isTextFile(data) { return !data.subarray(0, Math.min(data.length, 8192)).includes(0); }
function hasAllowedSignature(extension, data) {
  if (extension === '.pdf') return data.subarray(0, 5).toString('ascii') === '%PDF-';
  if (extension === '.png') return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (extension === '.jpg' || extension === '.jpeg') return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (extension === '.webp') return data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP';
  if (extension === '.docx' || extension === '.xlsx') return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && [0x03,0x05,0x07].includes(data[2]) && [0x04,0x06,0x08].includes(data[3]);
  if (extension === '.doc' || extension === '.xls' || extension === '.msg') return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]));
  if (extension === '.csv' || extension === '.eml' || extension === '.txt') return isTextFile(data);
  return false;
}
function validateUpload(filename, data) {
  const extension = path.extname(filename).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) throw Object.assign(new Error('仅支持 PDF、Office 文档、CSV、图片、邮件或纯文本文件'), { status: 415 });
  if (!hasAllowedSignature(extension, data)) throw Object.assign(new Error('文件内容与扩展名不一致，已拒绝上传'), { status: 415 });
}
function serveStatic(req, res, pathname) { const target = pathname === '/' ? '/index.html' : pathname; const file = path.resolve(PUBLIC_DIR, `.${target}`); if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false; const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' }; const body = fs.readFileSync(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-cache' }); res.end(body); return true; }

function ensureIntegratedIdentity(name, isAdmin = false) {
  const displayName = cleanSegment(name, '成员姓名');
  if (getUserByName(displayName)) return getUserByName(displayName);
  const salt = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO users(name,role,salt,password_hash,must_change_password,sort_order,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(displayName, isAdmin ? 'admin' : 'member', salt, hashPassword(crypto.randomBytes(32).toString('hex'), salt), 0, 999, new Date().toISOString());
  fs.mkdirSync(path.join(FILES_DIR, displayName), { recursive: true });
  return getUserByName(displayName);
}

function isIntegratedAdmin(name) {
  return INTEGRATED_ADMIN_NAMES.has(String(name || '').trim().replace(/\s+/g, '').toUpperCase());
}

async function getIntegratedMembership(req, projectId) {
  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('请先登录行程管理系统'), { status: 401 });
  const headers = { Authorization: authorization, apikey: SUPABASE_ANON_KEY };
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
  if (!userResponse.ok) throw Object.assign(new Error('行程系统登录已过期'), { status: 401 });
  const authUser = await userResponse.json();
  const profileUrl = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
  profileUrl.searchParams.set('select', 'user_id,display_name,role');
  profileUrl.searchParams.set('user_id', `eq.${authUser.id}`);
  profileUrl.searchParams.set('limit', '1');
  const projectUrl = new URL(`${SUPABASE_URL}/rest/v1/meetings`);
  projectUrl.searchParams.set('select', 'id,owner_user_id');
  projectUrl.searchParams.set('id', `eq.${projectId}`);
  projectUrl.searchParams.set('limit', '1');
  const [profileResponse, projectResponse] = await Promise.all([
    fetch(profileUrl, { headers: { ...headers, Accept: 'application/json' } }),
    fetch(projectUrl, { headers: { ...headers, Accept: 'application/json' } })
  ]);
  if (!profileResponse.ok || !projectResponse.ok) throw Object.assign(new Error('无法核验项目权限'), { status: 403 });
  const [profile] = await profileResponse.json(); const [project] = await projectResponse.json();
  if (!profile || !project) throw Object.assign(new Error('无权管理该项目'), { status: 403 });
  const integratedUser = { id: authUser.id, name: profile.display_name, projectRole: 'ops', role: isIntegratedAdmin(profile.display_name) ? 'admin' : 'member' };
  ensureIntegratedIdentity(integratedUser.name, integratedUser.role === 'admin');
  return integratedUser;
}

function integratedFolder(projectId) { const row = db.prepare('SELECT * FROM folders WHERE external_project_id=?').get(projectId); return row && mapFolder(row); }
function integratedFiles(folderId) { return db.prepare('SELECT * FROM files WHERE folder_id=? ORDER BY uploaded_at DESC').all(folderId).map((file) => mapFile(file)); }

async function syncArchiveGate(authorization, projectId, folderId) {
  const files = integratedFiles(folderId); const ready = files.some((file) => file.type === 'quotation') && files.some((file) => file.type === 'confirmation' && file.documentStatus === 'pending');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/meetings?id=eq.${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    headers: { Authorization: authorization, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ archive_ready: ready })
  });
  if (!response.ok) throw Object.assign(new Error('无法同步项目归档状态'), { status: 502 });
  return ready;
}

async function handleIntegratedApi(req, res, url) {
  const { pathname, searchParams } = url;
  const projectRootRoute = pathname.match(/^\/api\/integrated\/projects\/([0-9a-f-]{36})$/);
  if (projectRootRoute && req.method === 'DELETE') {
    const projectId = projectRootRoute[1]; const user = await getIntegratedMembership(req, projectId); const folder = integratedFolder(projectId);
    if (!folder) return json(res, 200, { ok: true });
    transaction(() => { audit(user.name, 'integrated_project_deleted', 'folder', folder.id, { projectId, name: folder.name }); db.prepare('DELETE FROM folders WHERE id=?').run(folder.id); });
    fs.rmSync(path.join(FILES_DIR, folder.member, folder.id), { recursive: true, force: true });
    return json(res, 200, { ok: true });
  }
  const travelRoute = pathname.match(/^\/api\/integrated\/projects\/([0-9a-f-]{36})\/travel\/(status|verify)$/);
  if (travelRoute) {
    const projectId = travelRoute[1]; const action = travelRoute[2]; const user = await getIntegratedMembership(req, projectId);
    // Authorize with the roster's server-side role function, never a display name.
    const authorization = String(req.headers.authorization || '');
    const authHeaders = { Authorization: authorization, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    const permission = await fetch(`${SUPABASE_URL}/rest/v1/rpc/can_manage_project`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ target_meeting: projectId }), signal: AbortSignal.timeout(15000) });
    if (!permission.ok || await permission.json() !== true) return error(res, 403, '只有本项目会务负责人或超级管理员可以核验行程');
    const verifier = await loadTravelModule();
    const quotaPolicy = await getTravelQuotaPolicy(authHeaders);
    if (action === 'status' && req.method === 'GET') return json(res, 200, verifier.status(quotaPolicy));
    if (action === 'verify' && req.method === 'POST') {
      const body = await readJsonBody(req); const journeys = body.journeys;
      if (!Array.isArray(journeys) || !journeys.length || journeys.length > 200 || journeys.some(j => !j || !/^[0-9a-f-]{36}$/i.test(j.attendeeId || '') || !/^(outbound|return)(:[a-zA-Z0-9-]{8,80})?$/.test(j.segment || ''))) return error(res, 400, '请提交当前名单内有效的行程记录');
      // Validate the selected roster version before consuming provider quota.
      const ids = [...new Set(journeys.map(j => j.attendeeId))];
      const rosterUrl = new URL(`${SUPABASE_URL}/rest/v1/attendees`);
      rosterUrl.searchParams.set('meeting_id', `eq.${projectId}`); rosterUrl.searchParams.set('id', `in.(${ids.join(',')})`);
      rosterUrl.searchParams.set('select', 'id,business_status,custom_fields,depart_city,depart_transport_type,arrive_date,arrive_city,return_depart_city,return_depart_transport_type,return_arrive_date,return_arrive_city,out_date,out_from,out_to,out_no,out_departure,out_arrival,return_date,return_from,return_to,return_no,return_departure,return_arrival');
      const rosterResponse = await fetch(rosterUrl, { headers: authHeaders, signal: AbortSignal.timeout(15000) });
      if (!rosterResponse.ok) return error(res, 403, '无法读取本项目名单，未调用数据源');
      const roster = await rosterResponse.json();
      const mapping = {date:'date',from:'from',to:'to',number:'no',departure:'departure',arrival:'arrival'};
      const stale = journeys.some(j => {
        const row = roster.find(a => a.id === j.attendeeId), extraId=String(j.segment).includes(':')?String(j.segment).split(':').slice(1).join(':'):'',prefix = String(j.segment).startsWith('return') ? 'return' : 'out';
        const extra=extraId?(row?.custom_fields?._journeySegments||[]).find(item=>String(item.id)===extraId):null;
        const extraMapping={date:'departDate',from:'departStation',to:'arriveStation',number:'number',departure:'departure',arrival:'arrival'};
        const detailValues=extra?{departCity:extra.departCity,departTransportType:extra.transportType,arriveDate:extra.arriveDate,arriveCity:extra.arriveCity}:prefix==='return'?{departCity:row?.return_depart_city,departTransportType:row?.return_depart_transport_type,arriveDate:row?.return_arrive_date,arriveCity:row?.return_arrive_city}:{departCity:row?.depart_city,departTransportType:row?.depart_transport_type,arriveDate:row?.arrive_date,arriveCity:row?.arrive_city};
        return !row || row.business_status === 'cancelled' || (extraId&&!extra) || ['departCity','departTransportType','arriveDate','arriveCity'].some(key=>String(j[key]||'').trim()!==String(detailValues[key]||'').trim()) || Object.entries(mapping).some(([key,column]) => {
          const value = String(extra?extra[extraMapping[key]]:row[`${prefix}_${column}`] || '').trim();
          return String(j[key] || '').trim() !== (['departure','arrival'].includes(key) ? value.slice(0,5) : value);
        });
      });
      if (stale) return error(res, 409, '名单已更新或记录不属于本项目，请刷新后重试；未调用数据源');
      const result = await verifier.verifyBatch(journeys, { allowPaid: body.allowPaid === true, ...quotaPolicy });
      audit(user.name, 'integrated_travel_verified', 'project', projectId, { submitted: journeys.length, cacheHits: result.usage.cacheHits, manualReviewOnly: true });
      return json(res, 200, result);
    }
  }
  const projectRoute = pathname.match(/^\/api\/integrated\/projects\/([0-9a-f-]{36})\/(sync|documents)$/);
  if (projectRoute) {
    const projectId = projectRoute[1]; const action = projectRoute[2]; const user = await getIntegratedMembership(req, projectId);
    if (action === 'sync' && req.method === 'POST') {
      if (!['ops', 'client'].includes(user.projectRole)) return error(res, 403, '只有项目负责人可以同步项目资料');
      const body = await readJsonBody(req); const meetingType = body.meetingType === 'internal' ? 'internal' : 'external';
      const identifier = cleanSegment(body.identifier, meetingType === 'internal' ? '合同编号' : '会议编码'); const activityName = cleanSegment(body.activityName, '活动名称'); const owner = cleanSegment(body.owner, '活动负责人');
      const date = String(body.date || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00`))) return error(res, 400, '请选择有效的活动日期');
      let folder = integratedFolder(projectId); const name = `${identifier}_${owner}_${date}`;
      if (!folder) {
        const storageMember = getUserByName(owner) ? owner : user.name; const matching = db.prepare('SELECT * FROM folders WHERE member=? AND name=? AND external_project_id IS NULL').get(storageMember, name);
        if (matching) { db.prepare('UPDATE folders SET external_project_id=?,activity_name=?,meeting_type=?,identifier=?,owner=?,meeting_date=? WHERE id=?').run(projectId, activityName, meetingType, identifier, owner, date, matching.id); folder = integratedFolder(projectId); }
        else {
          const id = crypto.randomUUID(); const createdAt = new Date().toISOString(); fs.mkdirSync(path.join(FILES_DIR, storageMember, id), { recursive: true });
          db.prepare('INSERT INTO folders(id,member,meeting_type,identifier,activity_name,compliance_scenario,owner,meeting_date,name,created_by,created_at,external_project_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id, storageMember, meetingType, identifier, activityName, 'unclassified', owner, date, name, user.name, createdAt, projectId); folder = integratedFolder(projectId);
        }
        audit(user.name, 'integrated_project_linked', 'folder', folder.id, { projectId, name });
      } else {
        db.prepare('UPDATE folders SET meeting_type=?,identifier=?,activity_name=?,owner=?,meeting_date=?,name=? WHERE id=?').run(meetingType, identifier, activityName, owner, date, name, folder.id); folder = integratedFolder(projectId);
      }
      return json(res, 200, { folder, files: integratedFiles(folder.id), user: { name: user.name, role: user.role } });
    }
    if (action === 'documents' && req.method === 'GET') {
      const folder = integratedFolder(projectId); return json(res, 200, { folder, files: folder ? integratedFiles(folder.id) : [], user: { name: user.name, role: user.role } });
    }
    if (action === 'documents' && req.method === 'POST') {
      const folder = integratedFolder(projectId); if (!folder) return error(res, 409, '请先完善并同步项目基本资料');
      const type = searchParams.get('type'); const requestedStatus = searchParams.get('status'); const requestedScenario = searchParams.get('scenario'); const allowedTypes = { quotation: '报价', confirmation: '会务确认单', po: '采购订单（PO）', po_email: '供应商PO确认邮件', other: '其他' }; if (!allowedTypes[type]) return error(res, 400, '请选择正确的文件类型'); const filename = cleanSegment(searchParams.get('filename'), '文件名');
      const effectiveScenario = user.role === 'admin' && ['po_email', 'signed_confirmation'].includes(requestedScenario) ? requestedScenario : folder.complianceScenario;
      if (user.role === 'admin' && !['po_email', 'signed_confirmation'].includes(requestedScenario)) return error(res, 400, '管理员上传文件前请选择场景一或场景二');
      if (user.role !== 'admin' && !['quotation', 'confirmation'].includes(type)) return error(res, 403, '成员只能上传报价和未签署会务确认单');
      if (user.role !== 'admin' && type === 'confirmation' && requestedStatus === 'signed') return error(res, 403, '已签署会务确认单由管理员上传');
      if (type === 'po_email' && effectiveScenario !== 'po_email') return error(res, 400, '场景二不需要供应商 PO 确认邮件');
      if (type === 'confirmation' && requestedStatus === 'signed' && effectiveScenario !== 'signed_confirmation') return error(res, 400, '场景一的最终材料应为供应商 PO 确认邮件');
      if (Number(req.headers['content-length'] || 0) > MAX_FILE_SIZE) return error(res, 413, '单个文件不能超过 50MB'); const data = await readBody(req, MAX_FILE_SIZE); if (!data.length) return error(res, 400, '文件内容为空'); validateUpload(filename, data);
      const storageName = `${crypto.randomUUID()}${path.extname(filename).slice(0, 16)}`; const diskPath = path.join(FILES_DIR, folder.member, folder.id, storageName); fs.writeFileSync(diskPath, data, { mode: 0o600 }); const documentStatus = type === 'confirmation' && user.role === 'admin' && requestedStatus === 'signed' ? 'signed' : (type === 'confirmation' ? 'pending' : null); const file = { id: crypto.randomUUID(), folderId: folder.id, name: filename, type, typeLabel: allowedTypes[type], documentStatus, size: data.length, uploadedBy: user.name, uploadedAt: new Date().toISOString(), storageName };
      try { transaction(() => { if (user.role === 'admin' && folder.complianceScenario !== effectiveScenario) db.prepare('UPDATE folders SET compliance_scenario=? WHERE id=?').run(effectiveScenario, folder.id); db.prepare('INSERT INTO files(id,folder_id,name,type,type_label,document_status,size,uploaded_by,uploaded_at,storage_name) VALUES(?,?,?,?,?,?,?,?,?,?)').run(file.id, folder.id, filename, type, file.typeLabel, documentStatus, file.size, user.name, file.uploadedAt, storageName); audit(user.name, 'integrated_file_uploaded', 'file', file.id, { projectId, type, documentStatus, complianceScenario: effectiveScenario }); }); } catch (err) { fs.rmSync(diskPath, { force: true }); throw err; }
      const archiveReady = await syncArchiveGate(String(req.headers.authorization || ''), projectId, folder.id); const { storageName: _, ...publicFile } = file; return json(res, 201, { file: publicFile, complianceScenario: effectiveScenario, archiveReady });
    }
  }
  const fileRoute = pathname.match(/^\/api\/integrated\/files\/([0-9a-f-]+)$/);
  if (fileRoute) {
    const projectId = searchParams.get('projectId'); if (!/^[0-9a-f-]{36}$/.test(projectId || '')) return error(res, 400, '缺少项目编号'); const user = await getIntegratedMembership(req, projectId);
    const row = db.prepare('SELECT f.*,d.member AS folder_member,d.external_project_id FROM files f JOIN folders d ON d.id=f.folder_id WHERE f.id=?').get(fileRoute[1]); if (!row || row.external_project_id !== projectId) return error(res, 404, '文件不存在');
    if (req.method === 'GET') { const diskPath = path.join(FILES_DIR, row.folder_member, row.folder_id, row.storage_name); if (!fs.existsSync(diskPath)) return error(res, 404, '文件内容已丢失'); audit(user.name, 'integrated_file_downloaded', 'file', row.id, { projectId, name: row.name }); const stat = fs.statSync(diskPath); res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': stat.size, 'Content-Disposition': contentDisposition(row.name) }); return fs.createReadStream(diskPath).pipe(res); }
    if (req.method === 'DELETE') { const memberMayDelete = row.uploaded_by === user.name && (row.type === 'quotation' || (row.type === 'confirmation' && row.document_status !== 'signed')); if (user.role !== 'admin' && !memberMayDelete) return error(res, 403, '最终采购材料只能由管理员删除'); transaction(() => { audit(user.name, 'integrated_file_deleted', 'file', row.id, { projectId, name: row.name }); db.prepare('DELETE FROM files WHERE id=?').run(row.id); }); fs.rmSync(path.join(FILES_DIR, row.folder_member, row.folder_id, row.storage_name), { force: true }); const archiveReady = await syncArchiveGate(String(req.headers.authorization || ''), projectId, row.folder_id); return json(res, 200, { ok: true, archiveReady }); }
  }
  return error(res, 404, '整合接口不存在');
}

async function handleApi(req, res, url) {
  const { pathname, searchParams } = url;
  if (pathname.startsWith('/api/integrated/')) return handleIntegratedApi(req, res, url);
  if (pathname === '/api/login' && req.method === 'POST') {
    const { name, password } = await readJsonBody(req); const loginName = String(name || '').trim(); const user = getUserByName(loginName);
    if (!user || !safeEqual(hashPassword(String(password || ''), user.salt), user.passwordHash)) { audit(loginName || '未知', 'login_failed', 'user', loginName); return error(res, 401, '姓名或密码不正确'); }
    const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { name: user.name, expiresAt: Date.now() + SESSION_TTL_MS }); audit(user.name, 'login', 'user', user.name);
    return json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': `lilly_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800` });
  }
  const user = getUser(req); if (!user) return error(res, 401, '请先登录');
  if (user.mustChangePassword && !['/api/me', '/api/logout', '/api/change-password'].includes(pathname)) return error(res, 428, '首次登录必须先修改初始密码');
  if (pathname === '/api/me' && req.method === 'GET') return json(res, 200, { user: publicUser(user) });
  if (pathname === '/api/logout' && req.method === 'POST') { const token = parseCookies(req).lilly_session; if (token) sessions.delete(token); audit(user.name, 'logout', 'user', user.name); return json(res, 200, { ok: true }, { 'Set-Cookie': 'lilly_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); }
  if (pathname === '/api/change-password' && req.method === 'POST') {
    const { currentPassword, newPassword } = await readJsonBody(req);
    if (!safeEqual(hashPassword(String(currentPassword || ''), user.salt), user.passwordHash)) return error(res, 400, '当前密码不正确');
    if (typeof newPassword !== 'string' || newPassword.length < 12 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) return error(res, 400, '新密码至少 12 位，并包含大小写字母、数字和特殊字符');
    const salt = crypto.randomBytes(16).toString('hex'); db.prepare('UPDATE users SET salt=?,password_hash=?,must_change_password=0 WHERE name=?').run(salt, hashPassword(newPassword, salt), user.name); audit(user.name, 'password_changed', 'user', user.name); return json(res, 200, { ok: true });
  }
  if (pathname === '/api/members' && req.method === 'GET') { const rows = user.role === 'admin' ? db.prepare('SELECT name,role FROM users ORDER BY sort_order').all() : db.prepare('SELECT name,role FROM users WHERE name=?').all(user.name); return json(res, 200, { members: rows }); }
  if (pathname === '/api/audit' && req.method === 'GET') { if (user.role !== 'admin') return error(res, 403, '仅管理员可查看操作日志'); const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') || 100))); return json(res, 200, { logs: db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit) }); }
  if (pathname === '/api/folders' && req.method === 'GET') {
    const requested = searchParams.get('member') || user.name; if (!canManage(user, requested) || !db.prepare('SELECT 1 FROM users WHERE name=?').get(requested)) return error(res, 403, '无权查看该成员空间');
    const folderRows = db.prepare('SELECT * FROM folders WHERE member=? ORDER BY created_at DESC').all(requested); const fileQuery = db.prepare('SELECT * FROM files WHERE folder_id=? ORDER BY uploaded_at DESC');
    return json(res, 200, { member: requested, folders: folderRows.map((row) => ({ ...mapFolder(row), files: fileQuery.all(row.id).map((file) => mapFile(file)) })) });
  }
  if (pathname === '/api/folders' && req.method === 'POST') {
    const body = await readJsonBody(req); const member = cleanSegment(body.member || user.name, '所属成员'); if (!db.prepare('SELECT 1 FROM users WHERE name=?').get(member)) return error(res, 400, '所属成员不在部门名单中'); if (!canManage(user, member)) return error(res, 403, '无权在该成员空间新建文件夹');
    const meetingType = body.meetingType === 'internal' ? 'internal' : 'external';
    const identifier = cleanSegment(body.identifier, meetingType === 'internal' ? '合同编号' : '会议编码');
    const activityName = cleanSegment(body.activityName, '活动名称');
    const complianceScenario = 'unclassified';
    const owner = cleanSegment(body.owner, '活动负责人'); const date = String(body.date || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00`))) return error(res, 400, '请选择有效的活动日期');
    const name = `${identifier}_${owner}_${date}`; if (db.prepare('SELECT 1 FROM folders WHERE member=? AND name=?').get(member, name)) return error(res, 409, '该项目文件夹已存在'); const folder = { id: crypto.randomUUID(), member, meetingType, identifier, activityName, complianceScenario, owner, date, name, createdBy: user.name, createdAt: new Date().toISOString() };
    fs.mkdirSync(path.join(FILES_DIR, member, folder.id), { recursive: true }); transaction(() => { db.prepare('INSERT INTO folders(id,member,meeting_type,identifier,activity_name,compliance_scenario,owner,meeting_date,name,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(folder.id, member, meetingType, identifier, activityName, complianceScenario, owner, date, name, user.name, folder.createdAt); audit(user.name, 'folder_created', 'folder', folder.id, { member, name, activityName, complianceScenario }); }); return json(res, 201, { folder });
  }
  const folderDelete = pathname.match(/^\/api\/folders\/([0-9a-f-]+)$/);
  if (folderDelete && req.method === 'DELETE') { const row = db.prepare('SELECT * FROM folders WHERE id=?').get(folderDelete[1]); if (!row) return error(res, 404, '文件夹不存在'); const folder = mapFolder(row); if (!canManage(user, folder.member)) return error(res, 403, '无权删除该文件夹'); const hasProtectedFiles = db.prepare("SELECT 1 FROM files WHERE folder_id=? AND (uploaded_by<>? OR type NOT IN ('quotation','confirmation') OR (type='confirmation' AND document_status='signed')) LIMIT 1").get(folder.id, user.name); if (user.role !== 'admin' && hasProtectedFiles) return error(res, 403, '该项目已包含最终采购材料，请联系管理员删除'); transaction(() => { audit(user.name, 'folder_deleted', 'folder', folder.id, { member: folder.member, name: folder.name }); db.prepare('DELETE FROM folders WHERE id=?').run(folder.id); }); fs.rmSync(path.join(FILES_DIR, folder.member, folder.id), { recursive: true, force: true }); return json(res, 200, { ok: true }); }
  if (pathname === '/api/files' && req.method === 'POST') {
    const folderId = searchParams.get('folderId'); const type = searchParams.get('type'); const requestedStatus = searchParams.get('status'); const requestedScenario = searchParams.get('scenario'); const allowedTypes = { quotation: '报价', confirmation: '会务确认单', po: '采购订单（PO）', po_email: '供应商PO确认邮件', other: '其他' }; if (!allowedTypes[type]) return error(res, 400, '请选择正确的文件类型'); const filename = cleanSegment(searchParams.get('filename'), '文件名'); const folderRow = db.prepare('SELECT * FROM folders WHERE id=?').get(folderId); if (!folderRow) return error(res, 404, '文件夹不存在'); const folder = mapFolder(folderRow); if (!canManage(user, folder.member)) return error(res, 403, '无权上传到该文件夹');
    const effectiveScenario = user.role === 'admin' && ['po_email', 'signed_confirmation'].includes(requestedScenario) ? requestedScenario : folder.complianceScenario;
    if (user.role === 'admin' && !['po_email', 'signed_confirmation'].includes(requestedScenario)) return error(res, 400, '管理员上传文件前请选择场景一或场景二');
    if (user.role !== 'admin' && !['quotation', 'confirmation'].includes(type)) return error(res, 403, '成员只能上传报价和未签署会务确认单');
    if (user.role !== 'admin' && type === 'confirmation' && requestedStatus === 'signed') return error(res, 403, '已签署会务确认单由管理员上传');
    if (type === 'po_email' && effectiveScenario !== 'po_email') return error(res, 400, '场景二不需要供应商 PO 确认邮件');
    if (type === 'confirmation' && requestedStatus === 'signed' && effectiveScenario !== 'signed_confirmation') return error(res, 400, '场景一的最终材料应为供应商 PO 确认邮件');
    if (Number(req.headers['content-length'] || 0) > MAX_FILE_SIZE) return error(res, 413, '单个文件不能超过 50MB'); const data = await readBody(req, MAX_FILE_SIZE); if (!data.length) return error(res, 400, '文件内容为空'); validateUpload(filename, data);
    const storageName = `${crypto.randomUUID()}${path.extname(filename).slice(0, 16)}`; const diskPath = path.join(FILES_DIR, folder.member, folder.id, storageName); fs.writeFileSync(diskPath, data, { mode: 0o600 }); const documentStatus = type === 'confirmation' && user.role === 'admin' && requestedStatus === 'signed' ? 'signed' : (type === 'confirmation' ? 'pending' : null); const file = { id: crypto.randomUUID(), folderId, name: filename, type, typeLabel: allowedTypes[type], documentStatus, size: data.length, uploadedBy: user.name, uploadedAt: new Date().toISOString(), storageName };
    try { transaction(() => { if (user.role === 'admin' && folder.complianceScenario !== effectiveScenario) { db.prepare('UPDATE folders SET compliance_scenario=? WHERE id=?').run(effectiveScenario, folderId); audit(user.name, 'folder_scenario_changed', 'folder', folderId, { from: folder.complianceScenario, to: effectiveScenario }); } db.prepare('INSERT INTO files(id,folder_id,name,type,type_label,document_status,size,uploaded_by,uploaded_at,storage_name) VALUES(?,?,?,?,?,?,?,?,?,?)').run(file.id, folderId, filename, type, file.typeLabel, documentStatus, file.size, user.name, file.uploadedAt, storageName); audit(user.name, 'file_uploaded', 'file', file.id, { folderId, name: filename, type, documentStatus, complianceScenario: effectiveScenario }); }); } catch (err) { fs.rmSync(diskPath, { force: true }); throw err; } const { storageName: _, ...publicFile } = file; return json(res, 201, { file: publicFile, complianceScenario: effectiveScenario });
  }
  const fileRoute = pathname.match(/^\/api\/files\/([0-9a-f-]+)$/);
  const getFileAndFolder = (id) => db.prepare('SELECT f.*, d.member AS folder_member FROM files f JOIN folders d ON d.id=f.folder_id WHERE f.id=?').get(id);
  if (fileRoute && req.method === 'PATCH') { const { status } = await readJsonBody(req); if (!['signed', 'pending'].includes(status)) return error(res, 400, '文件状态不正确'); const row = db.prepare('SELECT f.*, d.member AS folder_member, d.compliance_scenario FROM files f JOIN folders d ON d.id=f.folder_id WHERE f.id=?').get(fileRoute[1]); if (!row) return error(res, 404, '文件不存在'); if (user.role !== 'admin') return error(res, 403, '只有管理员可修改会务确认单签署状态'); if (row.type !== 'confirmation') return error(res, 400, '只有会务确认单可修改签署状态'); if (status === 'signed' && row.compliance_scenario !== 'signed_confirmation') return error(res, 400, '场景一项目不使用已签署会务确认单作为最终材料'); if (status === 'signed' && row.uploaded_by !== user.name) return error(res, 400, '成员上传的是未签署版本，请由管理员另行上传已签署会务确认单'); const now = new Date().toISOString(); transaction(() => { db.prepare('UPDATE files SET document_status=?,status_updated_by=?,status_updated_at=? WHERE id=?').run(status, user.name, now, row.id); audit(user.name, 'file_status_changed', 'file', row.id, { status }); }); return json(res, 200, { ok: true, status }); }
  if (fileRoute && req.method === 'GET') { const row = getFileAndFolder(fileRoute[1]); if (!row) return error(res, 404, '文件不存在'); if (!canManage(user, row.folder_member)) return error(res, 403, '无权下载该文件'); const diskPath = path.join(FILES_DIR, row.folder_member, row.folder_id, row.storage_name); if (!fs.existsSync(diskPath)) return error(res, 404, '文件内容已丢失'); audit(user.name, 'file_downloaded', 'file', row.id, { name: row.name }); const stat = fs.statSync(diskPath); res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': stat.size, 'Content-Disposition': contentDisposition(row.name) }); return fs.createReadStream(diskPath).pipe(res); }
  if (fileRoute && req.method === 'DELETE') { const row = getFileAndFolder(fileRoute[1]); if (!row) return error(res, 404, '文件不存在'); if (!canManage(user, row.folder_member)) return error(res, 403, '无权删除该文件'); const memberMayDelete = row.uploaded_by === user.name && (row.type === 'quotation' || (row.type === 'confirmation' && row.document_status !== 'signed')); if (user.role !== 'admin' && !memberMayDelete) return error(res, 403, '最终采购材料只能由管理员删除'); transaction(() => { audit(user.name, 'file_deleted', 'file', row.id, { name: row.name, folderId: row.folder_id }); db.prepare('DELETE FROM files WHERE id=?').run(row.id); }); fs.rmSync(path.join(FILES_DIR, row.folder_member, row.folder_id, row.storage_name), { force: true }); return json(res, 200, { ok: true }); }
  return error(res, 404, '接口不存在');
}

ensureData();
scheduleAutomaticBackups();
const server = http.createServer(async (req, res) => { try { const url = parseUrl(req); if (url.pathname.startsWith('/api/integrated/')) { const origin = String(req.headers.origin || ''); if (origin && !ALLOWED_ORIGINS.has(origin)) return error(res, 403, '来源不受信任'); if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); } res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS'); if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); } } if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url); if (req.method === 'GET' && serveStatic(req, res, url.pathname)) return; error(res, 404, '页面不存在'); } catch (err) { console.error(err); if (!res.headersSent) error(res, err.status || 500, err.status ? err.message : '服务器内部错误'); else res.destroy(); } });
server.listen(PORT, HOST, () => { console.log('礼来会务文件系统已启动（SQLite）：'); console.log(`  本机访问：http://127.0.0.1:${PORT}`); let addresses=[]; try { addresses=Object.values(os.networkInterfaces()).flat().filter((item) => item && item.family === 'IPv4' && !item.internal); } catch {} for (const address of addresses) console.log(`  局域网访问：http://${address.address}:${PORT}`); });
module.exports = server;
