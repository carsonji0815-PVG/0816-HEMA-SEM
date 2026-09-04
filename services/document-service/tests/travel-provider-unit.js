const assert = require('assert');

process.env.FLIGHT_PROVIDER = 'aerodatabox';
process.env.AERODATABOX_API_KEY = 'unit-test-key';
process.env.AERODATABOX_API_URL = 'https://example.test/aerodatabox';

const { createFlightProvider, normalizeAeroDataBoxFlight } = require('../flight-provider');

const normalized = normalizeAeroDataBoxFlight({
  number: 'CA8902', status: 'Expected',
  departure: { airport: { iata: 'PEK', municipalityName: 'Beijing' }, scheduledTime: { local: '2026-09-04 23:10+08:00' }, terminal: '3' },
  arrival: { airport: { iata: 'DLC', municipalityName: 'Dalian' }, scheduledTime: { local: '2026-09-05 00:35+08:00' }, terminal: '2' },
});
assert.equal(normalized.departure, '23:10');
assert.equal(normalized.arrival, '00:35');
assert.equal(normalized.arrivalDayOffset, 1);
assert.equal(normalized.from, '北京首都国际机场T3航站楼');
assert.equal(normalized.to, '大连周水子国际机场T2航站楼');

const db = { prepare(sql) { return sql.startsWith('SELECT') ? { get() { return undefined; } } : { run() {} }; } };
const fetchImpl = async () => ({ ok: true, status: 200, json: async () => [{
  number: 'CA8902', status: 'Expected',
  departure: { airport: { iata: 'PEK', municipalityName: 'Beijing' }, scheduledTime: { local: '2026-09-04 23:10+08:00' }, terminal: '3' },
  arrival: { airport: { iata: 'DLC', municipalityName: 'Dalian' }, scheduledTime: { local: '2026-09-05 00:35+08:00' }, terminal: '2' },
}] });

(async () => {
  const result = await createFlightProvider(db, fetchImpl).verify({ attendeeId: 'a-1', segment: 'outbound', date: '2026-09-04', number: 'CA8902', from: '北京', to: '大连', departure: '23:10', arrival: '00:35' });
  assert.equal(result.match.arrivalDayOffset, 1);
  assert.equal(result.source.label, 'AeroDataBox（API.Market）');
  assert.match(result.source.referenceUrl, /flightstats\.com\/v2\/flight-tracker\/CA\/8902/);
  console.log('Travel provider unit passed: source trace, terminals and cross-day arrival.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
