export const platformNames = { macos: 'macOS', windows: 'Windows', linux: 'Linux' };
export const staleAfterMS = 15 * 60 * 1000;
export function isRecent(record, now = Date.now()) {
  const age = now - Date.parse(record.receivedAt);
  return Number.isFinite(age) && age >= -60000 && age <= staleAfterMS;
}
export function versionLabel(record) {
  return [record.os?.flavor, record.os?.version].filter(Boolean).join(' · ');
}
export function filterMachines(records, { search = '', platform = '', flavor = '', status = '' } = {}, now = Date.now()) {
  const needle = search.trim().toLocaleLowerCase();
  return records.filter(r => (!platform || r.os?.family === platform)
    && (!flavor || versionLabel(r) === flavor)
    && (!status || (status === 'recent' ? isRecent(r, now) : status === 'stale' ? !isRecent(r, now) : r.health === status))
    && (!needle || [r.hostLabel, r.deviceId, platformNames[r.os?.family], r.os?.flavor, r.os?.version, ...(r.tags || [])].join(' ').toLocaleLowerCase().includes(needle)))
    .sort((a, b) => (Date.parse(b.receivedAt) || 0) - (Date.parse(a.receivedAt) || 0) || a.hostLabel.localeCompare(b.hostLabel));
}
export function exampleReport(now = Date.now()) {
  return { schemaVersion: 1, deviceId: '00000000-0000-4000-8000-000000000001', hostLabel: 'Example workstation',
    os: { family: 'macos', flavor: 'macOS', version: '26.0', architecture: 'arm64' },
    agentVersion: '0.1.0', reportedAt: new Date(now).toISOString(), health: 'unknown',
    summary: { installedApps: 42, potentialVulnerabilities: 0 }, tags: ['example'] };
}
export function sampleMachines(now = Date.now()) {
  return [
    ['Design Mac', 'macos', 'macOS', '26.0', 'arm64', 'ok', 2, { installedApps: 82, potentialVulnerabilities: 0 }, 'design'],
    ['Build workstation', 'windows', 'Windows 11 Pro', '24H2', 'x86_64', 'attention', 6, { installedApps: 64, potentialVulnerabilities: 3 }, 'engineering'],
    ['Lab node', 'linux', 'Ubuntu', '24.04 LTS', 'x86_64', 'unknown', 93, {}, 'lab', '0.5.2'],
    ['Studio Mac', 'macos', 'macOS', '15.7', 'arm64', 'ok', 11, { installedApps: 51, potentialVulnerabilities: 0 }, 'studio'],
    ['Compute node', 'linux', 'Debian', '13', 'arm64', 'ok', 4, { installedApps: 37, potentialVulnerabilities: 0 }, 'engineering'],
  ].map(([hostLabel, family, flavor, version, architecture, health, minutes, summary, tag, agentVersion = '0.1.0'], index) => ({
    ...exampleReport(now - minutes * 60000), deviceId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    hostLabel, os: { family, flavor, version, architecture }, health, summary, agentVersion,
    tags: ['sample', tag], receivedAt: new Date(now - minutes * 60000).toISOString(), sample: true,
  }));
}
export function decodeRecord(record) {
  const payload = record?.fields?.payloadJSON?.value;
  if (typeof payload !== 'string' || payload.length > 8192) throw new Error('Invalid report');
  const r = JSON.parse(payload);
  if (!r || r.schemaVersion !== 1 || typeof r.deviceId !== 'string' || typeof r.hostLabel !== 'string'
      || !platformNames[r.os?.family] || !['ok', 'attention', 'unknown'].includes(r.health)
      || !Array.isArray(r.tags) || !r.tags.every(t => typeof t === 'string')) throw new Error('Invalid report');
  const received = record.modified?.timestamp;
  if (typeof received !== 'number' || !Number.isFinite(received) || received < 0 || received > 8640000000000000) throw new Error('Missing receipt time');
  if (r.enrollment && record.recordName !== `device-${r.deviceId}`) throw new Error('Enrollment record identity mismatch');
  return { ...r, receivedAt: new Date(received).toISOString() };
}
const groupSlug = /^[a-z][a-z0-9]{0,23}$/;
function validGroup(value) { return typeof value === 'string' && groupSlug.test(value); }

export function inventoryGroups(groups = []) {
  if (!Array.isArray(groups) || !groups.every(validGroup) || new Set(groups).size !== groups.length) {
    throw new Error('Inventory groups must be an array of unique, lowercase group slugs');
  }
  return groups;
}

export async function queryFleet(database, isCurrent = () => true, group = '') {
  if (group !== '' && !validGroup(group)) throw new Error('Invalid inventory group');
  const recordType = group === '' ? 'ViperFleetStatus' : `InventoryGroup_${group}`;
  let query = { recordType, sortBy: [{ systemFieldName: 'modifiedTimestamp', ascending: false }] };
  const byID = new Map(), seen = new Set();
  for (let page = 0; page < 50; page++) {
    const response = await database.performQuery(query, { resultsLimit: 100, desiredKeys: ['payloadJSON'] });
    if (!isCurrent()) throw new Error('Load superseded');
    if (response.hasErrors || response.errors?.length || !Array.isArray(response.records)) throw new Error('Access unavailable');
    for (const record of response.records) {
      if (record.recordType !== undefined && record.recordType !== recordType) throw new Error('Unexpected record type');
      const r = decodeRecord(record);
      if (group && r.os.family !== 'macos') continue;
      if (!byID.has(r.deviceId)) byID.set(r.deviceId, r);
    }
    if (!response.continuationMarker) return [...byID.values()];
    if (seen.has(response.continuationMarker)) throw new Error('Repeated query cursor');
    seen.add(response.continuationMarker);
    // CloudKit JS accepts its QueryResponse object to continue a query.
    query = response;
  }
  throw new Error('Fleet exceeds this preview limit');
}
