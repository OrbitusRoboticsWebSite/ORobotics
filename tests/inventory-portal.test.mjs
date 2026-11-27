import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { dedicatedInventoryConfig } from '../scripts/configure-viper-fleet.mjs';
import { exampleReport } from '../static/viper-fleet/core.mjs';
import { InventoryView, inventoryContainer, openInventoryContainer } from '../static/viper-fleet/inventory/session.mjs';

const web = {
  REDAGENT_INVENTORY_WEB_ENABLED: 'true', REDAGENT_INVENTORY_WEB_ENVIRONMENT: 'development',
  REDAGENT_INVENTORY_WEB_API_TOKEN: 'synthetic-browser-token',
};
const user = { userRecordName: 'synthetic-admin' };
function record(group, hostLabel) {
  const report = { ...exampleReport(), hostLabel };
  return { recordType: 'InventoryGroup_' + group, fields: { payloadJSON: { value: JSON.stringify(report) } }, modified: { timestamp: 1700000000000 } };
}

test('dedicated inventory uses its own named container, Apple sign-in and web token', () => {
  const legacy = { VIPER_FLEET_ENABLED: 'true', VIPER_FLEET_API_TOKEN: 'legacy-token' };
  assert.deepEqual(dedicatedInventoryConfig(legacy), { enabled: false });
  assert.throws(() => dedicatedInventoryConfig({ ...legacy, REDAGENT_INVENTORY_WEB_ENABLED: 'true' }));
  assert.throws(() => dedicatedInventoryConfig({ ...web, REDAGENT_INVENTORY_WEB_API_TOKEN: '-----BEGIN PRIVATE KEY-----' }));
  const container = { containerIdentifier: inventoryContainer, environment: 'development' };
  let configuration;
  const apple = { configure(options) { configuration = options; }, getContainer(id) { assert.equal(id, inventoryContainer); return container; } };
  const config = dedicatedInventoryConfig({ ...legacy, ...web });
  assert.deepEqual(Object.keys(config).sort(), ['apiToken', 'container', 'enabled', 'environment']);
  assert.equal(openInventoryContainer(apple, config), container);
  const [entry] = configuration.containers;
  assert.equal(entry.apiTokenAuth.apiToken, web.REDAGENT_INVENTORY_WEB_API_TOKEN);
  assert.equal(entry.apiTokenAuth.persist, false);
  assert.equal(entry.apiTokenAuth.signInButton.id, 'inventory-sign-in');
  assert.throws(() => openInventoryContainer(apple, { ...config, container: 'iCloud.orbitusrobotics.ViperFleet' }));
  assert.throws(() => openInventoryContainer({ ...apple, getContainer: () => null }, config));
});

test('sign-in and a valid group are required; edits, account changes and denial clear prior results', async () => {
  const requests = [];
  const database = { performQuery(query) { return new Promise(resolve => requests.push({ query, resolve })); } };
  const renders = [];
  const view = new InventoryView(database, (message, reports) => renders.push({ message, reports }));
  await view.load('cobalt');
  view.setIdentity(user);
  for (const group of ['', 'Mixed', 'A/B', 'queue-item']) await view.load(group);
  assert.equal(requests.length, 0);
  const first = view.load('cobalt');
  view.clear();
  const second = view.load('beta');
  assert.deepEqual(requests.map(r => r.query.recordType), ['InventoryGroup_cobalt', 'InventoryGroup_beta']);
  requests[1].resolve({ records: [record('beta', 'Synthetic Beta Mac')] });
  await second;
  requests[0].resolve({ records: [record('cobalt', 'Late Mac')] });
  await first;
  assert.deepEqual(renders.at(-1).reports.map(r => r.hostLabel), ['Synthetic Beta Mac']);
  const failed = view.load('beta');
  assert.deepEqual(renders.at(-1).reports, []);
  requests[2].resolve({ hasErrors: true });
  await failed;
  assert.match(renders.at(-1).message, /unavailable/);
  const pending = view.load('cobalt');
  view.setIdentity(null);
  view.setIdentity({userRecordName: 'another-synthetic-admin'});
  requests[3].resolve({ records: [record('cobalt', 'Late Mac')] });
  await pending;
  assert.deepEqual(renders.at(-1).reports, []);
  assert.doesNotMatch(renders.at(-1).message, /Mac report/);
});

test('operator page is unlisted, starts inactive and imports only status code', async () => {
  const directory = new URL('../static/viper-fleet/inventory/', import.meta.url);
  const [html, portal, session, config] = await Promise.all(
    ['index.html', 'portal.mjs', 'session.mjs', 'config.json'].map(name => readFile(new URL(name, directory), 'utf8'))
  );
  assert.deepEqual(JSON.parse(config), { enabled: false });
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /id="group-form"[^>]*hidden/);
  assert.match(portal, /whenUserSignsOut/);
  assert.doesNotMatch(html + portal + session, /queue\.mjs|attachQueue|type="file"|saveRecords|modifyRecords|getDefaultContainer|localStorage|sessionStorage/i);
});
