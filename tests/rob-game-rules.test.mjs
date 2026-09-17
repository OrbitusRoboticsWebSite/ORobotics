import test from 'node:test';
import assert from 'node:assert/strict';
import { meleeDuration, meleePose } from '../assets/js/rob-melee-animation.mjs';
import { createROBSupportMotion, stepROBSupportMotion, advanceTorsoLean, targetTorsoLean, lactLengthForLean, robTorsoPresentation, ROB_LACT_REFERENCE_LENGTH, ROB_LEAN_HINGE } from '../assets/js/rob-support-motion.mjs';
import {
  BASE_FLIPPER_DURATION,
  BASE_FLIPPER_FORWARD_ANGLE,
  BASE_FLIPPER_REAR_ANGLE,
  MAX_TRIAL_LIVES,
  MAX_ROB_HEALTH,
  MAX_ROB_SHIELDS,
  SHIELD_ACTIVATION_DURATION,
  stepBubbleShield,
  BASE_ROB_ENERGY,
  BASE_DRIVE_SPEED,
  applyROBDamage,
  applyROBHealthDamage,
  advanceBaseFlipper,
  battleUpgradePoints,
  baseFlipperPresentation,
  bossStats,
  cameraHeading,
  circularBodiesOverlap,
  conveyorArrowOffset,
  conveyorDisplacement,
  consumeLaserEnergy,
  consumeTrialLife,
  canMountLedge,
  driveSpeedMultiplier,
  energyPickupAmount,
  faceColors,
  firstProjectileImpact,
  isUnlocked,
  laserEnergyCost,
  laserAimHeading,
  targetingComputerStats,
  LASER_RECHARGE_DELAY,
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
  assert.deepEqual(applyROBDamage({ health: MAX_ROB_HEALTH, shields: MAX_ROB_SHIELDS, damage: 6, shieldActive: true }), {
    appliedDamage: 6,
    shieldDamage: 6,
    healthDamage: 0,
    shields: 34,
    health: 100,
    scorePenalty: 120,
  });
  assert.deepEqual(applyROBDamage({ health: MAX_ROB_HEALTH, shields: 4, damage: 10, shieldActive: true }), {
    appliedDamage: 10,
    shieldDamage: 4,
    healthDamage: 6,
    shields: 0,
    health: 94,
    scorePenalty: 200,
  });
});

test('bubble shield requires activation, expires, and cannot be extended by holding its button', () => {
  const input = { remaining: 0, shields: MAX_ROB_SHIELDS, running: true };
  assert.equal(stepBubbleShield(input).active, false);
  assert.deepEqual(applyROBDamage({ health: 100, shields: 40, damage: 6 }), {
    appliedDamage: 6, shieldDamage: 0, healthDamage: 6, health: 94, shields: 40, scorePenalty: 120,
  });
  const active = stepBubbleShield({ ...input, activate: true });
  assert.equal(active.remaining, SHIELD_ACTIVATION_DURATION);
  const halfway = stepBubbleShield({ ...input, remaining: active.remaining, delta: SHIELD_ACTIVATION_DURATION / 2 });
  assert.equal(halfway.fraction, .5);
  assert.equal(stepBubbleShield({ ...input, remaining: halfway.remaining, activate: true }).remaining, halfway.remaining);
  assert.equal(stepBubbleShield({ ...input, remaining: halfway.remaining, delta: SHIELD_ACTIVATION_DURATION / 2 }).active, false);
  assert.equal(stepBubbleShield({ ...input, shields: 0, activate: true }).active, false);
  assert.equal(stepBubbleShield({ ...input, running: false, remaining: 2 }).remaining, 0);
});

test('map pickups replenish shields and repair hull damage without overfilling', () => {
  assert.equal(replenishROBShields(5), 29);
  assert.equal(replenishROBShields(35), MAX_ROB_SHIELDS);
  assert.equal(repairROBHealth(50), 85);
  assert.equal(repairROBHealth(90), MAX_ROB_HEALTH);
});

test('every fifth level adds an escalating reinforced ten-damage boss', () => {
  assert.deepEqual(bossStats(4, 4), { isBoss: false, shields: 4, contactDamage: undefined, projectileDamage: undefined });
  assert.deepEqual(bossStats(5, 6), { isBoss: true, shields: 60, contactDamage: 10, projectileDamage: 10 });
  assert.equal(bossStats(10, 8).shields, 90);
  assert.equal(bossStats(15, 10).shields, 120);
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
  assert.equal(laserEnergyCost(gatling, 0), 8);
  assert.equal(laserEnergyCost(gatling, 1), 24);
  assert.equal(laserEnergyCost(twinBlasters, 0), 10);
  assert.equal(laserEnergyCost(twinBlasters, 1), 28);
  assert.equal(laserEnergyCost(arcCannon, 0), 16);
  assert.equal(laserEnergyCost(arcCannon, 1), 44);
  assert.deepEqual(consumeLaserEnergy({ energy: 60, weapon: arcCannon, charge: 1 }), { fired: true, cost: 44, energy: 16 });
  assert.deepEqual(consumeLaserEnergy({ energy: 40, weapon: arcCannon, charge: 1 }), { fired: false, cost: 44, energy: 40 });
});

test('all laser auto-locks require the targeting computer upgrade', () => {
  const twinBlasters = rangedWeapons.find(({ id }) => id === 'twinBlasters');
  for (const weapon of rangedWeapons) assert.equal(maximumLaserLocks(weapon, 0), 0);
  assert.equal(maximumLaserLocks(twinBlasters, 1), 2);
  assert.equal(maximumLaserLocks(rangedWeapons[0], 1), 1);
  const targetingComputer = upgrades.find(({ id }) => id === 'targetingComputer');
  assert.equal(upgradeCost(targetingComputer, 0), 1200);
  assert.equal(upgradeCost(targetingComputer, 1), undefined);
});

test('the starter computer keeps manual aim and a slower firing and charging cycle', () => {
  const basic = targetingComputerStats(0), upgraded = targetingComputerStats(1);
  assert.equal(basic.autoLock, false); assert.equal(upgraded.autoLock, true);
  assert.ok(basic.cycleDuration > upgraded.cycleDuration);
  assert.ok(basic.chargeDuration > upgraded.chargeDuration);
  const aim = { origin: { x: 0, z: 0 }, heading: 0, target: { x: 5, z: 0 } };
  assert.equal(laserAimHeading({ ...aim, targetingComputerLevel: 0 }), 0, 'a nearby enemy cannot redirect a manual shot');
  assert.equal(laserAimHeading({ ...aim, targetingComputerLevel: 1 }), -Math.PI / 2);
  assert.equal(laserAimHeading({ ...aim, target: undefined, targetingComputerLevel: 1 }), 0, 'without a lock the upgraded laser can still fire forward');
});

test('laser energy cannot recharge while charging or immediately after firing', () => {
  for (const weapon of rangedWeapons) {
    const shot = consumeLaserEnergy({ energy: 100, weapon, charge: 1 });
    const idle = { energy: shot.energy, maximum: 100, moving: false, delta: .1 };
    assert.equal(updateDriveEnergy({ ...idle, secondsSinceShot: .5 }), shot.energy);
    assert.equal(updateDriveEnergy({ ...idle, charging: true, secondsSinceShot: 5 }), shot.energy);
    assert.ok(updateDriveEnergy({ ...idle, secondsSinceShot: LASER_RECHARGE_DELAY }) > shot.energy);
    assert.ok(updateDriveEnergy({ ...idle, moving: true, charging: true }) < shot.energy, 'driving still consumes energy');
    const empty = consumeLaserEnergy({ energy: weapon.baseEnergy - .1, weapon, charge: 0 });
    assert.equal(empty.fired, false); assert.equal(empty.energy, weapon.baseEnergy - .1);
  }
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
    shields: 6,
    contactDamage: 4,
    projectileDamage: 3,
    scale: 1.15,
    defeatReward: 500,
  });
});

test('flipper down pitches the front with the rear grounded; rear support levels the step climb', () => {
  const moving = advanceBaseFlipper({ angle: 0, target: 'forward', delta: BASE_FLIPPER_DURATION / 2 });
  assert.equal(moving.angle, BASE_FLIPPER_FORWARD_ANGLE / 2);
  const down = advanceBaseFlipper({ angle: 0, target: 'forward', delta: BASE_FLIPPER_DURATION + .01 });
  const raised = baseFlipperPresentation({ angle: down.angle, target: 'forward' });
  assert.equal(raised.lift, 0, 'rear support stays at floor height');
  assert.ok(raised.pitch > .7 && raised.pitch < .85);
  const rollerHeight = .11 * Math.cos(raised.pitch) + .33655 * Math.sin(down.angle + raised.pitch);
  assert.ok(Math.abs(rollerHeight - .029) < 1e-6, 'flipper roller contacts the floor');
  for (const [scale, stepHeight] of [[1.35, .34], [2.15, .62]]) {
    let previousRear = 0, previousPitch = raised.pitch;
    for (let step = 0; step <= 20; step++) {
      const pose = baseFlipperPresentation({ angle: 0, target: 'rear', climbProgress: step / 20, stepHeight, scale });
      const frontHeight = pose.lift + .42545 * scale * Math.sin(pose.pitch);
      assert.ok(frontHeight >= stepHeight - 1e-6, 'front stays on or above the step');
      assert.ok(pose.lift >= previousRear && pose.pitch <= previousPitch, 'rear rises while chassis levels');
      previousRear = pose.lift; previousPitch = pose.pitch;
    }
    assert.equal(previousRear, stepHeight); assert.equal(previousPitch, 0);
  }
  const rear = advanceBaseFlipper({ angle: down.angle, target: 'rear', climbing: true, delta: 2 });
  assert.ok(rear.angle > Math.PI, 'opposite rotation reaches the rear support pose');
  const contact = baseFlipperPresentation({ angle: rear.angle, target: 'rear', climbProgress: .55, stepHeight: .34, scale: 1.35 });
  const rearRollerHeight = contact.lift + 1.35 * (.11 * Math.cos(contact.pitch) + .33655 * Math.sin(rear.angle + contact.pitch));
  assert.ok(Math.abs(rearRollerHeight - .029 * 1.35) < 1e-6, 'rear flipper supports the robot against the lower floor');
  const stowed = advanceBaseFlipper({ angle: rear.angle, target: 'rear', delta: 2 });
  assert.equal(stowed.angle, 0);
});

test('a raised deck accepts only a forward flipper approach', () => {
  const approach = { start: { x: 0, z: -2 }, end: { x: 0, z: -2.4 }, approachEdgeZ: -2.2 };
  assert.equal(canMountLedge({ ...approach, flipperAngle: BASE_FLIPPER_REAR_ANGLE }), false);
  assert.equal(canMountLedge({ ...approach, flipperAngle: BASE_FLIPPER_FORWARD_ANGLE }), true);
  assert.equal(canMountLedge({ start: approach.end, end: approach.start, flipperAngle: BASE_FLIPPER_FORWARD_ANGLE, approachEdgeZ: -2.2 }), false);
});

test('a platform is a new floor for repeated flipper cycles', () => {
  for (let cycle = 0; cycle < 3; cycle++) {
    const raised = baseFlipperPresentation({ angle: BASE_FLIPPER_FORWARD_ANGLE, target: 'forward', onLedge: true, stepHeight: .62, scale: 2.15 });
    assert.equal(raised.lift, .62);
    assert.ok(raised.pitch > .7, 'front can rise again on top of the platform');
    const stowed = baseFlipperPresentation({ angle: 0, onLedge: true, stepHeight: .62, scale: 2.15 });
    assert.equal(stowed.pitch, 0); assert.equal(stowed.stabilized, true);
  }
});

test('a supported platform center permits flippers with either tread end overhanging', () => {
  for (const scale of [1.35, 2.15]) {
    const height = scale === 1.35 ? .34 : .62, contactSpan = .42545 * scale;
    for (const [frontFloor, rearFloor] of [[height, 0], [0, height]]) {
      let motion = createROBSupportMotion(height);
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const target of ['forward', 'rear']) {
          let angle = target === 'forward' ? 0 : BASE_FLIPPER_FORWARD_ANGLE;
          for (let frame = 0; frame < 20; frame++) {
            angle = advanceBaseFlipper({ angle, target, delta: .02 }).angle;
            motion = stepROBSupportMotion({ motion, frontFloor, rearFloor, centerFloor: height, contactSpan, scale, delta: .02 });
            assert.equal(motion.phase, 'grounded', 'the platform must keep the controls available');
            assert.equal(motion.height, height);
          }
          const pose = baseFlipperPresentation({ angle, target, supportHeight: motion.height, scale });
          assert.equal(pose.lift, height);
          assert.equal(target === 'forward' ? pose.pitch > .7 : pose.pitch === 0, true);
        }
      }
      // Moving the center off the deck still tips the base and then drops it.
      motion = stepROBSupportMotion({ motion, frontFloor, rearFloor, centerFloor: 0, contactSpan, scale, delta: .02 });
      assert.equal(motion.phase, 'edge');
      motion = stepROBSupportMotion({ motion, frontFloor: 0, rearFloor: 0, centerFloor: 0, contactSpan, scale, delta: .02 });
      assert.equal(motion.phase, 'falling');
    }
  }
});

test('sabers reverse smoothly and finish at the idle pose', () => {
  for (const style of ['left', 'right']) {
    const start = meleePose(style, 0), strike = meleePose(style, .45), recovery = meleePose(style, .75), end = meleePose(style, 1);
    assert.deepEqual(start, end);
    assert.ok(Math.abs(strike.armYaw) > 1.2);
    assert.ok(Math.abs(recovery.armYaw) > 0 && Math.abs(recovery.armYaw) < Math.abs(strike.armYaw));
    assert.equal(Math.sign(strike.armYaw), Math.sign(recovery.armYaw), 'return retraces the swing');
    for (let frame = 1; frame <= 120; frame++) {
      const a = meleePose(style, (frame - 1) / 120), b = meleePose(style, frame / 120);
      for (const key of ['armYaw', 'armRoll', 'torsoYaw']) assert.ok(Math.abs(b[key] - a[key]) < .04, `${key} stays continuous`);
    }
    assert.ok(meleeDuration(style) < 1.15, 'recovery leaves time to chain the combo');
  }
  for (const style of ['spin', 'hammer']) {
    const a = meleePose(style, .9999), b = meleePose(style, 1);
    assert.ok(Math.abs(a.armRoll - b.armRoll) < .001);
    assert.ok(Math.abs(a.hammerPitch - b.hammerPitch) < .001);
    assert.ok(Math.abs(Math.sin(a.torsoYaw - b.torsoYaw)) < .001, 'a full spin ends at the same orientation');
  }
});

test('edge support releases into gravity and settles on the lower floor', () => {
  for (const scale of [1.35, 2.15]) {
    const height = scale === 1.35 ? .34 : .62, contactSpan = .42545 * scale;
    let motion = createROBSupportMotion(height);
    for (let i = 0; i < 10; i++) motion = stepROBSupportMotion({ motion, frontFloor: 0, rearFloor: height, centerFloor: 0, contactSpan, scale, forward: 1, delta: .02 });
    assert.equal(motion.phase, 'edge'); assert.equal(motion.height, height);
    assert.ok(motion.pitch < 0, 'front tips down about supported rear');
    motion = stepROBSupportMotion({ motion, frontFloor: 0, rearFloor: 0, centerFloor: 0, contactSpan, scale, forward: 1, delta: .02 });
    assert.equal(motion.phase, 'falling'); assert.ok(motion.height < height && motion.height > 0);
    assert.ok(motion.velocity < 0, 'gravity accelerates downward after the rear clears');
    let sawLanding = false;
    for (let i = 0; i < 50; i++) {
      motion = stepROBSupportMotion({ motion, frontFloor: 0, rearFloor: 0, centerFloor: 0, contactSpan, scale, forward: 0, delta: .02 });
      assert.ok(motion.height + Math.min(0, contactSpan * Math.sin(motion.pitch)) >= -1e-6, 'neither tread end penetrates the landing floor');
      if (motion.phase === 'settling') sawLanding = true;
    }
    assert.ok(sawLanding); assert.equal(motion.phase, 'grounded');
    assert.equal(motion.height, 0); assert.equal(motion.pitch, 0); assert.equal(motion.velocity, 0);
  }
});

test('higher approaching terrain cannot raise ROB without a climb', () => {
  const motion = stepROBSupportMotion({ motion: createROBSupportMotion(), frontFloor: .62, rearFloor: 0, centerFloor: 0, contactSpan: .9, delta: .05 });
  assert.equal(motion.phase, 'grounded'); assert.equal(motion.height, 0);
});

test('LACT counter-leans at its lower hinge with the 8¼-inch reference pin length', () => {
  const rest = robTorsoPresentation({ basePitch: 0, leanAngle: 0 });
  assert.ok(Math.abs(rest.lactLength - ROB_LACT_REFERENCE_LENGTH) < 1e-12);
  const inMotion = advanceTorsoLean(0, .8, .05);
  assert.ok(Math.abs(lactLengthForLean(inMotion) - (ROB_LACT_REFERENCE_LENGTH - .045)) < 1e-7, 'linear actuator travel determines the intermediate lean angle');
  for (const pitch of [.8, -.35]) {
    const lean = advanceTorsoLean(0, pitch, 1);
    assert.equal(Math.sign(lean), -Math.sign(pitch));
    const pose = robTorsoPresentation({ basePitch: pitch, leanAngle: lean });
    assert.ok(pose.massCenter.z <= .212725 && pose.massCenter.z >= .212725 - .42545 * Math.cos(pitch), 'upper body remains over the tracks');
    assert.equal(pose.pitch, pitch + targetTorsoLean(pitch));
    const uncompensated = robTorsoPresentation({ basePitch: pitch, leanAngle: 0 });
    const hinge = ROB_LEAN_HINGE;
    const rotate = (p, a) => ({ y: p.y * Math.cos(a) - p.z * Math.sin(a), z: p.y * Math.sin(a) + p.z * Math.cos(a) });
    const a = rotate(hinge, pose.pitch), b = rotate(hinge, uncompensated.pitch);
    assert.ok(Math.abs(pose.position.y + a.y - uncompensated.position.y - b.y) < 1e-12);
    assert.ok(Math.abs(pose.position.z + a.z - uncompensated.position.z - b.z) < 1e-12, 'torso rotates about its hinge, not the origin');
    assert.ok(Math.abs(pose.lactLength - rest.lactLength) > .001, 'pin separation changes with torso lean');
  }
});

test('LACT moves the whole body fast enough to remain over the tread support during a flip', () => {
  for (const delta of [1 / 120, 1 / 60, .02, .05]) {
    let angle = 0, lean = 0;
    for (const target of ['forward', 'rear']) {
      for (let frame = 0; frame < Math.ceil(.6 / delta); frame++) {
        angle = advanceBaseFlipper({ angle, target, delta }).angle;
        const pitch = baseFlipperPresentation({ angle, target }).pitch;
        lean = advanceTorsoLean(lean, pitch, delta);
        const body = robTorsoPresentation({ basePitch: pitch, leanAngle: lean });
        assert.ok(body.massCenter.z <= .212725 + 1e-6, 'body must not lean behind the rear tread');
        assert.ok(body.massCenter.z >= .212725 - .42545 * Math.cos(pitch) - 1e-6, 'body must not tip ahead of the front tread');
      }
    }
  }
  const raised = robTorsoPresentation({ basePitch: .8, leanAngle: targetTorsoLean(.8) });
  assert.ok(raised.pitch < -.35, 'body visibly swings forward beyond merely staying vertical');
});

test('the third trial life is the terminal life', () => {
  assert.equal(MAX_TRIAL_LIVES, 3);
  assert.deepEqual(consumeTrialLife(3), { lives: 2, trialFailed: false });
  assert.deepEqual(consumeTrialLife(2), { lives: 1, trialFailed: false });
  assert.deepEqual(consumeTrialLife(1), { lives: 0, trialFailed: true });
});
