import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildROBVisual, robFlipperSupportHeight, ROB_VISUAL_DIMENSIONS } from '../assets/js/rob-visual-model.mjs';
import { loadCapturedROB } from '../assets/js/rob-captured-model.mjs';

test('ROB has rear wheel flipper pivots, separate end rollers and actual perforations', () => {
  const { root, baseFlipper } = buildROBVisual(); root.updateMatrixWorld(true);
  for (const side of ['Left', 'Right']) {
    const axle = root.getObjectByName(`${side} Tri-Wheel 3`).getWorldPosition(new THREE.Vector3());
    const pivot = baseFlipper.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(axle.z - pivot.z) < 1e-6 && Math.abs(axle.y - pivot.y) < 1e-6);
    const roller = root.getObjectByName(`${side} Flipper End Roller`);
    assert.equal(roller.position.z, -ROB_VISUAL_DIMENSIONS.flipperLength);
    const plate = root.getObjectByName(`${side} Perforated UHMW Flipper`);
    const origin = new THREE.Vector3(side === 'Left' ? -.5 : .5, pivot.y, pivot.z - .134);
    const ray = new THREE.Raycaster(origin, new THREE.Vector3(side === 'Left' ? 1 : -1, 0, 0));
    assert.equal(ray.intersectObject(plate).length, 0, 'ray must pass through the second plate hole');
    ray.ray.origin.y += .030;
    assert.ok(ray.intersectObject(plate).length > 0, 'plate rail must surround the hole');
  }
  assert.equal(root.getObjectByName('Base Lift Flipper Blade'), undefined);
  for (const name of ['Left Camera Eye', 'Right Camera Eye', 'Neck Pan', 'Left ROB Speaker Cone', 'Right ROB Speaker Cone', 'Left AMBER Joint 7', 'Right AMBER Joint 7']) assert.ok(root.getObjectByName(name), name);
});

test('rollers clear the floor over the entire animated cycle at both game scales', () => {
  for (const scale of [1.35, 2.15]) {
    const { root, baseFlipper, driveBase } = buildROBVisual({ scale });
    for (let degrees = 0; degrees >= -360; degrees -= 5) {
      const angle = degrees * Math.PI / 180, pitch = .23 * -degrees / 360;
      baseFlipper.rotation.x = angle; driveBase.rotation.x = pitch;
      driveBase.position.y = robFlipperSupportHeight(angle, pitch, scale); root.updateMatrixWorld(true);
      for (const side of ['Left', 'Right']) {
        const bounds = new THREE.Box3().setFromObject(root.getObjectByName(`${side} Flipper End Roller`), true);
        assert.ok(bounds.min.y >= -1e-6, `floor intersection at ${degrees} degrees`);
      }
    }
  }
});

test('all six published scans have valid GLB buffers and original scan provenance', () => {
  const directory = new URL('../static/models/rob/', import.meta.url);
  const provenance = JSON.parse(readFileSync(new URL('scan-provenance.json', directory)));
  assert.equal(provenance.scans.length, 6);
  for (const scan of provenance.scans) {
    const bytes = readFileSync(new URL(scan.file, directory));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(8), bytes.length);
    const jsonLength = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20, 20 + jsonLength));
    const binaryStart = 28 + jsonLength;
    for (const view of doc.bufferViews) assert.ok(view.byteOffset + view.byteLength <= bytes.length - binaryStart);
    assert.equal(doc.accessors[0].count, scan.vertices);
    assert.equal(doc.accessors[doc.meshes[0].primitives[0].indices].count, scan.triangles * 3);
    assert.equal(scan.sourceSHA256.length, 64); assert.equal(scan.originalUnmodified, true);
  }
});

test('captured surfaces load at both game scales and follow head motion without moving the base', async (t) => {
  const directory = new URL('../static/models/rob/', import.meta.url);
  t.mock.method(globalThis, 'fetch', async (url) => new Response(readFileSync(new URL(url.split('?')[0], directory))));
  t.mock.method(THREE.TextureLoader.prototype, 'loadAsync', async () => new THREE.Texture());
  for (const scale of [1, 2.15]) {
    const rig = buildROBVisual({ scale });
    const flipper = rig.baseFlipper, pivot = flipper.position.clone();
    const capture = await loadCapturedROB(rig, '', scale);
    rig.root.updateMatrixWorld(true);
    assert.ok(capture.triangles > 100000 && capture.triangles < 150000);
    assert.equal(rig.baseFlipper, flipper);
    assert.ok(flipper.position.equals(pivot));
    let triangles = 0;
    rig.root.traverse(node => {
      if (!node.material?.map) return;
      const geometry = node.geometry, positions = geometry.attributes.position;
      assert.equal(geometry.attributes.uv.count, positions.count);
      assert.ok(positions.array.every(Number.isFinite));
      triangles += positions.count / 3;
      for (let parent = node; parent; parent = parent.parent) assert.ok(parent.visible, node.name);
    });
    assert.equal(triangles, capture.triangles);
    assert.equal(rig.captureMaterial.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(rig.captureMaterial.color.getHex(), 0xffffff);
    const shoulder = rig.root.getObjectByName('Captured Shoulder Laser');
    assert.ok(shoulder.children.some(child => child.material?.map));
    assert.equal(shoulder.parent.name, 'Gatling Tilt Servo');
    assert.equal(rig.root.getObjectByName('Shoulder Laser Muzzle').parent, shoulder.parent);
    const head = rig.root.getObjectByName('Camera Head');
    const neck = rig.root.getObjectByName('Neck Pan');
    const base = rig.root.getObjectByName('Tri-Wheel Chassis');
    const sample = new THREE.Vector3().fromBufferAttribute(head.geometry.attributes.position, 0);
    const before = head.localToWorld(sample.clone()), baseBefore = base.matrixWorld.clone();
    neck.rotation.y += 0.6; rig.root.updateMatrixWorld(true);
    assert.ok(before.distanceTo(head.localToWorld(sample.clone())) > .01 * scale);
    assert.ok(base.matrixWorld.equals(baseBefore));
    assert.ok(rig.root.getObjectByName('Left Perforated UHMW Flipper').visible);
  }
});

test('a truncated capture leaves the complete fallback rig usable', async (t) => {
  const document = JSON.parse(readFileSync(new URL('../static/models/rob/rob-visual.json', import.meta.url)));
  t.mock.method(globalThis, 'fetch', async (url) => new Response(url.includes('.json') ? JSON.stringify(document) : new Uint8Array(8)));
  t.mock.method(THREE.TextureLoader.prototype, 'loadAsync', async () => new THREE.Texture());
  const rig = buildROBVisual(), head = rig.root.getObjectByName('Camera Head'), geometry = head.geometry;
  await assert.rejects(loadCapturedROB(rig, ''), /Invalid captured ROB buffer/);
  assert.equal(head.geometry, geometry);
  rig.root.traverse(node => assert.equal(node.visible, true));
});
