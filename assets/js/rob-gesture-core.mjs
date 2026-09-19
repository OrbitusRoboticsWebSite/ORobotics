// Pure simulation data. No hardware transport, executable script or motor mapping.
export const RAD = Math.PI / 180;
export const smooth = t => { const u = Math.max(0, Math.min(1, t)); return u*u*u*(10+u*(-15+6*u)); };
export function previewBounds(joint, reference = 0) {
  const arm = /^(left|right)_joint[1-7]$/.test(joint.name);
  const cap = arm ? 8 : joint.kind === 'continuous' ? 180 : 360;
  return { min: Math.max(-cap, joint.kind === 'continuous' ? -180 : (joint.lower-reference)/RAD),
    max: Math.min(cap, joint.kind === 'continuous' ? 180 : (joint.upper-reference)/RAD),
    speed: arm ? 15 : 45, acceleration: arm ? 45 : 140, arm };
}
export function validateGesture(clip, profile) {
  if (!clip || clip.schemaVersion !== 1 || clip.simulationOnly !== true || clip.kind !== 'gesture') throw Error('Use a version 1 simulation gesture.');
  if (typeof clip.name !== 'string' || !clip.name.trim() || clip.name.length > 100) throw Error('Give the gesture a short name.');
  if (!Number.isFinite(clip.duration) || clip.duration < .5 || clip.duration > 120) throw Error('Duration must be 0.5–120 seconds.');
  if (!clip.tracks || typeof clip.tracks !== 'object' || Array.isArray(clip.tracks) || Object.keys(clip.tracks).length > 40) throw Error('Invalid joint tracks.');
  const joints = new Map(profile.joints.map(j => [j.name,j]));
  for (const [name, keys] of Object.entries(clip.tracks)) {
    const joint = joints.get(name);
    if (!joint || !['revolute','continuous'].includes(joint.kind)) throw Error('Unknown movable joint: '+name);
    if (!Array.isArray(keys) || keys.length < 2 || keys.length > 256) throw Error(name+': use 2–256 keyframes.');
    const bounds = previewBounds(joint,profile.previewPositions[name] || 0);
    for (let i=0;i<keys.length;i++) {
      const key=keys[i];
      if (!Array.isArray(key) || key.length !== 2 || !key.every(Number.isFinite) || key[0]<0 || key[0]>clip.duration || (i && key[0]<=keys[i-1][0])) throw Error(name+': times must increase inside the duration.');
      if (key[1] < bounds.min-1e-8 || key[1]>bounds.max+1e-8) throw Error(name+': offset exceeds the preview range. Cable travel is unmeasured.');
      if (i) {
        const dt=key[0]-keys[i-1][0], delta=Math.abs(key[1]-keys[i-1][1]);
        if (1.875*delta/dt>bounds.speed+1e-8 || 5.774*delta/(dt*dt)>bounds.acceleration+1e-8) throw Error(name+': allow more time for this movement.');
      }
    }
    if (keys[0][0] !== 0 || keys[0][1] !== 0 || keys.at(-1)[0] !== clip.duration || keys.at(-1)[1] !== 0) throw Error(name+': start and end at the reference pose (0° offset).');
  }
  return clip;
}
export function sampleTrack(keys, time) {
  if (time<=keys[0][0]) return keys[0][1];
  for(let i=1;i<keys.length;i++) if(time<=keys[i][0]) {
    const [a,x]=keys[i-1], [b,y]=keys[i]; return x+(y-x)*smooth((time-a)/(b-a));
  }
  return keys.at(-1)[1];
}
export function sampleGesture(clip,time) {
  return Object.fromEntries(Object.entries(clip.tracks).map(([name,keys])=>[name,sampleTrack(keys,time)]));
}
const clip=(name,duration,tracks)=>({schemaVersion:1,simulationOnly:true,kind:'gesture',name,duration,tracks});
export const GESTURES = [
  clip('Curious glance',7,{neck_pan:[[0,0],[1.6,10],[3.2,10],[5.2,-7],[7,0]],lower_neck:[[0,0],[1.8,4],[4.8,4],[7,0]],torso_yaw:[[0,0],[2.5,3],[4.5,-2],[7,0]]}),
  clip('A thoughtful nod',6,{upper_neck:[[0,0],[1.3,5],[2.6,-3],[4,4],[6,0]],lower_neck:[[0,0],[2,2],[4,-1],[6,0]]}),
  clip('A small hello',8,{left_joint2:[[0,0],[2,6],[5.5,6],[8,0]],left_joint4:[[0,0],[2.7,-4],[5.5,-4],[8,0]],left_joint7:[[0,0],[2.8,0],[4,4],[5.2,-4],[6.5,3],[8,0]],neck_pan:[[0,0],[2,6],[5,6],[8,0]]}),
  clip('Listening',10,{lower_neck:[[0,0],[2,3],[7,3],[10,0]],upper_neck:[[0,0],[2.5,-2],[7,-2],[10,0]],neck_pan:[[0,0],[3,-5],[7,-5],[10,0]]}),
  clip('Ready to help',8,{left_joint2:[[0,0],[2.5,5],[5.5,5],[8,0]],right_joint2:[[0,0],[2.8,-5],[5.5,-5],[8,0]],left_joint4:[[0,0],[3.5,-3],[5.5,-3],[8,0]],right_joint4:[[0,0],[3.5,3],[5.5,3],[8,0]],body_lean:[[0,0],[3,2],[5,2],[8,0]],upper_neck:[[0,0],[2,3],[5,3],[8,0]]})
];
