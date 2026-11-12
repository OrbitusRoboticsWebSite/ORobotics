import { cloudKitHeaders, FleetError } from './cloudkit.mjs';
import { check, blobName, validateDescriptor } from './queue-format.mjs';

export class FleetCloud {
  constructor(credentials, fetcher = fetch) { this.credentials = credentials; this.fetcher = fetcher; }
  async request(operation, payload) {
    const c = this.credentials, route = `/database/1/${c.container}/${c.environment}/public/records/${operation}`;
    const body = JSON.stringify(payload);
    const response = await this.fetcher(`https://api.apple-cloudkit.com${route}`, { method: 'POST', body,
      headers: cloudKitHeaders(body, route, c), redirect: 'error', signal: this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
    if (!response.ok) throw new FleetError(`CloudKit HTTP ${response.status}; no queue receipt confirmed`);
    const result = await response.json();
    if (result.serverErrorCode || !Array.isArray(result.records)) throw new FleetError('CloudKit queue response was rejected');
    return result;
  }
  async lookup(name) {
    const r = (await this.request('lookup', { records: [{ recordName: name }] })).records[0];
    if (r?.serverErrorCode === 'NOT_FOUND') return null;
    check(r && !r.serverErrorCode && r.recordName === name && r.recordChangeTag, 'Could not read queue record'); return r;
  }
  async save(record, create = false) {
    const r = (await this.request('modify', { operations: [{ operationType: create ? 'create' : 'update', record }] })).records[0];
    check(r && !r.serverErrorCode && r.recordName === record.recordName && r.recordChangeTag
      && Number.isFinite(r.modified?.timestamp), 'Queue write was not acknowledged (permission or concurrent change)'); return r;
  }
  async jobs(deviceId) {
    let cursor; const found = [], seen = new Set();
    for (let p = 0; p < 100; p++) {
      const response = await this.request('query', { query: { recordType: 'ViperFleetCommand', filterBy: [
        { fieldName: 'deviceId', comparator: 'EQUALS', fieldValue: { value: deviceId } }],
        sortBy: [{ fieldName: 'createdAt', ascending: true }] }, resultsLimit: 100, ...(cursor ? { continuationMarker: cursor } : {}) });
      check(response.records.every(r => !r.serverErrorCode), 'Queue query failed'); found.push(...response.records);
      cursor = response.continuationMarker; if (!cursor) return found;
      check(!seen.has(cursor), 'Repeated CloudKit cursor'); seen.add(cursor);
    }
    throw new FleetError('Queue exceeded 10,000 jobs; archive completed jobs before continuing');
  }
}
export async function putMessage(cloud, encrypted, deviceId, jobId, purpose) {
  for (let i = 0; i < encrypted.chunks.length; i++) {
    const name = blobName(jobId, purpose, i, encrypted.descriptor.sha256);
    const existing = await cloud.lookup(name);
    if (existing) { check(existing.fields?.data?.value === encrypted.chunks[i], 'Encrypted chunk collision'); continue; }
    await cloud.save({ recordType: 'ViperFleetBlob', recordName: name, fields: {
      deviceId: { value: deviceId }, jobId: { value: jobId }, data: { value: encrypted.chunks[i] } } }, true);
  }
  return JSON.stringify(encrypted.descriptor);
}
export async function getMessage(cloud, serialized, jobId, purpose) {
  check(typeof serialized === 'string' && serialized.length < 2048, 'Missing encrypted message');
  const d = validateDescriptor(JSON.parse(serialized)), chunks = [];
  for (let i = 0; i < d.chunks; i++) {
    const r = await cloud.lookup(blobName(jobId, purpose, i, d.sha256));
    check(typeof r?.fields?.data?.value === 'string' && r.fields.data.value.length <= 350000, 'Encrypted chunk unavailable'); chunks.push(r.fields.data.value);
  }
  return { descriptor: d, chunks };
}
