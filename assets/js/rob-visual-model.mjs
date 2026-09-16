import * as THREE from 'three';

// Visual reconstruction from the September 15, 2026 ROB scans. Coordinates are
// Y-up, forward -Z. This is presentation geometry, not calibrated robot kinematics.
export const ROB_VISUAL_VERSION = '2026.09.15';
export const ROB_VISUAL_DIMENSIONS = Object.freeze({
  wheelSpacing: .42545, rearAxleZ: .212725, axleHeight: .11,
  flipperLength: .33655, flipperRollerRadius: .029, trackCenterX: .205,
});

// Display-only support clearance during the simulated full-turn lift cycle.
export const robFlipperSupportHeight = (angle, pitch = 0, scale = 1) => Math.max(0,
  ROB_VISUAL_DIMENSIONS.flipperRollerRadius - ROB_VISUAL_DIMENSIONS.axleHeight * Math.cos(pitch)
    - ROB_VISUAL_DIMENSIONS.flipperLength * Math.sin(angle + pitch)) * scale;

export function buildROBVisual({ scale = 1, finish = 0x45515d, faceColor = 0x5cff6b } = {}) {
  const root = new THREE.Group(); root.name = 'ROB';
  const materials = {
    body: new THREE.MeshStandardMaterial({ color: finish, metalness: .65, roughness: .42 }),
    aluminum: new THREE.MeshStandardMaterial({ color: 0xa8b3ba, metalness: .75, roughness: .32 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151a20, roughness: .9 }),
    polymer: new THREE.MeshStandardMaterial({ color: 0x30363b, roughness: .64 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x366a9a, metalness: .6, roughness: .4 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x071a22, metalness: .6, roughness: .12 }),
    face: new THREE.MeshStandardMaterial({ color: faceColor, emissive: faceColor, emissiveIntensity: .35 }),
  };
  Object.entries(materials).forEach(([name, material]) => { material.name = name; });
  const group = (name, parent, position = [0, 0, 0]) => {
    const node = new THREE.Group(); node.name = name; node.position.fromArray(position); parent.add(node); return node;
  };
  const part = (name, geometry, material, parent, position = [0, 0, 0], rotation = [0, 0, 0]) => {
    const node = new THREE.Mesh(geometry, materials[material]); node.name = name;
    node.position.fromArray(position); node.rotation.set(...rotation); node.castShadow = true; node.receiveShadow = true;
    parent.add(node); return node;
  };
  const box = (name, size, position, material, parent) => part(name, new THREE.BoxGeometry(...size), material, parent, position);
  const cyl = (name, radius, length, position, material, parent, axis = 'y') => part(name,
    new THREE.CylinderGeometry(radius, radius, length, 16), material, parent, position,
    axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]);
  const rod = (name, a, b, radius, material, parent) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const node = cyl(name, radius, delta.length(), start.add(end).multiplyScalar(.5).toArray(), material, parent);
    node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return node;
  };
  const { rearAxleZ, axleHeight, flipperLength, flipperRollerRadius, trackCenterX } = ROB_VISUAL_DIMENSIONS;
  const drive = group('Drive Base Assembly', root, [0, 0, rearAxleZ]);
  box('Tri-Wheel Chassis', [.32, .13, .42], [0, .205, -rearAxleZ], 'body', drive);
  const hood = box('Sloped Front Hood', [.325, .035, .23], [0, .28, -.30], 'body', drive); hood.rotation.x = -.27;
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'Left' : 'Right';
    const tread = group(`${prefix} Tri-Wheel Tread`, drive, [side * trackCenterX, 0, -rearAxleZ]);
    // Tangent belt around the asymmetric three-wheel layout seen in the scans.
    const belt = [[-.28, .038], [.275, .038], [.301, .12], [.133, .353], [.035, .383], [-.284, .155]];
    belt.forEach(([z, y], i) => {
      const [nz, ny] = belt[(i + 1) % belt.length], dz = nz - z, dy = ny - y, length = Math.hypot(dz, dy);
      const rotation = -Math.atan2(dy, dz);
      const rail = box(`${prefix} Track Belt Segment ${i + 1}`, [.085, .02, length + .008], [0, (y + ny) / 2, (z + nz) / 2], 'rubber', tread); rail.rotation.x = rotation;
      const count = Math.ceil(length / .043);
      for (let j = 0; j < count; j += 1) {
        const t = (j + .5) / count;
        const shoe = box(`${prefix} Tread Shoe ${i}-${j}`, [.096, .03, .029], [0, y + dy * t, z + dz * t], 'polymer', tread); shoe.rotation.x = rotation;
      }
    });
    [[-.212725, axleHeight, .078], [.065, .302, .073], [rearAxleZ, axleHeight, .078]].forEach(([z, y, radius], index) => {
      const wheel = group(`${prefix} Tri-Wheel ${index + 1}`, tread, [0, y, z]);
      cyl(`${prefix} Wheel Tire ${index}`, radius, .081, [0, 0, 0], 'rubber', wheel, 'x');
      cyl(`${prefix} Wheel Rim ${index}`, radius * .84, .087, [0, 0, 0], 'aluminum', wheel, 'x');
      cyl(`${prefix} Wheel Hub ${index}`, .02, .098, [0, 0, 0], 'polymer', wheel, 'x');
      for (let j = 0; j < 5; j += 1) {
        const angle = j * Math.PI * 2 / 5;
        cyl(`${prefix} Rim Recess ${index}-${j}`, .017, .002, [side * .0445, Math.sin(angle) * .041, Math.cos(angle) * .041], 'rubber', wheel, 'x');
      }
    });
  }
  const flipper = group('Base Lift Flipper Assembly', drive, [0, axleHeight, 0]);
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'Left' : 'Right';
    const arm = group(`${prefix} Base Lift Flipper Arm`, flipper, [side * .269, 0, 0]);
    // An extruded UHMW side plate, with genuine through holes, not a blade across the front.
    const outline = new THREE.Shape();
    outline.moveTo(-flipperLength, -.029); outline.lineTo(.018, -.042); outline.quadraticCurveTo(.049, 0, .018, .042);
    outline.lineTo(-flipperLength, .029); outline.quadraticCurveTo(-flipperLength - .03, 0, -flipperLength, -.029);
    for (let i = 1; i <= 4; i += 1) {
      const hole = new THREE.Path(); hole.absarc(-i * .067, 0, .021, 0, Math.PI * 2, true); outline.holes.push(hole);
    }
    const plate = new THREE.ExtrudeGeometry(outline, { depth: .014, bevelEnabled: false, curveSegments: 8 });
    // Shape X -> robot Z, extrusion Z -> robot -X.
    plate.translate(0, 0, -.007); plate.rotateY(-Math.PI / 2);
    part(`${prefix} Perforated UHMW Flipper`, plate, 'polymer', arm);
    cyl(`${prefix} Flipper Axle Cap`, .033, .027, [0, 0, 0], 'aluminum', arm, 'x');
    cyl(`${prefix} Flipper End Roller`, flipperRollerRadius, .038, [0, 0, -flipperLength], 'rubber', arm, 'x');
    cyl(`${prefix} Flipper Roller Hub`, .012, .041, [0, 0, -flipperLength], 'aluminum', arm, 'x');
  }
  const torso = group('Torso Assembly', root);
  cyl('Waist Bearing', .104, .044, [0, .51, .035], 'aluminum', torso);
  for (const x of [-.09, .09]) {
    rod('Open Waist Frame', [x, .31, .02], [x, .53, .07], .015, 'aluminum', torso);
    rod('Torso Linear Actuator', [x * .6, .30, -.08], [x * .6, .52, .055], .014, 'aluminum', torso);
  }
  box('Belly Compute', [.26, .10, .205], [0, .58, .012], 'body', torso);
  box('Cerebro Torso', [.32, .29, .205], [0, .765, .012], 'body', torso);
  box('Chest Bezel', [.302, .268, .014], [0, .77, -.099], 'polymer', torso);
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'Left' : 'Right', x = side * .078;
    cyl(`${prefix} ROB Speaker Ring`, .065, .018, [x, .79, -.116], 'rubber', torso, 'z');
    cyl(`${prefix} ROB Speaker Cone`, .048, .012, [x, .79, -.129], 'aluminum', torso, 'z');
    cyl(`${prefix} Speaker Dust Cap`, .019, .016, [x, .79, -.139], 'polymer', torso, 'z');
    for (const y of [.65, .883]) cyl(`${prefix} Chest Fastener ${y}`, .007, .004, [side * .14, y, -.111], 'aluminum', torso, 'z');
  }
  box('Chest Status Panel', [.10, .022, .014], [0, .692, -.113], 'rubber', torso);
  box('Depth Camera', [.105, .032, .045], [0, .576, -.116], 'aluminum', torso);
  for (const x of [-.037, 0, .037]) cyl('Belly Camera Lens', .008, .005, [x, .576, -.141], 'lens', torso, 'z');
  const neck = group('Neck Pan', torso, [0, .913, .02]);
  cyl('Neck Base', .047, .052, [0, .012, 0], 'rubber', neck);
  for (const x of [-.025, .025]) rod('Open Neck Rail', [x, .025, 0], [x, .242, .025], .010, 'aluminum', neck);
  rod('Neck Cable', [0, .018, .023], [0, .242, .048], .009, 'rubber', neck);
  for (const y of [.053, .237]) cyl('Neck Pitch Pivot', .025, .079, [0, y, .02], 'aluminum', neck, 'x');
  const head = group('Camera Head Pivot', neck, [0, .30, .008]);
  const shell = part('Camera Head', new THREE.IcosahedronGeometry(.080, 1), 'body', head); shell.scale.set(1, 1.12, .94);
  for (const side of [-1, 1]) {
    const eye = group(`${side < 0 ? 'Left' : 'Right'} Camera Eye`, head, [side * .039, -.004, -.058]); eye.rotation.y = side * -.26;
    cyl('Eye Lens Bezel', .026, .014, [0, 0, 0], 'aluminum', eye, 'z');
    cyl('Optical Lens', .018, .018, [0, 0, -.009], 'lens', eye, 'z');
    cyl(side < 0 ? 'Face Smiley Left Eye' : 'Face Smiley Right Eye', .005, .002, [0, .002, -.019], 'face', eye, 'z');
    rod('Head Antenna', [side * .042, .06, .01], [side * .065, .16, .012], .0025, 'aluminum', head);
  }
  box('Head Depth Camera', [.105, .027, .036], [0, -.07, -.034], 'polymer', head);
  for (const x of [-.033, .033]) cyl('Head Depth Lens', .009, .004, [x, -.07, -.054], 'lens', head, 'z');
  for (let i = 0; i < 5; i += 1) box(['Face Smiley Left Corner', 'Face Smiley Left Smile', 'Face Smiley Center Smile', 'Face Smiley Right Smile', 'Face Smiley Right Corner'][i], [.007, .003, .002], [(i - 2) * .010, -.046, -.065], 'face', head);
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'Left' : 'Right';
    const arm = group(`${prefix} Arm Assembly`, torso, [side * .208, .962, .018]); arm.userData.side = side;
    const joints = [[0, 0, 0], [side * .037, -.078, 0], [side * .066, -.177, -.003], [side * .080, -.243, -.004], [side * .074, -.315, -.006], [side * .089, -.408, -.012], [side * .084, -.479, -.013]];
    joints.forEach((p, i) => {
      cyl(`${prefix} AMBER Joint ${i + 1}`, i < 3 ? .043 : .030, i % 2 ? .067 : .060, p, 'aluminum', arm, i % 2 ? 'y' : 'z');
      if (i % 2 === 0) cyl(`${prefix} AMBER Blue Cap ${i}`, i < 3 ? .036 : .023, .007, [p[0], p[1], p[2] - .035], 'blue', arm, 'z');
      if (i < joints.length - 1) {
        const next = joints[i + 1];
        for (const offset of [-.025, .025]) {
          const link = rod(`${prefix} Link ${i}-${offset}`, [p[0], p[1], p[2] + offset], [next[0], next[1], next[2] + offset], .009, 'aluminum', arm);
          if (i === 1 || i === 4) {
            const length = Math.hypot(...next.map((v, j) => v - p[j]));
            link.geometry.dispose(); link.geometry = new THREE.BoxGeometry(.038, length, .012);
            if (offset < 0) { link.name = `${prefix} ${i === 1 ? 'Upper Arm' : 'Forearm'}`; link.material = materials.body; }
          }
        }
      }
    });
    box(`${prefix} Gripper Palm`, [.046, .04, .037], [side * .084, -.527, -.013], 'polymer', arm);
    for (const finger of [-1, 1]) {
      const node = box(`${prefix} Gripper Finger ${finger}`, [.012, .063, .015], [side * .084 + finger * .021, -.574, -.018], 'aluminum', arm); node.rotation.z = finger * -.14;
    }
  }
  // Bake presentation scale into geometry and translations. Runtime animations can
  // still set joint transforms without losing scale or resetting child offsets.
  if (scale !== 1) root.traverse((node) => { node.position.multiplyScalar(scale); if (node.isMesh) node.geometry.scale(scale, scale, scale); });
  return { root, materials, driveBase: drive, baseFlipper: flipper, torso,
    neckPan: neck, cameraHead: head,
    arms: ['Left', 'Right'].map((side) => root.getObjectByName(`${side} Arm Assembly`)),
    speakerCones: ['Left', 'Right'].map((side) => root.getObjectByName(`${side} ROB Speaker Cone`)),
    treadWheels: [-1, 1].flatMap((side) => [1, 2, 3].map((index) => ({ side: side < 0 ? 'left' : 'right', wheel: root.getObjectByName(`${side < 0 ? 'Left' : 'Right'} Tri-Wheel ${index}`) }))),
  };
}
