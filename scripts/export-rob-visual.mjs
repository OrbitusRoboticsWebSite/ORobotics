// Regenerate the engine-neutral rig consumed by RealityKit and SceneKit.
import { writeFile } from 'node:fs/promises';
import { buildROBVisual, ROB_VISUAL_DIMENSIONS, ROB_VISUAL_VERSION } from '../assets/js/rob-visual-model.mjs';
const { root, materials } = buildROBVisual();
const geometries = [], geometryKeys = new Map();
const rounded = (values) => Array.from(values, (v) => Math.round(v * 1e6) / 1e6);
function nodeJSON(node) {
  const result = { name: node.name, position: rounded(node.position.toArray()), rotation: rounded(node.quaternion.toArray()), scale: rounded(node.scale.toArray()) };
  if (node.isMesh) {
    const g = node.geometry;
    const value = { positions: rounded(g.attributes.position.array), normals: rounded(g.attributes.normal.array), indices: g.index ? Array.from(g.index.array) : Array.from({ length: g.attributes.position.count }, (_, i) => i) };
    const key = JSON.stringify(value);
    if (!geometryKeys.has(key)) { geometryKeys.set(key, geometries.length); geometries.push(value); }
    result.geometry = geometryKeys.get(key); result.material = node.material.name;
  }
  result.children = node.children.map(nodeJSON); return result;
}
const hierarchy = nodeJSON(root);
const result = { version: ROB_VISUAL_VERSION, units: 'meters', purpose: 'Scan-informed visual approximation; not calibrated kinematics', dimensions: ROB_VISUAL_DIMENSIONS,
  materials: Object.fromEntries(Object.entries(materials).map(([name, m]) => [name, { color: rounded(m.color.clone().convertLinearToSRGB().toArray()), metalness: m.metalness, roughness: m.roughness }])), geometries, root: hierarchy };
await writeFile(new URL('../static/models/rob/rob-visual.json', import.meta.url), JSON.stringify(result) + '\n');
console.log(`ROB ${result.version}: ${geometries.length} shared geometries`);
