import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [app,sql]=await Promise.all([
  readFile(new URL('../app.js',import.meta.url),'utf8'),
  readFile(new URL('../supabase/migrations/2026090404_meeting_settings_concurrency.sql',import.meta.url),'utf8'),
]);

const syncBody=app.slice(app.indexOf('async function syncBackend()'),app.indexOf('function parseServiceTime'));
assert.doesNotMatch(syncBody,/from\("meetings"\)\.update/,'generic state sync must never update meeting settings');
assert.doesNotMatch(syncBody,/column_locks/,'generic state sync must never overwrite all column locks');
assert.match(app,/settingsVersion:Number\(meeting\.settings_version\)\|\|0/);
assert.match(app,/update_meeting_settings/);
assert.match(app,/p_expected_version:Number\(state\.settings\.settingsVersion\)\|\|0/);
assert.match(app,/settingsConflict\(error\)/);

assert.match(sql,/settings_version bigint not null default 0/);
assert.match(sql,/for update/);
assert.match(sql,/v_before\.settings_version <> coalesce\(p_expected_version,-1\)/);
assert.match(sql,/v_field_config := coalesce\(v_before\.field_config/);
assert.match(sql,/meeting_settings_updated/);
assert.match(sql,/meeting_project_updated/);
assert.match(sql,/settings_version=settings_version\+1/);

console.log('meeting settings concurrency smoke: ok');
