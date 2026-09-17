import {
  BASE_FLIPPER_FORWARD_ANGLE, BASE_FLIPPER_REAR_ASSIST_ANGLE, ROB_CONTACT_SPAN,
  baseFlipperPresentation, flipperGroundPitch,
} from './rob-game-rules.mjs';
import { targetTorsoLean, robTorsoPresentation } from './rob-support-motion.mjs';

export const SHOWCASE_PLATFORM = Object.freeze({ width: 1.6, depth: 1.34, height: .24, edgeZ: -.30 });
export const SHOWCASE_CLIMB_DURATION = 11.5;
const REAR_AXLE_Z = .212725, START_Z = .65;
const projectedSpan = ROB_CONTACT_SPAN * Math.cos(flipperGroundPitch(BASE_FLIPPER_FORWARD_ANGLE));
// The tread nose overhangs its contact span; leave room for the roller at the lip.
const mountZ = SHOWCASE_PLATFORM.edgeZ + projectedSpan - REAR_AXLE_Z + .02;
const levelZ = SHOWCASE_PLATFORM.edgeZ - REAR_AXLE_Z;
const smooth = (value) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * smooth(t);

export function showcaseGroundPose(angle = 0) {
  let { pitch, lift } = baseFlipperPresentation({ angle });
  // The rearward roller can lift the back while the front tread stays planted.
  // Use the same support span and roller dimensions as the game's front lift.
  if (angle > Math.PI && .11 + .33655 * Math.sin(angle) < .029) {
    const clearance = (p) => -ROB_CONTACT_SPAN * Math.sin(p) + .11 * Math.cos(p) + .33655 * Math.sin(angle + p) - .029;
    let low = -.6, high = 0;
    for (let i = 0; i < 30; i++) { const mid = (low + high) / 2; if (clearance(mid) >= 0) low = mid; else high = mid; }
    pitch = low; lift = -ROB_CONTACT_SPAN * Math.sin(pitch);
  }
  return { angle, pitch, lift, z: START_Z, wheelTravel: 0, stage: 'Manual flippers',
    detail: 'The grounded tread end stays planted while the torso counter-leans above the upper wheel.' };
}

export function showcaseClimbPose(seconds = 0) {
  const t = Math.max(0, Math.min(SHOWCASE_CLIMB_DURATION, seconds));
  let angle = 0, z = START_Z, pitch = 0, lift = 0, stage, detail;
  if (t < 1.5) {
    stage = '1 · Approach the ledge'; detail = 'ROB approaches on level treads.';
    z = mix(START_Z, mountZ + .24, t / 1.5);
  } else if (t < 3) {
    stage = '2 · Lift the front'; detail = 'Flippers push down. The rear stays grounded and the torso leans forward to balance.';
    z = mountZ + .24; angle = mix(0, BASE_FLIPPER_FORWARD_ANGLE, (t - 1.5) / 1.5);
    pitch = flipperGroundPitch(angle);
  } else if (t < 4.6) {
    stage = '3 · Mount the front treads'; detail = 'ROB moves forward with its front treads raised above the lip.';
    z = mix(mountZ + .24, mountZ, (t - 3) / 1.6);
    angle = BASE_FLIPPER_FORWARD_ANGLE; pitch = flipperGroundPitch(angle);
  } else if (t < 8.4) {
    stage = '4 · Reverse and lift the rear'; detail = 'The flippers counter-rotate to provide rear support as ROB mounts the platform.';
    const progress = smooth((t - 4.6) / 3.8);
    angle = BASE_FLIPPER_FORWARD_ANGLE + (BASE_FLIPPER_REAR_ASSIST_ANGLE - BASE_FLIPPER_FORWARD_ANGLE) * progress;
    // First swing the roller above the lip, then advance the chassis. Moving
    // immediately would drag the still-grounded flipper through the step face.
    const travel = smooth((progress - .24) / .76);
    z = mountZ + (levelZ - mountZ) * travel;
    ({ pitch, lift } = baseFlipperPresentation({ angle, target: 'rear', climbProgress: travel, stepHeight: SHOWCASE_PLATFORM.height }));
  } else if (t < 9.7) {
    stage = '5 · Level and stow'; detail = 'Both tread ends are supported. The torso returns upright and the flippers tuck away.';
    z = levelZ; lift = SHOWCASE_PLATFORM.height;
    angle = mix(BASE_FLIPPER_REAR_ASSIST_ANGLE, 0, (t - 8.4) / 1.3);
  } else {
    stage = t < SHOWCASE_CLIMB_DURATION ? '6 · Drive onto the platform' : 'Climb complete · ROB is level';
    detail = 'ROB continues forward with level treads and an upright torso.';
    z = mix(levelZ, -1.08, (t - 9.7) / 1.8); lift = SHOWCASE_PLATFORM.height;
  }
  return { angle, pitch, lift, z, wheelTravel: START_Z - z, stage, detail };
}

export function applyShowcasePose(rig, pose) {
  rig.root.position.set(0, 0, pose.z);
  rig.driveBase.rotation.x = pose.pitch;
  rig.driveBase.position.y = pose.lift;
  rig.baseFlipper.rotation.x = pose.angle;
  const leanAngle = targetTorsoLean(pose.pitch);
  const torso = robTorsoPresentation({ basePitch: pose.pitch, leanAngle, rearHeight: pose.lift });
  rig.torso.rotation.x = torso.pitch;
  rig.torso.position.set(torso.position.x, torso.position.y, torso.position.z);
  rig.treadWheels.forEach(({ wheel }) => { wheel.rotation.x = -pose.wheelTravel / .078; });
  return { leanAngle, torso };
}

export function applyShowcaseLaser(rig, pan, tilt) {
  rig.root.getObjectByName('Right Shoulder Gatling').rotation.y = pan;
  rig.root.getObjectByName('Gatling Tilt Servo').rotation.x = tilt;
}
