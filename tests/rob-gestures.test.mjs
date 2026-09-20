import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildCalibratedRig} from '../assets/js/rob-calibrated-rig.mjs';
import {GESTURES,validateGesture,sampleGesture,previewBounds,gestureAvailability,armReferenceConflicts,ARM_CENTERED_LIMIT} from '../assets/js/rob-gesture-core.mjs';
import {ArmClearancePreview,HEAD_CLEARANCE_METERS} from '../assets/js/rob-arm-clearance.mjs';
import {HELLO_PLANNING} from '../assets/js/rob-hello-plan.mjs';
import {CURB_SEQUENCE,SequencePreview,SIGNALS,validateSequence} from '../assets/js/rob-curb-sequence.mjs';
import {GroundContactPreview,CURB_TERRAIN} from '../assets/js/rob-ground-contact.mjs';

const directory=new URL('../static/models/rob/gesture-studio/',import.meta.url);
const data=JSON.parse(fs.readFileSync(new URL('rob-scan-rig.json',directory))),profile=data.profile;
const playable=GESTURES.filter(g=>gestureAvailability(g,profile).playable);
const good=()=>Object.fromEntries(Object.keys(SIGNALS).map(k=>[k,true]));
test('all gesture samples stay inside unwrapped arm bounds and return to reference',()=>{
  for(const g of playable) {
    validateGesture(g,profile);
    for(let i=0;i<=1000;i++)for(const [name,angle] of Object.entries(sampleGesture(g,g.duration*i/1000))) {
      const joint=profile.joints.find(j=>j.name===name),b=previewBounds(joint,profile.previewPositions[name] || 0);
      assert.ok(angle>=b.min-1e-8 && angle<=b.max+1e-8);
    }
    assert.ok(Object.values(sampleGesture(g,0)).every(x=>x===0));
    assert.ok(Object.values(sampleGesture(g,g.duration)).every(x=>x===0));
  }
  const bad=structuredClone(GESTURES[0]);bad.tracks={left_joint1:[[0,0],[3,360],[7,0]]};
  assert.throws(()=>validateGesture(bad,profile),/preview range/);
  bad.tracks.left_joint1[1][1]=8;bad.tracks.left_joint1[1][0]=.01;
  assert.throws(()=>validateGesture(bad,profile),/more time/);
  bad.simulationOnly=false;assert.throws(()=>validateGesture(bad,profile),/simulation gesture/);
});
test('segmented mesh and calibrated hierarchy preserve source and Drake reference frames',()=>{
  const rig=buildCalibratedRig(data);
  assert.equal(data.segments.length,43);
  assert.equal(data.segments.reduce((n,s)=>n+s.triangleCount,0),222984);
  assert.ok(data.provenance.referenceReconstructionMaximumErrorMeters<1e-6);
  for(const part of data.segments) {
    // Validate using DataView rather than assuming pooled Buffer alignment.
    const bytes=Buffer.from(part.indices,'base64');
    assert.equal(bytes.length,part.triangleCount*12);
    for(let i=0;i<bytes.length;i+=4)assert.ok(bytes.readUInt32LE(i)<part.vertexCount);
    assert.equal(Buffer.from(part.positions,'base64').length,part.vertexCount*12);
    assert.equal(Buffer.from(part.colors,'base64').length,part.vertexCount*16);
  }
  const reference=JSON.parse(fs.readFileSync(new URL('drake-reference.json',directory)));
  assert.equal(reference.profileSHA256,data.provenance.profileSHA256);
  for(const [name,rows] of Object.entries(reference.frames)) {
    const actual=rig.links.get(name).matrixWorld;
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)assert.ok(Math.abs(actual.elements[c*4+r]-rows[r][c])<1e-9,name);
  }
  const right=rig.links.get('right_tool').matrixWorld.clone(),left=rig.links.get('left_tool').matrixWorld.clone();
  const before=rig.links.get('left_two_Link').getWorldPosition(new THREE.Vector3());
  rig.pose({left_joint2:5});
  assert.deepEqual(rig.links.get('right_tool').matrixWorld.elements,right.elements);
  assert.notDeepEqual(rig.links.get('left_tool').matrixWorld.elements,left.elements);
  assert.ok(rig.links.get('left_two_Link').getWorldPosition(new THREE.Vector3()).distanceTo(before)<1e-10);
  rig.pose();assert.deepEqual(rig.links.get('left_tool').matrixWorld.elements,left.elements);
  const flipper=rig.joints.get('left_flipper').node.quaternion.clone();
  const wheel=rig.joints.get('left_track_drive').node.quaternion.clone();
  const treadPatches=[];
  rig.root.traverse(n=>{if(n.isMesh && /_(sprocket_link|track_(front|upper)_idler_link)$/.test(n.name))treadPatches.push({node:n,matrix:n.matrixWorld.clone()});});
  assert.equal(treadPatches.length,6);
  rig.pose(Object.fromEntries([...rig.joints.keys()].filter(n=>/track_(drive|front_idler|upper_idler)$/.test(n)).map(n=>[n,90])));
  assert.notDeepEqual(rig.joints.get('left_track_drive').node.quaternion.toArray(),wheel.toArray());
  for(const p of treadPatches)assert.deepEqual(p.node.matrixWorld.elements,p.matrix.elements,'rubber belt scan patch must not orbit a wheel');
  assert.deepEqual(rig.joints.get('left_flipper').node.quaternion.toArray(),flipper.toArray());
  assert.deepEqual(rig.links.get('left_tool').matrixWorld.elements,left.elements);
  rig.pose();assert.deepEqual(rig.joints.get('left_track_drive').node.quaternion.toArray(),wheel.toArray());
  assert.throws(()=>rig.pose({left_joint1:360}),/limit/);
  assert.throws(()=>rig.pose({left_joint1:NaN}),/Nonfinite/);
});
test('arm limits are centered on upright zero, with hanging offsets consuming travel',()=>{
  const arms=profile.joints.filter(j=>/^(left|right)_joint[1-7]$/.test(j.name));
  assert.equal(arms.length,14);
  const rig=buildCalibratedRig(data);
  for(const joint of arms) {
    const bounds=previewBounds(joint,profile.previewPositions[joint.name] || 0);
    const reference=(profile.previewPositions[joint.name] || 0)*180/Math.PI;
    assert.ok(Math.abs(bounds.min+reference+120)<1e-8);assert.ok(Math.abs(bounds.max+reference-120)<1e-8);
    const wide={schemaVersion:1,simulationOnly:true,kind:'gesture',name:'Full preview sweep',duration:96,
      tracks:{[joint.name]:[[0,0],[32,bounds.max],[64,bounds.min],[96,0]]}};
    if(!bounds.referenceInRange){assert.equal(joint.name,'right_joint2');assert.throws(()=>validateGesture(wide,profile),/hanging reference/);continue;}
    assert.doesNotThrow(()=>validateGesture(wide,profile));
    for(const time of [0,16,32,48,64,80,96])assert.doesNotThrow(()=>rig.pose(sampleGesture(wide,time)));
    for(const outside of [bounds.min-.1,bounds.max+.1,360]) {
      const bad=structuredClone(wide);bad.tracks[joint.name][1][1]=outside;
      assert.throws(()=>validateGesture(bad,profile),/preview range/);
      assert.throws(()=>rig.pose({[joint.name]:outside}),/limit/);
    }
    const fast=structuredClone(wide);fast.tracks[joint.name][1][0]=1;
    assert.throws(()=>validateGesture(fast,profile),/more time/);
  }
  const conflicts=armReferenceConflicts(profile);assert.equal(conflicts.length,1);assert.equal(conflicts[0].name,'right_joint2');
  assert.ok(conflicts[0].excessDegrees>.4 && conflicts[0].excessDegrees<.5);
  assert.deepEqual(GESTURES.filter(g=>!gestureAvailability(g,profile).playable).map(g=>g.name),['Ready to help']);
  // A +120° offset from hanging J4 would exceed its centered +120° bound.
  assert.throws(()=>rig.pose({left_joint4:120}),/limit/);
  assert.doesNotThrow(()=>rig.pose({left_joint2:119.48052311116868}));
});
test('upright arm zero follows the mounting plate cross-product normal on both canted mounts',()=>{
  const rig=buildCalibratedRig(data),upright=Object.fromEntries(profile.joints.filter(j=>/^(left|right)_joint/.test(j.name)).map(j=>[j.name,-(profile.previewPositions[j.name]||0)*180/Math.PI]));
  rig.pose(upright);
  for(const side of ['left','right']) {
    const m=rig.links.get(side+'_base_link').matrixWorld,x=new THREE.Vector3().setFromMatrixColumn(m,0),y=new THREE.Vector3().setFromMatrixColumn(m,1);
    const normal=x.cross(y).normalize(),arm=rig.links.get(side+'_three_Link').getWorldPosition(new THREE.Vector3()).sub(rig.links.get(side+'_two_Link').getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(normal.dot(arm)>1-1e-10);assert.ok(Math.abs(normal.y)>.3,'mount cant must remain visible');
  }
});
test('curb sequence finishes only with confirmations and never authorizes hardware',()=>{
  const r=new SequencePreview(CURB_SEQUENCE,profile),startHeight=r.sample().world.height;r.start();
  let prior=r.sample();
  for(let i=0;i<10000 && !['complete','aborted'].includes(r.phase);i++){
    const previousStep=r.index;r.tick(1/60,good());const s=r.sample();
    for(const c of s.contacts)assert.ok(c.gap>=-1e-7,'terrain penetration: '+c.id);
    assert.ok(Math.abs(s.world.height-prior.world.height)<.004,'contact must not teleport the chassis');
    if(previousStep===r.index && s.brake==='hold')assert.equal(s.world.forward,prior.world.forward);
    prior=s;
  }
  assert.equal(r.phase,'complete');assert.equal(r.sample().hardwareAuthorized,false);
  assert.equal(r.events.filter(e=>e.event==='confirm_after').length,CURB_SEQUENCE.steps.length);
  assert.ok(Math.abs(r.sample().world.height-startHeight-.12)<1e-8);
  assert.ok(Math.abs(r.sample().world.pitch)<1e-6);
  const transfer=r.events.find(e=>e.step==='transfer' && e.event==='confirm_after');
  assert.equal(transfer.contacts.filter(c=>c.id.endsWith('_flipper') && c.surface==='ground').length,2);
  const rearPose=CURB_SEQUENCE.steps.find(s=>s.id==='transfer').pose.left_flipper;
  assert.ok(profile.previewPositions.left_flipper+rearPose*Math.PI/180<-Math.PI,'flippers must swing fully behind ROB');
  const missing=new SequencePreview(CURB_SEQUENCE,profile);missing.start();
  for(let i=0;i<1000;i++)missing.tick(.05,{pose_visible:true,operator_present:true});
  assert.equal(missing.phase,'aborted');assert.equal(missing.fault,'CONFIRMATION_TIMEOUT');assert.equal(missing.index,0);
});
test('loss of vision, operator, brake hold or rollback latches an abort without replay',()=>{
  for(const [fault,expected] of [[{pose_visible:false},'POSE_UNCONFIRMED'],[{operator_present:false},'OPERATOR_ABSENT'],[{brake_failed:true},'BRAKE_HOLD_FAILED'],[{rollback:true},'ROLLBACK_DETECTED']]) {
    const r=new SequencePreview(CURB_SEQUENCE,profile);r.start();r.tick(.1,good());r.tick(.1,{...good(),...fault});
    assert.equal(r.fault,expected);const frozen=r.sample();
    for(let i=0;i<50;i++)r.tick(.1,good());
    assert.deepEqual(r.sample(),frozen);
  }
  const r=new SequencePreview(CURB_SEQUENCE,profile);r.start();
  while(r.index<1)r.tick(.1,good());
  r.tick(.1,{...good(),hold_verified:false});assert.equal(r.phase,'before');assert.equal(r.elapsed,0);
  r.tick(.1,good());assert.equal(r.phase,'moving');
  r.tick(.1,{...good(),hold_verified:false});assert.equal(r.fault,'BRAKE_HOLD_UNCONFIRMED');
  const bad=structuredClone(CURB_SEQUENCE);bad.steps[0].brake='hold';
  assert.throws(()=>validateSequence(bad,profile),/held brake/);
  const support=new SequencePreview(CURB_SEQUENCE,profile);support.start();
  while(support.index<2 || support.phase!=='after')support.tick(.1,good());
  support.tick(.1,{...good(),front_flipper_contact:false});assert.equal(support.fault,'SUPPORT_UNCONFIRMED');
  const authoredHeight=structuredClone(CURB_SEQUENCE);authoredHeight.steps.at(-1).world={height:.1};
  assert.throws(()=>validateSequence(authoredHeight,profile),/terrain contact/);
});
test('airborne rollers cannot lift ROB, and a curb wall blocks unsupported drive',()=>{
  const g=new GroundContactPreview(profile),rest=g.state;
  for(const q of [0,40,80,110,119]) {
    const s=g.solve({left_flipper:q,right_flipper:q});
    assert.equal(s.world.height,rest.world.height);assert.equal(Math.abs(s.world.pitch),0);
    assert.equal(s.signals.front_flipper_contact,false);
  }
  for(const [q,front] of [[139,true],[-97,false]]) {
    const s=g.solve({left_flipper:q,right_flipper:q});
    assert.ok(s.world.height>rest.world.height);
    assert.equal(s.signals[front?'front_flipper_contact':'rear_flipper_contact'],true);
    for(const c of s.contacts.filter(c=>c.id.endsWith('_flipper')))assert.ok(Math.abs(c.gap)<1e-6);
  }
  const wall=new GroundContactPreview(profile,CURB_TERRAIN,-.35);let blocked=false;
  for(let i=0;i<200;i++){const s=wall.advance({},.005);assert.ok(Math.abs(s.world.height-rest.world.height)<1e-6);if(s.driveBlocked){blocked=true;break;}}
  assert.ok(blocked,'treads must stop at the curb face without flipper support');
});
test('automatic confirmations cannot bypass missing rear-wheel contact',()=>{
  const script=structuredClone(CURB_SEQUENCE);
  script.steps.find(s=>s.id==='transfer').pose={left_flipper:0,right_flipper:0,body_lean:0};
  const r=new SequencePreview(script,profile);r.start();
  for(let i=0;i<3000 && r.phase!=='aborted';i++)r.tick(.05,good());
  assert.equal(r.step.id,'transfer');assert.equal(r.fault,'CONFIRMATION_TIMEOUT');
  assert.equal(r.sample().contactSignals.rear_flipper_contact,false);
});
test('contact roller centers agree with the displayed approved joint hierarchy',()=>{
  const rig=buildCalibratedRig(data),g=new GroundContactPreview(profile,CURB_TERRAIN,-.35);
  for(const q of [0,119,139,-97]) {
    const offsets={left_flipper:q,right_flipper:q},s=g.solve(offsets);
    rig.pose(offsets);rig.root.position.set(s.world.x,0,s.world.height);rig.root.rotation.y=s.world.pitch*Math.PI/180;rig.root.updateMatrixWorld(true);
    for(const side of ['left','right']) {
      const point=rig.links.get(side+'_flipper_roller_link').getWorldPosition(new THREE.Vector3());
      const contact=s.contacts.find(c=>c.id===side+'_flipper');
      assert.ok(Math.abs(point.x-contact.centerX)<1e-9 && Math.abs(point.z-contact.centerZ)<1e-9);
    }
  }
});
test('hello raises the hand above the scanned head and waves side to side',()=>{
  const rig=buildCalibratedRig(data),hello=GESTURES.find(g=>g.name==='A small hello');
  const start=rig.links.get('left_tool').getWorldPosition(new THREE.Vector3()),ys=[];
  const right=rig.links.get('right_tool').matrixWorld.clone();
  for(let t=12;t<=22;t+=.1) {
    rig.pose(sampleGesture(hello,t));
    const hand=rig.links.get('left_tool').getWorldPosition(new THREE.Vector3());
    const head=new THREE.Box3().setFromObject(rig.links.get('insta360_link'));
    assert.ok(hand.z>head.max.z+.05,'hand must remain above the head during the wave');
    ys.push(hand.y);assert.deepEqual(rig.links.get('right_tool').matrixWorld.elements,right.elements);
  }
  assert.ok(Math.max(...ys)-Math.min(...ys)>.06,'wave must have visible sideways travel');
  rig.pose(sampleGesture(hello,hello.duration));
  assert.ok(rig.links.get('left_tool').getWorldPosition(new THREE.Vector3()).distanceTo(start)<1e-9);
});
test('IK wave respects centered travel and swept scan-derived head clearance',()=>{
  const safety=new ArmClearancePreview(data),hello=GESTURES.find(g=>g.name==='A small hello');
  assert.equal(HELLO_PLANNING.centeredLimitDegrees,ARM_CENTERED_LIMIT);
  assert.ok(HELLO_PLANNING.waypoints.every(w=>w.errorMeters<.002));
  assert.equal(safety.validateMotion(hello).clearanceMeters,HEAD_CLEARANCE_METERS);
  const rig=buildCalibratedRig(data);
  for(const t of [0,6,12,16,22,28,34]) {
    const pose=sampleGesture(hello,t),frames=safety.frames(pose);rig.pose(pose);
    for(const name of ['left_tool','right_tool','insta360_link','oak_link'])assert.ok(frames.get(name).elements.every((v,i)=>Math.abs(v-rig.links.get(name).matrixWorld.elements[i])<1e-9));
  }
  const seed=sampleGesture(hello,12),result=safety.solveIK({target:[.1,.44,1.42],seed});
  assert.ok(result.errorMeters<.002);assert.equal(safety.clearance(result.offsets).clear,true);
  safety.validateTransition(seed,result.offsets);
  assert.throws(()=>safety.solveIK({side:'right',target:[.1,-.4,1.3]}),/reference/);
  const center=new THREE.Vector3().setFromMatrixPosition(safety.frames(seed).get('insta360_link')).toArray();
  assert.throws(()=>safety.solveIK({target:center,seed}),/No IK solution/);
});
test('clear endpoints cannot authorize an arm path that crosses the head',()=>{
  const safety=new ArmClearancePreview(data),from={left_joint1:-120,left_joint2:160,left_joint4:-120},to={...from,left_joint1:120};
  assert.equal(safety.clearance(from).clear,true);assert.equal(safety.clearance(to).clear,true);
  assert.equal(safety.clearance({...from,left_joint1:-80}).clear,false);
  assert.throws(()=>safety.validateTransition(from,to),/Head clearance/);
  const clip={schemaVersion:1,simulationOnly:true,kind:'gesture',name:'Crossing the head',duration:96,
    tracks:Object.fromEntries(Object.keys(from).map(n=>[n,[[0,0],[24,from[n]],[72,to[n]],[96,0]]]))};
  validateGesture(clip,profile);assert.throws(()=>safety.validateMotion(clip),/Head clearance/);
  const sequence=structuredClone(CURB_SEQUENCE);sequence.steps[0].pose.left_joint2=5;
  assert.throws(()=>validateSequence(sequence,profile),/holds the arms and head/);
});
test('motion worker reports rejected paths without treating them as successful poses',async()=>{
  const {Worker}=await import('node:worker_threads');
  const url=new URL('../assets/js/rob-motion-worker.mjs',import.meta.url).href;
  const bootstrap="import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:data=>parentPort.postMessage(data)};await import("+JSON.stringify(url)+");parentPort.on('message',data=>self.onmessage({data}));";
  const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bootstrap)));let id=0;
  const request=(operation,payload)=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:++id,operation,payload});});
  try {
    const init=await request('init',data);assert.equal(init.result.ready,true);
    const clear=await request('transition',{from:{},to:{left_joint2:5}});assert.ok(clear.result.samples>0);
    const bad=await request('transition',{from:{},to:{left_joint4:120}});assert.match(bad.error,/limit/);assert.equal(bad.result,undefined);
  } finally {await worker.terminate();}
});
test('downloadable GLB has the complete rig, named clips, and verified asset hashes',async()=>{
  const bytes=fs.readFileSync(new URL('rob-articulated.glb',directory));
  const parsed=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert.equal(parsed.animations.length,playable.length);
  assert.deepEqual(parsed.animations.map(a=>a.name),playable.map(g=>g.name));
  assert.ok(parsed.scene.getObjectByName('left_tool'));
  let count=0;parsed.scene.traverse(n=>{if(n.isMesh)count++;});assert.equal(count,43);
  const mixer=new THREE.AnimationMixer(parsed.scene);mixer.clipAction(parsed.animations[2]).play();mixer.update(3);
  assert.ok(parsed.scene.getObjectByName('left_two_Link').quaternion.toArray().every(Number.isFinite));
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',directory)));
  for(const [name,entry] of Object.entries(manifest.files)) {
    const data=fs.readFileSync(new URL(name,directory));assert.equal(data.length,entry.bytes);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),entry.sha256);
  }
  const review=JSON.parse(fs.readFileSync(new URL('gesture-review.json',directory)));
  assert.equal(review.centeredLimitDegrees,120);assert.equal(review.referenceConflicts[0].name,'right_joint2');
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL('gestures.json',directory))),playable);
});
