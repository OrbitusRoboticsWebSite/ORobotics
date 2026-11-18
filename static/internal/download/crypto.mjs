// A link is the capability. Only ciphertext and opaque identifiers reach CloudKit.
export const RECORD_TYPE = 'InternalPublicDownload';
export const PART_BYTES = 8 * 1024 * 1024;
export const MAX_FILE_BYTES = 256 * 1024 * 1024;
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
export const tokenValid = token => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
export function base64(bytes) {
  let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export function unbase64(value) {
  requireThat(typeof value === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(value), 'Invalid encoding');
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
export function newToken() { return base64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export async function sha256(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''); }
export async function recordName(token, index = null) {
  requireThat(tokenValid(token), 'Invalid download link');
  requireThat(index === null || (Number.isInteger(index) && index >= 0 && index < MAX_FILE_BYTES / PART_BYTES), 'Invalid part');
  return `public-download-${await sha256(encoder.encode(`Orbitus download v1:${token}:${index === null ? 'manifest' : index}`))}`;
}
async function keyFor(token) {
  requireThat(tokenValid(token), 'Invalid download link');
  const bytes = unbase64(token.replace(/-/g, '+').replace(/_/g, '/') + '=');
  requireThat(bytes.length === 32 && base64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === token, 'Invalid download link');
  const material = await crypto.subtle.importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('Orbitus download v1'), info: encoder.encode('AES-256-GCM file and metadata') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function seal(bytes, token, context) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(context) }, await keyFor(token), bytes));
  const result = new Uint8Array(iv.length + cipher.length); result.set(iv); result.set(cipher, iv.length); return result;
}
export async function unseal(bytes, token, context) {
  requireThat(bytes instanceof Uint8Array && bytes.length >= 28 && bytes.length <= PART_BYTES + 28, 'Invalid encrypted part');
  try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: encoder.encode(context) }, await keyFor(token), bytes.subarray(12))); }
  catch { throw new Error('This link cannot open the download, or its contents have changed.'); }
}
export async function sealMetadata(metadata, token) { return JSON.stringify({ version: 1, sealed: base64(await seal(encoder.encode(JSON.stringify(metadata)), token, await recordName(token))) }); }
export async function openMetadata(payload, token) {
  requireThat(typeof payload === 'string' && payload.length < 131072, 'Invalid download metadata');
  const envelope = JSON.parse(payload); requireThat(envelope.version === 1, 'Unsupported download version');
  return validateMetadata(JSON.parse(decoder.decode(await unseal(unbase64(envelope.sealed), token, await recordName(token)))));
}
export function validateMetadata(meta) {
  const text = (s, n) => typeof s === 'string' && s.length > 0 && s.length <= n;
  requireThat(meta?.version === 1 && text(meta.title, 180) && text(meta.publishedAt, 40), 'Invalid download details');
  if (meta.kind === 'collection') {
    requireThat(Array.isArray(meta.files) && meta.files.length > 0 && meta.files.length <= 20, 'Invalid collection');
    requireThat(new Set(meta.files.map(f => f.token)).size === meta.files.length, 'Duplicate links');
    for (const f of meta.files) requireThat(tokenValid(f.token) && text(f.title, 180) && text(f.platform, 100), 'Invalid file link');
  } else {
    requireThat(meta.kind === 'file' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,179}$/.test(meta.filename), 'Invalid filename');
    requireThat((meta.mime === 'application/zip' && meta.filename.endsWith('.zip')) || (meta.mime === 'application/gzip' && meta.filename.endsWith('.tar.gz')), 'Unsupported package');
    requireThat(Number.isSafeInteger(meta.bytes) && meta.bytes > 0 && meta.bytes <= MAX_FILE_BYTES && /^[a-f0-9]{64}$/.test(meta.sha256), 'Invalid package size or checksum');
    requireThat(text(meta.platform, 100) && text(meta.instructions, 4000) && text(meta.validation, 3000), 'Invalid package notes');
    requireThat(meta.parts === Math.ceil(meta.bytes / PART_BYTES), 'Invalid part count');
  }
  return meta;
}
export function appleAssetURL(value) {
  const url = new URL(value);
  requireThat(url.protocol === 'https:' && !url.username && !url.password && (url.hostname.endsWith('.icloud-content.com') || url.hostname.endsWith('.apple-cloudkit.com') || url.hostname.endsWith('.icloud.com')), 'Unexpected asset host');
  return url.href;
}
export async function limitedBytes(response, limit, signal) {
  requireThat(response.ok && response.body, 'Download temporarily unavailable');
  const declared = response.headers.get('content-length'); requireThat(!declared || Number(declared) <= limit, 'Download exceeded its expected size');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) { signal?.throwIfAborted(); const { done, value } = await reader.read(); if (done) break; size += value.length; requireThat(size <= limit, 'Download exceeded its expected size'); chunks.push(value); }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const output = new Uint8Array(size); let position = 0; for (const c of chunks) { output.set(c, position); position += c.length; } return output;
}
export async function downloadFile(meta, token, lookup, fetchAsset = fetch, progress = () => {}, signal) {
  validateMetadata(meta); requireThat(meta.kind === 'file', 'Not a file');
  const bytes = new Uint8Array(meta.bytes); let offset = 0;
  for (let i = 0; i < meta.parts; i++) {
    signal?.throwIfAborted(); const name = await recordName(token, i), record = await lookup(name);
    requireThat(record.recordName === name && record.recordType === RECORD_TYPE && record.fields?.asset?.value, 'Download unavailable or revoked');
    const expected = Math.min(PART_BYTES, meta.bytes - offset), asset = record.fields.asset.value;
    requireThat(asset.size === expected + 28, 'Encrypted part size mismatch');
    const response = await fetchAsset(appleAssetURL(asset.downloadURL), { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal });
    const encrypted = await limitedBytes(response, expected + 28, signal); requireThat(encrypted.length === expected + 28, 'Incomplete download');
    const plain = await unseal(encrypted, token, name); requireThat(plain.length === expected, 'Part size mismatch');
    bytes.set(plain, offset); offset += plain.length; progress(offset / meta.bytes);
  }
  signal?.throwIfAborted(); requireThat(offset === meta.bytes && await sha256(bytes) === meta.sha256, 'Package checksum mismatch'); signal?.throwIfAborted(); return bytes;
}
