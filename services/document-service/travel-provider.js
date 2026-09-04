const crypto = require('crypto');

const TRAIN_API_URL = process.env.ALIYUN_TRAIN_API_URL || 'https://trainss.market.alicloudapi.com/fapigw/train/query';
const TRAIN_APPCODE = String(process.env.ALIYUN_TRAIN_APPCODE || '').trim();
const SUCCESS_CACHE_MS = Number(process.env.TRAIN_CACHE_HOURS || 24) * 60 * 60 * 1000;
const ERROR_CACHE_MS = 5 * 60 * 1000;

function text(value) { return String(value == null ? '' : value).trim(); }
function compactStation(value) {
  return text(value)
    .replace(/(?:国际)?机场.*$/i, '')
    .replace(/[TＴ]\s*\d+.*$/i, '')
    .replace(/(?:火车)?站$/u, '')
    .trim();
}
function normalizeTrainNo(value) { return text(value).replace(/\s+/g, '').toUpperCase(); }
function hhmm(value) {
  const match = text(value).match(/(?:T|\s)?(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : text(value);
}
function first(row, keys) {
  for (const key of keys) if (row && row[key] != null && text(row[key])) return row[key];
  return '';
}
function findCandidateRows(value, depth = 0) {
  if (depth > 6 || value == null) return [];
  if (Array.isArray(value)) {
    if (value.some((item) => item && typeof item === 'object' && !Array.isArray(item))) return value.filter((item) => item && typeof item === 'object');
    return value.flatMap((item) => findCandidateRows(item, depth + 1));
  }
  if (typeof value !== 'object') return [];
  const preferred = ['trains', 'train_list', 'trainList', 'list', 'result', 'data', 'records'];
  for (const key of preferred) {
    const rows = findCandidateRows(value[key], depth + 1);
    if (rows.length) return rows;
  }
  for (const nested of Object.values(value)) {
    const rows = findCandidateRows(nested, depth + 1);
    if (rows.length) return rows;
  }
  return [];
}
function normalizeTrain(row) {
  return {
    number: normalizeTrainNo(first(row, ['train_no', 'trainNo', 'train_number', 'trainNumber', 'station_train_code', 'checi', 'train_code', 'trainCode'])),
    from: text(first(row, ['departure_station', 'departureStation', 'from_station_name', 'fromStationName', 'start_station', 'startStation', 'start_station_name'])),
    to: text(first(row, ['arrival_station', 'arrivalStation', 'to_station_name', 'toStationName', 'end_station', 'endStation', 'end_station_name'])),
    departure: hhmm(first(row, ['departure_time', 'departureTime', 'start_time', 'startTime', 'from_time'])),
    arrival: hhmm(first(row, ['arrival_time', 'arrivalTime', 'arrive_time', 'arriveTime', 'end_time', 'to_time'])),
    duration: text(first(row, ['duration', 'run_time', 'runTime', 'lishi'])),
  };
}
function extractMessage(payload) {
  return text(payload?.reason || payload?.message || payload?.msg || payload?.error || payload?.result?.message || payload?.result?.msg);
}
function cacheKey(query) {
  return crypto.createHash('sha256').update(JSON.stringify(query)).digest('hex');
}

function createTrainProvider(db, fetchImpl = fetch) {
  const getCache = db.prepare('SELECT * FROM travel_api_cache WHERE cache_key=? AND expires_at>?');
  const putCache = db.prepare(`INSERT INTO travel_api_cache(cache_key,provider,request_json,response_json,status,fetched_at,expires_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET response_json=excluded.response_json,status=excluded.status,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at`);

  async function requestSchedule(input) {
    if (!TRAIN_APPCODE) throw Object.assign(new Error('高铁核验接口尚未配置'), { status: 503, code: 'TRAIN_PROVIDER_NOT_CONFIGURED' });
    const query = {
      search_type: '0',
      departure_station: compactStation(input.from),
      arrival_station: compactStation(input.to),
      date: text(input.date),
      filter: '1',
      enable_booking: '0',
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date) || !query.departure_station || !query.arrival_station) {
      throw Object.assign(new Error('高铁核验需要日期、出发站和到达站'), { status: 400 });
    }
    const key = cacheKey(query); const now = Date.now();
    const cached = getCache.get(key, new Date(now).toISOString());
    if (cached) return { payload: JSON.parse(cached.response_json), cached: true, fetchedAt: cached.fetched_at };

    const url = new URL(TRAIN_API_URL);
    Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
    let response; let payload;
    try {
      response = await fetchImpl(url, { headers: { Authorization: `APPCODE ${TRAIN_APPCODE}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      const raw = await response.text();
      try { payload = JSON.parse(raw); } catch { payload = { message: raw.slice(0, 500) }; }
    } catch (error) {
      throw Object.assign(new Error(`高铁数据服务暂时不可用：${error.message}`), { status: 502 });
    }
    const ok = response.ok && !['error', 'failed', 'fail'].includes(text(payload?.status).toLowerCase()) && !payload?.error_code;
    const fetchedAt = new Date(now).toISOString();
    putCache.run(key, 'aliyun_train', JSON.stringify(query), JSON.stringify(payload), ok ? 'ok' : 'error', fetchedAt, new Date(now + (ok ? SUCCESS_CACHE_MS : ERROR_CACHE_MS)).toISOString());
    if (!ok) throw Object.assign(new Error(extractMessage(payload) || `高铁数据服务返回 ${response.status}`), { status: 502 });
    return { payload, cached: false, fetchedAt };
  }

  async function verify(journey) {
    const response = await requestSchedule(journey);
    const rows = findCandidateRows(response.payload).map(normalizeTrain).filter((row) => row.number);
    const expected = normalizeTrainNo(journey.number);
    const match = rows.find((row) => row.number === expected) || null;
    return {
      attendeeId: text(journey.attendeeId), segment: journey.segment === 'return' ? 'return' : 'outbound', mode: 'train',
      provider: 'aliyun_train', source: { provider: 'aliyun_train', label: '阿里云市场·聚合数据', checkedAt: response.fetchedAt },
      requested: { date: text(journey.date), number: expected, from: text(journey.from), to: text(journey.to), departure: hhmm(journey.departure), arrival: hhmm(journey.arrival) },
      match, found: Boolean(match), cached: response.cached, fetchedAt: response.fetchedAt,
      warnings: match ? [] : [`未在${text(journey.date)} ${text(journey.from)}至${text(journey.to)}的计划车次中找到${expected}`],
    };
  }

  return { configured: Boolean(TRAIN_APPCODE), verify };
}

module.exports = { createTrainProvider, compactStation, normalizeTrainNo, normalizeTrain, findCandidateRows };
