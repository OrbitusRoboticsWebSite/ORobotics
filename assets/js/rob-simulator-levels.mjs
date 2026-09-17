export const KEY_WORKSHOP_KEY_SPAWN = Object.freeze([-3.6, -4.8]);
export const KEY_BEACON_HEIGHT = 5.8;

export function objectiveSpawnIsClear({
  point,
  blockers,
  halfWidth,
  halfDepth,
  clearance = 0,
}) {
  if (!Array.isArray(point) || point.length !== 2) return false;
  if (Math.abs(point[0]) > halfWidth - clearance || Math.abs(point[1]) > halfDepth - clearance) return false;
  return blockers.every(([x, z, width, depth]) => (
    Math.abs(point[0] - x) > width / 2 + clearance
    || Math.abs(point[1] - z) > depth / 2 + clearance
  ));
}

export const ARENA_HALF_WIDTH = 16;
export const ARENA_HALF_DEPTH = 20;
const LEVEL_SCALE = 1.38;

export function createCampaignLevels() {
  const levels = [
    { name: 'Calibration Ledge', floor: 0x172734, grid: 0x2ca4bb, gate: [0, -3.6], dock: [7.8, 5.7], cells: [[-7.5, -4.8], [.8, 3.3], [7.5, -.8]], enemies: [['spider', -7.2, .2], ['dalek', 6.8, -5.4], ['spider', 0, -4.8]], health: 4, speed: 0, bonus: 900, obstacles: [[-3.2, -.8, 2.7, 1.3, 1.1], [3.8, 1.6, 1.5, 3.2, 1.35], [-1.3, 4.7, 3.1, 1.2, .85], [6.6, -3.6, 1.2, 2.1, 1.6]] },
    { name: 'Key Workshop', floor: 0x241b32, grid: 0xc548e8, gate: [-7.8, 1.7], dock: [7.7, -5.7], key: KEY_WORKSHOP_KEY_SPAWN, door: [2.8, 0, .5, 5], cells: [[-1.3, -2.3], [7.2, 1.5], [4.5, -4.8]], enemies: [['spider', -4.8, 3.8], ['dalek', 6, -4], ['spider', -1, -4.6]], health: 4, speed: .18, bonus: 1100, obstacles: [[-5.5, -.5, 1.1, 5.8, 1.5], [-.4, 2.1, 5.2, 1, 1.1]] },
    { name: 'Crossroads', floor: 0x1c2924, grid: 0x55dd88, gate: [7.5, 3.8], dock: [-7.8, -5.8], key: [8, 5], door: [-2, 1.5, 5, .5], cells: [[-8, 4.7], [-3.7, -.8], [0, -5.8], [7, -3]], enemies: [['spider', -6.8, 1.1], ['dalek', -1.5, -4.6], ['spider', 6, 3.8]], health: 4, speed: .24, bonus: 1300, obstacles: [[-6.2, -2.4, 5.5, .9, 1.2], [0, -.8, 4.8, .9, 1.1], [6.2, .1, 4.8, .9, 1.3]] },
    { name: 'Sensor Hall', floor: 0x152b35, grid: 0x38dfff, gate: [-7, -4], dock: [8, 5.5], cells: [[-7, 5], [-1, -4], [4, 4], [7, -4]], enemies: [['spider', -4, 1], ['dalek', 5, -2], ['spider', -7, -4], ['dalek', 7, 4]], health: 4, speed: .25, bonus: 1500, obstacles: [[-4, -2, 1, 6, 1], [0, 2, 1, 6, 1], [4, -2, 1, 6, 1]] },
    { name: 'Amber Armory', floor: 0x30251a, grid: 0xf1b93a, gate: [0, -5], dock: [8, -5], key: [-8, 5], door: [0, 1, 4, .5], cells: [[-6, 4], [2, -4], [7, -2], [5, 4]], enemies: [['dalek', -3, 3], ['spider', 5, -3], ['dalek', 7, 4], ['spider', -7, -4]], health: 6, speed: .3, bonus: 1700, obstacles: [[-4, 0, 1, 5, 1], [4, -2, 1, 3, 1]] },
    { name: 'Switchback Foundry', floor: 0x2b1830, grid: 0xd65cff, gate: [-8, 0], dock: [8, -5], key: [0, 5], door: [5, -2, .5, 5], cells: [[-7, -5], [-3, 3], [3, -4], [7, 4], [0, 0]], enemies: [['spider', -4, 0], ['dalek', 2, 2], ['spider', 6, -4], ['dalek', -7, 4], ['spider', 7, 4]], health: 6, speed: .35, bonus: 1900, obstacles: [[-5, -2, 5, .7, 1], [-1, 2, 5, .7, 1], [3, -2, 5, .7, 1]] },
    { name: 'Twin Sentinel Bay', floor: 0x17282a, grid: 0x55dd88, gate: [0, -5], dock: [0, 5.5], cells: [[-7, -4], [7, -4], [-7, 4], [7, 4], [0, 0]], enemies: [['dalek', -5, 0], ['dalek', 5, 0], ['spider', 0, -3], ['spider', -7, 4], ['dalek', 7, 4]], health: 6, speed: .4, bonus: 2100, obstacles: [[-2.5, 0, .7, 5, 1], [2.5, 0, .7, 5, 1]] },
    { name: 'Power Relay', floor: 0x2e2614, grid: 0xffc83d, gate: [-8, 5], dock: [8, -5], key: [-8, -5], door: [1, 0, .5, 5], cells: [[-5, 2], [2, -4], [5, 0], [7, -4], [0, 4]], enemies: [['spider', -3, -2], ['dalek', 3, 3], ['spider', 7, 0], ['dalek', -7, 4], ['spider', 7, -4]], health: 8, speed: .42, bonus: 2300, obstacles: [[-4, 0, .8, 5, 1], [4, 2.5, .8, 2, 1]] },
    { name: 'Guardian Maze', floor: 0x1a2430, grid: 0x5aa8ff, gate: [8, -5], dock: [-8, -5], key: [8, 5], door: [-5, 1, 4, .5], cells: [[-8, -5], [-3, -3], [0, 4], [4, -2], [7, 2], [-7, 4]], enemies: [['spider', -6, 0], ['dalek', -1, -4], ['spider', 3, 3], ['dalek', 7, -3], ['spider', -7, 4], ['dalek', 6, 4]], health: 8, speed: .46, bonus: 2600, obstacles: [[-5, -2, 5, .7, 1], [-1, -2, .7, 4, 1], [3, -2, 5, .7, 1], [6, 3.5, .7, 2, 1]] },
    { name: 'Mission Control', floor: 0x132a25, grid: 0x2bdf8a, gate: [0, -5], dock: [0, -5.5], key: [-8, 5], door: [0, 2, 5, .5], cells: [[-8, 5], [-5, -2], [0, -3], [5, -2], [8, -5], [7, 4]], enemies: [['dalek', -6, -2], ['spider', -2, 3], ['dalek', 3, -2], ['spider', 7, 3], ['dalek', -7, 4], ['spider', 6, -5]], health: 8, speed: .5, bonus: 3000, obstacles: [[-5, -2, .8, 4, 1], [0, -1, .8, 4, 1], [5, -2, .8, 4, 1]] },
    { name: 'Reactor Run', floor: 0x25151a, grid: 0xff5c72, gate: [-8, -5], dock: [8, 5], cells: [[-8, 5], [-5, -4], [-1, 3], [3, -4], [7, 0], [8, 5]], enemies: [['spider', -7, 0], ['spider', -3, 4], ['dalek', 1, -4], ['spider', 5, 3], ['dalek', 7, -3], ['dalek', 0, 1]], health: 8, speed: .54, bonus: 3300, obstacles: [[-6, -2, 4, .8, 1.2], [-1, 2, 5, .8, 1.2], [5, -2, 4, .8, 1.2]] },
    { name: 'Eclipse Hangar', floor: 0x17152d, grid: 0xa876ff, gate: [8, 5], dock: [-8, -5], key: [-8, 5], door: [2, 0, .5, 5], cells: [[-7, -4], [-5, 3], [-1, -3], [3, 4], [6, -4], [8, 2]], enemies: [['dalek', -7, 0], ['spider', -4, -4], ['dalek', -1, 4], ['spider', 3, -3], ['dalek', 6, 4], ['spider', 8, -2]], health: 8, speed: .58, bonus: 3600, obstacles: [[-5, 0, 1, 6, 1.2], [5, 2, 1, 4, 1.2]] },
    { name: 'Quantum Causeway', floor: 0x10293a, grid: 0x38dfff, gate: [0, -5], dock: [8, 5], key: [-8, 5], door: [-2, 1, 5, .5], cells: [[-8, -4], [-6, 4], [-3, -1], [0, 4], [3, -4], [6, 1], [8, 5]], enemies: [['spider', -8, 0], ['dalek', -5, -4], ['spider', -2, 4], ['dalek', 1, -3], ['spider', 4, 4], ['dalek', 7, -2], ['spider', 8, 4]], health: 10, speed: .62, bonus: 3900, obstacles: [[-6, -2, 4, .7, 1], [-1, 2, 4, .7, 1], [4, -2, 4, .7, 1]] },
    { name: 'Siege Foundry', floor: 0x301b12, grid: 0xff9b45, gate: [-8, 0], dock: [8, -5], key: [0, 5], door: [4, -1, .5, 5], cells: [[-8, -5], [-6, 3], [-3, -3], [0, 4], [3, -4], [6, 3], [8, -2]], enemies: [['dalek', -8, 1], ['dalek', -5, -4], ['spider', -2, 3], ['dalek', 1, -3], ['spider', 4, 4], ['spider', 7, -4], ['dalek', 8, 2]], health: 10, speed: .66, bonus: 4200, obstacles: [[-6, 0, 1, 6, 1.4], [-1, -2, 1, 4, 1.2], [4, 2, 1, 4, 1.2]] },
    { name: 'Final Citadel', floor: 0x10261d, grid: 0x2bdf8a, gate: [0, -5], dock: [0, 5.5], key: [-8, 5], door: [0, 1, 5, .5], cells: [[-8, -5], [-8, 5], [-5, 0], [-2, -4], [2, 4], [5, 0], [8, -5], [8, 5]], enemies: [['spider', -8, 0], ['dalek', -6, -4], ['spider', -4, 4], ['dalek', -1, -3], ['spider', 2, 4], ['dalek', 5, -4], ['spider', 8, 1], ['dalek', 7, 5]], health: 10, speed: .7, bonus: 4800, obstacles: [[-6, -2, 4, .8, 1.3], [-1, 2, 4, .8, 1.3], [4, -2, 4, .8, 1.3], [7, 3, 1, 3, 1.3]] },
    { name: 'Plasma Launch Yard', floor: 0x102437, grid: 0x38bfff, gate: [-7, 3], dock: [0, -5], cells: [[-8, 5], [-7, -4], [-3, 3], [0, -3], [3, 4], [7, -4], [8, 2], [-8, 0], [3, -1], [0, 5]], enemies: [["spider", -8, 2], ["dalek", -6, -4], ["spider", -3, 4], ["dalek", 0, -3], ["spider", 3, 3], ["dalek", 6, -4], ["spider", 8, 1], ["dalek", -8, -5]], health: 12, speed: 0.740, bonus: 5100, obstacles: [[-6, -2, 4, .8, 1.5], [0, 2, 4, .8, 1.5], [6, -2, 4, .8, 1.5], [-8, 4, .8, 3, 1.5]] },
    { name: 'Skybridge Depot', floor: 0x102437, grid: 0x38bfff, gate: [7, 3], dock: [0, -5], cells: [[-8, 5], [-7, -4], [-3, 3], [0, -3], [3, 4], [7, -4], [8, 2], [-8, 0], [3, -1], [0, 5]], enemies: [["dalek", -8, 2], ["spider", -6, -4], ["dalek", -3, 4], ["spider", 0, -3], ["dalek", 3, 3], ["spider", 6, -4], ["dalek", 8, 1], ["spider", -8, -5]], health: 12, speed: 0.765, bonus: 5400, obstacles: [[-6, -2, 4, .8, 1.5], [0, 2, 4, .8, 1.5], [6, -2, 4, .8, 1.5], [8, 4, .8, 3, 1.5]] },
    { name: 'Blue Jet Refinery', floor: 0x102437, grid: 0x38bfff, gate: [-7, 3], dock: [0, -5], cells: [[-8, 5], [-7, -4], [-3, 3], [0, -3], [3, 4], [7, -4], [8, 2], [-8, 0], [3, -1], [0, 5]], enemies: [["spider", -8, 2], ["dalek", -6, -4], ["spider", -3, 4], ["dalek", 0, -3], ["spider", 3, 3], ["dalek", 6, -4], ["spider", 8, 1], ["dalek", -8, -5]], health: 12, speed: 0.790, bonus: 5700, obstacles: [[-6, -2, 4, .8, 1.5], [0, 2, 4, .8, 1.5], [6, -2, 4, .8, 1.5], [-8, 4, .8, 3, 1.5]] },
    { name: 'Cloudbreak Relay', floor: 0x102437, grid: 0x38bfff, gate: [7, 3], dock: [0, -5], cells: [[-8, 5], [-7, -4], [-3, 3], [0, -3], [3, 4], [7, -4], [8, 2], [-8, 0], [3, -1], [0, 5]], enemies: [["dalek", -8, 2], ["spider", -6, -4], ["dalek", -3, 4], ["spider", 0, -3], ["dalek", 3, 3], ["spider", 6, -4], ["dalek", 8, 1], ["spider", -8, -5], ["dalek", 6, 5]], health: 14, speed: 0.815, bonus: 6000, obstacles: [[-6, -2, 4, .8, 1.5], [0, 2, 4, .8, 1.5], [6, -2, 4, .8, 1.5], [8, 4, .8, 3, 1.5]] },
    { name: 'Orbital Liftworks', floor: 0x102437, grid: 0x38bfff, gate: [-7, 3], dock: [0, -5], cells: [[-8, 5], [-7, -4], [-3, 3], [0, -3], [3, 4], [7, -4], [8, 2], [-8, 0], [3, -1], [0, 5]], enemies: [["spider", -8, 2], ["dalek", -6, -4], ["spider", -3, 4], ["dalek", 0, -3], ["spider", 3, 3], ["dalek", 6, -4], ["spider", 8, 1], ["dalek", -8, -5], ["spider", 6, 5]], health: 14, speed: 0.840, bonus: 6300, obstacles: [[-6, -2, 4, .8, 1.5], [0, 2, 4, .8, 1.5], [6, -2, 4, .8, 1.5], [-8, 4, .8, 3, 1.5]] },
    { name: 'Ion Storm Crossing', floor: 0x102437, grid: 0x38bfff, gate: [7, 3], dock: [0, -5], cells: [[-8, 5], [-7, -4], [-3, 3], [0, -3], [3, 4], [7, -4], [8, 2], [-8, 0], [3, -1], [0, 5]], enemies: [["dalek", -8, 2], ["spider", -6, -4], ["dalek", -3, 4], ["spider", 0, -3], ["dalek", 3, 3], ["spider", 6, -4], ["dalek", 8, 1], ["spider", -8, -5], ["dalek", 6, 5]], health: 14, speed: 0.865, bonus: 6600, obstacles: [[-6, -2, 4, .8, 1.5], [0, 2, 4, .8, 1.5], [6, -2, 4, .8, 1.5], [8, 4, .8, 3, 1.5]] },
    { name: 'Elevated Bastion', floor: 0x102437, grid: 0x38bfff, gate: [-7, 3], dock: [0, -5], cells: [[-8, 5], [-7, -4], [-3, 3], [0, -3], [3, 4], [7, -4], [8, 2], [-8, 0], [3, -1], [0, 5]], enemies: [["spider", -8, 2], ["dalek", -6, -4], ["spider", -3, 4], ["dalek", 0, -3], ["spider", 3, 3], ["dalek", 6, -4], ["spider", 8, 1], ["dalek", -8, -5], ["spider", 6, 5], ["dalek", 0, 1]], health: 16, speed: 0.890, bonus: 6900, obstacles: [[-6, -2, 4, .8, 1.5], [0, 2, 4, .8, 1.5], [6, -2, 4, .8, 1.5], [-8, 4, .8, 3, 1.5]] },
    { name: 'Starport Gauntlet', floor: 0x102437, grid: 0x38bfff, gate: [7, 3], dock: [0, -5], cells: [[-8, 5], [-7, -4], [-3, 3], [0, -3], [3, 4], [7, -4], [8, 2], [-8, 0], [3, -1], [0, 5]], enemies: [["dalek", -8, 2], ["spider", -6, -4], ["dalek", -3, 4], ["spider", 0, -3], ["dalek", 3, 3], ["spider", 6, -4], ["dalek", 8, 1], ["spider", -8, -5], ["dalek", 6, 5], ["spider", 0, 1]], health: 16, speed: 0.915, bonus: 7200, obstacles: [[-6, -2, 4, .8, 1.5], [0, 2, 4, .8, 1.5], [6, -2, 4, .8, 1.5], [8, 4, .8, 3, 1.5]] },
    { name: 'Plasma Summit', floor: 0x102437, grid: 0x38bfff, gate: [-7, 3], dock: [0, -5], cells: [[-8, 5], [-7, -4], [-3, 3], [0, -3], [3, 4], [7, -4], [8, 2], [-8, 0], [3, -1], [0, 5]], enemies: [["spider", -8, 2], ["dalek", -6, -4], ["spider", -3, 4], ["dalek", 0, -3], ["spider", 3, 3], ["dalek", 6, -4], ["spider", 8, 1], ["dalek", -8, -5], ["spider", 6, 5], ["dalek", 0, 1]], health: 16, speed: 0.940, bonus: 7500, obstacles: [[-6, -2, 4, .8, 1.5], [0, 2, 4, .8, 1.5], [6, -2, 4, .8, 1.5], [-8, 4, .8, 3, 1.5]] },
  ].map((level) => ({ ...level, gate: level.gate.map((value, axis) => value * LEVEL_SCALE * (axis ? 1.35 : 1)), dock: [level.dock[0] * LEVEL_SCALE, -18.2], key: level.key?.map((value, axis) => value * LEVEL_SCALE * (axis ? 1.35 : 1)), door: level.door?.map((value, index) => index < 4 ? value * LEVEL_SCALE * (index % 2 ? 1.35 : 1) : value), cells: level.cells.map((point) => point.map((value, axis) => value * LEVEL_SCALE * (axis ? 1.35 : 1))), enemies: level.enemies.map(([type, x, z]) => [type, x * LEVEL_SCALE, z * LEVEL_SCALE * 1.35]), obstacles: level.obstacles.map(([x, z, w, d, h]) => [x * LEVEL_SCALE, z * LEVEL_SCALE * 1.35, w * LEVEL_SCALE, d * LEVEL_SCALE * 1.35, h]) }));
  // A locked door is a real partition, not a decorative panel that can be driven around.
  // Complete the wall on both sides of every doorway while leaving the door-sized opening.
  levels.forEach((level) => {
    if (!level.door) return;
    const [x, z, w, d] = level.door;
    // Keep a full turning lane on both sides of the security partition.
    for (const obstacle of level.obstacles) {
      const axis = w > d ? 1 : 0, half = (w > d ? d : w) / 2;
      const obstacleHalf = obstacle[axis + 2] / 2, separation = half + obstacleHalf + 3.8;
      const center = w > d ? z : x;
      if (Math.abs(obstacle[axis] - center) < separation) obstacle[axis] = center + (obstacle[axis] >= center ? 1 : -1) * separation;
    }
    if (w > d) {
      const leftWidth = x - w / 2 + ARENA_HALF_WIDTH, rightWidth = ARENA_HALF_WIDTH - (x + w / 2);
      if (leftWidth > .05) level.obstacles.push([-ARENA_HALF_WIDTH + leftWidth / 2, z, leftWidth, d, 1.8]);
      if (rightWidth > .05) level.obstacles.push([x + w / 2 + rightWidth / 2, z, rightWidth, d, 1.8]);
    } else {
      const nearDepth = z - d / 2 + ARENA_HALF_DEPTH, farDepth = ARENA_HALF_DEPTH - (z + d / 2);
      if (nearDepth > .05) level.obstacles.push([x, -ARENA_HALF_DEPTH + nearDepth / 2, w, nearDepth, 1.8]);
      if (farDepth > .05) level.obstacles.push([x, z + d / 2 + farDepth / 2, w, farDepth, 1.8]);
    }
  });
  const itemCandidates = [
    [-13.2, -9.2], [13.2, -9.2], [-13.2, 7.8], [13.2, 7.8],
    [-8.8, -7.2], [8.8, -7.2], [-10.5, 2.4], [10.5, 2.4],
    [-4.5, 7.4], [4.5, 7.4], [0, -8.2], [0, 5.8],
    [-6.7, -.2], [6.7, -.2],
  ];
  const pointIsClear = (level, point, reserved, padding = .85) => (
    Math.abs(point[0]) < ARENA_HALF_WIDTH - 1.4
      && Math.abs(point[1]) < ARENA_HALF_DEPTH - 1.4
      && level.obstacles.every(([x, z, width, depth]) => Math.abs(point[0] - x) > width / 2 + padding || Math.abs(point[1] - z) > depth / 2 + padding)
      && (!level.door || Math.abs(point[0] - level.door[0]) > level.door[2] / 2 + padding || Math.abs(point[1] - level.door[1]) > level.door[3] / 2 + padding)
      && reserved.every((candidate) => Math.hypot(point[0] - candidate[0], point[1] - candidate[1]) > 1.35)
  );
  levels.forEach((level, index) => {
    const rotation = (index + 1) % itemCandidates.length, ordered = [...itemCandidates.slice(rotation), ...itemCandidates.slice(0, rotation)];
    const reserved = [...level.cells, level.dock, ...(level.key ? [level.key] : [])];
    const takePoint = () => {
      const pointIndex = ordered.findIndex((point) => pointIsClear(level, point, reserved));
      const point = pointIndex >= 0 ? ordered.splice(pointIndex, 1)[0] : ordered.shift();
      reserved.push(point);
      return point;
    };
    level.cells.push(takePoint(), takePoint());
    level.shieldPickups = Array.from({ length: index + 1 >= 8 ? 2 : 1 }, takePoint);
    level.repairPickups = Array.from({ length: index + 1 >= 10 ? 2 : 1 }, takePoint);
  });
  levels.forEach((level, index) => {
    level.obstacles.push([-4.5, 14.3, 9, .65, 1.8], [4.5, 10.8, 9, .65, 1.8], [-11.8, -14.2, 1.2, 3.2, 1.8]);
    level.cells.push([11.8, 16.9], [-11.8, 12.4]);
    level.platforms = [];
    level.requiresBooster = index >= 15;
    if (level.requiresBooster) {
      const offset = (index - 15) % 3;
      level.platforms = [
        { x: -7, z: -13.1, w: 2.4, d: 2.2, height: 2.5 + offset * .25 },
        { x: 7, z: -13.1, w: 2.4, d: 2.2, height: 3.4 + offset * .25 },
        { x: 0, z: -17.2, w: 2.8, d: 2, height: 4.3 + offset * .25 },
      ];
      level.cells.push(...level.platforms.slice(0, 2).map(({ x, z }) => [x, z]));
      level.dock = [0, -17.2];
    }
  });
  levels.forEach(repairMissionSpawns);
  return levels;
}

// Reserve enough space for ROB to turn, not just for the tiny cell mesh.
export function reachableCoursePoints(level, { closedDoor = false, clearance = 1.48 } = {}) {
  const blockers = [...level.obstacles, ...(closedDoor && level.door ? [level.door] : [])];
  const step = .6, candidates = new Map();
  for (let xi = -24; xi <= 24; xi += 1) for (let zi = -30; zi <= 30; zi += 1) {
    const point = [xi * step, zi * step];
    if (objectiveSpawnIsClear({ point, blockers, halfWidth: ARENA_HALF_WIDTH, halfDepth: ARENA_HALF_DEPTH, clearance })) candidates.set(`${xi},${zi}`, { point, xi, zi });
  }
  const start = [...candidates.values()].sort((a, b) => Math.hypot(a.point[0], a.point[1] - 18.4) - Math.hypot(b.point[0], b.point[1] - 18.4))[0];
  if (!start) throw new Error(`No safe start in ${level.name}`);
  const visited = new Set([`${start.xi},${start.zi}`]), queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${current.xi + dx},${current.zi + dz}`, next = candidates.get(key);
      if (next && !visited.has(key)) { visited.add(key); queue.push(next); }
    }
  }
  return queue.map(({ point }) => point);
}

function repairMissionSpawns(level) {
  const reachable = reachableCoursePoints(level), beforeDoor = level.door ? reachableCoursePoints(level, { closedDoor: true }) : reachable;
  level.spawn = beforeDoor[0];
  const reserved = [level.spawn];
  function place(point, options = reachable, blockers = level.obstacles) {
    const available = (candidate) => objectiveSpawnIsClear({ point: candidate, blockers, halfWidth: ARENA_HALF_WIDTH, halfDepth: ARENA_HALF_DEPTH, clearance: 1.48 })
      && reserved.every((other) => Math.hypot(candidate[0] - other[0], candidate[1] - other[1]) > 1.5);
    const connected = options.some((candidate) => Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) < .7);
    const chosen = connected && available(point) ? point : options.filter(available).sort((a, b) => Math.hypot(a[0] - point[0], a[1] - point[1]) - Math.hypot(b[0] - point[0], b[1] - point[1]))[0];
    if (!chosen) throw new Error(`No reachable objective placement in ${level.name}`);
    reserved.push(chosen); return chosen;
  }
  level.dock = place(level.dock);
  if (level.key) level.key = place(level.key, beforeDoor, [...level.obstacles, level.door]);
  level.cells = level.cells.map((point) => place(point));
  const groundBlockers = [...level.obstacles, ...level.platforms.map((p) => [p.x, p.z, p.w * 2, p.d * 2])];
  level.enemies = level.enemies.map(([kind, x, z]) => [kind, ...place([x, z], reachable, groundBlockers)]);
  level.shieldPickups = level.shieldPickups.map((point) => place(point));
  level.repairPickups = level.repairPickups.map((point) => place(point));
}
