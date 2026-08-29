export const GAMEPLAY_RULESET_VERSION = '2026.09.02';
export const MAX_ROB_HEALTH = 100;
export const MAX_ROB_SHIELDS = 40;
export const BASE_ROB_ENERGY = 100;
export const SHIELD_PICKUP_STRENGTH = 24;
export const REPAIR_PICKUP_STRENGTH = 35;

export const upgrades = [
  { id: 'speedBoost', name: 'Speed Boost', maximumLevel: 3, baseCost: 700, costStep: 650 },
  { id: 'energyCapacity', name: 'Energy Capacity', maximumLevel: 3, baseCost: 550, costStep: 500 },
  { id: 'weaponPower', name: 'Weapon Power', maximumLevel: 3, baseCost: 900, costStep: 800 },
];

export const upgradeCost = (upgrade, level) => level < upgrade.maximumLevel ? upgrade.baseCost + level * upgrade.costStep : undefined;
export const driveSpeedMultiplier = (level) => 1 + Math.max(0, level) * .35;
export const maximumEnergy = (level) => BASE_ROB_ENERGY + Math.max(0, level) * 25;
export const upgradedWeaponDamage = (damage, level) => damage + Math.max(0, level);
export const updateDriveEnergy = ({ energy, maximum, moving, delta, capacityLevel = 0 }) => Math.max(0, Math.min(
  maximum,
  energy + delta * (moving ? -6.6 : 3.2 + Math.max(0, capacityLevel) * .8),
));

export const resolveAxisSlidingMotion = ({ start, end, canOccupy, iterations = 10 }) => {
  if (canOccupy(end)) return { position: { x: end.x, z: end.z }, collided: false };
  const position = { x: start.x, z: start.z };
  const axes = Math.abs(end.x - start.x) >= Math.abs(end.z - start.z) ? ['x', 'z'] : ['z', 'x'];

  for (const axis of axes) {
    const axisStart = position[axis];
    const axisEnd = end[axis];
    const candidate = { ...position, [axis]: axisEnd };
    if (canOccupy(candidate)) {
      position[axis] = axisEnd;
      continue;
    }
    let clearFraction = 0;
    let blockedFraction = 1;
    for (let index = 0; index < iterations; index += 1) {
      const candidateFraction = (clearFraction + blockedFraction) / 2;
      const partial = { ...position, [axis]: axisStart + (axisEnd - axisStart) * candidateFraction };
      if (canOccupy(partial)) clearFraction = candidateFraction;
      else blockedFraction = candidateFraction;
    }
    if (clearFraction > .001) position[axis] = axisStart + (axisEnd - axisStart) * clearFraction;
  }
  return { position, collided: true };
};

export const pointInBox = (point, box) => Math.abs(point.x - box.x) <= box.w && Math.abs(point.z - box.z) <= box.d;

export const conveyorDisplacement = ({ point, conveyors, delta }) => {
  const conveyor = conveyors.find((candidate) => pointInBox(point, candidate));
  return conveyor ? { x: conveyor.dx * conveyor.speed * delta, z: conveyor.dz * conveyor.speed * delta } : { x: 0, z: 0 };
};

export const cameraHeading = (camera, elapsed) => camera.heading + Math.sin(elapsed * .72 + camera.id * 1.7) * camera.sweep;
export const securityCameraSees = ({ camera, robot, elapsed, blockers = [], shadows = [] }) => {
  if (shadows.some((shadow) => pointInBox(robot, shadow))) return false;
  const offset = { x: robot.x - camera.x, z: robot.z - camera.z };
  const distance = Math.hypot(offset.x, offset.z);
  if (distance < .001 || distance > camera.range) return false;
  const heading = cameraHeading(camera, elapsed);
  const forward = { x: -Math.sin(heading), z: -Math.cos(heading) };
  if ((offset.x / distance) * forward.x + (offset.z / distance) * forward.z < Math.cos(Math.PI / 5)) return false;
  return blockers.every((blocker) => segmentBoxHitFraction(camera, robot, blocker, .015) === undefined);
};

export const finishes = [
  { id: 'graphite', name: 'Graphite', color: 0x45515d },
  { id: 'rescueOrange', name: 'Rescue Orange', color: 0xe06b2f },
  { id: 'arcticWhite', name: 'Arctic White', color: 0xe5edf2 },
  { id: 'cobaltBlue', name: 'Cobalt Blue', color: 0x2769ba },
  { id: 'tacticalGreen', name: 'Tactical Green', color: 0x4d7151 },
];

export const faceColors = [
  { id: 'lime', name: 'Lime', color: 0x5cff6b },
  { id: 'cyan', name: 'Cyan', color: 0x52e8ff },
  { id: 'amber', name: 'Amber', color: 0xffb43b },
  { id: 'magenta', name: 'Magenta', color: 0xff62d0 },
  { id: 'white', name: 'White', color: 0xf2f7ff },
  { id: 'red', name: 'Red', color: 0xff5268 },
];

export const rangedWeapons = [
  { id: 'shoulderGatling', name: 'Shoulder Gatling', shortName: 'Gatling', requiredLevel: 0, projectileSpeed: 13, baseDamage: 1, chargeDamage: 2 },
  { id: 'twinBlasters', name: 'Twin Blasters', shortName: 'Blasters', requiredLevel: 5, projectileSpeed: 18, baseDamage: 1, chargeDamage: 1 },
  { id: 'arcCannon', name: 'Arc Cannon', shortName: 'Arc Cannon', requiredLevel: 15, projectileSpeed: 11, baseDamage: 2, chargeDamage: 3 },
];

export const meleeWeapons = [
  { id: 'dualSabers', name: 'Dual Sabers', shortName: 'Sabers', requiredLevel: 0 },
  { id: 'powerHammer', name: 'Power Hammer', shortName: 'Hammer', requiredLevel: 10 },
];

export const weaponDamage = (weapon, charge) => weapon.baseDamage + Math.floor(Math.max(0, Math.min(1, charge)) * weapon.chargeDamage);

export const bossStats = (levelNumber, baseShields) => {
  const isBoss = levelNumber % 5 === 0;
  return {
    isBoss,
    shields: isBoss ? Math.max(10, baseShields * 3) : baseShields,
    contactDamage: isBoss ? 10 : undefined,
    projectileDamage: isBoss ? 10 : undefined,
  };
};

export const securityMiniBossStats = () => ({
  isBoss: true,
  isMiniBoss: true,
  shields: 3,
  contactDamage: 4,
  projectileDamage: 3,
  scale: 1.15,
  defeatReward: 500,
});

export const unlockReward = (completedLevel) => ({
  5: 'Twin Blasters unlocked in the ROB workshop!',
  10: 'Power Hammer unlocked in the ROB workshop!',
  15: 'Arc Cannon unlocked in the ROB workshop!',
})[completedLevel];

export const isUnlocked = (item, highestCompletedLevel) => highestCompletedLevel >= item.requiredLevel;

// Boxes use the simulator's { x, z, w, d } convention, where w and d are half extents.
export const segmentBoxHitFraction = (start, end, box, padding = 0) => {
  const delta = { x: end.x - start.x, z: end.z - start.z };
  const minimum = { x: box.x - box.w - padding, z: box.z - box.d - padding };
  const maximum = { x: box.x + box.w + padding, z: box.z + box.d + padding };
  let entry = 0;
  let exit = 1;

  for (const axis of ['x', 'z']) {
    if (Math.abs(delta[axis]) < 0.000001) {
      if (start[axis] < minimum[axis] || start[axis] > maximum[axis]) return undefined;
      continue;
    }
    const first = (minimum[axis] - start[axis]) / delta[axis];
    const second = (maximum[axis] - start[axis]) / delta[axis];
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry > exit) return undefined;
  }
  return entry;
};

export const segmentCircleHitFraction = (start, end, center, radius) => {
  const delta = { x: end.x - start.x, z: end.z - start.z };
  const offset = { x: start.x - center.x, z: start.z - center.z };
  const a = delta.x * delta.x + delta.z * delta.z;
  if (a < 0.000001) return offset.x * offset.x + offset.z * offset.z <= radius * radius ? 0 : undefined;
  const c = offset.x * offset.x + offset.z * offset.z - radius * radius;
  if (c <= 0) return 0;
  const b = 2 * (offset.x * delta.x + offset.z * delta.z);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return undefined;
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  if (first >= 0 && first <= 1) return first;
  if (second >= 0 && second <= 1) return second;
  return undefined;
};

export const firstProjectileImpact = ({ start, end, blockers, targets, wallPadding = 0.07 }) => {
  let nearest;
  for (const blocker of blockers) {
    const fraction = segmentBoxHitFraction(start, end, blocker, wallPadding);
    if (fraction !== undefined && (!nearest || fraction < nearest.fraction)) nearest = { kind: 'wall', fraction, blocker };
  }
  for (const target of targets) {
    const fraction = segmentCircleHitFraction(start, end, target, target.radius);
    if (fraction !== undefined && (!nearest || fraction < nearest.fraction)) nearest = { kind: 'target', fraction, target };
  }
  return nearest;
};

export const distanceToBox = (point, box) => {
  const dx = Math.max(box.x - box.w - point.x, 0, point.x - (box.x + box.w));
  const dz = Math.max(box.z - box.d - point.z, 0, point.z - (box.z + box.d));
  return Math.hypot(dx, dz);
};

export const meleeAnimationIsClear = ({ origin, target, blockers, spinRadius, padding = 0.08 }) => {
  if (spinRadius !== undefined) return blockers.every((box) => distanceToBox(origin, box) > spinRadius);
  return blockers.every((box) => segmentBoxHitFraction(origin, target, box, padding) === undefined);
};

export const applyROBHealthDamage = (health, damage) => {
  const appliedDamage = Math.max(0, Math.floor(damage));
  return { appliedDamage, health: Math.max(0, health - appliedDamage), scorePenalty: appliedDamage * 20 };
};

export const applyROBDamage = ({ health, shields, damage }) => {
  const appliedDamage = Math.max(0, Math.floor(damage));
  const shieldDamage = Math.min(Math.max(0, shields), appliedDamage);
  const healthDamage = appliedDamage - shieldDamage;
  return {
    appliedDamage,
    shieldDamage,
    healthDamage,
    shields: Math.max(0, shields - shieldDamage),
    health: Math.max(0, health - healthDamage),
    scorePenalty: appliedDamage * 20,
  };
};

export const replenishROBShields = (shields, amount = SHIELD_PICKUP_STRENGTH) => Math.min(
  MAX_ROB_SHIELDS,
  Math.max(0, shields) + Math.max(0, amount),
);

export const repairROBHealth = (health, amount = REPAIR_PICKUP_STRENGTH) => Math.min(
  MAX_ROB_HEALTH,
  Math.max(0, health) + Math.max(0, amount),
);
