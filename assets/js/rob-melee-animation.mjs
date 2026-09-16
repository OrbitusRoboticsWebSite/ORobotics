// Matches ROBMeleeAnimation.swift. Attacks include their recovery, so every
// arm starts and ends at rest without hiding or retracting the saber blades.
const smooth = (value) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export const meleeDuration = (style) => style === 'spin' ? .82 : style === 'hammer' ? .65 : .48;
export const meleePose = (style, progress = 1) => {
  const p = Math.max(0, Math.min(1, progress));
  const pose = { armYaw: 0, armRoll: 0, torsoYaw: 0, hammerPitch: 0 };
  if (!style || p <= 0 || p >= 1) return pose;
  // Smooth turnaround after the strike, followed by a slightly slower return.
  const excursion = p < .45 ? smooth(p / .45) : 1 - smooth((p - .45) / .55);
  if (style === 'spin') {
    pose.torsoYaw = smooth(p) * Math.PI * 2;
    pose.armRoll = Math.PI / 2 * smooth(p / .2) * (1 - smooth((p - .75) / .25));
  } else if (style === 'hammer') {
    pose.hammerPitch = -1.5 * excursion;
  } else {
    const direction = style === 'left' ? -1 : 1;
    pose.armYaw = direction * 1.3 * excursion;
    pose.armRoll = .5 * excursion;
    pose.torsoYaw = direction * .24 * excursion;
  }
  return pose;
};
