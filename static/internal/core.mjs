// Private content is fetched from CloudKit records, never from static assets.
export const CATALOG_ID = 'internal-catalog-v1';
export const ADMIN_ID = 'internal-admin-v1';
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const CHUNK_BYTES = 192 * 1024;
export const MAX_CHUNKS = Math.ceil(MAX_FILE_BYTES / CHUNK_BYTES);
const enc = new TextEncoder();
const namePattern = /^internal-file-[0-9a-f-]{36}-\d{3}$/;
export class AccessError extends Error {}
function requireThat(ok, message) { if (!ok) throw new Error(message); }
const string = (v, max = 2000) => typeof v === 'string' && v.length <= max;
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function identityName(value) { return value?.userRecordName || value?.userIdentity?.userRecordName || ''; }
export function validateConfig(value) {
  requireThat(value && value.container === 'iCloud.orbitusrobotics.Internal', 'Unexpected container');
  requireThat(['production', 'development'].includes(value.environment), 'Invalid environment');
  requireThat(typeof value.enabled === 'boolean', 'Invalid enable flag');
  requireThat(!value.enabled || (string(value.apiToken, 256) && value.apiToken.length > 10), 'Missing browser API token');
  return value;
}
export function safeURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
export function formatBytes(n) { return n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`; }
export function validateDocument(doc) {
  requireThat(doc && /^[0-9a-f-]{36}$/.test(doc.id) && string(doc.title, 180) && doc.title.length > 0, 'Invalid document identity');
  requireThat(string(doc.filename, 180) && /^[^/\\\x00-\x1f]+$/.test(doc.filename), 'Invalid filename');
  const types = { 'application/pdf': '.pdf', 'application/json': '.json', 'text/plain': '.txt', 'application/zip': '.zip' };
  requireThat(types[doc.mime] && doc.filename.toLowerCase().endsWith(types[doc.mime]), 'Unsupported document type');
  requireThat(Number.isSafeInteger(doc.bytes) && doc.bytes > 0 && doc.bytes <= MAX_FILE_BYTES && hex(doc.sha256), 'Invalid file size or digest');
  requireThat(Array.isArray(doc.chunks) && doc.chunks.length === Math.ceil(doc.bytes / CHUNK_BYTES) && doc.chunks.length <= MAX_CHUNKS, 'Invalid chunk count');
  requireThat(new Set(doc.chunks).size === doc.chunks.length && doc.chunks.every((n, i) => n === `internal-file-${doc.id}-${String(i).padStart(3, '0')}` && namePattern.test(n)), 'Invalid chunk names');
  for (const key of ['summary', 'category', 'date', 'version', 'status']) requireThat(string(doc[key] || '', key === 'summary' ? 3000 : 180), 'Invalid document metadata');
  return doc;
}
export function validateCatalog(value) {
  requireThat(value?.schemaVersion === 1 && string(value.title, 160) && string(value.updatedAt, 40), 'Invalid catalog');
  for (const key of ['documents', 'news', 'work', 'whitepapers']) requireThat(Array.isArray(value[key]) && value[key].length <= 300, 'Invalid catalog collection');
  value.documents.forEach(validateDocument);
  requireThat(new Set(value.documents.map(d => d.id)).size === value.documents.length, 'Duplicate documents');
  for (const item of [...value.news, ...value.work, ...value.whitepapers]) {
    requireThat(item && string(item.id, 100) && string(item.title, 200) && string(item.summary, 5000), 'Invalid entry');
    for (const k of ['date', 'status', 'category', 'version', 'evidenceDate']) requireThat(string(item[k] || '', 200), 'Invalid entry metadata');
    requireThat(!item.body || (Array.isArray(item.body) && item.body.length <= 40 && item.body.every(p => string(p, 6000))), 'Invalid article');
    requireThat(!item.links || (Array.isArray(item.links) && item.links.length <= 20 && item.links.every(l => string(l.label, 200) && safeURL(l.url))), 'Invalid source link');
    requireThat(!item.image || safeURL(item.image), 'Invalid image URL');
  }
  requireThat(enc.encode(JSON.stringify(value)).length <= 600000, 'Catalog is too large');
  return value;
}
export function filterItems(items, search = '', category = '') {
  const q = search.trim().toLowerCase();
  return items.filter(item => (!category || item.category === category) && (!q || [item.title, item.summary, item.category, item.status].join(' ').toLowerCase().includes(q)));
}
export async function digest(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join(''); }
export function toBase64(bytes) {
  let str = ''; for (let i = 0; i < bytes.length; i += 8192) str += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(str);
}
export function fromBase64(text) {
  requireThat(string(text, CHUNK_BYTES * 4 / 3 + 8) && /^[A-Za-z0-9+/]*={0,2}$/.test(text), 'Invalid file chunk');
  return Uint8Array.from(atob(text), c => c.charCodeAt(0));
}
export async function packageDocument(bytes, metadata) {
  requireThat(bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= MAX_FILE_BYTES, 'Files must be between 1 byte and 20 MB');
  const id = crypto.randomUUID(); const records = [];
  for (let i = 0; i * CHUNK_BYTES < bytes.length; i++) records.push({ recordName: `internal-file-${id}-${String(i).padStart(3, '0')}`, recordType: 'InternalDocumentChunk', fields: {
    documentID: { value: id }, chunkIndex: { value: i }, data: { value: toBase64(bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES)) },
  } });
  const document = validateDocument({ ...metadata, id, bytes: bytes.length, sha256: await digest(bytes), chunks: records.map(r => r.recordName) });
  return { document, records };
}
export class PortalRepository {
  constructor(database, stillCurrent = () => true) { this.db = database; this.stillCurrent = stillCurrent; }
  check() { if (!this.stillCurrent()) throw new AccessError('Session ended'); }
  async records(names) {
    this.check(); const response = await this.db.fetchRecords(names); this.check();
    if (response?.hasErrors || response?.errors?.length || !Array.isArray(response?.records) || response.records.length !== names.length) throw new AccessError('Access unavailable');
    const byName = new Map(response.records.map(r => [r.recordName, r]));
    if (byName.size !== names.length) throw new AccessError('Invalid record response');
    return names.map(name => { const r = byName.get(name); if (!r || r.serverErrorCode || !r.fields) throw new AccessError('Access unavailable'); return r; });
  }
  async catalog() {
    const [r] = await this.records([CATALOG_ID]);
    if (r.recordType !== 'InternalCatalog') throw new AccessError('Invalid catalog record');
    return { catalog: validateCatalog(JSON.parse(r.fields.payloadJSON?.value)), tag: r.recordChangeTag };
  }
  async isAdmin() {
    try { const [r] = await this.records([ADMIN_ID]); return r.recordType === 'InternalAdminGate' && r.fields.enabled?.value === 1; }
    catch { return false; }
  }
  async document(doc, progress = () => {}) {
    validateDocument(doc); this.check();
    const output = new Uint8Array(doc.bytes); let offset = 0;
    for (let i = 0; i < doc.chunks.length; i += 8) {
      const records = await this.records(doc.chunks.slice(i, i + 8));
      for (let j = 0; j < records.length; j++) {
        const r = records[j], index = i + j;
        requireThat(r.recordType === 'InternalDocumentChunk' && r.fields.documentID?.value === doc.id && r.fields.chunkIndex?.value === index, 'File chunk identity mismatch');
        const bytes = fromBase64(r.fields.data?.value);
        requireThat(bytes.length === Math.min(CHUNK_BYTES, doc.bytes - offset), 'File chunk size mismatch');
        output.set(bytes, offset); offset += bytes.length;
      }
      this.check(); progress(offset / doc.bytes);
    }
    requireThat(offset === doc.bytes && await digest(output) === doc.sha256, 'File checksum mismatch'); this.check();
    return output;
  }
  async save(records) {
    this.check(); const response = await this.db.saveRecords(records); this.check();
    if (response?.hasErrors || response?.errors?.length || response?.records?.length !== records.length || response.records.some(r => r.serverErrorCode)) throw new AccessError('CloudKit did not confirm the write');
    return response.records;
  }
  async publish(catalog, tag) {
    validateCatalog(catalog);
    if (!await this.isAdmin()) throw new AccessError('Administrator access required');
    const record = { recordType: 'InternalCatalog', recordName: CATALOG_ID, fields: { payloadJSON: { value: JSON.stringify(catalog) } }, ...(tag ? { recordChangeTag: tag } : {}) };
    return (await this.save([record]))[0];
  }
  async upload(bytes, metadata, progress = () => {}) {
    if (!await this.isAdmin()) throw new AccessError('Administrator access required');
    const packaged = await packageDocument(bytes, metadata);
    for (let i = 0; i < packaged.records.length; i += 5) {
      await this.save(packaged.records.slice(i, i + 5)); progress(Math.min(1, (i + 5) / packaged.records.length));
    }
    await this.document(packaged.document); // Read-back hash before it can appear in the catalog.
    return packaged.document;
  }
}
