// Fictional campaign equipment. These rules never access radios or robot hardware.
export const TACTICAL = Object.freeze({ jammerDrain: 14, jammerRadius: 8, gelCost: 3, gelCycle: .22, gelSpeed: 28, gelRange: 32, gelDamage: 2, switchScore: 400, switchSkill: 60 });
export const PEQ_MODES = ['off', 'blue', 'infrared', 'flashlight'];
export const nextPEQMode = (mode) => PEQ_MODES[(PEQ_MODES.indexOf(mode) + 1) % PEQ_MODES.length];
export function stepJammer({ active, installed, running, energy, delta }) {
  const enabled = Boolean(active && installed && running && energy > 0);
  const remaining = Math.max(0, energy - (enabled ? TACTICAL.jammerDrain * Math.max(0, delta) : 0));
  return { energy: remaining, active: enabled && remaining > 0 };
}
export function signalJammed({ active, origin, target, isBoss = false, isMiniBoss = false, radius = TACTICAL.jammerRadius }) {
  return active && !isBoss && !isMiniBoss && Math.hypot(origin.x - target.x, (origin.y || 0) - (target.y || 0), origin.z - target.z) <= radius;
}
export function gelDischarge({ installed, equipped, running, handsBusy, energy, elapsed, lastShot }) {
  const fired = Boolean(installed && equipped && running && !handsBusy && energy >= TACTICAL.gelCost && elapsed - lastShot >= TACTICAL.gelCycle - 1e-9);
  return { fired, energy: energy - (fired ? TACTICAL.gelCost : 0), lastShot: fired ? elapsed : lastShot };
}
