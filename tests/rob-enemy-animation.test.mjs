import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOOTER_WHEEL_RADIUS, shooterTurretYaw, shooterWheelAngle, spiderLegPose } from '../assets/js/rob-enemy-animation.mjs';

test('shooter wheels rotate in proportion to distance traveled', () => {
  assert.equal(shooterWheelAngle(Math.PI * 2 * SHOOTER_WHEEL_RADIUS), -Math.PI * 2);
});

test('opposite spider legs alternate their crawl stroke', () => {
  const left = spiderLegPose({ travelDistance: 1, elapsed: 2, legIndex: 0, side: -1 });
  const right = spiderLegPose({ travelDistance: 1, elapsed: 2, legIndex: 0, side: 1 });
  assert.ok(Math.abs(left.swing + right.swing) < 0.000001);
  assert.notEqual(left.lift, right.lift);
});

test('shooter turret sweep remains controlled', () => {
  for (let time = 0; time < 10; time += 0.25) assert.ok(Math.abs(shooterTurretYaw(time, 3)) <= 0.16);
});
