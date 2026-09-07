export const SHOOTER_WHEEL_RADIUS = 0.27;

export function shooterWheelAngle(travelDistance, radius = SHOOTER_WHEEL_RADIUS) {
  return -travelDistance / radius;
}

export function shooterTurretYaw(elapsed, enemyIndex = 0) {
  return Math.sin(elapsed * 1.7 + enemyIndex * 0.73) * 0.16;
}

export function spiderLegPose({ travelDistance, elapsed, legIndex, side, lunging = false }) {
  const alternatingSide = side < 0 ? Math.PI : 0;
  const phase = travelDistance * 8 + elapsed * 1.15 + legIndex * Math.PI / 2 + alternatingSide;
  const effort = lunging ? 1.35 : 1;
  const lift = Math.max(0, Math.cos(phase)) * 0.24 * effort;
  return {
    swing: Math.sin(phase) * 0.42 * effort,
    lift,
    knee: -0.28 + lift * 0.85,
  };
}
