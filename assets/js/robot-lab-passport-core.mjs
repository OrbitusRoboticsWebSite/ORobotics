export const ROB_SCHOOL_TOTAL = 80;
export const ROB_SCHOOL_VERSION = 'school-80-v1';

export function normalizeCompleted(values, total = ROB_SCHOOL_TOTAL) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => Number.isInteger(value) && value >= 0 && value < total))]
    .sort((left, right) => left - right);
}

export function mergeCompleted(...collections) {
  return normalizeCompleted(collections.flat());
}

export function encodeProgress(values, total = ROB_SCHOOL_TOTAL) {
  const completed = new Set(normalizeCompleted(values, total));
  let bits = '';
  for (let start = 0; start < total; start += 4) {
    let nibble = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      if (completed.has(start + offset)) nibble |= 1 << offset;
    }
    bits += nibble.toString(16);
  }
  return `${ROB_SCHOOL_VERSION}:${bits}`;
}

export function decodeProgress(value, total = ROB_SCHOOL_TOTAL) {
  const [version, bits = ''] = String(value || '').split(':');
  if (version !== ROB_SCHOOL_VERSION || !/^[0-9a-f]+$/i.test(bits)) return [];
  const completed = [];
  for (let nibbleIndex = 0; nibbleIndex < bits.length; nibbleIndex += 1) {
    const nibble = Number.parseInt(bits[nibbleIndex], 16);
    for (let offset = 0; offset < 4; offset += 1) {
      const missionIndex = nibbleIndex * 4 + offset;
      if (missionIndex < total && nibble & (1 << offset)) completed.push(missionIndex);
    }
  }
  return completed;
}

export function cleanMakerName(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24) || 'ROB MAKER';
}

export function rewardCodeFromHex(hex) {
  const clean = String(hex || '').replace(/[^a-f0-9]/gi, '').toUpperCase().padEnd(12, '0');
  return clean.slice(0, 12).match(/.{1,4}/g).join('-');
}
