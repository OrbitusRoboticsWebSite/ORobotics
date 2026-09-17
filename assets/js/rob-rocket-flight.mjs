export const ROCKET_ENERGY_PER_SECOND = 18;
export const ROCKET_CEILING = 3;

export const createRocketFlight = () => ({ airborne: false, velocity: 0, thrusting: false });

// Heights and speeds use the same model scale as ROB's support physics.
export function stepRocketFlight({ motion, height, floor, energy, held, installed, delta, scale = 1 }) {
  const dt = Math.max(0, delta);
  const poweredTime = installed && held ? Math.min(dt, Math.max(0, energy) / ROCKET_ENERGY_PER_SECOND) : 0;
  const thrusting = poweredTime > 0;
  if (!motion.airborne && !thrusting) return { motion: createRocketFlight(), height, energy };
  let velocity = thrusting
    ? Math.min(1.4 * scale, motion.velocity + 4 * scale * poweredTime)
    : Math.max(-1.3 * scale, motion.velocity - 3.2 * scale * dt);
  let nextHeight = height + velocity * dt;
  if (nextHeight >= ROCKET_CEILING * scale) { nextHeight = ROCKET_CEILING * scale; velocity = Math.min(0, velocity); }
  const landed = nextHeight <= floor && velocity <= 0;
  return {
    motion: landed ? createRocketFlight() : { airborne: true, velocity, thrusting },
    height: landed ? floor : nextHeight,
    energy: Math.max(0, energy - poweredTime * ROCKET_ENERGY_PER_SECOND),
  };
}
