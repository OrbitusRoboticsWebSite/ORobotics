#!/usr/bin/env node
// Production only. Never print tokens, private file contents or Apple error bodies.
import { readFile, writeFile, mkdtemp, chmod } from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CloudClient, readProfile, auditSchema, deniedLookup, verifyConsoleSchemaExport, callerIdentity } from './cloud.mjs';
import { PortalRepository, validateCatalog, CATALOG_ID, ADMIN_ID } from '../../static/internal/core.mjs';
const run = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => { if (v.startsWith('--')) a.push([v.slice(2), all[i + 1]]); return a; }, []));
try {
  if (!args.profile || !args.package || !args.receipt) throw new Error('Required: --profile, --package and --receipt (private paths)');
  const p = await readProfile(args.profile), client = new CloudClient(p);
  let schema, schemaEvidence;
  if (args['console-schema-receipt']) {
    const receiptPath = path.resolve(args['console-schema-receipt']);
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    if (!receipt.schemaFile || !path.isAbsolute(receipt.schemaFile)) throw new Error('Console schema receipt needs an absolute export path');
    schema = await readFile(receipt.schemaFile, 'utf8');
    schemaEvidence = verifyConsoleSchemaExport(receipt, schema, p);
  } else {
    const temp = await mkdtemp(path.join(tmpdir(), 'orbitus-schema-')); await chmod(temp, 0o700);
    const schemaFile = path.join(temp, 'production.ckdb');
    try { await run('xcrun', ['cktool','export-schema','--team-id',p.teamID,'--container-id',p.container,'--environment','production','--output-file',schemaFile], { timeout: 60000 }); }
    catch { throw new Error('Production schema export failed. Use a Keychain management token or a freshly verified Console export receipt. No content was uploaded.'); }
    schema = await readFile(schemaFile, 'utf8');
    schemaEvidence = { method: 'cktool-live-export', exportedAt: new Date().toISOString() };
  }
  const grants = auditSchema(schema);
  const owner = callerIdentity(await client.call('users/caller', {}));
  if (owner.userRecordName !== p.expectedAdminRecordName) throw new Error('Signing key owner does not match the verified administrator');
  let unapprovedToken, stranger;
  if (args['unapproved-token-file']) {
    unapprovedToken = (await readFile(args['unapproved-token-file'], 'utf8')).trim();
    if (!unapprovedToken) throw new Error('The test-account token is empty');
    stranger = callerIdentity(await client.call('users/caller', {}, unapprovedToken));
    if (!stranger.userRecordName || stranger.userRecordName === owner.userRecordName) throw new Error('The negative-test account must be signed in and different from the administrator');
  }
  const id = randomUUID(), canaries = [
    { recordName: `internal-probe-${id}-catalog`, recordType: 'InternalCatalog', fields: { payloadJSON: { value: '{"synthetic":true}' } } },
    { recordName: `internal-probe-${id}-file`, recordType: 'InternalDocumentChunk', fields: { documentID: { value: id }, chunkIndex: { value: 0 }, data: { value: 'c3ludGhldGlj' } } },
    { recordName: `internal-probe-${id}-admin`, recordType: 'InternalAdminGate', fields: { enabled: { value: 1 } } },
    { recordName: `internal-probe-${id}-roster`, recordType: 'InternalStaffRoster', fields: { payloadJSON: { value: '{"synthetic":true}' } } },
  ];
  for (const r of canaries) await client.create(r);
  const names = canaries.map(r => r.recordName), ownerRead = await client.fetchRecords(names);
  if (ownerRead.hasErrors || ownerRead.records.length !== names.length) throw new Error('Administrator canary read failed');
  for (const token of ['', ...(unapprovedToken ? [unapprovedToken] : [])]) {
    const r = await client.call('records/lookup', { records: names.map(recordName => ({ recordName })) }, token);
    if (!deniedLookup(r, names)) throw new Error('Anonymous or unapproved-account denial was not established. No private content uploaded.');
  }
  const packet = JSON.parse(await readFile(args.package, 'utf8'));
  if (packet.schemaVersion !== 1 || packet.container !== p.container || !Array.isArray(packet.records)) throw new Error('Invalid private import');
  const next = validateCatalog(packet.catalog), expectedNames = next.documents.flatMap(d => d.chunks);
  if (packet.records.length !== expectedNames.length || new Set(packet.records.map(r => r.recordName)).size !== expectedNames.length || packet.records.some(r => !expectedNames.includes(r.recordName))) throw new Error('Import contains unexpected records');
  const localRecords = new Map(packet.records.map(r => [r.recordName, r]));
  const local = new PortalRepository({ fetchRecords: async requested => ({ records: requested.map(n => localRecords.get(n)).filter(Boolean) }) });
  for (const doc of next.documents) await local.document(doc);
  // Guard against accidentally replacing another catalog on first publication.
  const existing = await client.call('records/lookup', { records: [{ recordName: CATALOG_ID }, { recordName: ADMIN_ID }] });
  if (existing.serverErrorCode || existing.records?.length !== 2) throw new Error('Cannot inspect existing catalog');
  const old = existing.records.find(r => r.recordName === CATALOG_ID), gate = existing.records.find(r => r.recordName === ADMIN_ID);
  if (!old || (old.serverErrorCode && old.serverErrorCode !== 'NOT_FOUND') || !gate || (gate.serverErrorCode && gate.serverErrorCode !== 'NOT_FOUND')) throw new Error('Existing catalog access failed');
  if (gate.serverErrorCode === 'NOT_FOUND') await client.create({ recordType: 'InternalAdminGate', recordName: ADMIN_ID, fields: { enabled: { value: 1 } } });
  const remote = new PortalRepository(client);
  if (!await remote.isAdmin()) throw new Error('Administrator gate not verified');
  for (const record of packet.records) {
    const r = await client.call('records/lookup', { records: [{ recordName: record.recordName }] });
    const found = r.records?.[0];
    if (found?.serverErrorCode === 'NOT_FOUND') await client.create(record);
    else if (!found || found.serverErrorCode || Object.entries(record.fields).some(([k, v]) => JSON.stringify(found.fields?.[k]?.value) !== JSON.stringify(v.value))) throw new Error('Existing immutable file chunk does not match import');
  }
  for (const doc of next.documents) await remote.document(doc);
  if (!old.serverErrorCode) {
    const previous = validateCatalog(JSON.parse(old.fields.payloadJSON.value)); const merged = new Map(previous.documents.map(d => [d.id, d]));
    for (const d of next.documents) merged.set(d.id, d); next.documents = [...merged.values()];
  }
  next.updatedAt = new Date().toISOString(); await remote.publish(next, old.recordChangeTag);
  const final = await remote.catalog();
  if (JSON.stringify(final.catalog) !== JSON.stringify(next)) throw new Error('Published catalog did not match read-back');
  await writeFile(args.receipt, JSON.stringify({ checkedAt: new Date().toISOString(), container: p.container, environment: p.environment, schemaEvidence, grants, adminRecordName: owner.userRecordName, negativeTestRecordName: stranger?.userRecordName || null, anonymousDenied: true, unapprovedAuthenticatedDenied: stranger ? true : null, documentCount: next.documents.length, documents: next.documents.map(({ id, filename, sha256, bytes }) => ({ id, filename, sha256, bytes })), canaryRecordNames: names, catalogTag: final.tag }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`Published and verified ${next.documents.length} private documents. Receipt saved locally. Membership grants are separate.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
