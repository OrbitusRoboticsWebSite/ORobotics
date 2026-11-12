#!/usr/bin/env node
// Runs only when a private, explicitly provisioned bootstrap is supplied.
import { readFile, mkdir, writeFile, lstat, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { validateCredentials } from './cloudkit.mjs';
import { loadReceiver, durableJSON, privateJSON } from './queue-agent.mjs';
import { check, bytes64, intervalMinutes } from './queue-format.mjs';
import { validateAuthority, sealEnrollment } from './enrollment-format.mjs';

export function validateBootstrap(value) {
  check(value?.version === 1 && value.kind === 'viperlink-auto-enrollment'
    && value.container === 'iCloud.orbitusrobotics.ViperFleet', 'Invalid private fleet bootstrap');
  validateCredentials({ ...value, privateKey: value.privateKeyPEM });
  intervalMinutes(value.intervalMinutes); validateAuthority(value.enrollmentAuthority);
  check(!value.enrollmentAuthority.privateKey, 'Receiver bootstrap must not contain the controller enrollment private key');
  return value;
}
async function regularPath(file) {
  for (let p = path.resolve(file); ; p = path.dirname(p)) {
    try { check(!(await lstat(p)).isSymbolicLink(), 'Enrollment path must not contain symbolic links'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (path.dirname(p) === p) break;
  }
}
export async function autoEnroll({ bootstrapFile, data, hostname = os.hostname() }) {
  check(path.isAbsolute(data) && path.isAbsolute(bootstrapFile), 'Use absolute enrollment paths');
  await regularPath(data); await regularPath(bootstrapFile);
  const bootstrap = validateBootstrap(await privateJSON(bootstrapFile, 16384));
  await mkdir(data, { recursive: true, mode: 0o700 });
  const lockFile = path.join(data, '.enrollment-lock');
  const lock = await open(lockFile, 'wx', 0o600);
  try {
    const profileFile = path.join(data, 'receiver.json');
    let exists = false;
    try { await lstat(profileFile); exists = true; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const current = exists ? await loadReceiver(profileFile) : null;
    if (current) {
      check(current.container === bootstrap.container && current.environment === bootstrap.environment
        && current.keyID === bootstrap.keyID, 'Existing enrollment belongs to a different fleet; it was preserved');
      // Reinstallation preserves identity, journal, credentials and disabled state.
      return { enrolled: true, reused: true, deviceId: current.deviceId, name: current.name, enabled: current.enabled };
    }
    const root = path.join(data, 'Workspace'); await regularPath(root); await mkdir(root, { recursive: true, mode: 0o700 });
    const device = { deviceId: crypto.randomUUID(), name: hostname.trim().slice(0, 80), commandKey: bytes64(crypto.getRandomValues(new Uint8Array(32))) };
    const enrollment = await sealEnrollment(device, bootstrap.enrollmentAuthority, bootstrap);
    const pemFile = path.join(data, 'fleet-private.pem'); await regularPath(pemFile);
    try { await writeFile(pemFile, bootstrap.privateKeyPEM, { mode: 0o600, flag: 'wx' }); }
    catch (e) { if (e.code !== 'EEXIST') throw e;
      check(await readFile(pemFile, 'utf8') === bootstrap.privateKeyPEM, 'An existing transport key differs; it was preserved'); }
    await durableJSON(profileFile, { version: 1, container: bootstrap.container, environment: bootstrap.environment,
      keyID: bootstrap.keyID, ...device, privateKeyFile: 'fleet-private.pem', root,
      intervalMinutes: bootstrap.intervalMinutes, enabled: true, enrollment });
    return { enrolled: true, reused: false, deviceId: device.deviceId, name: device.name, enabled: true };
  } finally { await lock.close(); await unlink(lockFile); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    check(args.length === 4 && args[0] === '--bootstrap' && args[2] === '--data', 'Expected --bootstrap FILE --data DIRECTORY');
    console.log(JSON.stringify(await autoEnroll({ bootstrapFile: args[1], data: args[3] })));
  } catch { console.error('Automatic enrollment failed; existing enrollment was preserved. Check the private bootstrap and protected data directory.'); process.exitCode = 1; }
}
