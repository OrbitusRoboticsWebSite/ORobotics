// Shared by the browser and Node. Each enrolled host has a distinct command key.
// CloudKit transports encrypted jobs; possession of the shared reporting key
// alone cannot authorize a command or forge another device's result.
export const fleetLimits = Object.freeze({ fileBytes: 8 * 1024 * 1024, bundleBytes: 16 * 1024 * 1024,
  chunkBytes: 256 * 1024, maxChunks: 65, outputBytes: 64 * 1024, intervalMax: 1440 });
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
export function check(value, message) { if (!value) throw new Error(message); }
export function bytes64(data) {
  let s = ''; for (let i = 0; i < data.length; i += 8192) s += String.fromCharCode(...data.subarray(i, i + 8192));
  return btoa(s);
}
export function from64(value) {
  check(typeof value === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(value) && value.length % 4 === 0, 'Invalid base64 data');
  const s = atob(value); return Uint8Array.from(s, c => c.charCodeAt(0));
}
export async function sha256(data) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(n => n.toString(16).padStart(2, '0')).join(''); }
export function filename(name) {
  check(typeof name === 'string' && name.length && encoder.encode(name).length <= 240
    && !/[\\/\u0000-\u001f\u007f:]/.test(name) && !/[. ]$/.test(name) && !['.', '..'].includes(name)
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name), 'Use a portable filename without folders');
  return name;
}
export function intervalMinutes(value) { check(Number.isInteger(value) && value >= 1 && value <= fleetLimits.intervalMax, 'Check-in interval must be 1–1440 whole minutes'); return value; }
export function validatePlan(plan) {
  check(plan && plan.version === 1 && uuid.test(plan.id) && typeof plan.name === 'string' && plan.name.trim()
    && encoder.encode(plan.name).length <= 200 && Array.isArray(plan.steps) && plan.steps.length > 0 && plan.steps.length <= 1000, 'Invalid ViperLink payload');
  const ids = new Set();
  for (const s of plan.steps) {
    check(s && uuid.test(s.id) && !ids.has(s.id.toLowerCase()), 'Payload step IDs must be unique'); ids.add(s.id.toLowerCase());
    check(['command', 'upload', 'download'].includes(s.kind), 'Unsupported payload step');
    if (s.kind === 'command') check(typeof s.command === 'string' && s.command.length && !s.command.includes('\0')
      && encoder.encode(s.command).length <= 16384 && Number.isInteger(s.timeout) && s.timeout >= 1 && s.timeout <= 300, 'Invalid command or timeout');
    else { filename(s.remoteName); if (s.kind === 'upload') filename(s.file); }
  }
  return plan;
}
export async function validateBundle(bundle) {
  validatePlan(bundle?.plan); check(bundle.files && typeof bundle.files === 'object' && !Array.isArray(bundle.files), 'Missing payload files');
  let total = 0; const needed = new Set(bundle.plan.steps.filter(s => s.kind === 'upload').map(s => s.file));
  check(Object.keys(bundle.files).every(n => needed.has(n)) && Object.keys(bundle.files).length === needed.size, 'Payload files do not match upload steps');
  for (const name of needed) {
    filename(name); const f = bundle.files[name]; const data = from64(f?.data);
    total += data.length; check(total <= fleetLimits.fileBytes && f.size === data.length && f.sha256 === await sha256(data), 'File size or SHA-256 mismatch');
  }
  check(encoder.encode(JSON.stringify(bundle)).length <= fleetLimits.bundleBytes, 'Cloud payload exceeds 16 MiB (8 MiB of files)');
  return bundle;
}
function aad(purpose, deviceId, jobId) {
  check(['request', 'result'].includes(purpose) && uuid.test(deviceId) && uuid.test(jobId), 'Invalid encrypted job identity');
  return encoder.encode(`ViperFleet/1\0${purpose}\0${deviceId.toLowerCase()}\0${jobId.toLowerCase()}`);
}
export async function seal(value, secret, purpose, deviceId, jobId) {
  const raw = from64(secret); check(raw.length === 32, 'Invalid device command key');
  const data = encoder.encode(JSON.stringify(value)); check(data.length <= fleetLimits.bundleBytes, 'Encrypted message is too large');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad(purpose, deviceId, jobId), tagLength: 128 }, key, data));
  const chunks = []; for (let i = 0; i < encrypted.length; i += fleetLimits.chunkBytes) chunks.push(bytes64(encrypted.subarray(i, i + fleetLimits.chunkBytes)));
  return { descriptor: { version: 1, nonce: bytes64(nonce), bytes: encrypted.length, sha256: await sha256(encrypted), chunks: chunks.length }, chunks };
}
export function validateDescriptor(d) {
  check(d && d.version === 1 && from64(d.nonce).length === 12 && Number.isInteger(d.bytes) && d.bytes >= 16
    && d.bytes <= fleetLimits.bundleBytes + 16 && /^[0-9a-f]{64}$/.test(d.sha256)
    && d.chunks === Math.ceil(d.bytes / fleetLimits.chunkBytes) && d.chunks <= fleetLimits.maxChunks, 'Invalid encrypted message descriptor');
  return d;
}
export async function unseal(descriptor, chunks, secret, purpose, deviceId, jobId) {
  const d = validateDescriptor(descriptor); check(chunks.length === d.chunks, 'Incomplete encrypted message');
  const encrypted = new Uint8Array(d.bytes); let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const data = from64(chunks[i]); check(data.length === Math.min(fleetLimits.chunkBytes, d.bytes - offset), 'Incorrect encrypted chunk size');
    encrypted.set(data, offset); offset += data.length;
  }
  check(await sha256(encrypted) === d.sha256, 'Encrypted message checksum mismatch');
  const raw = from64(secret); check(raw.length === 32, 'Invalid device command key');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: from64(d.nonce), additionalData: aad(purpose, deviceId, jobId), tagLength: 128 }, key, encrypted);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(clear));
}
export function blobName(jobId, purpose, index, digest) { return `blob-${jobId.toLowerCase()}-${purpose}-${digest.slice(0, 16)}-${index}`; }
export function validateRequest(value, deviceId, jobId, now = Date.now()) {
  check(value?.version === 1 && value.deviceId === deviceId && value.jobId === jobId, 'Job is addressed to a different machine');
  const created = Date.parse(value.createdAt), expires = Date.parse(value.expiresAt);
  check(Number.isFinite(created) && Number.isFinite(expires) && created <= now + 300000
    && expires > created && expires - created <= 7 * 86400000, 'Invalid job lifetime');
  check(expires > now, 'Job expired'); return value;
}
