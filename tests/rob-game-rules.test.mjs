import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_FLIPPER_DURATION,
  MAX_ROB_HEALTH,
  MAX_ROB_SHIELDS,
  BASE_ROB_ENERGY,
  BASE_DRIVE_SPEED,
  applyROBDamage,
  applyROBHealthDamage,
  battleUpgradePoints,
  baseFlipperPresentation,
  bossStats,
  cameraHeading,
  circularBodiesOverlap,
  conveyorArrowOffset,
  conveyorDisplacement,
  consumeLaserEnergy,
  driveSpeedMultiplier,
  energyPickupAmount,
  faceColors,
  firstProjectileImpact,
  isUnlocked,
  laserEnergyCost,
  maximumEnergy,
  maximumLaserLocks,
  meleeAnimationIsClear,
  rangedWeapons,
  repairROBHealth,
  replenishROBShields,
  passiveEnergyRecharge,
  resolveAxisSlidingMotion,
  securityCameraSees,
  securityCameraVisionDistances,
  securityMiniBossStats,
  updateDriveEnergy,
  upgradeCost,
  upgrades,
  upgradedWeaponDamage,
  unlockReward,
  weaponDamage,
} from '../assets/js/rob-game-rules.mjs';

test('ROB smile colors stay synchronized with the Apple workshop palette', () => {
  assert.deepEqual(faceColors.map(({ id }) => id), ['lime', 'cyan', 'amber', 'magenta', 'white', 'red']);
  assert.equal(faceColors[0].color, 0x5cff6b);
  assert.equal(new Set(faceColors.map(({ color }) => color)).size, faceColors.length);
});

test('a wall wins when it is between a projectile and its target', () => {
  const impact = firstProjectileImpact({
    start: { x: 0, z: 3 },
    end: { x: 0, z: -3 },
    blockers: [{ x: 0, z: 1, w: 2, d: 0.12 }],
    targets: [{ id: 'enemy', x: 0, z: 0, radius: 0.4 }],
  });
  assert.equal(impact.kind, 'wall');
});

test('a target is damaged only after the projectile segment reaches it', () => {
  assert.equal(firstProjectileImpact({
    start: { x: 0, z: 3 }, end: { x: 0, z: 2.5 }, blockers: [], targets: [{ x: 0, z: 0, radius: 0.4 }],
  }), undefined);
  assert.equal(firstProjectileImpact({
    start: { x: 0, z: 1 }, end: { x: 0, z: -1 }, blockers: [], targets: [{ x: 0, z: 0, radius: 0.4 }],
  }).kind, 'target');
});

test('walls occlude only melee targets whose actual attack path crosses them', () => {
  const wall = { x: 0, z: 1, w: 2, d: 0.12 };
  assert.equal(meleeAnimationIsClear({ origin: { x: 0, z: 2 }, target: { x: 0, z: 0 }, blockers: [wall] }), false);
  assert.equal(meleeAnimationIsClear({ origin: { x: 0, z: 2 }, target: { x: 1, z: 2 }, blockers: [wall] }), true);
});

test('scaled robot body volumes overlap only inside their combined collision radii', () => {
  assert.equal(circularBodiesOverlap({ x: 0, z: 0 }, .72, { x: 1, z: 0 }, .64), true);
  assert.equal(circularBodiesOverlap({ x: 0, z: 0 }, .72, { x: 1.36, z: 0 }, .64), false);
  assert.equal(circularBodiesOverlap({ x: 0, z: 0 }, .72 * 1.35, { x: 1.5, z: 0 }, .64), true);
});

test('ROB takes regular damage without forcing a restart at positive health', () => {
  assert.deepEqual(applyROBHealthDamage(MAX_ROB_HEALTH, 6), { appliedDamage: 6, health: 94, scorePenalty: 120 });
});

test('ROB shields absorb hits before damage reaches the hull', () => {
  assert.deepEqual(applyROBDamage({ health: MAX_ROB_HEALTH, shields: MAX_ROB_SHIELDS, damage: 6 }), {
    appliedDamage: 6,
    shieldDamage: 6,
    healthDamage: 0,
    shields: 34,
    health: 100,
    scorePenalty: 120,
  });
  assert.deepEqual(applyROBDamage({ health: MAX_ROB_HEALTH, shields: 4, damage: 10 }), {
    appliedDamage: 10,
    shieldDamage: 4,
    healthDamage: 6,
    shields: 0,
    health: 94,
    scorePenalty: 200,
  });
});

test('map pickups replenish shields and repair hull damage without overfilling', () => {
  assert.equal(replenishROBShields(5), 29);
  assert.equal(replenishROBShields(35), MAX_ROB_SHIELDS);
  assert.equal(repairROBHealth(50), 85);
  assert.equal(repairROBHealth(90), MAX_ROB_HEALTH);
});

test('every fifth level adds an escalating reinforced ten-damage boss', () => {
  assert.deepEqual(bossStats(4, 3), { isBoss: false, shields: 3, contactDamage: undefined, projectileDamage: undefined });
  assert.deepEqual(bossStats(5, 3), { isBoss: true, shields: 30, contactDamage: 10, projectileDamage: 10 });
  assert.equal(bossStats(10, 4).shields, 45);
  assert.equal(bossStats(15, 5).shields, 60);
});

test('weapon progression matches iOS and visionOS milestones', () => {
  const [, twinBlasters, arcCannon] = rangedWeapons;
  assert.equal(isUnlocked(twinBlasters, 4), false);
  assert.equal(isUnlocked(twinBlasters, 5), true);
  assert.equal(isUnlocked(arcCannon, 14), false);
  assert.equal(isUnlocked(arcCannon, 15), true);
  assert.match(unlockReward(10), /Power Hammer/);
  assert.equal(weaponDamage(arcCannon, 1), 5);
});

test('laser shots spend system energy and charged weapons cost more', () => {
  const [gatling, twinBlasters, arcCannon] = rangedWeapons;
  assert.equal(laserEnergyCost(gatling, 0), 4);
  assert.equal(laserEnergyCost(gatling, 1), 12);
  assert.equal(laserEnergyCost(twinBlasters, 1), 14);
  assert.equal(laserEnergyCost(arcCannon, 1), 22);
  assert.deepEqual(consumeLaserEnergy({ energy: 30, weapon: arcCannon, charge: 1 }), { fired: true, cost: 22, energy: 8 });
  assert.deepEqual(consumeLaserEnergy({ energy: 20, weapon: arcCannon, charge: 1 }), { fired: false, cost: 22, energy: 20 });
});

test('Twin Blasters require the targeting computer upgrade for two independent locks', () => {
  const twinBlasters = rangedWeapons.find(({ id }) => id === 'twinBlasters');
  assert.equal(maximumLaserLocks(twinBlasters, 0), 1);
  assert.equal(maximumLaserLocks(twinBlasters, 1), 2);
  assert.equal(maximumLaserLocks(rangedWeapons[0], 1), 1);
  const targetingComputer = upgrades.find(({ id }) => id === 'targetingComputer');
  assert.equal(upgradeCost(targetingComputer, 0), 1200);
  assert.equal(upgradeCost(targetingComputer, 1), undefined);
});

test('performance upgrades match the Apple game economy', () => {
  const [speed, capacity, weapon, targetingComputer] = upgrades;
  assert.equal(upgradeCost(speed, 0), 700);
  assert.equal(upgradeCost(speed, 1), 1350);
  assert.equal(upgradeCost(speed, 3), undefined);
  assert.equal(upgradeCost(capacity, 0), 550);
  assert.equal(upgradeCost(weapon, 0), 900);
  assert.equal(BASE_DRIVE_SPEED, 4.5);
  assert.equal(driveSpeedMultiplier(1), 1.6);
  assert.equal(driveSpeedMultiplier(3), 2.8);
  assert.equal(maximumEnergy(1), 160);
  assert.equal(maximumEnergy(3), 280);
  assert.equal(energyPickupAmount(0), 70);
  assert.equal(energyPickupAmount(3), 130);
  assert.equal(passiveEnergyRecharge(0), 6);
  assert.equal(passiveEnergyRecharge(3), 15);
  assert.equal(upgradedWeaponDamage(2, 1), 3);
  assert.equal(targetingComputer.name, 'Targeting Computer');
});

test('drive energy drains in motion and charges while stopped', () => {
  const drained = updateDriveEnergy({ energy: BASE_ROB_ENERGY, maximum: BASE_ROB_ENERGY, moving: true, delta: 1 });
  assert.equal(drained, 93.4);
  assert.equal(updateDriveEnergy({ energy: drained, maximum: BASE_ROB_ENERGY, moving: false, delta: 1 }), 99.4);
  assert.equal(updateDriveEnergy({ energy: 151, maximum: 160, moving: false, delta: 1, capacityLevel: 1 }), 160);
});

test('wall assist slides along obstacles and always permits a clear reverse', () => {
  const canOccupy = ({ z }) => z >= 1;
  const slide = resolveAxisSlidingMotion({ start: { x: 0, z: 1 }, end: { x: 2, z: 0 }, canOccupy });
  assert.equal(slide.collided, true);
  assert.equal(slide.position.x, 2);
  assert.equal(slide.position.z, 1);

  const reverse = resolveAxisSlidingMotion({ start: slide.position, end: { x: 2, z: 2 }, canOccupy });
  assert.deepEqual(reverse, { position: { x: 2, z: 2 }, collided: false });
});

test('conveyors move ROB along their arrow direction only inside the striped zone', () => {
  const conveyors = [{ x: 2, z: 1, w: 1, d: .5, dx: 1, dz: 0, speed: .6 }];
  assert.deepEqual(conveyorDisplacement({ point: { x: 2, z: 1 }, conveyors, delta: .5 }), { x: .3, z: 0 });
  assert.deepEqual(conveyorDisplacement({ point: { x: 0, z: 0 }, conveyors, delta: .5 }), { x: 0, z: 0 });
});

test('conveyor chevrons animate and wrap in the physical travel direction', () => {
  assert.equal(conveyorArrowOffset({ baseOffset: 0, elapsed: 1, speed: .5, span: 2, direction: 1 }), .5);
  assert.equal(conveyorArrowOffset({ baseOffset: 0, elapsed: 1, speed: .5, span: 2, direction: -1 }), -.5);
  assert.equal(conveyorArrowOffset({ baseOffset: .75, elapsed: 1, speed: .5, span: 2, direction: 1 }), -.75);
});

test('battle damage and defeats pay into the persistent upgrade economy', () => {
  assert.equal(battleUpgradePoints({ damage: 1 }), 50);
  assert.equal(battleUpgradePoints({ damage: 2, defeatReward: 300 }), 400);
  assert.equal(battleUpgradePoints({ damage: -3, defeatReward: -1 }), 0);
});

test('security cameras respect their view cone, walls, and shadow cover', () => {
  const camera = { id: 0, x: 0, z: 2, heading: 0, sweep: 0, range: 8 };
  const robot = { x: 0, z: -2 };
  assert.equal(securityCameraSees({ camera, robot, elapsed: 0 }), true);
  assert.equal(securityCameraSees({ camera, robot: { x: 0, z: 1 }, elapsed: 0, blockers: [{ x: 0, z: 0, w: 1, d: .1 }] }), true);
  assert.equal(securityCameraSees({ camera, robot, elapsed: 0, blockers: [{ x: 0, z: 0, w: 1, d: .1 }] }), false);
  assert.equal(securityCameraSees({ camera, robot, elapsed: 0, shadows: [{ x: 0, z: -2, w: 1, d: 1 }] }), false);
  assert.equal(securityCameraSees({ camera, robot: { x: 5, z: 2 }, elapsed: 0 }), false);
  const disabledCamera = { ...camera, disabled: true };
  assert.equal(securityCameraSees({ camera: disabledCamera, robot, elapsed: 0 }), false);
  assert.equal(cameraHeading(disabledCamera, 4), camera.heading);
  assert.deepEqual(securityCameraVisionDistances({ camera: disabledCamera, heading: 0, rayCount: 5 }), [0, 0, 0, 0, 0]);
});

test('camera vision fan stops every red ray at the wall surface', () => {
  const camera = { id: 0, x: 0, z: 2, heading: 0, sweep: 0, range: 8 };
  const distances = securityCameraVisionDistances({
    camera,
    heading: 0,
    blockers: [{ x: 0, z: 0, w: 4, d: .1 }],
    rayCount: 49,
  });

  assert.equal(distances.length, 49);
  assert.ok(distances.every((distance) => distance < 2.4));
  assert.equal(securityCameraVisionDistances({ camera, heading: 0, rayCount: 5 }).every((distance) => distance === 8), true);
});

test('a camera releases one lightweight mini boss profile', () => {
  assert.deepEqual(securityMiniBossStats(), {
    isBoss: true,
    isMiniBoss: true,
    shields: 3,
    contactDamage: 4,
    projectileDamage: 3,
    scale: 1.15,
    defeatReward: 500,
  });
});

test('the base flipper presentation deploys, holds, lifts, and returns to travel pose', () => {
  const resting = baseFlipperPresentation(-1);
  const deploying = baseFlipperPresentation(.3);
  const holding = baseFlipperPresentation(1);
  const retracting = baseFlipperPresentation(2.2);
  const complete = baseFlipperPresentation(BASE_FLIPPER_DURATION);

  assert.deepEqual(resting, { active: false, phase: 0, angle: 0, lift: 0, pitch: 0 });
  assert.equal(deploying.active, true);
  assert.ok(deploying.phase > 0 && deploying.phase < 1);
  assert.equal(holding.phase, 1);
  assert.ok(holding.angle < 0 && holding.lift > 0 && holding.pitch > 0);
  assert.ok(retracting.phase > 0 && retracting.phase < 1);
  assert.deepEqual(complete, resting);
});
