import * as THREE from 'three';
import { PICKUP_LEAN_ANGLE } from './rob-pickup.mjs';

export function makeCargoVisual(kind, scale = 1) {
  const root = new THREE.Group(); root.name = `Mission cargo: ${kind}`;
  const metal = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, metalness: .45, roughness: .4 });
  const add = (geometry, material, y = 0) => { const part = new THREE.Mesh(geometry, material); part.position.y = y; root.add(part); return part; };
  if (kind === 'chessPawn') {
    const points = [[.105, -.12], [.11, -.10], [.08, -.065], [.055, -.035], [.042, .035], [.06, .06]].map(([x, y]) => new THREE.Vector2(x, y));
    const ivory = new THREE.MeshStandardMaterial({ color: 0xf3e7c9, roughness: .3 });
    add(new THREE.LatheGeometry(points, 24), ivory); add(new THREE.SphereGeometry(.065, 20, 12), ivory, .10);
  } else if (kind === 'batteryModule') {
    add(new THREE.CylinderGeometry(.095, .095, .24, 20), metal);
    const cap = new THREE.MeshStandardMaterial({ color: 0xffcb55, metalness: .55, roughness: .3 });
    add(new THREE.CylinderGeometry(.08, .08, .025, 20), cap, .13);
    add(new THREE.TorusGeometry(.097, .014, 8, 24), cap).rotation.x = Math.PI / 2;
  } else {
    add(new THREE.BoxGeometry(.24, .24, .24), metal);
    const bands = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: .3, roughness: .4 });
    add(new THREE.BoxGeometry(.245, .045, .245), bands, -.06);
    add(new THREE.BoxGeometry(.245, .045, .245), bands, .06);
  }
  root.scale.setScalar(scale); return root;
}

export function makeCargoDestination(kind, scale = 1) {
  const root = new THREE.Group(); root.name = 'Cargo destination';
  const board = new THREE.Mesh(new THREE.BoxGeometry(.48, .014, .48), new THREE.MeshStandardMaterial({ color: 0x0d9488 })); root.add(board);
  if (kind === 'chessPawn') {
    for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
      const square = new THREE.Mesh(new THREE.BoxGeometry(.118, .009, .118), new THREE.MeshStandardMaterial({ color: (x + z) % 2 ? 0x26313d : 0xf3e7c9 }));
      square.position.set((x - 1.5) * .12, .012, (z - 1.5) * .12); root.add(square);
    }
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(.15, .19, 40), new THREE.MeshBasicMaterial({ color: 0x45ffab, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .022; root.add(ring);
  root.scale.setScalar(scale); return root;
}

export function applyPickupArms(rig, leanAmount, carrying, bodyPitch) {
  if (leanAmount <= .001 && !carrying) return;
  // Whole-arm presentation keeps hanging arms vertical as the upper body leans.
  // It does not claim individual B1 motor solutions.
  for (const arm of rig.arms) {
    arm.rotation.set(-bodyPitch, 0, 0);
    if (carrying && arm.userData.side > 0) arm.rotation.x += (1 - leanAmount) * .45;
  }
  for (const saber of rig.sabers || []) saber.visible = false;
  if (rig.hammer) rig.hammer.visible = false;
}

export const pickupLeanTarget = (automatic, amount) => automatic * (1 - amount) + PICKUP_LEAN_ANGLE * amount;
