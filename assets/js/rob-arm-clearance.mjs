import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { MeshBVH } from 'three-mesh-bvh';
import { RAD, previewBounds, validateGesture, sampleGesture } from './rob-gesture-core.mjs';

export const HEAD_CLEARANCE_METERS=.025;
const SWEEP_COVER_METERS=.004, MAX_SWEEP_SAMPLES=30000;
const ARM_LINK=/^(left|right)_(one_Link|two_Link|three_Link|four_Link|five_Link|six_Link|seven_Link|tool)$/;
const HEAD_LINKS=['insta360_link','oak_link'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function shape(part) {
  const bytes=Uint8Array.from(atob(part.positions),c=>c.charCodeAt(0));
  const raw=new Float32Array(bytes.buffer),unique=new Map();
  for(let i=0;i<raw.length;i+=3)unique.set(raw.slice(i,i+3).join(','),new THREE.Vector3(raw[i],raw[i+1],raw[i+2]));
  const points=[...unique.values()],geometry=new ConvexGeometry(points);
  geometry.computeBoundingBox();geometry.boundsTree=new MeshBVH(geometry);
  const center=points.reduce((p,v)=>p.add(v),new THREE.Vector3()).divideScalar(points.length);
  return {name:part.link,geometry,hull:new ConvexHull().setFromPoints(points),center,
    radius:Math.max(...points.map(p=>p.length()))};
}

// Collision envelopes enclose all vertices of the selected rigid scan segments.
// They do not estimate cable routing, payloads or missing scan surfaces.
export class ArmClearancePreview {
  constructor(document) {
    this.profile=document.profile;
    this.joints=[];const pending=[...this.profile.joints],known=new Set(['base_link']);
    while(pending.length) {
      const i=pending.findIndex(j=>known.has(j.parent));
      if(i<0)throw Error('Disconnected arm profile.');
      const joint=pending.splice(i,1)[0];known.add(joint.child);
      this.joints.push({...joint,rotation:new THREE.Quaternion().setFromEuler(new THREE.Euler(...joint.origin.rpyRadians,'ZYX')),
        axisVector:new THREE.Vector3(...joint.axis).normalize(),translation:new THREE.Vector3(...joint.origin.xyzMeters)});
    }
    this.shapes=document.segments.filter(p=>ARM_LINK.test(p.link)||HEAD_LINKS.includes(p.link)).map(shape);
    this.arms=this.shapes.filter(s=>ARM_LINK.test(s.name));this.head=this.shapes.filter(s=>HEAD_LINKS.includes(s.name));
    if(this.arms.length!==16 || this.head.length!==2)throw Error('Missing arm/head collision envelopes.');
    const parents=new Map(this.joints.map(j=>[j.child,j]));
    for(const s of this.shapes) {
      s.levers=new Map();let link=s.name,lever=s.radius;
      while(parents.has(link)) {const j=parents.get(link);s.levers.set(j.name,lever);lever+=j.translation.length();link=j.parent;}
    }
    this.motionLevers=new Map(this.joints.map(j=>[j.name,Math.max(...this.arms.flatMap(a=>this.head.map(h=>
      // Common-ancestor rotation preserves pair distance exactly.
      a.levers.has(j.name)&&h.levers.has(j.name)?0:Math.max(a.levers.get(j.name)||0,h.levers.get(j.name)||0))))]));
    this.pairCache=new Map();
  }
  frames(offsets={}) {
    const frames=new Map([['base_link',new THREE.Matrix4()]]);
    for(const j of this.joints) {
      const q=j.rotation.clone(),angle=(this.profile.previewPositions[j.name] || 0)+(offsets[j.name] || 0)*RAD;
      if(['revolute','continuous'].includes(j.kind))q.multiply(new THREE.Quaternion().setFromAxisAngle(j.axisVector,angle));
      frames.set(j.child,frames.get(j.parent).clone().multiply(new THREE.Matrix4().compose(j.translation,q,new THREE.Vector3(1,1,1))));
    }
    return frames;
  }
  assertTargets(offsets) {
    for(const [name,delta] of Object.entries(offsets)) {
      const j=this.joints.find(j=>j.name===name);
      if(!j || !Number.isFinite(delta))throw Error('Invalid pose joint: '+name);
      const b=previewBounds(j,this.profile.previewPositions[name] || 0);
      // The unchanged captured observation is displayable, not a new target.
      if(delta!==0 && (delta<b.min-1e-8 || delta>b.max+1e-8))throw Error(name+': centered preview limit exceeded.');
    }
  }
  clearance(offsets={},padding=0) {
    const frames=this.frames(offsets),distance=HEAD_CLEARANCE_METERS+padding;
    const placed=new Map(this.shapes.map(s=>[s.name,{matrix:frames.get(s.name),box:s.geometry.boundingBox.clone().applyMatrix4(frames.get(s.name))}]));
    for(const arm of this.arms)for(const head of this.head) {
      const a=placed.get(arm.name),h=placed.get(head.name);
      if(!a.box.clone().expandByScalar(distance).intersectsBox(h.box))continue;
      const transform=h.matrix.clone().invert().multiply(a.matrix);
      const key=arm.name+'/'+head.name,prior=this.pairCache.get(key),queryDistance=Math.max(distance,HEAD_CLEARANCE_METERS+SWEEP_COVER_METERS)+1e-8;
      if(prior && prior.queryDistance>=queryDistance && transform.elements.every((v,i)=>Math.abs(v-prior.transform[i])<1e-12)) {
        if(prior.distance<distance-1e-9)return {clear:false,arm:arm.name,obstacle:head.name,distance:prior.distance,required:distance};
        continue;
      }
      // Closed convex hulls also reject full containment without surface contact.
      const contained=head.hull.containsPoint(arm.center.clone().applyMatrix4(transform)) ||
        arm.hull.containsPoint(head.center.clone().applyMatrix4(transform.clone().invert()));
      const nearest=contained?{distance:0}:head.geometry.boundsTree.closestPointToGeometry(arm.geometry,transform,{},null,0,queryDistance);
      this.pairCache.set(key,{queryDistance,distance:nearest?.distance??Infinity,transform:[...transform.elements]});
      if(nearest && nearest.distance<distance-1e-9)return {clear:false,arm:arm.name,obstacle:head.name,distance:nearest.distance,required:distance};
    }
    return {clear:true,required:distance};
  }
  assertClear(offsets,padding=0) {
    const result=this.clearance(offsets,padding);
    if(!result.clear)throw Error('Head clearance: '+result.arm+' approaches '+result.obstacle+' ('+(result.distance*1000).toFixed(1)+' mm; '+(result.required*1000).toFixed(1)+' mm required).');
    return result;
  }
  validateTransition(from,to) {
    this.assertTargets(from);this.assertTargets(to);
    const names=[...new Set([...Object.keys(from),...Object.keys(to)])];
    for(const name of names) {
      const b=previewBounds(this.joints.find(j=>j.name===name),this.profile.previewPositions[name] || 0);
      if(b.arm && !b.referenceInRange && (from[name]??0)!==(to[name]??0))throw Error(name+': reconcile the out-of-range hanging reference before moving it.');
    }
    this.assertClear(from);this.assertClear(to);
    const travel=.5*names.reduce((n,k)=>n+(this.motionLevers.get(k)||0)*Math.abs((to[k]??0)-(from[k]??0)),0)*RAD;
    const count=Math.max(1,Math.ceil(travel/SWEEP_COVER_METERS));
    if(count>MAX_SWEEP_SAMPLES)throw Error('Pose transition too complex to verify.');
    for(let i=0;i<count;i++) {
      const u=(i+.5)/count,pose=Object.fromEntries(names.map(k=>[k,(from[k]??0)+((to[k]??0)-(from[k]??0))*u]));
      this.assertClear(pose,travel/count);
    }
    return {samples:count,clearanceMeters:HEAD_CLEARANCE_METERS};
  }
  validateMotion(clip) {
    validateGesture(clip,this.profile);
    const times=[...new Set([0,clip.duration,...Object.values(clip.tracks).flatMap(keys=>keys.map(k=>k[0]))])].sort((a,b)=>a-b);
    let samples=0;
    for(const t of times)this.assertClear(sampleGesture(clip,t));
    for(let i=1;i<times.length;i++) {
      const a=times[i-1],b=times[i];let rate=0;
      for(const [name,keys] of Object.entries(clip.tracks)) {
        const end=keys.findIndex((k,n)=>n>0 && k[0]>=b);if(end<1)continue;
        const [t0,q0]=keys[end-1],[t1,q1]=keys[end],u=clamp(.5,(a-t0)/(t1-t0),(b-t0)/(t1-t0));
        rate+=.5*(this.motionLevers.get(name)||0)*Math.abs(q1-q0)/(t1-t0)*30*u*u*(1-u)*(1-u)*RAD;
      }
      // Midpoint sampling plus a lever/speed bound covers the interval between
      // samples, including different keyframe timing on each moving joint.
      const count=Math.max(1,Math.ceil(rate*(b-a)/SWEEP_COVER_METERS));
      samples+=count;if(samples>MAX_SWEEP_SAMPLES)throw Error('Gesture too complex to verify; reduce its keyframes or travel.');
      for(let n=0;n<count;n++) {
        const t=a+(b-a)*(n+.5)/count;
        try {this.assertClear(sampleGesture(clip,t),rate*(b-a)/count);}
        catch(error) {throw Error(error.message+' At '+t.toFixed(2)+' s.');}
      }
    }
    return {samples,clearanceMeters:HEAD_CLEARANCE_METERS,protectedLinks:[...HEAD_LINKS]};
  }
  solveIK({side='left',target,seed={}}) {
    if(!['left','right'].includes(side) || !Array.isArray(target) || target.length!==3 || !target.every(Number.isFinite))throw Error('Use a finite ROB-base XYZ target in metres.');
    const names=Array.from({length:7},(_,i)=>side+'_joint'+(i+1)),joints=names.map(n=>this.joints.find(j=>j.name===n));
    for(const j of joints)if(!previewBounds(j,this.profile.previewPositions[j.name] || 0).referenceInRange)throw Error(j.name+': reconcile the hanging reference before IK.');
    this.assertTargets(seed);this.assertClear(seed);
    let pose={...seed};const goal=new THREE.Vector3(...target);
    for(let iteration=0;iteration<300;iteration++) {
      const frames=this.frames(pose),tip=new THREE.Vector3().setFromMatrixPosition(frames.get(side+'_tool')),error=goal.clone().sub(tip);
      if(error.length()<.002)return {offsets:pose,errorMeters:error.length(),iterations:iteration};
      const columns=joints.map(j=>{
        const m=frames.get(j.child),origin=new THREE.Vector3().setFromMatrixPosition(m);
        return j.axisVector.clone().transformDirection(m).cross(tip.clone().sub(origin));
      });
      const a=new THREE.Matrix3().set(.0025,0,0,0,.0025,0,0,0,.0025);
      for(const c of columns)for(let row=0;row<3;row++)for(let col=0;col<3;col++)a.elements[col*3+row]+=c.getComponent(row)*c.getComponent(col);
      const step=error.clone().applyMatrix3(a.invert()),delta=columns.map(c=>clamp(c.dot(step)/RAD,-6,6));
      let accepted=false;
      for(let scale=1;scale>=1/128;scale/=2) {
        const next={...pose};
        joints.forEach((j,i)=>{const b=previewBounds(j,this.profile.previewPositions[j.name] || 0);next[j.name]=clamp((pose[j.name]??0)+delta[i]*scale,b.min,b.max);});
        const p=new THREE.Vector3().setFromMatrixPosition(this.frames(next).get(side+'_tool'));
        if(p.distanceTo(goal)<error.length()-1e-8 && this.clearance(next).clear) {pose=next;accepted=true;break;}
      }
      if(!accepted)break;
    }
    throw Error('No IK solution with the current centered limits and head clearance. Choose an outside waypoint or a different target.');
  }
}
