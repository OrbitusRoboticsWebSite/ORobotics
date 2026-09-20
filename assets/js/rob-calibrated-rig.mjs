import * as THREE from 'three';
import { previewBounds, RAD } from './rob-gesture-core.mjs';
function decoded(value,Type) {
  const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  return new Type(bytes.buffer);
}
export function buildCalibratedRig(document) {
  if(document.schemaVersion!==1 || document.simulationOnly!==true || !document.segments?.length) throw Error('Unsupported scan rig.');
  const profile=document.profile, root=new THREE.Group(), links=new Map(), joints=new Map();
  root.name='ROB approved scan';
  for(const link of profile.links) {const node=new THREE.Group();node.name=link.name;links.set(link.name,node);}
  root.add(links.get('base_link'));
  for(const joint of profile.joints) {
    const node=links.get(joint.child), origin=joint.origin;
    node.position.fromArray(origin.xyzMeters);
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...origin.rpyRadians,'ZYX'));
    const axis=new THREE.Vector3().fromArray(joint.axis).normalize();
    joints.set(joint.name,{joint,node,origin:q,axis});links.get(joint.parent).add(node);
  }
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}), surfaces=[];
  for(const part of document.segments) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(decoded(part.positions,Float32Array),3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(decoded(part.normals,Float32Array),3));
    geometry.setAttribute('color',new THREE.BufferAttribute(decoded(part.colors,Float32Array),4));
    geometry.setIndex(new THREE.BufferAttribute(decoded(part.indices,Uint32Array),1));
    geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=part.link;links.get(part.link).add(mesh);
    surfaces.push({mesh,color:new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL((surfaces.length*.618034)%1,.6,.55),side:THREE.DoubleSide})});
  }
  function pose(offsets={}) {
    for(const [name,{joint,node,origin,axis}] of joints) {
      const reference=profile.previewPositions[name] || 0, delta=offsets[name] ?? 0;
      if(!Number.isFinite(delta)) throw Error('Nonfinite pose: '+name);
      const b=previewBounds(joint,reference);
      // A zero offset can display the captured scan even if its estimated pose
      // conflicts with the new range. Playback is separately validated; this
      // exception must not invent a legal transition to/from that observation.
      if(joint.kind!=='fixed' && delta!==0 && (delta<b.min-1e-7 || delta>b.max+1e-7)) throw Error('Preview limit exceeded: '+name);
      node.quaternion.copy(origin);
      if(['revolute','continuous'].includes(joint.kind)) node.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis,reference+delta*RAD));
    }
    root.updateMatrixWorld(true);
  }
  pose();
  // Nearest-wheel scan cuts also contain the continuous rubber belt. Preserve
  // their reference positions on the tread frame instead of orbiting patches.
  for(const {mesh} of surfaces) {
    const match=mesh.name.match(/^(left|right)_(sprocket_link|track_(front|upper)_idler_link)$/);
    if(match)links.get(match[1]+'_track_link').attach(mesh);
  }
  root.updateMatrixWorld(true);
  return {root,profile,joints,links,pose,provenance:document.provenance,
    showSegments(enabled){for(const s of surfaces)s.mesh.material=enabled?s.color:material;}};
}
