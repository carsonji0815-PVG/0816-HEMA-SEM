const crypto = require('crypto');

const JUHE_API_URL = process.env.JUHE_FLIGHT_API_URL || 'https://v.juhe.cn/flight_dynamic/query';
const JUHE_API_KEY = String(process.env.JUHE_FLIGHT_API_KEY || '').trim();
const AERODATABOX_API_URL = String(process.env.AERODATABOX_API_URL || 'https://prod.api.market/api/v1/aedbx/aerodatabox').replace(/\/$/, '');
const AERODATABOX_API_KEY = String(process.env.AERODATABOX_API_KEY || '').trim();
const FLIGHT_PROVIDER = String(process.env.FLIGHT_PROVIDER || (AERODATABOX_API_KEY ? 'aerodatabox' : 'juhe')).trim().toLowerCase();
const SUCCESS_CACHE_MS = Number(process.env.FLIGHT_CACHE_HOURS || 12) * 60 * 60 * 1000;
const ERROR_CACHE_MS = 5 * 60 * 1000;

const AIRPORTS = {
  PEK: '北京首都国际机场', PKX: '北京大兴国际机场', PVG: '上海浦东国际机场', SHA: '上海虹桥国际机场',
  CAN: '广州白云国际机场', SZX: '深圳宝安国际机场', CTU: '成都双流国际机场', TFU: '成都天府国际机场',
  CKG: '重庆江北国际机场', XIY: '西安咸阳国际机场', HGH: '杭州萧山国际机场', NKG: '南京禄口国际机场',
  TAO: '青岛胶东国际机场', DLC: '大连周水子国际机场', FOC: '福州长乐国际机场', XMN: '厦门高崎国际机场',
  WUH: '武汉天河国际机场', CSX: '长沙黄花国际机场', KMG: '昆明长水国际机场', URC: '乌鲁木齐天山国际机场',
  SYX: '三亚凤凰国际机场', HAK: '海口美兰国际机场', TSN: '天津滨海国际机场', CGO: '郑州新郑国际机场',
};
const AIRPORT_CITIES = {
  PEK: '北京', PKX: '北京', PVG: '上海', SHA: '上海', CAN: '广州', SZX: '深圳', CTU: '成都', TFU: '成都',
  CKG: '重庆', XIY: '西安', HGH: '杭州', NKG: '南京', TAO: '青岛', DLC: '大连', FOC: '福州', XMN: '厦门',
  WUH: '武汉', CSX: '长沙', KMG: '昆明', URC: '乌鲁木齐', SYX: '三亚', HAK: '海口', TSN: '天津', CGO: '郑州',
};

function text(value) { return String(value == null ? '' : value).trim(); }
function normalizeFlightNo(value) { return text(value).replace(/\s+/g, '').toUpperCase(); }
function hhmm(value) {
  const source = typeof value === 'object' && value ? (value.local || value.utc) : value;
  const match = text(source).match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : text(source);
}
function localDate(value) {
  const source = typeof value === 'object' && value ? (value.local || value.utc) : value;
  return text(source).match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
}
function dayOffset(departureDate, arrivalDate) {
  if (!departureDate || !arrivalDate) return 0;
  const departure = Date.parse(`${departureDate}T00:00:00Z`); const arrival = Date.parse(`${arrivalDate}T00:00:00Z`);
  return Number.isNaN(departure) || Number.isNaN(arrival) ? 0 : Math.round((arrival - departure) / 86400000);
}
function terminalLabel(value) {
  const raw = text(value).replace(/^航站楼\s*/iu, '').replace(/^terminal\s*/iu, '');
  if (!raw) return '';
  const normalized = /^\d+$/u.test(raw) ? `T${raw}` : raw.toUpperCase().replace(/^T\s*/u, 'T');
  return /航站楼$/u.test(normalized) ? normalized : `${normalized}航站楼`;
}
function airportDetails(code, city, airportName, terminal) {
  const normalizedCode = normalizeFlightNo(code);
  const normalizedCity = AIRPORT_CITIES[normalizedCode] || text(city);
  const normalizedAirport = AIRPORTS[normalizedCode] || text(airportName) || `${normalizedCity}机场`;
  const normalizedTerminal = terminalLabel(terminal);
  return { code: normalizedCode, city: normalizedCity, airport: normalizedAirport, terminal: normalizedTerminal, label: `${normalizedAirport}${normalizedTerminal || ''}` };
}
function airportLabel(code, city, terminal) { return airportDetails(code, city, '', terminal).label; }
function normalizedResult(number, departure, arrival, state, sharedFlightNo = '') {
  return {
    number: normalizeFlightNo(number), from: departure.label, to: arrival.label,
    fromCity: departure.city, toCity: arrival.city, fromAirport: departure.airport, toAirport: arrival.airport,
    fromCode: departure.code, toCode: arrival.code, departure: departure.time, arrival: arrival.time,
    departureTerminal: departure.terminal, arrivalTerminal: arrival.terminal,
    departureDate: departure.date || '', arrivalDate: arrival.date || '', arrivalDayOffset: dayOffset(departure.date, arrival.date),
    state: text(state), sharedFlightNo: normalizeFlightNo(sharedFlightNo),
  };
}
function normalizeJuheFlight(row) {
  const departureValue = row?.FlightDeptimePlanDate || row?.departureTime; const arrivalValue = row?.FlightArrtimePlanDate || row?.arrivalTime;
  const departure = { ...airportDetails(row?.FlightDepcode || row?.departure, row?.FlightDep || row?.departureName, '', row?.FlightHTerminal || row?.departureTerminal), time: hhmm(departureValue), date: localDate(departureValue) };
  const arrival = { ...airportDetails(row?.FlightArrcode || row?.arrival, row?.FlightArr || row?.arrivalName, '', row?.FlightTerminal || row?.arrivalTerminal), time: hhmm(arrivalValue), date: localDate(arrivalValue) };
  return normalizedResult(row?.FlightNo || row?.flightNo, departure, arrival, row?.FlightState || row?.status, row?.ShareFlightNo || row?.shareFlightNo);
}
function normalizeAeroDataBoxFlight(row) {
  const depAirport = row?.departure?.airport || {}; const arrAirport = row?.arrival?.airport || {};
  const departure = { ...airportDetails(depAirport.iata || depAirport.icao, depAirport.municipalityName, depAirport.name || depAirport.shortName, row?.departure?.terminal), time: hhmm(row?.departure?.scheduledTime), date: localDate(row?.departure?.scheduledTime) };
  const arrival = { ...airportDetails(arrAirport.iata || arrAirport.icao, arrAirport.municipalityName, arrAirport.name || arrAirport.shortName, row?.arrival?.terminal), time: hhmm(row?.arrival?.scheduledTime), date: localDate(row?.arrival?.scheduledTime) };
  return normalizedResult(row?.number, departure, arrival, row?.status);
}
function cacheKey(query) { return crypto.createHash('sha256').update(JSON.stringify(query)).digest('hex'); }
function providerConfig() {
  if (FLIGHT_PROVIDER === 'aerodatabox') return { id: 'aerodatabox', label: 'AeroDataBox（API.Market）', key: AERODATABOX_API_KEY };
  return { id: 'juhe_flight_dynamic', label: '聚合数据·全球航班动态', key: JUHE_API_KEY };
}
function referenceUrl(query) {
  const match = normalizeFlightNo(query.fnum).match(/^([A-Z0-9]{2})(\d{1,4})$/); if (!match) return '';
  const [year, month, date] = text(query.date).split('-');
  return `https://www.flightstats.com/v2/flight-tracker/${match[1]}/${Number(match[2])}?year=${year}&month=${Number(month)}&date=${Number(date)}`;
}

function createFlightProvider(db, fetchImpl = fetch) {
  const config = providerConfig();
  const getCache = db.prepare('SELECT * FROM travel_api_cache WHERE cache_key=? AND expires_at>?');
  const putCache = db.prepare(`INSERT INTO travel_api_cache(cache_key,provider,request_json,response_json,status,fetched_at,expires_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET response_json=excluded.response_json,status=excluded.status,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at`);

  async function request(query) {
    if (config.id === 'aerodatabox') {
      const url = new URL(`${AERODATABOX_API_URL}/flights/number/${encodeURIComponent(query.fnum)}/${query.date}`);
      url.searchParams.set('dateLocalRole', 'Departure'); url.searchParams.set('withAircraftImage', 'false'); url.searchParams.set('withLocation', 'false');
      const response = await fetchImpl(url, { headers: { Accept: 'application/json', 'x-api-market-key': config.key }, signal: AbortSignal.timeout(15000) });
      const payload = response.status === 204 ? [] : await response.json();
      return { response, payload, ok: response.ok, message: payload?.message || payload?.error };
    }
    const url = new URL(JUHE_API_URL); url.searchParams.set('key', config.key); url.searchParams.set('fnum', query.fnum); url.searchParams.set('date', query.date);
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); const payload = await response.json();
    return { response, payload, ok: response.ok && Number(payload?.error_code || 0) === 0, message: payload?.reason || payload?.message };
  }

  async function verify(journey) {
    if (!config.key) throw Object.assign(new Error('航班核验接口尚未配置'), { status: 503, code: 'FLIGHT_PROVIDER_NOT_CONFIGURED' });
    const query = { fnum: normalizeFlightNo(journey.number), date: text(journey.date) };
    if (!query.fnum || !/^\d{4}-\d{2}-\d{2}$/.test(query.date)) throw Object.assign(new Error('航班核验需要航班号和日期'), { status: 400 });
    const key = cacheKey({ provider: config.id, ...query }); const now = Date.now();
    const cached = getCache.get(key, new Date(now).toISOString()); let payload; let fetchedAt; let cacheHit = false;
    if (cached) { payload = JSON.parse(cached.response_json); fetchedAt = cached.fetched_at; cacheHit = true; }
    else {
      let result;
      try { result = await request(query); payload = result.payload; }
      catch (error) { throw Object.assign(new Error(`航班数据服务暂时不可用：${error.message}`), { status: 502 }); }
      fetchedAt = new Date(now).toISOString();
      putCache.run(key, config.id, JSON.stringify(query), JSON.stringify(payload), result.ok ? 'ok' : 'error', fetchedAt, new Date(now + (result.ok ? SUCCESS_CACHE_MS : ERROR_CACHE_MS)).toISOString());
      if (!result.ok) throw Object.assign(new Error(text(result.message) || `航班数据服务返回 ${result.response.status}`), { status: 502 });
    }
    const rawRows = config.id === 'aerodatabox' ? (Array.isArray(payload) ? payload : []) : (Array.isArray(payload?.result) ? payload.result : payload?.result ? [payload.result] : []);
    const normalize = config.id === 'aerodatabox' ? normalizeAeroDataBoxFlight : normalizeJuheFlight;
    const rows = rawRows.map(normalize).filter((row) => row.number);
    const match = rows.find((row) => row.number === query.fnum || row.sharedFlightNo === query.fnum) || rows[0] || null;
    const warnings = match ? [] : [`未查询到${query.date}的航班${query.fnum}`];
    if (match && !match.departureTerminal) warnings.push('接口未返回出发航站楼，请人工核查');
    if (match && !match.arrivalTerminal) warnings.push('接口未返回抵达航站楼，请人工核查');
    return { attendeeId: text(journey.attendeeId), segment: journey.segment === 'return' ? 'return' : 'outbound', mode: 'flight', provider: config.id, source: { provider: config.id, label: config.label, checkedAt: fetchedAt, referenceUrl: referenceUrl(query) }, requested: { date: query.date, number: query.fnum, from: text(journey.from), to: text(journey.to), departure: hhmm(journey.departure), arrival: hhmm(journey.arrival) }, match, found: Boolean(match), cached: cacheHit, fetchedAt, warnings };
  }
  return { configured: Boolean(config.key), provider: config.id, label: config.label, verify };
}

module.exports = { createFlightProvider, normalizeFlight: normalizeJuheFlight, normalizeJuheFlight, normalizeAeroDataBoxFlight, normalizeFlightNo, airportLabel, terminalLabel, localDate, dayOffset };
