import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { filterMachines, sampleMachines, isRecent, decodeRecord, queryFleet } from '../static/viper-fleet/core.mjs';
import { fleetConfig } from '../scripts/configure-viper-fleet.mjs';
const now = Date.parse('2026-11-11T05:00:00Z'), records = sampleMachines(now);
test('platform, flavor, status and text filters compose', () => {
  assert.equal(filterMachines(records, { platform: 'macos' }, now).length, 2);
  assert.equal(filterMachines(records, { platform: 'linux', search: 'Ubuntu' }, now)[0].hostLabel, 'Lab node');
  assert.equal(filterMachines(records, { platform: 'linux', flavor: 'Debian · 13' }, now)[0].hostLabel, 'Compute node');
  assert.equal(filterMachines(records, { status: 'attention' }, now).length, 1);
  assert.equal(filterMachines(records, { status: 'unknown' }, now).length, 1);
  assert.equal(filterMachines(records, { status: 'recent' }, now).length, 4);
  assert.equal(filterMachines(records, { status: 'stale' }, now).length, 1);
  assert.equal(filterMachines(records, { search: ' ENGINEERING ' }, now).length, 2);
  assert.equal(filterMachines(records, { search: 'does not exist' }, now).length, 0);
});
test('invalid or far-future receipt times cannot appear recent', () => {
  assert.equal(isRecent({ receivedAt: 'invalid' }, now), false);
  assert.equal(isRecent({ receivedAt: new Date(now + 120000).toISOString() }, now), false);
});
test('CloudKit parsing requires usable data and server receipt time', () => {
  const r = { fields: { payloadJSON: { value: JSON.stringify(records[0]) }, receivedAt: { value: now } } };
  assert.equal(decodeRecord(r).receivedAt, new Date(now).toISOString());
  assert.throws(() => decodeRecord({ fields: { payloadJSON: { value: 'not-json' } } }));
  assert.throws(() => decodeRecord({ fields: { payloadJSON: { value: JSON.stringify(records[0]) } } }));
  assert.throws(() => decodeRecord({ fields: { payloadJSON: { value: 'x'.repeat(8193) } } }));
});
test('query uses CloudKit continuation responses and never returns partial data on denial', async () => {
  const record = r => ({ fields: { payloadJSON: { value: JSON.stringify(r) }, receivedAt: { value: now } } });
  const first = { records: [record(records[0])], continuationMarker: 'next' };
  let calls = 0;
  const database = { async performQuery(query) { calls++; if (calls === 1) return first; assert.equal(query, first); return { records: [record(records[1])] }; } };
  assert.equal((await queryFleet(database)).length, 2);
  await assert.rejects(queryFleet({ performQuery: async () => ({ hasErrors: true, records: [record(records[0])] }) }));
  await assert.rejects(queryFleet({ performQuery: async () => first }));
  await assert.rejects(queryFleet({ performQuery: async () => first }, () => false));
});
test('staged portal is unindexed, inactive and contains no password form', async () => {
  const html = await readFile(new URL('../static/viper-fleet/index.html', import.meta.url), 'utf8');
  const config = JSON.parse(await readFile(new URL('../static/viper-fleet/config.json', import.meta.url), 'utf8'));
  assert.match(html, /noindex, nofollow, noarchive/); assert.match(html, /Live sign-in and machine reporting are not activated/);
  assert.doesNotMatch(html, /type="password"|analytics|googletag/i);
  assert.equal(config.enabled, false); assert.equal(config.apiToken, ''); assert.equal(config.intakeURL, '');
  assert.ok(records.every(r => r.sample === true && r.hostLabel !== 'Rob4'));
});
test('build configuration stays inactive by default and rejects unsafe or missing endpoints', () => {
  assert.equal(fleetConfig({}).enabled, false);
  assert.throws(() => fleetConfig({ VIPER_FLEET_ENABLED: 'true' }));
  const env = { VIPER_FLEET_ENABLED: 'true', VIPER_FLEET_CONTAINER: 'iCloud.example.Fleet', VIPER_FLEET_ENVIRONMENT: 'production', VIPER_FLEET_API_TOKEN: 'public-test-token', VIPER_FLEET_INTAKE_URL: 'https://intake.example/v1/check-in' };
  assert.equal(fleetConfig(env).enabled, true);
  for (const endpoint of ['http://intake.example/v1/check-in', 'https://user:pass@intake.example/v1/check-in', 'https://intake.example/v1/check-in?token=x', 'https://intake.example/other'])
    assert.throws(() => fleetConfig({ ...env, VIPER_FLEET_INTAKE_URL: endpoint }));
});
