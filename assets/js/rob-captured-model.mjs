import * as THREE from 'three';

// Attach the same captured surfaces bundled by the Apple renderers. Loading is
// asynchronous; controls and the existing procedural rig remain usable meanwhile.
export async function loadCapturedROB(rig, baseURL, scale = 1) {
  const response = await fetch(`${baseURL}rob-visual.json?v=20260916`);
  if (!response.ok) throw new Error('ROB capture metadata could not load');
  const document = await response.json();
  const [binaryResponse, texture] = await Promise.all([
    fetch(`${baseURL}${document.geometryBuffer}?v=20260916`),
    new THREE.TextureLoader().loadAsync(`${baseURL}rob-captured-colors.png?v=20260916`),
  ]);
  if (!binaryResponse.ok) { texture.dispose(); throw new Error('ROB capture geometry could not load'); }
  const buffer = await binaryResponse.arrayBuffer();
  texture.colorSpace = THREE.SRGBColorSpace;
  const neutral = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  const body = neutral.clone(); body.userData.captured = true;
  const prepared = [];
  function prepare(source, target) {
    if (!target || target.name !== source.name) throw new Error(`Missing ROB animation node ${source.name}`);
    const range = document.geometries[source.geometry]?.buffer;
    if (range) {
      const { byteOffset, vertexCount } = range;
      if (!Number.isInteger(byteOffset) || !Number.isInteger(vertexCount) || byteOffset < 0 || vertexCount <= 0 || vertexCount > 2000000 || byteOffset % 4 || byteOffset + vertexCount * 32 > buffer.byteLength) throw new Error('Invalid captured ROB buffer');
      const values = new Float32Array(buffer, byteOffset, vertexCount * 8);
      const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
      for (let i = 0; i < vertexCount; i++) {
        for (let c = 0; c < 3; c++) { positions[i * 3 + c] = values[i * 8 + c] * scale; normals[i * 3 + c] = values[i * 8 + c + 3]; }
        uvs[i * 2] = values[i * 8 + 6]; uvs[i * 2 + 1] = values[i * 8 + 7];
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      prepared.push({ target, geometry, material: source.material === 'captured-body' ? body : neutral });
    } else if (target.isMesh && source.geometry === undefined) prepared.push({ target });
    source.children.forEach((child, index) => prepare(child, target.children[index]));
  }
  try { prepare(document.root, rig.root); } catch (error) {
    prepared.forEach(({ geometry }) => geometry?.dispose()); neutral.dispose(); body.dispose(); texture.dispose(); throw error;
  }
  for (const { target, geometry, material } of prepared) {
    if (!geometry) { target.visible = false; continue; }
    if (target.isMesh) { target.geometry.dispose(); target.geometry = geometry; target.material = material; target.visible = true; }
    else { const surface = new THREE.Mesh(geometry, material); surface.name = `${target.name} Captured Surface`; target.add(surface); }
  }
  rig.captureMaterial = body; rig.root.userData.captureVersion = document.version;
  return document.capture;
}
