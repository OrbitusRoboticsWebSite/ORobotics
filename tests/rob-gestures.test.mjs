import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildCalibratedRig} from '../assets/js/rob-calibrated-rig.mjs';
import {GESTURES,validateGesture,sampleGesture,previewBounds} from '../assets/js/rob-gesture-core.mjs';
import {CURB_SEQUENCE,SequencePreview,SIGNALS,validateSequence} from '../assets/js/rob-curb-sequence.mjs';

const directory=new URL('../static/models/rob/gesture-studio/',import.meta.url);
const data=JSON.parse(fs.readFileSync(new URL('rob-scan-rig.json',directory))),profile=data.profile;
const good=()=>Object.fromEntries(Object.keys(SIGNALS).map(k=>[k,true]));
test('all gesture samples stay inside unwrapped arm bounds and return to reference',()=>{
  for(const g of GESTURES) {
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
  rig.rollTreads(.9);
  assert.notDeepEqual(rig.joints.get('left_track_drive').node.quaternion.toArray(),wheel.toArray());
  assert.deepEqual(rig.joints.get('left_flipper').node.quaternion.toArray(),flipper.toArray());
  assert.deepEqual(rig.links.get('left_tool').matrixWorld.elements,left.elements);
  rig.pose();assert.deepEqual(rig.joints.get('left_track_drive').node.quaternion.toArray(),wheel.toArray());
  assert.throws(()=>rig.rollTreads(NaN),/wheel distance/);
  assert.throws(()=>rig.pose({left_joint1:360}),/limit/);
  assert.throws(()=>rig.pose({left_joint1:NaN}),/Nonfinite/);
});
test('curb sequence finishes only with confirmations and never authorizes hardware',()=>{
  const r=new SequencePreview(CURB_SEQUENCE,profile);r.start();
  for(let i=0;i<10000 && r.phase!=='complete';i++)r.tick(.05,good());
  assert.equal(r.phase,'complete');assert.equal(r.sample().hardwareAuthorized,false);
  assert.equal(r.events.filter(e=>e.event==='confirm_after').length,CURB_SEQUENCE.steps.length);
  assert.equal(r.sample().world.height,.12);
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
  support.tick(.1,{...good(),rear_support:false});assert.equal(support.fault,'SUPPORT_UNCONFIRMED');
  const unfinished=structuredClone(CURB_SEQUENCE);unfinished.steps.at(-1).world.height=.1;
  assert.throws(()=>validateSequence(unfinished,profile),/platform height/);
});
test('downloadable GLB has the complete rig, named clips, and verified asset hashes',async()=>{
  const bytes=fs.readFileSync(new URL('rob-articulated.glb',directory));
  const parsed=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert.equal(parsed.animations.length,GESTURES.length);
  assert.deepEqual(parsed.animations.map(a=>a.name),GESTURES.map(g=>g.name));
  assert.ok(parsed.scene.getObjectByName('left_tool'));
  let count=0;parsed.scene.traverse(n=>{if(n.isMesh)count++;});assert.equal(count,43);
  const mixer=new THREE.AnimationMixer(parsed.scene);mixer.clipAction(parsed.animations[2]).play();mixer.update(3);
  assert.ok(parsed.scene.getObjectByName('left_two_Link').quaternion.toArray().every(Number.isFinite));
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',directory)));
  for(const [name,entry] of Object.entries(manifest.files)) {
    const data=fs.readFileSync(new URL(name,directory));assert.equal(data.length,entry.bytes);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),entry.sha256);
  }
});
