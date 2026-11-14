import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PortalRepository, AccessError, packageDocument, validateCatalog, safeURL, CHUNK_BYTES, CATALOG_ID, ADMIN_ID, identityName } from '../static/internal/core.mjs';
import { internalConfig } from '../scripts/configure-internal.mjs';
import { auditSchema, deniedLookup, CloudClient } from '../scripts/internal/cloud.mjs';
import { generateKeyPairSync, verify, createHash } from 'node:crypto';
const meta = { title: 'Synthetic QA file', filename: 'synthetic.txt', mime: 'text/plain', category: 'QA', summary: 'Invented test bytes', version: '1.0', date: '2026-11-13' };
const emptyCatalog = () => ({ schemaVersion: 1, title: 'Synthetic test catalog', updatedAt: '2026-11-13', documents: [], news: [], work: [], whitepapers: [] });
function fakeDB(records, options = {}) {
  const data = new Map(records.map(r => [r.recordName, structuredClone(r)]));
  let writes = 0;
  return { get writes() { return writes; }, data,
    async fetchRecords(names) { if (options.denied) return { hasErrors: true, errors: [{ code: 'ACCESS_DENIED' }], records: [] }; return { records: names.map(name => data.get(name)).filter(Boolean) }; },
    async saveRecords(records) { writes += records.length; if (options.writeDenied) return { hasErrors: true, errors: [{ code: 'ACCESS_DENIED' }], records: [] }; for (const r of records) data.set(r.recordName, structuredClone(r)); return { records }; },
  };
}
test('disabled default has no token and enabled configuration requires the exact container plus verification', () => {
  assert.equal(internalConfig({}).enabled, false); assert.equal(internalConfig({ ORBITUS_INTERNAL_API_TOKEN: 'anything' }).apiToken, '');
  assert.throws(() => internalConfig({ ORBITUS_INTERNAL_ENABLED: 'true', ORBITUS_INTERNAL_API_TOKEN: 'public-browser-token' }), /verification/);
  assert.equal(internalConfig({ ORBITUS_INTERNAL_ENABLED: 'true', ORBITUS_INTERNAL_ACCESS_VERIFIED: 'true', ORBITUS_INTERNAL_API_TOKEN: 'public-browser-token' }).environment, 'production');
});
test('anonymous or unapproved users cannot read a catalog even if a response includes records', async () => {
  const record = { recordName: CATALOG_ID, recordType: 'InternalCatalog', fields: { payloadJSON: { value: JSON.stringify(emptyCatalog()) } } };
  const db = { async fetchRecords() { return { hasErrors: true, records: [record] }; } };
  await assert.rejects(new PortalRepository(db).catalog(), AccessError);
});
test('a signed-in identity is not treated as employee authorization', async () => {
  assert.equal(identityName({ userRecordName: 'signed-in-but-unapproved' }), 'signed-in-but-unapproved');
  await assert.rejects(new PortalRepository(fakeDB([], { denied: true })).catalog(), AccessError);
});
test('sign-out during an in-flight response discards the response', async () => {
  let valid = true;
  const db = { async fetchRecords() { valid = false; return { records: [{ recordName: CATALOG_ID, recordType: 'InternalCatalog', fields: { payloadJSON: { value: JSON.stringify(emptyCatalog()) } } }] }; } };
  await assert.rejects(new PortalRepository(db, () => valid).catalog(), /Session ended/);
});
test('multi-chunk binary round trip preserves bytes and hash despite record reordering', async () => {
  const bytes = new Uint8Array(CHUNK_BYTES + 137); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const { document, records } = await packageDocument(bytes, meta);
  const db = fakeDB(records); const original = db.fetchRecords; db.fetchRecords = async names => { const r = await original(names); r.records.reverse(); return r; };
  assert.deepEqual(await new PortalRepository(db).document(document), bytes);
});
test('missing, duplicate, swapped or corrupted chunks cannot produce a download', async () => {
  const { document, records } = await packageDocument(new Uint8Array(CHUNK_BYTES + 1).fill(42), meta);
  await assert.rejects(new PortalRepository(fakeDB(records.slice(0, 1))).document(document), AccessError);
  const db = fakeDB(records); db.data.get(records[0].recordName).fields.chunkIndex.value = 1;
  await assert.rejects(new PortalRepository(db).document(document), /identity mismatch/);
  const corrupted = fakeDB(records); corrupted.data.get(records[1].recordName).fields.data.value = 'AA==';
  await assert.rejects(new PortalRepository(corrupted).document(document), /checksum mismatch/);
  const duplicate = { async fetchRecords() { return { records: [records[0], records[0]] }; } };
  await assert.rejects(new PortalRepository(duplicate).document(document), /Invalid record response/);
});
test('a valid employee cannot publish without the administrator gate', async () => {
  const db = fakeDB([]); await assert.rejects(new PortalRepository(db).publish(emptyCatalog(), 'old-tag'), /Administrator/); assert.equal(db.writes, 0);
});
test('server write denials are surfaced and not reported as successful publication', async () => {
  const db = fakeDB([{ recordName: ADMIN_ID, recordType: 'InternalAdminGate', fields: { enabled: { value: 1 } } }], { writeDenied: true });
  await assert.rejects(new PortalRepository(db).publish(emptyCatalog(), 'old-tag'), AccessError);
});
test('catalog write carries the fetched change tag so conflicting edits are not forced', async () => {
  const db = fakeDB([{ recordName: ADMIN_ID, recordType: 'InternalAdminGate', fields: { enabled: { value: 1 } } }]);
  await new PortalRepository(db).publish(emptyCatalog(), 'expected-etag'); assert.equal(db.data.get(CATALOG_ID).recordChangeTag, 'expected-etag');
});
test('unsafe links, unsupported files and excessive catalog content are rejected', async () => {
  assert.equal(safeURL('javascript:alert(1)'), ''); assert.equal(safeURL('https://user:password@example.com'), ''); assert.equal(safeURL('//example.com'), '');
  const c = emptyCatalog(); c.news = [{ id: 'x', title: 'x', summary: 'x', links: [{ label: 'x', url: 'data:text/html,unsafe' }] }]; assert.throws(() => validateCatalog(c));
  await assert.rejects(packageDocument(new Uint8Array([1]), { ...meta, filename: '../file.txt' }));
  await assert.rejects(packageDocument(new Uint8Array([1]), { ...meta, mime: 'text/html', filename: 'file.html' }));
});
test('private record types have only explicit employee and administrator grants', async () => {
  const schema = await readFile(new URL('../scripts/internal/schema.ckdb', import.meta.url), 'utf8');
  for (const type of ['InternalCatalog','InternalDocumentChunk','InternalAdminGate','InternalStaffRoster']) {
    const body = schema.split(`RECORD TYPE ${type} (`)[1].split(');')[0];
    assert.doesNotMatch(body, /GRANT\s+[^\n]*TO\s+"?_(?:world|icloud|creator)/); assert.match(body, /GRANT CREATE, READ, WRITE TO InternalAdmin/);
    if (['InternalAdminGate','InternalStaffRoster'].includes(type)) assert.doesNotMatch(body, /TO InternalEmployee/);
    else assert.match(body, /GRANT READ TO InternalEmployee/);
  }
});
test('public shell contains no private company content, local paths, PDFs or persisted session cache', async () => {
  const directory = new URL('../static/internal/', import.meta.url);
  for (const file of await readdir(directory)) {
    assert.ok(['index.html','portal.css','portal.mjs','core.mjs','config.json'].includes(file), `Unexpected static file ${file}`);
    const source = await readFile(new URL(file, directory), 'utf8');
    assert.doesNotMatch(source, /\/Users\/|BEGIN PRIVATE KEY|localStorage|sessionStorage|indexedDB/);
  }
  const source = await readFile(new URL('../static/internal/portal.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.innerHTML\s*=/); assert.match(source, /persist: false/); assert.match(source, /revokeObjectURL/);
});
test('production schema audit rejects authenticated-default access and excess employee privileges', async () => {
  const schema = await readFile(new URL('../scripts/internal/schema.ckdb', import.meta.url), 'utf8');
  assert.equal(Object.keys(auditSchema(schema)).length, 4);
  assert.throws(() => auditSchema(schema.replace('GRANT READ TO InternalEmployee', 'GRANT READ TO "_icloud"')));
  assert.throws(() => auditSchema(schema.replace('GRANT READ TO InternalEmployee', 'GRANT READ, WRITE TO InternalEmployee')));
});
test('access denial checks reject expired authentication, unrelated errors and leaked fields', () => {
  assert.equal(deniedLookup({ serverErrorCode: 'AUTHENTICATION_FAILED' }, ['known']), false);
  assert.equal(deniedLookup({ serverErrorCode: 'BAD_REQUEST' }, ['known']), false);
  assert.equal(deniedLookup({ serverErrorCode: 'ACCESS_DENIED', records: [{ fields: { private: 'x' } }] }, ['known']), false);
  assert.equal(deniedLookup({ records: [{ recordName: 'known', serverErrorCode: 'NOT_FOUND' }] }, ['known']), true);
});
test('CloudKit signed requests use UTC seconds and sign the exact request body and path', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const original = globalThis.fetch;
  globalThis.fetch = async (url, request) => {
    const date = request.headers['X-Apple-CloudKit-Request-ISO8601Date']; assert.match(date, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    const bodyHash = createHash('sha256').update(request.body).digest('base64');
    assert.equal(verify('sha256', Buffer.from(`${date}:${bodyHash}:${new URL(url).pathname}`), publicKey, Buffer.from(request.headers['X-Apple-CloudKit-Request-SignatureV1'], 'base64')), true);
    return { status: 200, json: async () => ({ userRecordName: 'synthetic-owner' }) };
  };
  try { const response = await new CloudClient({ container: 'iCloud.orbitusrobotics.Internal', environment: 'production', keyID: 'synthetic', key: privateKey }).call('users/caller', {}); assert.equal(response.userRecordName, 'synthetic-owner'); }
  finally { globalThis.fetch = original; }
});
