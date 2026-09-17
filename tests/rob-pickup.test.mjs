import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPickupTask, interactWithCargo, advancePickupLean, PICKUP_LEAN_ANGLE, PICKUP_REWARD } from '../assets/js/rob-pickup.mjs';
import { applyPickupArms } from '../assets/js/rob-pickup-visual.mjs';
import { buildROBVisual } from '../assets/js/rob-visual-model.mjs';
import { robTorsoPresentation } from '../assets/js/rob-support-motion.mjs';
import { createCampaignLevels, reachableCoursePoints } from '../assets/js/rob-simulator-levels.mjs';

const source = { x: 1, y: .12, z: 0 }, destination = { x: 3, y: .12, z: -1 };
const context = { running: true, grounded: true, leanAmount: 1, speed: 0, hand: source, destination, dropPosition: source, scale: 1 };

test('cargo requires a settled lean, stopped treads, hand reach, and an unobstructed path', () => {
  const state = createPickupTask(source);
  for (const [change, event] of [[{ running: false }, 'inactive'], [{ grounded: false }, 'land'], [{ speed: -.2 }, 'stop'],
    [{ leanAmount: .9 }, 'lean'], [{ leanAmount: NaN }, 'lean'], [{ speed: NaN }, 'stop'], [{ hand: { x: 0, y: 2, z: 0 } }, 'outOfReach'], [{ clear: false }, 'blocked']]) {
    const result = interactWithCargo(state, { ...context, ...change });
    assert.equal(result.event, event); assert.equal(result.state, state); assert.equal(result.reward, 0);
  }
});

test('carry, drop, regrasp and precise delivery pay once and reset for the next mission', () => {
  let result = interactWithCargo(createPickupTask(source), context);
  assert.equal(result.state.phase, 'carrying'); assert.equal(result.reward, 0);
  result = interactWithCargo(result.state, { ...context, hand: { x: 2, y: .12, z: 0 }, dropPosition: { x: 2, y: .12, z: 0 } });
  assert.equal(result.event, 'dropped');
  result = interactWithCargo(result.state, { ...context, hand: result.state.position });
  assert.equal(result.event, 'pickedUp');
  const unsafe = interactWithCargo(result.state, { ...context, hand: { x: 2, y: .12, z: 0 }, dropClear: false });
  assert.equal(unsafe.event, 'unsafeDrop'); assert.equal(unsafe.state.phase, 'carrying');
  result = interactWithCargo(result.state, { ...context, hand: destination });
  assert.equal(result.event, 'delivered'); assert.equal(result.reward, PICKUP_REWARD);
  assert.equal(interactWithCargo(result.state, { ...context, hand: destination }).reward, 0);
  assert.equal(createPickupTask(source).phase, 'waiting');
  assert.equal(interactWithCargo(createPickupTask({ x: NaN, y: 0, z: 0 }), context).event, 'outOfReach');
});

test('leaning brings the modeled hand within floor-object reach at browser and native scales', () => {
  for (const scale of [1.35, 2.15]) {
    const rig = buildROBVisual({ scale }); rig.root.updateMatrixWorld(true);
    const base = rig.driveBase.matrixWorld.clone();
    const pose = robTorsoPresentation({ basePitch: 0, leanAngle: PICKUP_LEAN_ANGLE, scale });
    rig.torso.position.set(pose.position.x, pose.position.y, pose.position.z); rig.torso.rotation.x = pose.pitch;
    applyPickupArms(rig, 1, false, pose.pitch); rig.root.updateMatrixWorld(true);
    const hand = rig.root.getObjectByName('Right Gripper Palm').getWorldPosition(new THREE.Vector3());
    assert.ok(rig.driveBase.matrixWorld.equals(base), 'lean must not move the chassis');
    const floorObject = { x: hand.x, y: .12 * scale, z: hand.z };
    assert.equal(interactWithCargo(createPickupTask(floorObject), { ...context, hand, scale }).event, 'pickedUp');
    assert.ok(hand.z < -.3 * scale, 'the hand reaches forward');
  }
  assert.equal(advancePickupLean(0, true, 2), 1);
  assert.equal(advancePickupLean(1, false, 2), 0);
});

test('all 24 cargo objectives start on reachable ground before a locked door and deliver at the dock', () => {
  const levels = createCampaignLevels();
  assert.equal(new Set(levels.map((level) => level.cargo.id)).size, 3);
  for (const level of levels) {
    const points = reachableCoursePoints(level, { closedDoor: true });
    assert.ok(points.some((p) => Math.hypot(p[0] - level.cargo.pickup[0], p[1] - level.cargo.pickup[1]) < .7), level.name);
    assert.ok(level.cargo.pickup[1] > 0, 'cargo begins on the lower floor');
    assert.deepEqual(level.cargo.destinationPoint, level.dock);
    for (const item of [...level.cells, ...level.shieldPickups, ...level.repairPickups]) {
      assert.ok(Math.hypot(item[0] - level.cargo.pickup[0], item[1] - level.cargo.pickup[1]) > 1.5, level.name);
    }
  }
});
