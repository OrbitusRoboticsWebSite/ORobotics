// Offline game rules. The scan establishes the lean direction, not a calibrated
// actuator-to-angle curve or physical grasp workspace.
export const PICKUP_LEAN_ANGLE = -.85;
export const PICKUP_REACH_METERS = .22;
export const PICKUP_REWARD = 350;
export const CARGO_TYPES = Object.freeze([
  Object.freeze({ id: 'supplyCrate', name: 'supply crate', destination: 'supply pad' }),
  Object.freeze({ id: 'batteryModule', name: 'battery module', destination: 'charging pad' }),
  Object.freeze({ id: 'chessPawn', name: 'chess pawn', destination: 'marked chess square' }),
]);
export const cargoForLevel = (index) => CARGO_TYPES[index % CARGO_TYPES.length];
export const createPickupTask = (position) => ({ phase: 'waiting', position: { ...position } });
export const advancePickupLean = (amount, enabled, delta) => {
  const target = enabled ? 1 : 0;
  return amount + Math.sign(target - amount) * Math.min(Math.abs(target - amount), Math.max(0, delta) * 1.8);
};
export const pickupDriveMultiplier = (amount, carrying) => amount > .05 ? .25 : carrying ? .72 : 1;

// All positions share world coordinates; scale converts the game's visual
// metres to that renderer's scene units. Obstruction checks belong to the scene.
export function interactWithCargo(state, context) {
  const { running, grounded, leanAmount, speed, hand, destination, dropPosition, scale = 1, clear = true, dropClear = true } = context;
  const unchanged = (event) => ({ state, event, reward: 0 });
  if (!running || state.phase === 'delivered') return unchanged('inactive');
  if (!grounded) return unchanged('land');
  if (!(Math.abs(speed) <= .08)) return unchanged('stop');
  if (!(leanAmount >= .95)) return unchanged('lean');
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const validPoint = (point) => point && ['x', 'y', 'z'].every((axis) => Number.isFinite(point[axis]));
  if (!validPoint(hand) || !validPoint(destination) || !validPoint(state.position) || !Number.isFinite(scale) || scale <= 0) return unchanged('outOfReach');
  if (!clear) return unchanged('blocked');
  if (state.phase === 'waiting') {
    if (distance(hand, state.position) > PICKUP_REACH_METERS * scale) return unchanged('outOfReach');
    return { state: { ...state, phase: 'carrying' }, event: 'pickedUp', reward: 0 };
  }
  if (distance(hand, destination) <= PICKUP_REACH_METERS * scale) {
    return { state: { phase: 'delivered', position: { ...destination } }, event: 'delivered', reward: PICKUP_REWARD };
  }
  if (!dropClear || !validPoint(dropPosition) || distance(hand, dropPosition) > PICKUP_REACH_METERS * scale) return unchanged('unsafeDrop');
  return { state: createPickupTask(dropPosition), event: 'dropped', reward: 0 };
}
