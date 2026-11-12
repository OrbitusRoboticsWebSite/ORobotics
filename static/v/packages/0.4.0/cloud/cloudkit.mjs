// Direct CloudKit reporting. No hosted relay or third-party dependencies.
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { validateEnvelope } from './enrollment-format.mjs';

export const containerIdentifier = 'iCloud.orbitusrobotics.ViperFleet';
export const deviceIDPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export class FleetError extends Error {}
function fail(message) { throw new FleetError(message); }
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) fail('Unsupported report fields');
}
function string(value, length) {
  if (typeof value !== 'string' || !value.trim() || value.length > length || /[\u0000-\u001f\u007f]/.test(value)) fail('Invalid report value');
  return value.trim();
}
export function validateReport(value, deviceId, now = Date.now()) {
  object(value, ['schemaVersion', 'deviceId', 'hostLabel', 'os', 'agentVersion', 'reportedAt', 'health', 'summary', 'tags', 'enrollment']);
  if (Buffer.byteLength(JSON.stringify(value)) > 8192) fail('Report exceeds 8192 bytes');
  if (value.schemaVersion !== 1 || !deviceIDPattern.test(value.deviceId) || value.deviceId !== deviceId) fail('Invalid schema or profile device ID');
  object(value.os, ['family', 'flavor', 'version', 'architecture']);
  if (!['macos', 'windows', 'linux'].includes(value.os.family)) fail('Unsupported platform');
  if (!['ok', 'attention', 'unknown'].includes(value.health)) fail('Unsupported health value');
  const reportedAt = Date.parse(value.reportedAt);
  if (typeof value.reportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value.reportedAt)
      || !Number.isFinite(reportedAt) || Math.abs(now - reportedAt) > 300000) fail('reportedAt must be UTC within five minutes of the local clock');
  object(value.summary, ['installedApps', 'potentialVulnerabilities']);
  for (const count of [value.summary.installedApps, value.summary.potentialVulnerabilities])
    if (!Number.isSafeInteger(count) || count < 0 || count > 10000000) fail('Invalid summary count');
  if (!Array.isArray(value.tags) || value.tags.length > 8) fail('At most eight tags are allowed');
  return { schemaVersion: 1, deviceId, hostLabel: string(value.hostLabel, 80),
    os: { family: value.os.family, flavor: string(value.os.flavor, 64), version: string(value.os.version, 48), architecture: string(value.os.architecture, 24) },
    agentVersion: string(value.agentVersion, 32), reportedAt: new Date(reportedAt).toISOString(), health: value.health,
    summary: { installedApps: value.summary.installedApps, potentialVulnerabilities: value.summary.potentialVulnerabilities },
    tags: [...new Set(value.tags.map(tag => string(tag, 32)))],
    ...(value.enrollment ? { enrollment: validateEnvelope(value.enrollment) } : {}) };
}
export function validateCredentials(credentials) {
  if (!/^iCloud\.[A-Za-z0-9.-]+$/.test(credentials.container || '')
      || !['development', 'production'].includes(credentials.environment)
      || !/^[A-Za-z0-9_-]{1,128}$/.test(credentials.keyID || '')) fail('Set the container, environment and registered CloudKit key ID in your private profile');
  try {
    const key = createPrivateKey(credentials.privateKey);
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error();
    return key;
  } catch { fail('A readable P-256 private key is required'); }
}
export function cloudKitHeaders(body, path, credentials, now = Date.now()) {
  const key = validateCredentials(credentials);
  const date = new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const digest = createHash('sha256').update(body).digest('base64');
  // Node's default ECDSA encoding is the ASN.1 DER format CloudKit requires.
  const signature = sign('sha256', Buffer.from(`${date}:${digest}:${path}`), key).toString('base64');
  return { 'Content-Type': 'application/json', 'X-Apple-CloudKit-Request-KeyID': credentials.keyID,
    'X-Apple-CloudKit-Request-ISO8601Date': date, 'X-Apple-CloudKit-Request-SignatureV1': signature };
}
async function request(operation, payload, credentials, now, fetcher) {
  const path = `/database/1/${credentials.container}/${credentials.environment}/public/records/${operation}`;
  const body = JSON.stringify(payload), headers = cloudKitHeaders(body, path, credentials, now);
  let response;
  try {
    const result = await fetcher(`https://api.apple-cloudkit.com${path}`, {
      method: 'POST', headers, body, signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    if (!result.ok) fail(`CloudKit returned HTTP ${result.status}; check the key, schema and environment`);
    response = await result.json();
  } catch (error) {
    if (error instanceof FleetError) throw error;
    fail('CloudKit request failed; no successful receipt was confirmed');
  }
  if (response.serverErrorCode || !Array.isArray(response.records) || response.records.length !== 1) fail('CloudKit returned an invalid record response');
  return response.records[0];
}
export async function saveReport(value, credentials, { now = Date.now(), fetcher = fetch } = {}) {
  const report = validateReport(value, credentials.deviceId, now);
  validateCredentials(credentials);
  const recordName = `device-${report.deviceId}`;
  const existing = await request('lookup', { records: [{ recordName }], desiredKeys: ['payloadJSON'] }, credentials, now, fetcher);
  const missing = existing?.serverErrorCode === 'NOT_FOUND';
  if (!missing) {
    if (!existing || existing.serverErrorCode || existing.recordName !== recordName || !existing.recordChangeTag) fail('CloudKit could not read the existing report');
    let previous;
    try { previous = JSON.parse(existing.fields?.payloadJSON?.value); } catch { fail('The existing report is malformed; inspect it before replacing it'); }
    if (!Number.isFinite(Date.parse(previous.reportedAt))) fail('The existing report has no usable report timestamp');
    if (Date.parse(previous.reportedAt) >= Date.parse(report.reportedAt)) fail('A report with this timestamp or later is already stored');
  }
  const record = await request('modify', { operations: [{ operationType: missing ? 'create' : 'update', record: {
    recordType: 'ViperFleetStatus', recordName,
    ...(missing ? {} : { recordChangeTag: existing.recordChangeTag }),
    fields: { deviceId: { value: report.deviceId }, hostLabel: { value: report.hostLabel },
      platform: { value: report.os.family }, payloadJSON: { value: JSON.stringify(report) } },
  } }] }, credentials, now, fetcher);
  if (['CONFLICT', 'EXISTS'].includes(record?.serverErrorCode)) fail('Another report arrived; retry with a fresh timestamp');
  if (record?.serverErrorCode === 'ACCESS_DENIED') fail('CloudKit denied the write; assign FleetReporter to the registered key owner in this environment');
  const acceptedAt = record?.modified?.timestamp;
  if (!record || record.serverErrorCode || record.recordName !== recordName || !record.recordChangeTag
      || typeof acceptedAt !== 'number' || !Number.isFinite(acceptedAt) || acceptedAt < 0 || acceptedAt > 8640000000000000)
    fail('CloudKit did not acknowledge this report with a server timestamp');
  return { accepted: true, deviceId: report.deviceId, recordName, receivedAt: new Date(acceptedAt).toISOString(),
    container: credentials.container, environment: credentials.environment };
}
