import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildCalibratedRig } from '../assets/js/rob-calibrated-rig.mjs';
import { GESTURES, validateGesture, sampleGesture, armReferenceConflicts, ARM_CENTERED_LIMIT } from '../assets/js/rob-gesture-core.mjs';
import { ArmClearancePreview } from '../assets/js/rob-arm-clearance.mjs';
import { HELLO_PLANNING } from '../assets/js/rob-hello-plan.mjs';
import { CURB_SEQUENCE, validateSequence } from '../assets/js/rob-curb-sequence.mjs';

// The exporter consumes Blob, which Node supports; this supplies its async reader.
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result='data:'+blob.type+';base64,'+Buffer.from(buffer).toString('base64');this.onloadend?.();});}
};
const directory='static/models/rob/gesture-studio/';
const raw=await fs.readFile(directory+'rob-scan-rig.json'),source=JSON.parse(raw),rig=buildCalibratedRig(source);
const clearance=new ArmClearancePreview(source),available=[],pending=[],checks={};
for(const clip of GESTURES) {
  try {validateGesture(clip,rig.profile);}
  catch(error) {if(!error.message.includes('hanging reference'))throw error;pending.push({name:clip.name,reason:error.message});continue;}
  checks[clip.name]=clearance.validateMotion(clip);available.push(clip);
}
const review={schemaVersion:1,simulationOnly:true,hardwareAuthorized:false,centeredLimitDegrees:ARM_CENTERED_LIMIT,
  uprightDefinition:'Arm extends along mounting-plate normal: plate X cross plate Y. Model joint zero; not a raw motor zero.',
  scriptCoordinates:'centeredDegrees = scanReferenceRadians * 180 / pi + offsetDegrees',
  referenceConflicts:armReferenceConflicts(rig.profile),headClearanceMeters:.025,
  collisionModel:'Convex envelopes of every scanned arm segment against the head and upper OAK-D. Does not cover neck, torso, arm/arm, cable, payload or environment clearance.',
  checks,pending,helloPlanning:HELLO_PLANNING,sourceProfileSHA256:source.provenance.profileSHA256};
const scene=new THREE.Scene(),conversion=new THREE.Group();conversion.name='ROB Z-up to glTF Y-up';conversion.rotation.x=-Math.PI/2;
scene.add(conversion);conversion.add(rig.root);
scene.userData={simulationOnly:true,hardwareAuthorized:false,sourceProfileSHA256:source.provenance.profileSHA256,centeredArmLimitDegrees:ARM_CENTERED_LIMIT,headClearanceMeters:.025,treadVisuals:'Rubber belt scan patches fixed to tread frames',description:'Scan rig with centered arm limits and head-clearance-reviewed animations. Terrain/collision checkers belong to the website, not this GLB. Physical cable travel and full-body clearance unvalidated.'};
const animations=[];
for(const clip of available) {
  validateGesture(clip,rig.profile);
  const times=Array.from({length:Math.round(clip.duration*30)+1},(_,i)=>i/30),tracks=[];
  for(const name of Object.keys(clip.tracks)) {
    const node=rig.joints.get(name).node,values=[];
    for(const t of times){rig.pose(sampleGesture(clip,t));values.push(...node.quaternion.toArray());}
    tracks.push(new THREE.QuaternionKeyframeTrack(node.uuid+'.quaternion',times,values));
  }
  animations.push(new THREE.AnimationClip(clip.name,clip.duration,tracks));
}
rig.pose();scene.updateMatrixWorld(true);
const glb=Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true,animations,onlyVisible:true}));
await fs.writeFile(directory+'rob-articulated.glb',glb);
await fs.writeFile(directory+'gestures.json',JSON.stringify(available,null,2)+'\n');
await fs.writeFile(directory+'gesture-review.json',JSON.stringify(review,null,2)+'\n');
validateSequence(CURB_SEQUENCE,rig.profile);
await fs.writeFile(directory+'curb-sequence.json',JSON.stringify(CURB_SEQUENCE,null,2)+'\n');
await fs.writeFile(directory+'segmentation-report.json',JSON.stringify(source.provenance,null,2)+'\n');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const files={};
for(const name of ['rob-scan-rig.json','rob-articulated.glb','gestures.json','gesture-review.json','curb-sequence.json','segmentation-report.json','drake-reference.json']) {
  const bytes=await fs.readFile(directory+name);files[name]={bytes:bytes.length,sha256:hash(bytes)};
}
await fs.writeFile(directory+'manifest.json',JSON.stringify({schemaVersion:1,assetRevision:3,simulationOnly:true,hardwareAuthorized:false,centeredArmLimitDegrees:ARM_CENTERED_LIMIT,headClearanceMeters:.025,curbSchemaVersion:2,previewContactModel:'planar-quasi-static',treadVisuals:'Rubber belt scan patches fixed to tread frames',sourceProfileSHA256:source.provenance.profileSHA256,segments:source.segments.length,animations:animations.map(a=>a.name),pendingAnimations:pending,files},null,2)+'\n');
console.log('Exported '+source.segments.length+' rigid segments and '+animations.length+' GLB animations; '+glb.length+' bytes.');
