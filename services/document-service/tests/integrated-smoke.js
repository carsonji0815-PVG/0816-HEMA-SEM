const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');

const mockPort = Number(process.env.MOCK_SUPABASE_PORT || 19661);
const appPort = Number(process.env.TEST_APP_PORT || 19662);
const projectId = '11111111-2222-4333-8444-555555555555';
const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const authHeaders = { Authorization: 'Bearer integration-test-token' };
let trainApiCalls = 0;
let flightApiCalls = 0;

const mock = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url.startsWith('/fapigw/train/query')) {
    trainApiCalls += 1;
    assert.equal(req.headers.authorization, 'APPCODE test-train-appcode');
    return res.end(JSON.stringify({ result: { list: [{ train_no: 'G1651', departure_station: '上海虹桥站', arrival_station: '福州南站', departure_time: '07:58', arrival_time: '13:20' }] } }));
  }
  if (req.url.startsWith('/aerodatabox/flights/number/CA8902/2026-09-04')) {
    flightApiCalls += 1; const requestUrl = new URL(req.url, `http://127.0.0.1:${mockPort}`);
    assert.equal(req.headers['x-api-market-key'], 'test-aerodatabox-key'); assert.equal(requestUrl.searchParams.get('dateLocalRole'), 'Departure');
    return res.end(JSON.stringify([{ number: 'CA8902', status: 'Expected', departure: { airport: { iata: 'PEK', name: 'Beijing Capital International Airport', municipalityName: 'Beijing' }, scheduledTime: { local: '2026-09-04 23:10+08:00', utc: '2026-09-04 15:10Z' }, terminal: '3' }, arrival: { airport: { iata: 'DLC', name: 'Dalian Zhoushuizi International Airport', municipalityName: 'Dalian' }, scheduledTime: { local: '2026-09-05 00:35+08:00', utc: '2026-09-04 16:35Z' }, terminal: '2' } }]));
  }
  if (req.url.startsWith('/auth/v1/user')) return res.end(JSON.stringify({ id: userId }));
  if (req.url.startsWith('/rest/v1/profiles')) return res.end(JSON.stringify([{ user_id: userId, display_name: 'JLL', role: 'ops' }]));
  if (req.url.startsWith('/rest/v1/meetings') && req.method === 'GET') return res.end(JSON.stringify([{ id: projectId, owner_user_id: userId }]));
  if (req.url.startsWith('/rest/v1/meetings') && req.method === 'PATCH') { res.writeHead(204); return res.end(); }
  res.writeHead(404); res.end(JSON.stringify({ error: 'not found' }));
});

function request(path, options = {}) {
  return fetch(`http://127.0.0.1:${appPort}${path}`, { ...options, headers: { ...authHeaders, ...(options.headers || {}) } });
}

(async () => {
  await new Promise((resolve) => mock.listen(mockPort, '127.0.0.1', resolve));
  const child = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, HOST: '127.0.0.1', PORT: String(appPort), SUPABASE_URL: `http://127.0.0.1:${mockPort}`, SUPABASE_ANON_KEY: 'test-anon-key', ALIYUN_TRAIN_APPCODE: 'test-train-appcode', ALIYUN_TRAIN_API_URL: `http://127.0.0.1:${mockPort}/fapigw/train/query`, FLIGHT_PROVIDER: 'aerodatabox', AERODATABOX_API_KEY: 'test-aerodatabox-key', AERODATABOX_API_URL: `http://127.0.0.1:${mockPort}/aerodatabox`, BACKUP_DIR: `${process.cwd()}/data/test-backups` }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    for (let attempt = 0; attempt < 120; attempt += 1) { try { if ((await fetch(`http://127.0.0.1:${appPort}/`)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
    await request(`/api/integrated/projects/${projectId}`, { method: 'DELETE' });
    const sync = await request(`/api/integrated/projects/${projectId}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingType: 'external', identifier: 'TEST-MEETING-001', activityName: '整合接口测试', owner: 'JLL', date: '2026-08-21' }) });
    assert.equal(sync.status, 200); const linked = await sync.json(); assert.equal(linked.user.role, 'admin'); assert.equal(linked.folder.externalProjectId, projectId); assert.equal(linked.folder.complianceScenario, 'unclassified');

    const missingScenario = await request(`/api/integrated/projects/${projectId}/documents?type=po&filename=missing.pdf`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: 'missing-scenario' });
    assert.equal(missingScenario.status, 400);

    const payload = 'signed-confirmation-content';
    const quotation = await request(`/api/integrated/projects/${projectId}/documents?type=quotation&scenario=signed_confirmation&filename=quotation.pdf`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: payload });
    assert.equal(quotation.status, 201);
    const pending = await request(`/api/integrated/projects/${projectId}/documents?type=confirmation&status=pending&scenario=signed_confirmation&filename=pending.pdf`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: payload });
    assert.equal(pending.status, 201); assert.equal((await pending.json()).archiveReady, true);
    const upload = await request(`/api/integrated/projects/${projectId}/documents?type=confirmation&status=signed&scenario=signed_confirmation&filename=${encodeURIComponent('会务确认单（已签署）.pdf')}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: payload });
    assert.equal(upload.status, 201); const uploaded = await upload.json(); assert.equal(uploaded.file.documentStatus, 'signed');

    const documents = await request(`/api/integrated/projects/${projectId}/documents`); assert.equal(documents.status, 200); const listing = await documents.json(); assert.equal(listing.folder.complianceScenario, 'signed_confirmation'); assert.equal(listing.files.length, 3);
    const status = await request(`/api/integrated/projects/${projectId}/travel/status`); assert.equal(status.status, 200); const providers = await status.json(); assert.equal(providers.train.configured, true); assert.equal(providers.flight.configured, true); assert.equal(providers.flight.providerId, 'aerodatabox');
    const stationNonce = `测试站${Date.now()}`;
    const verificationBody = { journeys: [{ attendeeId: 'a-104', segment: 'outbound', mode: 'train', date: '2026-09-11', number: 'G1651', from: stationNonce, to: '福州南站', departure: '07:58', arrival: '13:20' }, { attendeeId: 'a-105', segment: 'outbound', mode: 'flight', date: '2026-09-04', number: 'CA8902', from: '北京', to: '大连', departure: '23:10', arrival: '00:35' }, { attendeeId: 'a-106', segment: 'return', mode: 'flight', date: '2026-09-04', number: 'CA8902', from: '北京', to: '大连', departure: '23:10', arrival: '00:35' }] };
    const verification = await request(`/api/integrated/projects/${projectId}/travel/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(verificationBody) });
    assert.equal(verification.status, 200); const verified = await verification.json(); assert.equal(verified.results[0].found, true); assert.equal(verified.results[0].match.to, '福州南站'); assert.equal(verified.results[1].provider, 'aerodatabox'); assert.equal(verified.results[1].match.fromCity, '北京'); assert.equal(verified.results[1].match.from, '北京首都国际机场T3航站楼'); assert.equal(verified.results[1].match.to, '大连周水子国际机场T2航站楼'); assert.equal(verified.results[1].match.departure, '23:10'); assert.equal(verified.results[1].match.arrival, '00:35'); assert.equal(verified.results[1].match.arrivalDayOffset, 1); assert.equal(verified.results[1].source.label, 'AeroDataBox（API.Market）'); assert.match(verified.results[1].source.referenceUrl, /flightstats\.com/); assert.equal(verified.results[2].attendeeId, 'a-106'); assert.equal(verified.usage.uniqueFlightQueries, 1); assert.equal(flightApiCalls, 1);
    const cachedVerification = await request(`/api/integrated/projects/${projectId}/travel/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(verificationBody) });
    assert.equal(cachedVerification.status, 200); assert.equal((await cachedVerification.json()).usage.cacheHits, 3); assert.equal(trainApiCalls, 1); assert.equal(flightApiCalls, 1);
    const download = await request(`/api/integrated/files/${uploaded.file.id}?projectId=${projectId}`); assert.equal(download.status, 200); assert.equal(await download.text(), payload); assert.equal(download.headers.get('access-control-allow-origin'), '*');
    for (const file of listing.files) { const remove = await request(`/api/integrated/files/${file.id}?projectId=${projectId}`, { method: 'DELETE' }); assert.equal(remove.status, 200); }
    console.log('Integrated smoke passed: project link, document workflow, train verification, SQLite cache, download and delete.');
  } finally {
    child.kill('SIGTERM'); await new Promise((resolve) => mock.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
