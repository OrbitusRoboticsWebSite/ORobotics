export const KEY_WORKSHOP_KEY_SPAWN = Object.freeze([-3.6, -4.8]);

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
