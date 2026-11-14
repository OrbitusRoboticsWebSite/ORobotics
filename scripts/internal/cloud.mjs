import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
export function verifyConsoleSchemaExport(receipt, schema, profile, now = Date.now()) {
  const exportedAt = Date.parse(receipt.exportedAt), age = now - exportedAt;
  const expectedPrefix = `/dashboard/database/teams/${profile.teamID}/containers/${profile.container}/environments/PRODUCTION/`;
  let source; try { source = new URL(receipt.sourceURL); } catch { throw new Error('Invalid Console export source'); }
  if (receipt.schemaVersion !== 1 || receipt.container !== profile.container || receipt.teamID !== profile.teamID || receipt.environment !== 'production' ||
      source.origin !== 'https://icloud.developer.apple.com' || !source.pathname.startsWith(expectedPrefix) ||
      !Number.isFinite(age) || age < -60000 || age > 30 * 60000 ||
      receipt.sha256 !== createHash('sha256').update(schema).digest('hex')) {
    throw new Error('Console export is stale, mismatched or not from the verified production container');
  }
  return { method: 'operator-verified-console-export', sourceURL: source.href, exportedAt: receipt.exportedAt, sha256: receipt.sha256 };
}
export function auditSchema(schema) {
  const grants = {};
  for (const type of ['InternalCatalog','InternalDocumentChunk','InternalAdminGate','InternalStaffRoster']) {
    const body = schema.match(new RegExp(`RECORD TYPE\\s+"?${type}"?\\s*\\(([\\s\\S]*?)\\);`))?.[1];
    if (!body) throw new Error(`Missing ${type} schema`);
    const permissions = [...body.matchAll(/GRANT\s+([A-Z,\s]+?)\s+TO\s+"?([\w]+)"?/g)].flatMap(m => m[1].split(',').map(p => `${m[2]}:${p.trim()}`)).sort();
    const expected = ['InternalAdmin:CREATE','InternalAdmin:READ','InternalAdmin:WRITE'];
    if (type === 'InternalCatalog' || type === 'InternalDocumentChunk') expected.push('InternalEmployee:READ');
    if (JSON.stringify(permissions) !== JSON.stringify(expected.sort())) throw new Error(`Unexpected permissions on ${type}`);
    grants[type] = permissions;
  }
  return grants;
}
export async function readProfile(filename) {
  const profile = JSON.parse(await readFile(filename, 'utf8'));
  if (profile.container !== 'iCloud.orbitusrobotics.Internal' || profile.environment !== 'production' || !/^[A-Za-z0-9_-]{5,128}$/.test(profile.keyID || '') || !/^[A-Z0-9]{10}$/.test(profile.teamID || '') || !profile.expectedAdminRecordName || !profile.apiToken) throw new Error('Complete the dedicated production profile and verified administrator identity');
  const key = createPrivateKey(await readFile(path.resolve(path.dirname(filename), profile.privateKeyFile), 'utf8'));
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('A P-256 signing key is required');
  return { ...profile, key };
}
export function callerIdentity(response) {
  const identity = response.userRecordName ? response : response.users?.length === 1 ? response.users[0] : null;
  if (response.httpStatus !== 200 || response.serverErrorCode || !identity?.userRecordName ||
      (response.users && (response.users.length !== 1 || response.users[0].userRecordName !== identity.userRecordName))) throw new Error('CloudKit did not verify the current identity');
  return identity;
}
export class CloudClient {
  constructor(profile) { this.profile = profile; }
  async call(operation, payload, webToken = null) {
    const { container, environment, keyID, key, apiToken } = this.profile;
    const route = `/database/1/${container}/${environment}/public/${operation}`;
    const method = operation === 'users/caller' ? 'GET' : 'POST', body = method === 'GET' ? '' : JSON.stringify(payload);
    let query = '', headers = { 'Content-Type': 'application/json' };
    if (webToken !== null) {
      query = `?${new URLSearchParams({ ckAPIToken: apiToken, ...(webToken ? { ckWebAuthToken: webToken } : {}) })}`;
      headers.Origin = 'https://www.orbitusrobotics.com';
    } else {
      const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), digest = createHash('sha256').update(body).digest('base64');
      headers = { ...headers, 'X-Apple-CloudKit-Request-KeyID': keyID, 'X-Apple-CloudKit-Request-ISO8601Date': date,
        'X-Apple-CloudKit-Request-SignatureV1': sign('sha256', Buffer.from(`${date}:${digest}:${route}`), key).toString('base64') };
    }
    const response = await fetch(`https://api.apple-cloudkit.com${route}${query}`, { method, ...(method === 'POST' ? { body } : {}), headers, signal: AbortSignal.timeout(30000), redirect: 'error' });
    let data; try { data = await response.json(); } catch { throw new Error('CloudKit response was not JSON'); }
    return { httpStatus: response.status, ...data };
  }
  async fetchRecords(names) {
    const r = await this.call('records/lookup', { records: names.map(recordName => ({ recordName })) });
    return { ...r, hasErrors: !!r.serverErrorCode || !r.records || r.records.some(x => x.serverErrorCode) };
  }
  async create(record) {
    const r = await this.call('records/modify', { operations: [{ operationType: 'create', record }] });
    if (r.serverErrorCode || r.records?.length !== 1 || r.records[0].serverErrorCode || r.records[0].recordName !== record.recordName) throw new Error('CloudKit did not confirm record creation');
    return r.records[0];
  }
  async saveRecords(records) {
    const r = await this.call('records/modify', { operations: records.map(record => ({ operationType: record.recordChangeTag ? 'update' : 'create', record })) });
    return { ...r, hasErrors: !!r.serverErrorCode || !r.records || r.records.some(x => x.serverErrorCode) };
  }
}
export function deniedLookup(result, names) {
  // An unknown type, malformed request, expired token or network error is not proof of denial.
  if (result.records?.some(r => r.fields)) return false;
  if (result.serverErrorCode === 'ACCESS_DENIED') return true;
  return Array.isArray(result.records) && result.records.length === names.length && result.records.every((r, i) => r.recordName === names[i] && ['NOT_FOUND','ACCESS_DENIED'].includes(r.serverErrorCode) && !r.fields);
}
