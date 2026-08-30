export const ROB_DROID_PROFILE_VERSION = 1;
export const ROB_DROID_PROFILE_STORAGE_KEY = 'rob-droid-profile-v1';
export const ROB_DROID_CODE_PREFIX = 'ROBDROID1';

export const droidFinishes = [
  { id: 'graphite', name: 'Graphite', color: 0x45515d },
  { id: 'rescueOrange', name: 'Rescue Orange', color: 0xe06b2f },
  { id: 'arcticWhite', name: 'Arctic White', color: 0xe5edf2 },
  { id: 'cobaltBlue', name: 'Cobalt Blue', color: 0x2769ba },
  { id: 'tacticalGreen', name: 'Tactical Green', color: 0x4d7151 },
  { id: 'solarYellow', name: 'Solar Yellow', color: 0xf6c945 },
  { id: 'plasmaPurple', name: 'Plasma Purple', color: 0x824de3 },
  { id: 'makerPink', name: 'Maker Pink', color: 0xe24a9a },
];

export const droidFaceColors = [
  { id: 'lime', name: 'Lime', color: 0x5cff6b },
  { id: 'cyan', name: 'Cyan', color: 0x52e8ff },
  { id: 'amber', name: 'Amber', color: 0xffb43b },
  { id: 'magenta', name: 'Magenta', color: 0xff62d0 },
  { id: 'white', name: 'White', color: 0xf2f7ff },
  { id: 'red', name: 'Red', color: 0xff5268 },
];

export const droidHousingMaterials = [
  { id: 'powderCoatedSteel', name: 'Powder-coated steel', note: 'Tough panels with a durable colored finish.', metalness: .68, roughness: .5 },
  { id: 'brushedAluminum', name: 'Brushed aluminum', note: 'Light, bright panels with a metallic sheen.', metalness: .9, roughness: .28 },
  { id: 'impactPolymer', name: 'Impact polymer', note: 'Rounded nonmetal panels for a friendly maker-floor shell.', metalness: .06, roughness: .72 },
  { id: 'carbonComposite', name: 'Carbon composite', note: 'Dark lightweight panels reserved for advanced builds.', metalness: .18, roughness: .38 },
];

export const droidHousingStyles = [
  { id: 'fieldShell', name: 'Field shell', note: 'Full service panels protect wiring and connectors.' },
  { id: 'openMakerFrame', name: 'Open maker frame', note: 'Color-coded covers leave teaching systems visible.' },
  { id: 'festivalArmor', name: 'Festival armor', note: 'Rounded high-visibility panels for the Maker Faire floor.' },
];

export const droidSectionDefinitions = [
  { id: 'treads', name: 'Tread system', icon: '🛞', startBuild: 26, endBuild: 38, summary: 'Treads, H-bridges, encoders, closed-loop speed, and battery telemetry.' },
  { id: 'torso', name: 'Torso & rotation', icon: '🧭', startBuild: 51, endBuild: 57, summary: '24 V distribution, torso stepper, homing, and rotating power return.' },
  { id: 'cameraNetwork', name: 'Camera & network', icon: '🛰️', startBuild: 58, endBuild: 64, summary: 'RPLIDAR, USB 3 slip ring, Orbi LAN, Insta360, and link monitoring.' },
  { id: 'bellyCompute', name: 'Belly compute', icon: '🖥️', startBuild: 65, endBuild: 70, summary: 'Protected 12 V compute rail, sealed inverter boundary, and startup tests.' },
  { id: 'arms', name: 'Arm system', icon: '🦾', startBuild: 71, endBuild: 77, summary: '48 V arm power, contactor, CAN, Ubuntu gateway, and bounded commands.' },
  { id: 'commissioned', name: 'Mission-ready ROB', icon: '🏁', startBuild: 78, endBuild: 80, summary: 'Commissioning sequence, watchdog proof, passport, and Maker Faire handoff.' },
];

const validID = (value, values, fallback) => values.some(({ id }) => id === value) ? value : fallback;
const cleanSections = (values) => {
  const allowed = new Set(droidSectionDefinitions.map(({ id }) => id));
  return [...new Set(Array.isArray(values) ? values.filter((value) => allowed.has(value)) : [])]
    .sort((left, right) => [...allowed].indexOf(left) - [...allowed].indexOf(right));
};

export const cleanDroidName = (value) => String(value || '')
  .replace(/[^A-Za-z0-9 _-]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 20) || 'ROB MAKER';

export const defaultDroidProfile = () => ({
  version: ROB_DROID_PROFILE_VERSION,
  name: 'ROB MAKER',
  finish: 'graphite',
  faceColor: 'lime',
  material: 'powderCoatedSteel',
  housing: 'fieldShell',
  sections: [],
  weaponMount: 'panTiltGatling',
  targetLaser: 'red',
  trainingBeam: 'blue',
});

export function sanitizeDroidProfile(value = {}) {
  const fallback = defaultDroidProfile();
  return {
    version: ROB_DROID_PROFILE_VERSION,
    name: cleanDroidName(value.name),
    finish: validID(value.finish, droidFinishes, fallback.finish),
    faceColor: validID(value.faceColor, droidFaceColors, fallback.faceColor),
    material: validID(value.material, droidHousingMaterials, fallback.material),
    housing: validID(value.housing, droidHousingStyles, fallback.housing),
    sections: cleanSections(value.sections),
    weaponMount: 'panTiltGatling',
    targetLaser: 'red',
    trainingBeam: 'blue',
  };
}

export function droidSectionProgress(completedBuildIndices = []) {
  const complete = new Set((Array.isArray(completedBuildIndices) ? completedBuildIndices : [])
    .filter((value) => Number.isInteger(value) && value >= 0));
  return droidSectionDefinitions.map((section) => {
    const required = Array.from({ length: section.endBuild - section.startBuild + 1 }, (_, offset) => section.startBuild - 1 + offset);
    const completed = required.filter((index) => complete.has(index)).length;
    return { ...section, completed, required: required.length, assembled: completed === required.length };
  });
}

export function profileWithCurriculum(profile, completedBuildIndices) {
  const existing = sanitizeDroidProfile(profile);
  return sanitizeDroidProfile({
    ...existing,
    sections: [
      ...existing.sections,
      ...droidSectionProgress(completedBuildIndices).filter(({ assembled }) => assembled).map(({ id }) => id),
    ],
  });
}

function compactProfile(profile) {
  const value = sanitizeDroidProfile(profile);
  // Keep this key order aligned with Swift's sorted CodingKeys for portable checksums.
  return { b: value.trainingBeam, c: value.faceColor, f: value.finish, h: value.housing, m: value.material, n: value.name, s: value.sections, t: value.targetLaser, v: value.version, w: value.weaponMount };
}

function expandedProfile(value) {
  return sanitizeDroidProfile({
    trainingBeam: value?.b,
    faceColor: value?.c,
    finish: value?.f,
    housing: value?.h,
    material: value?.m,
    name: value?.n,
    sections: value?.s,
    targetLaser: value?.t,
    version: value?.v,
    weaponMount: value?.w,
  });
}

function base64URLFromBytes(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesFromBase64URL(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function droidProfileChecksum(bytes) {
  let hash = 0x811c9dc5;
  bytes.forEach((byte) => {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  });
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

export function encodeDroidProfile(profile) {
  const bytes = new TextEncoder().encode(JSON.stringify(compactProfile(profile)));
  return `${ROB_DROID_CODE_PREFIX}.${base64URLFromBytes(bytes)}.${droidProfileChecksum(bytes)}`;
}

export function decodeDroidProfile(code) {
  const [prefix, payload, checksum, ...extra] = String(code || '').trim().split('.');
  if (prefix !== ROB_DROID_CODE_PREFIX || !payload || !/^[A-F0-9]{8}$/i.test(checksum || '') || extra.length) throw new Error('That is not a complete ROB Droid Code.');
  let bytes;
  try { bytes = bytesFromBase64URL(payload); } catch { throw new Error('The Droid Code contains invalid characters.'); }
  if (droidProfileChecksum(bytes) !== checksum.toUpperCase()) throw new Error('The Droid Code was damaged while copying.');
  let compact;
  try { compact = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('The Droid Code payload is not valid.'); }
  if (compact?.v !== ROB_DROID_PROFILE_VERSION) throw new Error('This Droid Code uses an unsupported version.');
  return expandedProfile(compact);
}

export function readDroidProfile(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(ROB_DROID_PROFILE_STORAGE_KEY);
    if (saved) return sanitizeDroidProfile(JSON.parse(saved));
    return sanitizeDroidProfile({
      finish: storage?.getItem('robRobotFinish'),
      faceColor: storage?.getItem('robFaceColor'),
    });
  } catch { return defaultDroidProfile(); }
}

export function writeDroidProfile(profile, storage = globalThis.localStorage) {
  const clean = sanitizeDroidProfile(profile);
  try {
    storage?.setItem(ROB_DROID_PROFILE_STORAGE_KEY, JSON.stringify(clean));
    storage?.setItem('robRobotFinish', clean.finish);
    storage?.setItem('robFaceColor', clean.faceColor);
  } catch { /* Device storage is optional. */ }
  return clean;
}
