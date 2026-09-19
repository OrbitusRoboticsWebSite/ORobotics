import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildCalibratedRig } from '../assets/js/rob-calibrated-rig.mjs';
import { GESTURES, validateGesture, sampleGesture } from '../assets/js/rob-gesture-core.mjs';
import { CURB_SEQUENCE, validateSequence } from '../assets/js/rob-curb-sequence.mjs';

// The exporter consumes Blob, which Node supports; this supplies its async reader.
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result='data:'+blob.type+';base64,'+Buffer.from(buffer).toString('base64');this.onloadend?.();});}
};
const directory='static/models/rob/gesture-studio/';
const raw=await fs.readFile(directory+'rob-scan-rig.json'),source=JSON.parse(raw),rig=buildCalibratedRig(source);
const scene=new THREE.Scene(),conversion=new THREE.Group();conversion.name='ROB Z-up to glTF Y-up';conversion.rotation.x=-Math.PI/2;
scene.add(conversion);conversion.add(rig.root);
scene.userData={simulationOnly:true,hardwareAuthorized:false,sourceProfileSHA256:source.provenance.profileSHA256,description:'Automatically segmented reference scan. Cable limits, collisions, dynamics and contact unvalidated.'};
const animations=[];
for(const clip of GESTURES) {
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
await fs.writeFile(directory+'gestures.json',JSON.stringify(GESTURES,null,2)+'\n');
validateSequence(CURB_SEQUENCE,rig.profile);
await fs.writeFile(directory+'curb-sequence.json',JSON.stringify(CURB_SEQUENCE,null,2)+'\n');
await fs.writeFile(directory+'segmentation-report.json',JSON.stringify(source.provenance,null,2)+'\n');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const files={};
for(const name of ['rob-scan-rig.json','rob-articulated.glb','gestures.json','curb-sequence.json','segmentation-report.json','drake-reference.json']) {
  const bytes=await fs.readFile(directory+name);files[name]={bytes:bytes.length,sha256:hash(bytes)};
}
await fs.writeFile(directory+'manifest.json',JSON.stringify({schemaVersion:1,simulationOnly:true,hardwareAuthorized:false,sourceProfileSHA256:source.provenance.profileSHA256,segments:source.segments.length,animations:animations.map(a=>a.name),files},null,2)+'\n');
console.log('Exported '+source.segments.length+' rigid segments and '+animations.length+' GLB animations; '+glb.length+' bytes.');
