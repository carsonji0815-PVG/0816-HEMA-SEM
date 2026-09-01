// Compare COPY row fingerprints locally on the server; never print row data,
// password hashes or tokens. Then test RLS inside rolled-back transactions.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const base = process.env.MIGRATION_BACKUP;
if (!/^\/opt\/lilly-migration\/backups\/source-[A-Za-z0-9TZ.-]+$/.test(base || '')) throw new Error('Private backup directory required.');
const previous = JSON.parse(readFileSync(`${base}/rehearsal-validation.json`, 'utf8'));
if (previous.target !== 'lilly-stage-db' || !previous.allCountsMatch) throw new Error('Successful count verification required.');
const psql = sql => spawnSync('docker', ['exec', '-i', 'lilly-stage-db', 'psql', '-U', 'postgres', '-d', 'postgres', '-qAt', '--set', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 30000 });
const digest = rows => createHash('sha256').update([...rows].sort().join('\n')).digest('hex');
const lines = readFileSync(`${base}/data.sql`, 'utf8').split('\n'), results = [];
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].startsWith('COPY ')) continue;
  const header = lines[i];
  if (!/^COPY "(public|auth|storage)"\."[a-z_][a-z0-9_]*" \("[a-z_][a-z0-9_]*"(?:, "[a-z_][a-z0-9_]*")*\) FROM stdin;$/.test(header)) throw new Error('Unexpected COPY descriptor.');
  const table = header.match(/^COPY "([^"]+)"\."([^"]+)"/).slice(1).join('.');
  const expected = []; while (++i < lines.length && lines[i] !== '\\.') expected.push(lines[i]);
  const r = psql(`SET timezone='UTC';\n${header.replace('FROM stdin;', 'TO STDOUT;')}\n`);
  // Newer source columns in empty internal tables do not contain data to copy.
  if (r.status !== 0 && expected.length === 0 && !table.startsWith('public.') && previous.counts.some(x => x.table === table && x.actual === 0)) {
    results.push({ table, rows: 0, matches: true, check: 'empty-table-count' }); continue;
  }
  if (r.status !== 0) throw new Error(`Cannot compare ${table}; raw row output suppressed.`);
  const raw = r.stdout.endsWith('\n') ? r.stdout.slice(0, -1) : r.stdout;
  const actual = raw === '' ? [] : raw.split('\n');
  results.push({ table, rows: actual.length, matches: expected.length === actual.length && digest(expected) === digest(actual), check: 'sorted-copy-sha256' });
}
const expectedAttendees = previous.counts.find(x => x.table === 'public.attendees').expected;
const denyCheck = `DO $$ DECLARE n bigint; BEGIN BEGIN SELECT count(*) INTO n FROM public.attendees; EXCEPTION WHEN insufficient_privilege THEN n := 0; END; IF n <> 0 THEN RAISE EXCEPTION 'Unexpected roster visibility'; END IF; END $$;`;
const tests = {
  anonymousIsolated: `BEGIN; SET LOCAL ROLE anon; ${denyCheck} ROLLBACK;`,
  unassignedAccountIsolated: `BEGIN; DO $$ BEGIN PERFORM set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated","email":"migration-unassigned@invalid.example"}', true); END $$; SET LOCAL ROLE authenticated; ${denyCheck} ROLLBACK;`,
  administratorCanReadRoster: `BEGIN; DO $$ DECLARE u record; BEGIN SELECT id,email INTO u FROM auth.users WHERE lower(email)='jll@grandchinamice.com'; IF u.id IS NULL THEN RAISE EXCEPTION 'Expected administrator not found'; END IF; PERFORM set_config('request.jwt.claims', json_build_object('sub',u.id,'email',u.email,'role','authenticated')::text,true); END $$; SET LOCAL ROLE authenticated; DO $$ DECLARE n bigint; BEGIN SELECT count(*) INTO n FROM public.attendees; IF n <> ${expectedAttendees} THEN RAISE EXCEPTION 'Administrator visibility mismatch'; END IF; END $$; ROLLBACK;`,
};
const permissions = {};
for (const [name, sql] of Object.entries(tests)) permissions[name] = psql(sql).status === 0;
const rls = psql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;");
permissions.allBusinessTablesHaveRls = rls.status === 0 && rls.stdout.trim() === '0';
const report = { checkedAt: new Date().toISOString(), results, permissions, allDataMatch: results.every(x => x.matches), allPermissionChecksPass: Object.values(permissions).every(Boolean), productionReady: false };
writeFileSync(`${base}/rehearsal-content-and-rls.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ tables: results.length, allDataMatch: report.allDataMatch, mismatches: results.filter(x => !x.matches), permissions }, null, 2));
if (!report.allDataMatch || !report.allPermissionChecksPass) process.exitCode = 1;
