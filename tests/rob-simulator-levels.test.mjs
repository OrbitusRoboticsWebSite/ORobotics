import assert from 'node:assert/strict';
import test from 'node:test';
import { KEY_BEACON_HEIGHT, KEY_WORKSHOP_KEY_SPAWN, objectiveSpawnIsClear } from '../assets/js/rob-simulator-levels.mjs';

test('the access-key visibility line rises above the arena walls', () => {
  assert.ok(KEY_BEACON_HEIGHT > 4.5);
});

test('Level 2 key is inside the arena on an obstacle-free route', () => {
  const blockers = [
    [-5.5, -0.5, 1.1, 5.8],
    [-0.4, 2.1, 5.2, 1],
  ];
  assert.equal(objectiveSpawnIsClear({
    point: KEY_WORKSHOP_KEY_SPAWN,
    blockers,
    halfWidth: 16 / 1.38,
    halfDepth: 12 / 1.38,
    clearance: 1,
  }), true);
});

test('objective spawn validation rejects a key hidden inside a wall or arena edge', () => {
  const layout = { blockers: [[0, 0, 4, 2]], halfWidth: 10, halfDepth: 8, clearance: 1 };
  assert.equal(objectiveSpawnIsClear({ ...layout, point: [0, 0] }), false);
  assert.equal(objectiveSpawnIsClear({ ...layout, point: [9.5, 0] }), false);
  assert.equal(objectiveSpawnIsClear({ ...layout, point: [6, 4] }), true);
});

import { createCampaignLevels, reachableCoursePoints, ARENA_HALF_WIDTH, ARENA_HALF_DEPTH } from '../assets/js/rob-simulator-levels.mjs';

test('all 24 longer courses have reachable cells, keys and docks with turning clearance', () => {
  const campaign = createCampaignLevels();
  assert.equal(campaign.length, 24);
  for (const level of campaign) {
    assert.ok(level.obstacles.length >= 5);
    assert.ok(level.cells.length >= 7);
    const reachable = reachableCoursePoints(level);
    for (const point of [...level.cells, level.dock, ...level.shieldPickups, ...level.repairPickups]) {
      assert.ok(objectiveSpawnIsClear({ point, blockers: level.obstacles, halfWidth: ARENA_HALF_WIDTH, halfDepth: ARENA_HALF_DEPTH, clearance: 1.48 }), `${level.name}: objective in a wall`);
      assert.ok(reachable.some((p) => Math.hypot(p[0] - point[0], p[1] - point[1]) < .7), `${level.name}: unreachable objective`);
      const floor = level.platforms.find((p) => Math.abs(point[0] - p.x) <= p.w && Math.abs(point[1] - p.z) <= p.d)?.height ?? .62;
      assert.ok(level.platforms.every((p) => p.height <= floor || Math.abs(point[0] - p.x) > p.w + 1.48 || Math.abs(point[1] - p.z) > p.d + 1.48), `${level.name}: objective trapped beside a raised platform`);
    }
    if (level.key) assert.ok(reachableCoursePoints(level, { closedDoor: true }).some((p) => Math.hypot(p[0] - level.key[0], p[1] - level.key[1]) < .7), `${level.name}: key is behind its own locked door`);
    assert.ok(level.dock[1] < -16, `${level.name}: dock must remain at the far end`);
  }
});

test('new rocket missions require landing above flipper reach without unreachable heights', () => {
  for (const level of createCampaignLevels().slice(15)) {
    assert.equal(level.requiresBooster, true);
    assert.equal(level.platforms.length, 3);
    assert.ok(level.platforms.every((p) => p.height > 2 && p.height < 3 * 2.15));
    assert.ok(level.platforms.slice(0, 2).every((p) => level.cells.some(([x, z]) => Math.abs(x - p.x) < p.w && Math.abs(z - p.z) < p.d)));
    assert.ok(level.platforms.some((p) => Math.abs(level.dock[0] - p.x) < p.w && Math.abs(level.dock[1] - p.z) < p.d));
  }
});
