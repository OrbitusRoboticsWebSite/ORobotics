export const GAMEPLAY_RULESET_VERSION = '2026.09.17.3';
export const MAX_ROB_HEALTH = 100;
export const MAX_ROB_SHIELDS = 40;
export const SHIELD_ACTIVATION_DURATION = 2.5;
// Match the native game's bounded defensive window. Repeated taps cannot extend it.
export const stepBubbleShield = ({ remaining = 0, shields, running, delta = 0, activate = false }) => {
  if (!running || shields <= 0) return { remaining: 0, active: false, fraction: 0 };
  const next = activate && remaining <= 0 ? SHIELD_ACTIVATION_DURATION : Math.max(0, remaining - Math.max(0, delta));
  return { remaining: next, active: next > 0, fraction: Math.min(1, next / SHIELD_ACTIVATION_DURATION) };
};
export const MAX_TRIAL_LIVES = 3;
export const BASE_ROB_ENERGY = 100;
export const BASE_DRIVE_SPEED = 4.5;
// Radians per second for one unit of tread differential; speed upgrades affect travel only.
export const BASE_TURN_SPEED = 1.1;
export const SHIELD_PICKUP_STRENGTH = 24;
export const REPAIR_PICKUP_STRENGTH = 35;

export const upgrades = [
  { id: 'speedBoost', name: 'Speed Boost', maximumLevel: 3, baseCost: 700, costStep: 650 },
  { id: 'energyCapacity', name: 'Energy Capacity', maximumLevel: 3, baseCost: 550, costStep: 500 },
  { id: 'weaponPower', name: 'Laser Power', maximumLevel: 3, baseCost: 900, costStep: 800 },
  { id: 'targetingComputer', name: 'Targeting Computer', maximumLevel: 1, baseCost: 1200, costStep: 0 },
  { id: 'kyberCrystals', name: 'Kyber Crystals', maximumLevel: 3, baseCost: 600, costStep: 1000 },
  { id: 'rocketBooster', name: 'Plasma Booster', maximumLevel: 1, baseCost: 900, costStep: 0 },
  { id: 'jammer', name: 'Jammer', maximumLevel: 1, baseCost: 1800, costStep: 0 },
  { id: 'gelBlaster', name: 'StrikeForce Gel Kit + PEQ', maximumLevel: 1, baseCost: 6000, costStep: 0 },
];

export const upgradeCost = (upgrade, level) => level < upgrade.maximumLevel ? upgrade.baseCost + level * upgrade.costStep : undefined;
export const upgradeRequiredCompletedLevel = (upgrade, level) => upgrade.id === 'jammer' ? 5 : upgrade.id === 'gelBlaster' ? 10 : upgrade.id === 'rocketBooster' ? 3 : upgrade.id === 'kyberCrystals' ? level * 5 : 0;
export const saberDamage = (crystalLevel = 0) => 1 + Math.max(0, Math.min(3, Math.floor(crystalLevel)));
export const enemyContactDamage = ({ kind, isBoss = false, isMiniBoss = false }) => isMiniBoss ? 12 : isBoss ? 30 : kind === 'spider' ? 18 : 15;
export const enemySkillReward = ({ isBoss = false, isMiniBoss = false }) => isMiniBoss ? 30 : isBoss ? 100 : 20;
export const levelSkillReward = (levelNumber) => 50 + Math.max(0, Math.min(14, levelNumber - 1)) * 10;
// A separate balance key prevents old open game tabs from restoring the old economy.
export const skillPointBalance = (savedBalance, legacyBalance = 0) => {
  const raw = Number(savedBalance ?? legacyBalance);
  const balance = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  return savedBalance == null ? Math.floor(balance / 10) : balance;
};

export function robotWallPenetration({ point, heading, wall, halfWidth = .95, halfLength = 1.08 }) {
  const right = { x: Math.cos(heading), z: -Math.sin(heading) }, forward = { x: Math.sin(heading), z: Math.cos(heading) };
  let best;
  for (const axis of [right, forward, { x: 1, z: 0 }, { x: 0, z: 1 }]) {
    const separation = (point.x - wall.x) * axis.x + (point.z - wall.z) * axis.z;
    const radius = halfWidth * Math.abs(right.x * axis.x + right.z * axis.z) + halfLength * Math.abs(forward.x * axis.x + forward.z * axis.z);
    const depth = radius + wall.w * Math.abs(axis.x) + wall.d * Math.abs(axis.z) - Math.abs(separation);
    if (depth <= 0) return undefined;
    if (!best || depth < best.depth) best = { depth, x: axis.x * Math.sign(separation || 1), z: axis.z * Math.sign(separation || 1) };
  }
  return best;
}

// Small separating shifts let the chassis rotate out of a corner without
// admitting a pose inside either wall or teleporting across a partition.
export function resolveWallTurn({ point, heading, walls, canOccupy, maximumShift = .3, halfWidth = .95, halfLength = 1.08 }) {
  const candidate = { ...point };
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false;
    for (const wall of walls) {
      const overlap = robotWallPenetration({ point: candidate, heading, wall, halfWidth, halfLength });
      if (!overlap) continue;
      candidate.x += overlap.x * (overlap.depth + .002); candidate.z += overlap.z * (overlap.depth + .002); moved = true;
    }
    if (Math.hypot(candidate.x - point.x, candidate.z - point.z) > maximumShift) return undefined;
    if (!moved) return canOccupy(candidate) ? candidate : undefined;
  }
  return undefined;
}
export const driveSpeedMultiplier = (level) => 1 + Math.max(0, level) * .6;
export const maximumEnergy = (level) => BASE_ROB_ENERGY + Math.max(0, level) * 60;
export const energyPickupAmount = (capacityLevel = 0) => 70 + Math.max(0, capacityLevel) * 20;
export const passiveEnergyRecharge = (capacityLevel = 0) => 6 + Math.max(0, capacityLevel) * 3;
export const upgradedWeaponDamage = (damage, level) => damage + Math.max(0, level);
export const LASER_RECHARGE_DELAY = 1.5;
export const updateDriveEnergy = ({ energy, maximum, moving, delta, capacityLevel = 0, charging = false, secondsSinceShot = Infinity }) => Math.max(0, Math.min(
  maximum,
  energy + delta * (moving ? -6.6 : charging || secondsSinceShot < LASER_RECHARGE_DELAY ? 0 : passiveEnergyRecharge(capacityLevel)),
));
export const consumeTrialLife = (lives) => {
  const remaining = Math.max(0, Math.min(MAX_TRIAL_LIVES, Math.floor(lives)) - 1);
  return { lives: remaining, trialFailed: remaining === 0 };
};

export const BASE_FLIPPER_ENERGY_COST = 4;
export const BASE_FLIPPER_FORWARD_ANGLE = -Math.PI * .30;
export const BASE_FLIPPER_REAR_ANGLE = 0;
export const BASE_FLIPPER_REAR_ASSIST_ANGLE = Math.PI * 1.15;
export const ROB_CONTACT_SPAN = .42545;
export const BASE_FLIPPER_MOTOR_SPEED = 4.8;
export const BASE_FLIPPER_DURATION = Math.abs(BASE_FLIPPER_REAR_ANGLE - BASE_FLIPPER_FORWARD_ANGLE) / BASE_FLIPPER_MOTOR_SPEED;
export const baseFlipperTargetAngle = (target, climbing = false) => target === 'forward' ? BASE_FLIPPER_FORWARD_ANGLE : climbing ? BASE_FLIPPER_REAR_ASSIST_ANGLE : BASE_FLIPPER_REAR_ANGLE;
export const baseFlipperPhase = (angle) => Math.max(0, Math.min(1,
  (angle - BASE_FLIPPER_REAR_ANGLE) / (BASE_FLIPPER_FORWARD_ANGLE - BASE_FLIPPER_REAR_ANGLE),
));
export const advanceBaseFlipper = ({ angle, target, delta, climbing = false }) => {
  const targetAngle = baseFlipperTargetAngle(target, climbing), difference = targetAngle - angle, maximumStep = BASE_FLIPPER_MOTOR_SPEED * Math.max(0, delta);
  const nextAngle = Math.abs(difference) <= maximumStep ? targetAngle : angle + Math.sign(difference) * maximumStep;
  return { angle: nextAngle, active: Math.abs(nextAngle - targetAngle) > .005 };
};
export const flipperGroundPitch = (angle) => {
  // Rear tread contact stays on the floor. Solve the flipper roller's floor
  // contact for chassis pitch instead of translating the whole robot upward.
  const a = .11 + .33655 * Math.sin(angle), b = .33655 * Math.cos(angle);
  if (a >= .029 || b <= 0 || angle >= 0) return 0;
  return Math.max(0, Math.min(.85, Math.asin(.029 / Math.hypot(a, b)) - Math.atan2(a, b)));
};
export const ledgeClimbProgress = ({ z, heading = 0, approachEdgeZ, scale = 1 }) => {
  const span = ROB_CONTACT_SPAN * scale * Math.max(.1, Math.cos(heading));
  const projected = span * Math.cos(flipperGroundPitch(BASE_FLIPPER_FORWARD_ANGLE));
  return (approachEdgeZ - z + projected - span / 2) / projected;
};
export const baseFlipperPresentation = ({ angle, target = 'rear', onLedge = false, climbProgress, stepHeight = 0, supportHeight = onLedge ? stepHeight : 0, scale = 1 }) => {
  const climbing = Number.isFinite(climbProgress);
  const phase = baseFlipperPhase(angle), active = Math.abs(angle - baseFlipperTargetAngle(target, climbing)) > .005;
  const stabilized = onLedge && !climbing && !active && Math.abs(angle) < .005;
  let pitch = flipperGroundPitch(angle), lift = supportHeight;
  if (climbing) {
    const span = ROB_CONTACT_SPAN * scale;
    const supportedPitch = Math.asin(Math.min(1, stepHeight / span));
    // The front lands on the step while the rear is still grounded. When the
    // returning flipper contacts the lower floor, it raises the rear around
    // that front contact. The trailing tracks finish the climb at the edge.
    const t = Math.max(0, Math.min(1, (climbProgress - .75) / .25));
    const terrainPitch = supportedPitch * (1 - t * t * (3 - 2 * t));
    if (angle <= 0) pitch = Math.max(terrainPitch, flipperGroundPitch(angle));
    else {
      let contactPitch = supportedPitch;
      const clearance = (p) => stepHeight - span * Math.sin(p) + scale * (.11 * Math.cos(p) + .33655 * Math.sin(angle + p) - .029);
      if (angle > Math.PI / 2 && clearance(contactPitch) < 0) {
        let low = 0, high = contactPitch;
        for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (clearance(mid) >= 0) low = mid; else high = mid; }
        contactPitch = low;
      }
      pitch = Math.min(terrainPitch, contactPitch);
    }
    lift = Math.max(0, stepHeight - ROB_CONTACT_SPAN * scale * Math.sin(pitch));
  }
  return { active, phase, angle, lift, pitch, stabilized, climbing };
};
export const canMountLedge = ({ start, end, flipperAngle, approachEdgeZ }) => (
  end.z < start.z && start.z >= approachEdgeZ && baseFlipperPhase(flipperAngle) >= .9
);

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

export const conveyorArrowOffset = ({ baseOffset, elapsed, speed, span, direction }) => {
  if (!(span > 0)) return baseOffset;
  const shifted = baseOffset + elapsed * speed * direction + span / 2;
  return ((shifted % span) + span) % span - span / 2;
};

export const battleScore = ({ damage = 0, defeatReward = 0 }) => (
  Math.max(0, Math.floor(damage)) * 50 + Math.max(0, Math.floor(defeatReward))
);

export const SECURITY_CAMERA_HALF_ANGLE = Math.PI / 5;
export const FLIPPER_HACK_DURATION = 2.2;
export const FLIPPER_HACK_REWARD = 300;
export const cameraHeading = (camera, elapsed) => camera.disabled ? camera.heading : camera.heading + Math.sin(elapsed * .72 + camera.id * 1.7) * camera.sweep;
export const securityCameraSightDistance = ({ camera, heading, angleOffset = 0, blockers = [] }) => {
  if (camera.disabled) return 0;
  const rayHeading = heading + angleOffset;
  const end = {
    x: camera.x - Math.sin(rayHeading) * camera.range,
    z: camera.z - Math.cos(rayHeading) * camera.range,
  };
  const nearestFraction = blockers.reduce((nearest, blocker) => {
    const fraction = segmentBoxHitFraction(camera, end, blocker, .015);
    return fraction === undefined ? nearest : Math.min(nearest, fraction);
  }, 1);
  return camera.range * nearestFraction;
};
export const securityCameraVisionDistances = ({ camera, heading, blockers = [], rayCount = 49 }) => {
  const count = Math.max(2, Math.floor(rayCount));
  return Array.from({ length: count }, (_, index) => {
    const angleOffset = -SECURITY_CAMERA_HALF_ANGLE + (SECURITY_CAMERA_HALF_ANGLE * 2 * index) / (count - 1);
    return securityCameraSightDistance({ camera, heading, angleOffset, blockers });
  });
};
export const securityCameraSees = ({ camera, robot, elapsed, blockers = [], shadows = [] }) => {
  if (camera.disabled) return false;
  if (shadows.some((shadow) => pointInBox(robot, shadow))) return false;
  const offset = { x: robot.x - camera.x, z: robot.z - camera.z };
  const distance = Math.hypot(offset.x, offset.z);
  if (distance < .001 || distance > camera.range) return false;
  const heading = cameraHeading(camera, elapsed);
  const forward = { x: -Math.sin(heading), z: -Math.cos(heading) };
  if ((offset.x / distance) * forward.x + (offset.z / distance) * forward.z < Math.cos(SECURITY_CAMERA_HALF_ANGLE)) return false;
  const targetHeading = Math.atan2(-offset.x, -offset.z);
  return distance <= securityCameraSightDistance({ camera, heading, angleOffset: targetHeading - heading, blockers }) + .001;
};

export const finishes = [
  { id: 'graphite', name: 'Graphite', color: 0x45515d },
  { id: 'rescueOrange', name: 'Rescue Orange', color: 0xe06b2f },
  { id: 'arcticWhite', name: 'Arctic White', color: 0xe5edf2 },
  { id: 'cobaltBlue', name: 'Cobalt Blue', color: 0x2769ba },
  { id: 'tacticalGreen', name: 'Tactical Green', color: 0x4d7151 },
  { id: 'solarYellow', name: 'Solar Yellow', color: 0xf6c945 },
  { id: 'plasmaPurple', name: 'Plasma Purple', color: 0x824de3 },
  { id: 'makerPink', name: 'Maker Pink', color: 0xe24a9a },
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
  { id: 'shoulderGatling', name: 'Pan-Tilt Gatling', shortName: 'Gatling', requiredLevel: 0, projectileSpeed: 13, baseDamage: 1, chargeDamage: 2, baseEnergy: 8, chargeEnergy: 16 },
  { id: 'twinBlasters', name: 'Twin Blasters', shortName: 'Blasters', requiredLevel: 5, projectileSpeed: 18, baseDamage: 1, chargeDamage: 1, baseEnergy: 10, chargeEnergy: 18 },
  { id: 'arcCannon', name: 'Arc Cannon', shortName: 'Arc Cannon', requiredLevel: 15, projectileSpeed: 11, baseDamage: 2, chargeDamage: 3, baseEnergy: 16, chargeEnergy: 28 },
];

export const meleeWeapons = [
  { id: 'dualSabers', name: 'Dual Sabers', shortName: 'Sabers', requiredLevel: 0 },
  { id: 'powerHammer', name: 'Power Hammer', shortName: 'Hammer', requiredLevel: 10 },
];

export const weaponDamage = (weapon, charge) => weapon.baseDamage + Math.floor(Math.max(0, Math.min(1, charge)) * weapon.chargeDamage);
export const laserEnergyCost = (weapon, charge) => weapon.baseEnergy + Math.max(0, Math.min(1, charge)) * weapon.chargeEnergy;
export const consumeLaserEnergy = ({ energy, weapon, charge }) => {
  const cost = laserEnergyCost(weapon, charge);
  return energy >= cost ? { fired: true, cost, energy: energy - cost } : { fired: false, cost, energy };
};
export const targetingComputerStats = (level = 0) => level > 0
  ? { autoLock: true, cycleDuration: .25, chargeDuration: 1.25 }
  : { autoLock: false, cycleDuration: .8, chargeDuration: 1.8 };
export const maximumLaserLocks = (weapon, targetingComputerLevel = 0) => (
  targetingComputerLevel <= 0 ? 0 : weapon?.id === 'twinBlasters' ? 2 : 1
);
export const laserAimHeading = ({ origin, heading, target, targetingComputerLevel = 0 }) => (
  targetingComputerLevel > 0 && target ? Math.atan2(-(target.x - origin.x), -(target.z - origin.z)) : heading
);

export const bossStats = (levelNumber, baseShields) => {
  const isBoss = levelNumber % 5 === 0;
  return {
    isBoss,
    shields: isBoss ? 30 + (levelNumber / 5) * 30 : baseShields,
    contactDamage: isBoss ? 30 : undefined,
    projectileDamage: isBoss ? 10 : undefined,
  };
};

export const securityMiniBossStats = () => ({
  isBoss: true,
  isMiniBoss: true,
  shields: 6,
  contactDamage: 12,
  projectileDamage: 3,
  scale: 1.15,
  defeatReward: 500,
});

export const unlockReward = (completedLevel) => ({
  3: 'Plasma Booster available: 900 skill points in the workshop!',
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

export const circularBodiesOverlap = (first, firstRadius, second, secondRadius) => (
  Math.hypot(first.x - second.x, first.z - second.z) < Math.max(0, firstRadius) + Math.max(0, secondRadius)
);

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

export const meleeAnimationIsClear = ({ origin, target, blockers, padding = 0.08 }) => {
  return blockers.every((box) => segmentBoxHitFraction(origin, target, box, padding) === undefined);
};

export const applyROBHealthDamage = (health, damage) => {
  const appliedDamage = Math.max(0, Math.floor(damage));
  return { appliedDamage, health: Math.max(0, health - appliedDamage), scorePenalty: appliedDamage * 20 };
};

export const applyROBDamage = ({ health, shields, damage, shieldActive = false }) => {
  const appliedDamage = Math.max(0, Math.floor(damage));
  const shieldDamage = shieldActive ? Math.min(Math.max(0, shields), appliedDamage) : 0;
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
