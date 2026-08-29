import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ROB_HEALTH,
  BASE_ROB_ENERGY,
  applyROBHealthDamage,
  bossStats,
  conveyorDisplacement,
  driveSpeedMultiplier,
  firstProjectileImpact,
  isUnlocked,
  maximumEnergy,
  meleeAnimationIsClear,
  rangedWeapons,
  securityCameraSees,
  updateDriveEnergy,
  upgradeCost,
  upgrades,
  upgradedWeaponDamage,
  unlockReward,
  weaponDamage,
} from '../assets/js/rob-game-rules.mjs';

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

test('walls block forward melee paths and spin clearance', () => {
  const wall = { x: 0, z: 1, w: 2, d: 0.12 };
  assert.equal(meleeAnimationIsClear({ origin: { x: 0, z: 2 }, target: { x: 0, z: 0 }, blockers: [wall] }), false);
  assert.equal(meleeAnimationIsClear({ origin: { x: 0, z: 2 }, blockers: [wall], spinRadius: 1.1 }), false);
});

test('ROB takes regular damage without forcing a restart at positive health', () => {
  assert.deepEqual(applyROBHealthDamage(MAX_ROB_HEALTH, 6), { appliedDamage: 6, health: 94, scorePenalty: 120 });
});

test('every fifth level adds a reinforced ten-damage boss', () => {
  assert.deepEqual(bossStats(4, 3), { isBoss: false, shields: 3, contactDamage: undefined, projectileDamage: undefined });
  assert.deepEqual(bossStats(5, 3), { isBoss: true, shields: 10, contactDamage: 10, projectileDamage: 10 });
  assert.equal(bossStats(15, 5).shields, 15);
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

test('performance upgrades match the Apple game economy', () => {
  const [speed, capacity, weapon] = upgrades;
  assert.equal(upgradeCost(speed, 0), 700);
  assert.equal(upgradeCost(speed, 1), 1350);
  assert.equal(upgradeCost(speed, 3), undefined);
  assert.equal(upgradeCost(capacity, 0), 550);
  assert.equal(upgradeCost(weapon, 0), 900);
  assert.equal(driveSpeedMultiplier(1), 1.18);
  assert.equal(maximumEnergy(1), 125);
  assert.equal(upgradedWeaponDamage(2, 1), 3);
});

test('drive energy drains in motion and charges while stopped', () => {
  const drained = updateDriveEnergy({ energy: BASE_ROB_ENERGY, maximum: BASE_ROB_ENERGY, moving: true, delta: 1 });
  assert.equal(drained, 93.4);
  assert.equal(updateDriveEnergy({ energy: drained, maximum: BASE_ROB_ENERGY, moving: false, delta: 1 }), 96.60000000000001);
  assert.equal(updateDriveEnergy({ energy: 124, maximum: 125, moving: false, delta: 1, capacityLevel: 1 }), 125);
});

test('conveyors move ROB along their arrow direction only inside the striped zone', () => {
  const conveyors = [{ x: 2, z: 1, w: 1, d: .5, dx: 1, dz: 0, speed: .6 }];
  assert.deepEqual(conveyorDisplacement({ point: { x: 2, z: 1 }, conveyors, delta: .5 }), { x: .3, z: 0 });
  assert.deepEqual(conveyorDisplacement({ point: { x: 0, z: 0 }, conveyors, delta: .5 }), { x: 0, z: 0 });
});

test('security cameras respect their view cone, walls, and shadow cover', () => {
  const camera = { id: 0, x: 0, z: 2, heading: 0, sweep: 0, range: 8 };
  const robot = { x: 0, z: -2 };
  assert.equal(securityCameraSees({ camera, robot, elapsed: 0 }), true);
  assert.equal(securityCameraSees({ camera, robot, elapsed: 0, blockers: [{ x: 0, z: 0, w: 1, d: .1 }] }), false);
  assert.equal(securityCameraSees({ camera, robot, elapsed: 0, shadows: [{ x: 0, z: -2, w: 1, d: 1 }] }), false);
  assert.equal(securityCameraSees({ camera, robot: { x: 5, z: 2 }, elapsed: 0 }), false);
});
