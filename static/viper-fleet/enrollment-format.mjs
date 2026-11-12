// Shared by Node and the browser. Enrollment envelopes are readable only by
// controllers; receivers receive the public half of this separate key pair.
import { check, uuid, bytes64, from64 } from './queue-format.mjs';

const encoder = new TextEncoder();
const salt = encoder.encode('ViperFleet/enrollment/1');
const b64url = bytes => bytes64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const rawurl = text => from64(text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - text.length % 4) % 4));

export function validateAuthority(value, privateRequired = false) {
  check(value?.version === 1 && uuid.test(value.id) && from64(value.publicKey).length === 65
    && from64(value.publicKey)[0] === 4, 'Invalid fleet enrollment authority');
  if (privateRequired) check(from64(value.privateKey).length === 32, 'Controller enrollment private key is required');
  return value;
}
export function validateEnvelope(value) {
  check(value?.version === 1 && uuid.test(value.authorityId)
    && typeof value.publicKey === 'string' && value.publicKey.length <= 100
    && from64(value.publicKey).length === 65 && from64(value.publicKey)[0] === 4
    && typeof value.sealed === 'string' && value.sealed.length <= 2048
    && from64(value.sealed).length >= 28, 'Invalid encrypted enrollment');
  return value;
}
function context(container, environment, authorityId, deviceId) {
  check(/^iCloud\.[A-Za-z0-9.-]+$/.test(container) && ['development', 'production'].includes(environment)
    && uuid.test(authorityId) && uuid.test(deviceId), 'Invalid enrollment identity');
  return encoder.encode(`ViperFleet/enrollment/1\0${container}\0${environment}\0${authorityId}\0${deviceId}`);
}
function validateDevice(value) {
  check(uuid.test(value?.deviceId) && typeof value.name === 'string' && value.name.trim()
    && value.name.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value.name)
    && from64(value.commandKey).length === 32, 'Invalid enrolled machine');
  return { deviceId: value.deviceId, name: value.name, commandKey: value.commandKey };
}
async function publicKey(value) {
  return crypto.subtle.importKey('raw', from64(value), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}
async function privateKey(authority) {
  validateAuthority(authority, true);
  const pub = from64(authority.publicKey);
  return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33)), d: b64url(from64(authority.privateKey)), ext: false },
  { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
}
async function wrappingKey(secret, pub, info, usage) {
  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, secret, 256);
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info }, material,
    { name: 'AES-GCM', length: 256 }, false, [usage]);
}
export async function createAuthority() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const privateJWK = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { version: 1, id: crypto.randomUUID(), publicKey: bytes64(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
    privateKey: bytes64(rawurl(privateJWK.d)) };
}
export async function sealEnrollment(device, authority, fleet) {
  validateDevice(device); validateAuthority(authority);
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const info = context(fleet.container, fleet.environment, authority.id, device.deviceId);
  const key = await wrappingKey(pair.privateKey, await publicKey(authority.publicKey), info, 'encrypt');
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: info }, key, encoder.encode(JSON.stringify(device))));
  const sealed = new Uint8Array(nonce.length + encrypted.length); sealed.set(nonce); sealed.set(encrypted, nonce.length);
  return { version: 1, authorityId: authority.id,
    publicKey: bytes64(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))), sealed: bytes64(sealed) };
}
export async function openEnrollment(report, authority, fleet) {
  validateAuthority(authority, true); const envelope = validateEnvelope(report.enrollment);
  check(envelope.authorityId === authority.id, 'Enrollment belongs to a different controller');
  const info = context(fleet.container, fleet.environment, authority.id, report.deviceId);
  const key = await wrappingKey(await privateKey(authority), await publicKey(envelope.publicKey), info, 'decrypt');
  const sealed = from64(envelope.sealed);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.slice(0, 12), additionalData: info }, key, sealed.slice(12));
  const device = validateDevice(JSON.parse(new TextDecoder().decode(clear)));
  check(device.deviceId === report.deviceId && device.name === report.hostLabel, 'Enrollment report identity mismatch');
  return device;
}
export async function discoverEnrollments(reports, authority, fleet, existing = []) {
  validateAuthority(authority, true);
  const devices = new Map(existing.map(d => [d.deviceId, validateDevice(d)]));
  for (const report of reports) {
    if (report.enrollment?.authorityId !== authority.id) continue;
    const device = await openEnrollment(report, authority, fleet), previous = devices.get(device.deviceId);
    check(!previous || previous.commandKey === device.commandKey, 'A known machine has a different command key; enrollment was not replaced');
    devices.set(device.deviceId, device);
    check(devices.size <= 1000, 'Fleet exceeds 1000 controller entries');
  }
  return [...devices.values()];
}
