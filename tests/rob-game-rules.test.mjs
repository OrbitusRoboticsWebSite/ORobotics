import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ROB_HEALTH,
  applyROBHealthDamage,
  bossStats,
  firstProjectileImpact,
  isUnlocked,
  meleeAnimationIsClear,
  rangedWeapons,
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
