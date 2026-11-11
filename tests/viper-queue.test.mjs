import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKeys, checkedRecords } from '../static/viper-fleet/queue.mjs';
import { seal, unseal, validateBundle } from '../static/viper-fleet/queue-format.mjs';
const config = { container: 'iCloud.orbitusrobotics.ViperFleet', environment: 'development' };
const device = { deviceId: '00000000-0000-4000-8000-000000000001', name: 'Test host', commandKey: btoa('x'.repeat(32)) };
test('web imports only matching per-machine command keys, never the server key', () => {
  const p = { version: 1, ...config, devices: [device] };
  assert.deepEqual(validateKeys(p, config), [device]);
  for (const bad of [{ ...p, privateKeyPEM: 'secret' }, { ...p, environment: 'production' }, { ...p, devices: [device, device] }, { ...p, devices: [{ ...device, commandKey: '' }] }]) assert.throws(() => validateKeys(bad, config));
});
test('cloud errors and missing result arrays fail closed', () => {
  for (const response of [{ hasErrors: true, records: [] }, { records: [{ serverErrorCode: 'ACCESS_DENIED' }] }, {}]) assert.throws(() => checkedRecords(response));
});
test('web encrypted payload format roundtrips and rejects a different machine', async () => {
  const plan = { version: 1, id: crypto.randomUUID(), name: 'Read system version', steps: [{ id: crypto.randomUUID(), kind: 'command', command: 'uname -a', timeout: 30 }] };
  const b = await validateBundle({ plan, files: {} }), job = crypto.randomUUID(); const e = await seal(b, device.commandKey, 'request', device.deviceId, job);
  assert.deepEqual(await unseal(e.descriptor, e.chunks, device.commandKey, 'request', device.deviceId, job), b);
  await assert.rejects(unseal(e.descriptor, e.chunks, device.commandKey, 'request', crypto.randomUUID(), job));
});
