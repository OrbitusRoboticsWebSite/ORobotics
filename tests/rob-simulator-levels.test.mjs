import assert from 'node:assert/strict';
import test from 'node:test';
import { KEY_WORKSHOP_KEY_SPAWN, objectiveSpawnIsClear } from '../assets/js/rob-simulator-levels.mjs';

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
