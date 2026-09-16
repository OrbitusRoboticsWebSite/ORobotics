// Game geometry, in meters before renderer scaling. The lean hinge sits above
// the upper (third) tread wheel. The pictured LACT is 8¼ inches between its pins
// in the reference pose; that length is not its stroke or joint limit.
export const ROB_LACT_REFERENCE_LENGTH = .20955;
export const ROB_LEAN_HINGE = Object.freeze({ x: 0, y: .302 + .073, z: .065 });
// Approximate upper-body mass center for the game, not measured mass properties.
export const ROB_TORSO_MASS_CENTER = Object.freeze({ x: 0, y: .78, z: .012 });
export const ROB_LACT_FIXED_PIN = Object.freeze({ x: 0, y: .30, z: -.08 });
export const ROB_LACT_MOVING_PIN = Object.freeze({ x: 0, y: .30 + Math.sqrt(ROB_LACT_REFERENCE_LENGTH ** 2 - .135 ** 2), z: .055 });
const moveToward = (value, target, step) => value + Math.sign(target - value) * Math.min(Math.abs(target - value), step);
const rotateX = (p, angle) => ({ x: p.x, y: p.y * Math.cos(angle) - p.z * Math.sin(angle), z: p.y * Math.sin(angle) + p.z * Math.cos(angle) });
const rotateY = (p, angle) => ({ x: p.x * Math.cos(angle) + p.z * Math.sin(angle), y: p.y, z: -p.x * Math.sin(angle) + p.z * Math.cos(angle) });
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const multiply = (p, scale) => ({ x: p.x * scale, y: p.y * scale, z: p.z * scale });

export const lactLengthForLean = (angle) => {
  const moving = add(ROB_LEAN_HINGE, rotateX(subtract(ROB_LACT_MOVING_PIN, ROB_LEAN_HINGE), angle));
  const difference = subtract(moving, ROB_LACT_FIXED_PIN);
  return Math.hypot(difference.x, difference.y, difference.z);
};
export const targetTorsoLean = (basePitch) => {
  const rearZ = .212725, frontZ = rearZ - .42545 * Math.cos(basePitch);
  const hinge = add(rotateX(subtract(ROB_LEAN_HINGE, { x: 0, y: 0, z: rearZ }), basePitch), { x: 0, y: 0, z: rearZ });
  const arm = subtract(ROB_TORSO_MASS_CENTER, ROB_LEAN_HINGE);
  const uprightZ = hinge.z + arm.z;
  const supportedZ = Math.max(frontZ + .07, Math.min(rearZ - .07, uprightZ));
  // Upright alone is insufficient: pitching the base moves this hinge aft.
  // Swing the entire upper body forward until its mass projects over the tracks.
  const bodyPitch = Math.abs(supportedZ - uprightZ) < 1e-9 ? 0
    : Math.asin(Math.max(-1, Math.min(1, (supportedZ - hinge.z) / Math.hypot(arm.y, arm.z)))) - Math.atan2(arm.z, arm.y);
  return Math.max(-1.45, Math.min(1.15, bodyPitch - basePitch));
};
export const advanceTorsoLean = (angle, basePitch, delta) => {
  const target = targetTorsoLean(basePitch);
  // Game linkage travel keeps pace with the flipper motor instead of leaving
  // the upper body behind the rear support during the transition.
  const length = lactLengthForLean(angle), targetLength = lactLengthForLean(target), step = .90 * Math.max(0, delta);
  if (Math.abs(targetLength - length) <= step) return target;
  const nextLength = moveToward(length, targetLength, step);
  // Stay on the monotonic branch of the illustrated two-pin linkage. These
  // angle bounds and linear speed are game presentation values.
  let low = -1.45, high = 1.15;
  for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (lactLengthForLean(mid) < nextLength) low = mid; else high = mid; }
  return (low + high) / 2;
};
export const robTorsoPresentation = ({ basePitch, leanAngle, rearHeight = 0, rootHeight = 0, scale = 1, yaw = 0 }) => {
  const rear = { x: 0, y: 0, z: .212725 }, pitch = basePitch + leanAngle;
  const basePoint = (point) => add(rotateX(subtract(point, rear), basePitch), rear);
  const hinge = basePoint(ROB_LEAN_HINGE);
  const rotateBody = (point) => rotateX(rotateY(point, yaw), pitch);
  const offset = subtract(hinge, rotateBody(ROB_LEAN_HINGE));
  const position = multiply(offset, scale); position.y += rearHeight - rootHeight;
  const fixedPin = basePoint(ROB_LACT_FIXED_PIN);
  const movingPin = add(offset, rotateBody(ROB_LACT_MOVING_PIN));
  const difference = subtract(movingPin, fixedPin);
  const massCenter = add(offset, rotateBody(ROB_TORSO_MASS_CENTER));
  return { position, pitch, fixedPin, movingPin, massCenter, lactLength: Math.hypot(difference.x, difference.y, difference.z) };
};

export const createROBSupportMotion = (height = 0) => ({ height, velocity: 0, pitch: 0, phase: 'grounded', supportHeight: height, fallDirection: 0 });

// Separate floor support from vertical motion. A flipper can brace against any
// supported floor; it cannot keep ROB suspended after both tread ends clear it.
export const stepROBSupportMotion = ({ motion, frontFloor, rearFloor, centerFloor, contactSpan, scale = 1, forward = 0, delta }) => {
  const next = { ...motion }, dt = Math.max(0, delta), epsilon = .0001;
  const high = Math.max(frontFloor, rearFloor), low = Math.min(frontFloor, rearFloor, centerFloor);
  // Treads have a continuous contact patch. An overhanging end does not
  // remove support while the center is still above the current deck. Only
  // accept an already-reached plane; this must not lift ROB onto a new step.
  const centerSupported = centerFloor >= high - epsilon && centerFloor <= motion.supportHeight + epsilon;
  const mixedSupport = high - Math.min(frontFloor, rearFloor) > epsilon && !centerSupported;
  if (mixedSupport && high <= motion.supportHeight + epsilon && motion.phase !== 'falling' && motion.phase !== 'settling') {
    // Tip around the tread end still on the platform. Retain the platform as
    // the support level until the trailing end also clears the edge.
    const target = Math.max(-.38, Math.min(.38, Math.asin(Math.max(-1, Math.min(1, (frontFloor - rearFloor) / contactSpan))) * .6));
    next.pitch = moveToward(motion.pitch, target, dt * 2.4);
    next.height = rearFloor > frontFloor ? rearFloor : frontFloor - contactSpan * Math.sin(next.pitch);
    next.velocity = 0; next.phase = 'edge'; next.supportHeight = high;
    next.fallDirection = frontFloor < rearFloor ? 1 : -1;
    return next;
  }
  if (high < motion.supportHeight - epsilon && (motion.phase === 'grounded' || motion.phase === 'edge')) {
    next.phase = 'falling'; next.velocity = 0;
    if (motion.phase !== 'edge') next.fallDirection = Math.sign(forward);
  }
  if (next.phase === 'falling') {
    next.pitch = moveToward(next.pitch, -.35 * next.fallDirection, dt * 2.4);
    const gravity = 9.81 * scale;
    next.height += next.velocity * dt - .5 * gravity * dt * dt;
    next.velocity -= gravity * dt;
    const contactHeight = high - Math.min(0, contactSpan * Math.sin(next.pitch));
    if (next.height <= contactHeight) {
      next.height = contactHeight; next.velocity = 0; next.phase = 'settling'; next.supportHeight = high;
    }
    return next;
  }
  if (next.phase === 'settling' || (next.phase === 'edge' && !mixedSupport)) {
    next.pitch = moveToward(next.pitch, 0, dt * 2.8);
    next.height = high - Math.min(0, contactSpan * Math.sin(next.pitch));
    next.velocity = 0; next.supportHeight = high;
    next.phase = Math.abs(next.pitch) < epsilon ? 'grounded' : 'settling';
    return next;
  }
  // A higher front sample is an approaching step, not permission to teleport
  // onto it. The climb state owns that transition after front clearance.
  return createROBSupportMotion(mixedSupport ? low : centerFloor);
};
