import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildROBVisual, robFlipperSupportHeight } from './rob-visual-model.mjs';

document.querySelectorAll('[data-rob-showcase]').forEach((root) => {
  const viewport = root.querySelector('[data-model-viewport]');
  const poster = root.querySelector('[data-model-poster]');
  const status = root.querySelector('[data-model-status]');
  const select = root.querySelector('[data-model-pose]');
  const rotate = root.querySelector('[data-model-rotate]');
  const flipper = root.querySelector('[data-model-flipper]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer, controls, displayed, rig, request = 0, stopped = false, visible = true, frame;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a121c);
  const camera = new THREE.PerspectiveCamera(38, 1, .01, 30);
  const loader = new GLTFLoader();
  const lights = new THREE.HemisphereLight(0xe4f2ff, 0x526274, 3); scene.add(lights);
  const key = new THREE.DirectionalLight(0xffffff, 4); key.position.set(2, 3, -3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x85bfff, 3); rim.position.set(-2, 2, 2); scene.add(rim);
  const dispose = (model) => {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    model?.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      (Array.isArray(node.material) ? node.material : node.material ? [node.material] : []).forEach((material) => {
        materials.add(material); Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });
      });
    });
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose());
  };
  function reset() {
    const front = rig ? -1 : 1;
    camera.position.set(front * 1.25, 1.04, front * 2.6);
    controls.target.set(0, .70, 0); controls.update();
  }
  function show(model) {
    if (displayed) { scene.remove(displayed); dispose(displayed); }
    displayed = model; scene.add(displayed); reset(); poster.hidden = true;
  }
  async function load() {
    const current = ++request;
    viewport.setAttribute('aria-busy', 'true');
    flipper.closest('label').hidden = select.value !== 'rig';
    if (select.value === 'rig') {
      rig = buildROBVisual(); show(rig.root); flipper.value = '0'; root.querySelector('[data-model-angle]').textContent = '0°';
      status.textContent = 'Drag to orbit · scroll or pinch to zoom. Move the slider to turn the flippers.';
      viewport.setAttribute('aria-busy', 'false'); return;
    }
    rig = undefined;
    status.textContent = 'Loading ROB’s scan…';
    try {
      const gltf = await loader.loadAsync(`${root.dataset.modelBase}${select.value}.glb`);
      if (current !== request || stopped) { dispose(gltf.scene); return; }
      show(gltf.scene);
      status.textContent = 'Drag to orbit · scroll or pinch to zoom. Arrow keys rotate; + and − zoom.';
    } catch {
      if (current !== request || stopped) return;
      status.textContent = 'The scan could not load. Try another pose or choose the interactive robot.';
    } finally {
      if (current === request) viewport.setAttribute('aria-busy', 'false');
    }
  }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional ROB robot');
    renderer.domElement.tabIndex = 0; viewport.append(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 1; controls.maxDistance = 5;
    controls.maxPolarAngle = Math.PI * .88; controls.autoRotate = !reducedMotion; controls.autoRotateSpeed = .6;
    rotate.setAttribute('aria-pressed', String(controls.autoRotate)); rotate.textContent = controls.autoRotate ? 'Pause rotation' : 'Rotate';
    controls.addEventListener('start', () => { controls.autoRotate = false; rotate.setAttribute('aria-pressed', 'false'); rotate.textContent = 'Rotate'; });
    const resize = new ResizeObserver(() => {
      const width = viewport.clientWidth, height = viewport.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    }); resize.observe(viewport);
    const clock = new THREE.Clock();
    function animate() {
      if (stopped || !visible || document.hidden) { frame = undefined; return; }
      frame = requestAnimationFrame(animate); controls.update(Math.min(clock.getDelta(), .05)); renderer.render(scene, camera);
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !frame) animate(); }); observer.observe(root);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !frame) animate(); });
    select.addEventListener('change', load);
    root.querySelector('[data-model-reset]').addEventListener('click', reset);
    rotate.addEventListener('click', () => {
      controls.autoRotate = !controls.autoRotate; rotate.setAttribute('aria-pressed', String(controls.autoRotate));
      rotate.textContent = controls.autoRotate ? 'Pause rotation' : 'Rotate';
    });
    flipper.addEventListener('input', () => {
      if (!rig) return;
      const angle = Number(flipper.value) * Math.PI / 180; rig.baseFlipper.rotation.x = angle;
      // Raise the display robot only enough to keep the roller above the ground.
      rig.root.position.y = robFlipperSupportHeight(angle);
      root.querySelector('[data-model-angle]').textContent = `${flipper.value}°`;
    });
    renderer.domElement.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
      event.preventDefault(); controls.autoRotate = false; rotate.setAttribute('aria-pressed', 'false'); rotate.textContent = 'Rotate';
      if (event.key === 'Home') { reset(); return; }
      const offset = camera.position.clone().sub(controls.target), spherical = new THREE.Spherical().setFromVector3(offset);
      if (event.key === 'ArrowLeft') spherical.theta -= .15;
      if (event.key === 'ArrowRight') spherical.theta += .15;
      if (event.key === 'ArrowUp') spherical.phi -= .1;
      if (event.key === 'ArrowDown') spherical.phi += .1;
      if (['+', '='].includes(event.key)) spherical.radius *= .9;
      if (event.key === '-') spherical.radius *= 1.1;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, .1, Math.PI * .88);
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, 1, 5);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical)); controls.update();
    });
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault(); stopped = true; cancelAnimationFrame(frame); poster.hidden = false;
      status.textContent = 'The 3D view was interrupted. Reload this page to explore ROB again.';
    });
    window.addEventListener('pageshow', (event) => { if (event.persisted && !frame) animate(); });
    window.addEventListener('pagehide', (event) => {
      if (event.persisted) { cancelAnimationFrame(frame); frame = undefined; return; }
      stopped = true; request += 1; cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); controls.dispose(); dispose(displayed); renderer.dispose();
    });
    reset(); load(); animate();
  } catch {
    renderer?.dispose();
    root.querySelector('[data-model-controls]').hidden = true;
    status.textContent = 'ROB’s scan is shown above. Interactive 3D is unavailable in this browser.';
  }
});
