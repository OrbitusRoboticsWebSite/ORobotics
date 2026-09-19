import * as THREE from 'three';
import { RAD } from './rob-gesture-core.mjs';

export const CURB_TERRAIN = Object.freeze({start: .34, end: 1.84, height: .12});
const CONTACT_EPS = .001;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Planar, quasi-static contact preview. No mass, traction or brake-force claim.
// Circle/terrain separation is measured at the reviewed wheel radii. The
// tread envelope samples the rubber belt between its three wheel centers.
function frames(profile,positions) {
  const result=new Map([['base_link',new THREE.Matrix4()]]), pending=[...profile.joints];
  while(pending.length) {
    const index=pending.findIndex(j=>result.has(j.parent));
    if(index<0)throw Error('Disconnected contact profile.');
    const j=pending.splice(index,1)[0],o=j.origin;
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rpyRadians,'ZYX'));
    if(['continuous','revolute'].includes(j.kind))q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...j.axis).normalize(),positions[j.name] || 0));
    result.set(j.child,result.get(j.parent).clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...o.xyzMeters),q,new THREE.Vector3(1,1,1))));
  }
  return result;
}

export function circleTerrainContact(circle,terrain) {
  let result={gap:circle.z-circle.radius,nx:0,nz:1,surface:'ground',x:circle.x,z:0};
  if(!terrain || terrain.height<=0)return result;
  const x=clamp(circle.x,terrain.start,terrain.end),z=clamp(circle.z,0,terrain.height);
  const dx=circle.x-x,dz=circle.z-z,d=Math.hypot(dx,dz);
  let face;
  if(d>1e-12)face={gap:d-circle.radius,nx:dx/d,nz:dz/d,surface:'platform',x,z};
  else {
    const choices=[{distance:circle.x-terrain.start,nx:-1,nz:0,x:terrain.start,z:circle.z},
      {distance:terrain.end-circle.x,nx:1,nz:0,x:terrain.end,z:circle.z},
      {distance:terrain.height-circle.z,nx:0,nz:1,x:circle.x,z:terrain.height}];
    const nearest=choices.sort((a,b)=>a.distance-b.distance)[0];
    face={...nearest,gap:-nearest.distance-circle.radius,surface:'platform'};
  }
  return face.gap<result.gap?face:result;
}

export class GroundContactPreview {
  constructor(profile,terrain=null,baseX=0) {
    this.profile=profile;this.terrain=terrain;
    this.links=new Map(profile.links.map(l=>[l.name,l]));
    this.reference=frames(profile,profile.previewPositions);
    const point=name=>new THREE.Vector3().setFromMatrixPosition(this.reference.get(name));
    this.rear=point('left_sprocket_link');
    this.startAxleX=baseX+this.rear.x;this.axleX=this.startAxleX;
    this.staticCircles=['left_sprocket_link','left_track_front_idler_link','left_track_upper_idler_link'].map((name,i)=>{
      const p=point(name);return {id:['rear_tread','front_tread','upper_tread'][i],x:p.x-this.rear.x,z:p.z-this.rear.z,radius:this.links.get(name).boxMeters[0]/2};
    });
    const wheels=[...this.staticCircles];
    for(let i=0;i<3;i++) {
      const a=wheels[i],b=wheels[(i+1)%3],count=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.01);
      for(let n=1;n<count;n++)this.staticCircles.push({id:'belt',x:a.x+(b.x-a.x)*n/count,z:a.z+(b.z-a.z)*n/count,radius:a.radius});
    }
    this.supportCenterX=(wheels[0].x+wheels[1].x)/2;
    this.state=this.solve({},this.axleX);
  }
  circles(offsets) {
    const positions={...this.profile.previewPositions};
    for(const name of ['left_flipper','right_flipper'])positions[name]+=(offsets[name] || 0)*RAD;
    const f=frames(this.profile,positions),result=[...this.staticCircles];
    for(const side of ['left','right']) {
      const name=side+'_flipper_roller_link',p=new THREE.Vector3().setFromMatrixPosition(f.get(name));
      result.push({id:side+'_flipper',x:p.x-this.rear.x,z:p.z-this.rear.z,radius:this.links.get(name).boxMeters[0]/2});
    }
    return result;
  }
  requiredHeight(x,radius) {
    const t=this.terrain;
    if(!t)return radius;
    const dx=Math.max(t.start-x,x-t.end,0);
    return dx<radius?Math.max(radius,t.height+Math.sqrt(radius*radius-dx*dx)):radius;
  }
  evaluate(circles,axleX,angle) {
    const c=Math.cos(angle),s=Math.sin(angle);
    let height=-Infinity;
    for(const p of circles)height=Math.max(height,this.requiredHeight(axleX+p.x*c-p.z*s,p.radius)-p.x*s-p.z*c);
    return {height,cost:height+this.supportCenterX*s,angle};
  }
  solve(offsets,axleX=this.axleX) {
    const circles=this.circles(offsets);
    let best=this.evaluate(circles,axleX,0);
    // Lowest support-center height under gravity, constrained by nonpenetration.
    // Search both pitch directions; a floating roller adds no active constraint.
    for(let degrees=-55;degrees<=55;degrees++) {
      const candidate=this.evaluate(circles,axleX,degrees*RAD);
      if(candidate.cost<best.cost)best=candidate;
    }
    let low=best.angle-RAD,high=best.angle+RAD;
    for(let i=0;i<28;i++) {
      const a=low+(high-low)/3,b=high-(high-low)/3;
      if(this.evaluate(circles,axleX,a).cost<this.evaluate(circles,axleX,b).cost)high=b;else low=a;
    }
    const refined=this.evaluate(circles,axleX,(low+high)/2);
    if(refined.cost<best.cost)best=refined;
    const c=Math.cos(best.angle),s=Math.sin(best.angle);
    const worldCircles=circles.map(p=>({...p,x:axleX+p.x*c-p.z*s,z:best.height+p.x*s+p.z*c}));
    const contacts=worldCircles.map(p=>({...circleTerrainContact(p,this.terrain),id:p.id,centerX:p.x,centerZ:p.z,radius:p.radius}));
    const touching=contacts.filter(p=>p.gap<=CONTACT_EPS && p.nz>.2);
    const flipper=touching.filter(p=>p.id.endsWith('_flipper'));
    const rearWheel=contacts.find(p=>p.id==='rear_tread'),frontWheel=contacts.find(p=>p.id==='front_tread');
    const t=this.terrain;
    const frontContact=touching.some(p=>!p.id.endsWith('_flipper') && p.surface==='platform');
    const rearFlippers=flipper.filter(p=>p.centerX<axleX-.05).length===2;
    const frontFlippers=flipper.filter(p=>p.centerX>axleX+.05).length===2;
    const onPlatform=!!t && frontContact && rearWheel.centerX-rearWheel.radius>t.start+.005 &&
      rearWheel.centerZ-rearWheel.radius>=t.height-CONTACT_EPS && rearWheel.centerZ-rearWheel.radius<t.height+.025;
    return {offsets:{...offsets},axleX,axleHeight:best.height,angle:best.angle,
      world:{forward:axleX-this.startAxleX,x:axleX-this.rear.x*c+this.rear.z*s,height:best.height-this.rear.x*s-this.rear.z*c,pitch:-best.angle/RAD},
      contacts,worldCircles,signals:{
        edge_aligned:!t || (frontWheel.centerX+frontWheel.radius<t.start && t.start-frontWheel.centerX-frontWheel.radius<.22),
        front_flipper_contact:frontFlippers,
        front_lifted:frontFlippers && (!t || frontWheel.centerZ-frontWheel.radius>t.height+.003),
        front_ready:!!t && frontWheel.centerX>t.start+.015 && frontWheel.centerZ-frontWheel.radius>t.height+.001,
        front_contact:frontContact,rear_flipper_contact:rearFlippers,
        rear_support:rearFlippers || (rearWheel.gap<=CONTACT_EPS && rearWheel.nz>.2),
        on_platform:onPlatform,level_verified:onPlatform && Math.abs(best.angle)<.5*RAD && rearWheel.gap<=CONTACT_EPS && frontWheel.gap<=CONTACT_EPS
      }};
  }
  advance(offsets,distance=0) {
    if(!Number.isFinite(distance) || distance<0 || distance>.02)throw Error('Contact drive step exceeds 20 mm.');
    this.state=this.solve(offsets,this.axleX);
    let travel=distance;
    // Sweep horizontally at the settled pose first. A vertical curb face blocks
    // travel; it cannot teleport the body up onto the deck.
    const clear=dx=>this.state.worldCircles.every(p=>{
      const hit=circleTerrainContact({...p,x:p.x+dx},this.terrain);
      return hit.gap>=(hit.surface==='platform' && hit.nx<-.01?0:-1e-8);
    });
    if(distance && !clear(distance)) {
      let low=0,high=distance;
      for(let n=0;n<24;n++){const mid=(low+high)/2;if(clear(mid))low=mid;else high=mid;}
      travel=low;
    }
    this.axleX+=travel;this.state=this.solve(offsets,this.axleX);
    this.state.driveBlocked=travel<distance-1e-5;this.state.travel=travel;
    return this.state;
  }
}
