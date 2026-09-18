import * as THREE from 'three';
import model from './rob-tactical-model.mjs';

export function buildTacticalVisual(torso, scale) {
  const jammer = new THREE.Group(), blaster = new THREE.Group();
  jammer.name = 'Router Backpack Jammer'; blaster.name = 'Two-handed StrikeForce Gel Kit';
  torso.add(jammer, blaster);
  for (const p of model.parts) {
    const size = p.size.map(v => v * scale);
    const geometry = p.shape === 'box' ? new THREE.BoxGeometry(...size) : p.shape === 'sphere' ? new THREE.SphereGeometry(size[0], 12, 8) : new THREE.CylinderGeometry(size[0], size[0], size[1], 12);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: p.color, roughness: .52, metalness: .28 }));
    mesh.name = p.name; mesh.position.fromArray(p.position).multiplyScalar(scale); mesh.quaternion.fromArray(p.rotation); mesh.castShadow = true;
    (p.group === 'jammer' ? jammer : blaster).add(mesh);
  }
  const muzzle = new THREE.Group(); muzzle.position.fromArray(model.muzzle).multiplyScalar(scale); blaster.add(muzzle);
  const blueBeam = new THREE.Mesh(new THREE.CylinderGeometry(.002 * scale, .002 * scale, 7, 6), new THREE.MeshBasicMaterial({ color: 0x278fff, transparent: true, opacity: .55 }));
  blueBeam.rotation.x = Math.PI / 2; blueBeam.position.z = -3.5; muzzle.add(blueBeam);
  const light = new THREE.SpotLight(0xe6f3ff, 9, 15, .40, .5, 1);
  light.target.position.set(0, 0, -10); muzzle.add(light, light.target);
  const ring = new THREE.Mesh(new THREE.RingGeometry(7.9, 8, 80), new THREE.MeshBasicMaterial({ color: 0xbb7aff, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  jammer.visible = blaster.visible = blueBeam.visible = light.visible = ring.visible = false;
  return { jammer, blaster, muzzle, blueBeam, light, ring };
}

export function applyTacticalVisual(rig, { installed, active, equipped, mode, elapsed }) {
  rig.jammer.visible = installed;
  rig.blaster.visible = equipped;
  rig.blueBeam.visible = equipped && mode === 'blue';
  rig.light.visible = equipped && mode === 'flashlight';
  rig.ring.visible = active;
  rig.ring.material.opacity = .2 + .2 * (1 + Math.sin(elapsed * 5)) / 2;
}
