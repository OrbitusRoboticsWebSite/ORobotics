import * as THREE from 'three';
import { loadCapturedROB } from './rob-captured-model.mjs';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildROBVisual } from './rob-visual-model.mjs';
import { SHOWCASE_PLATFORM, SHOWCASE_CLIMB_DURATION, showcaseGroundPose, showcaseClimbPose, applyShowcasePose, applyShowcaseLaser } from './rob-showcase-motion.mjs';

document.querySelectorAll('[data-rob-showcase]').forEach((root) => {
  const viewport = root.querySelector('[data-model-viewport]');
  const poster = root.querySelector('[data-model-poster]');
  const status = root.querySelector('[data-model-status]');
  const select = root.querySelector('[data-model-pose]');
  const rotate = root.querySelector('[data-model-rotate]');
  const flipper = root.querySelector('[data-model-flipper]');
  const rigControls = root.querySelector('[data-model-rig-controls]');
  const pan = root.querySelector('[data-model-laser-pan]'), tilt = root.querySelector('[data-model-laser-tilt]');
  const scan = root.querySelector('[data-model-laser-scan]');
  const climb = root.querySelector('[data-model-climb]'), progress = root.querySelector('[data-model-progress]');
  const stage = root.querySelector('[data-model-stage]'), balance = root.querySelector('[data-model-balance]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer, controls, displayed, rig, request = 0, stopped = false, visible = true, frame;
  let playing = false, demonstration = false, demoTime = 0, laserScanning = !reducedMotion, scanTime = 0;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a121c);
  const camera = new THREE.PerspectiveCamera(38, 1, .01, 30);
  const loader = new GLTFLoader();
  scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x526274, 3));
  const key = new THREE.DirectionalLight(0xffffff, 4); key.position.set(2, 3, -3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x85bfff, 3); rim.position.set(-2, 2, 2); scene.add(rim);
  const course = new THREE.Group(); course.visible = false; scene.add(course);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4.8), new THREE.MeshStandardMaterial({ color: 0x122331, roughness: .95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.003, -.45); course.add(floor);
  const grid = new THREE.GridHelper(4, 20, 0x31556e, 0x203b4d); grid.position.set(0, .001, -.45); course.add(grid);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(SHOWCASE_PLATFORM.width, SHOWCASE_PLATFORM.height, SHOWCASE_PLATFORM.depth), new THREE.MeshStandardMaterial({ color: 0x2b465a, metalness: .25, roughness: .7 }));
  platform.position.set(0, SHOWCASE_PLATFORM.height / 2, SHOWCASE_PLATFORM.edgeZ - SHOWCASE_PLATFORM.depth / 2); course.add(platform);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(SHOWCASE_PLATFORM.width, .018, .028), new THREE.MeshBasicMaterial({ color: 0xffb84a }));
  lip.position.set(0, SHOWCASE_PLATFORM.height + .009, SHOWCASE_PLATFORM.edgeZ - .014); course.add(lip);
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
  const updateRotationButton = () => {
    rotate.setAttribute('aria-pressed', String(controls.autoRotate));
    rotate.textContent = controls.autoRotate ? 'Pause view rotation' : 'Rotate view';
  };
  function resetView() {
    if (rig) { camera.position.set(2.45, 1.35, -2.4); controls.target.set(0, .66, -.22); }
    else { camera.position.set(1.25, 1.04, 2.6); controls.target.set(0, .70, 0); }
    controls.update();
  }
  const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
  function present() {
    if (!rig) return;
    const pose = demonstration ? showcaseClimbPose(demoTime) : showcaseGroundPose(Number(flipper.value) * Math.PI / 180);
    const { leanAngle } = applyShowcasePose(rig, pose);
    if (demonstration) flipper.value = String(pose.angle * 180 / Math.PI);
    setText(root.querySelector('[data-model-angle]'), `${Math.round(pose.angle * 180 / Math.PI)}°`);
    setText(balance, `Chassis ${Math.round(pose.pitch * 180 / Math.PI)}° · Body counter-lean ${Math.round(leanAngle * 180 / Math.PI)}°`);
    setText(stage, demonstration ? pose.stage : 'Explore ROB’s moving joints');
    progress.value = String(demonstration ? demoTime : 0);
    progress.setAttribute('aria-valuetext', `${Math.round(demoTime / SHOWCASE_CLIMB_DURATION * 100)}% · ${pose.stage}`);
    setText(root.querySelector('[data-model-progress-text]'), `${Math.round(demoTime / SHOWCASE_CLIMB_DURATION * 100)}%`);
    climb.textContent = playing ? 'Pause climb' : demoTime >= SHOWCASE_CLIMB_DURATION ? 'Replay climb' : demonstration ? 'Resume climb' : 'Watch ROB climb';
    climb.setAttribute('aria-pressed', String(playing));
    if (demonstration) setText(status, pose.detail);
  }
  function presentLaser(delta = 0) {
    if (!rig) return;
    if (laserScanning) {
      pan.value = String(THREE.MathUtils.damp(Number(pan.value), Math.sin(scanTime * .7) * .9 * 180 / Math.PI, 6, delta));
      tilt.value = String(THREE.MathUtils.damp(Number(tilt.value), Math.sin(scanTime * .43) * .13 * 180 / Math.PI, 6, delta));
    }
    applyShowcaseLaser(rig, Number(pan.value) * Math.PI / 180, Number(tilt.value) * Math.PI / 180);
    setText(root.querySelector('[data-model-pan-angle]'), `${Math.round(Number(pan.value))}°`);
    setText(root.querySelector('[data-model-tilt-angle]'), `${Math.round(Number(tilt.value))}°`);
    scan.setAttribute('aria-pressed', String(laserScanning)); scan.textContent = laserScanning ? 'Pause laser scan' : 'Scan shoulder laser';
  }
  function resetPose() {
    playing = demonstration = false; demoTime = 0; flipper.value = pan.value = tilt.value = '0'; scanTime = 0;
    present(); presentLaser();
    status.textContent = 'Move the shoulder laser or flippers, or watch ROB climb. Drag to orbit; scroll or pinch to zoom.';
  }
  function show(model) {
    if (displayed) { scene.remove(displayed); dispose(displayed); }
    displayed = model; scene.add(displayed); resetView(); poster.hidden = true;
  }
  async function load() {
    const current = ++request;
    playing = false;
    viewport.setAttribute('aria-busy', 'true');
    rigControls.hidden = select.value !== 'rig'; course.visible = select.value === 'rig'; stage.hidden = select.value !== 'rig';
    if (select.value === 'rig') {
      rig = buildROBVisual(); const capturedRig = rig; show(rig.root); resetPose();
      controls.autoRotate = false; updateRotationButton();
      status.textContent = 'Loading ROB’s captured surfaces…';
      try {
        await loadCapturedROB(capturedRig, root.dataset.modelBase);
        if (current !== request || stopped) { dispose(capturedRig.root); return; }
        status.textContent = 'Move the shoulder laser or flippers, or watch ROB climb. Drag to orbit; scroll or pinch to zoom.';
      } catch {
        if (current !== request || stopped) return;
        status.textContent = 'The captured surfaces could not load. The motion controls still work on the simplified robot.';
      } finally { if (current === request) viewport.setAttribute('aria-busy', 'false'); }
      return;
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
    } finally { if (current === request) viewport.setAttribute('aria-busy', 'false'); }
  }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', 'Interactive ROB with shoulder laser, balanced flippers, and a ledge-climbing demonstration');
    renderer.domElement.tabIndex = 0; viewport.append(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 1; controls.maxDistance = 5;
    controls.maxPolarAngle = Math.PI * .88; controls.autoRotate = !reducedMotion; controls.autoRotateSpeed = .6;
    updateRotationButton();
    controls.addEventListener('start', () => { controls.autoRotate = false; updateRotationButton(); });
    const resize = new ResizeObserver(() => {
      const width = viewport.clientWidth, height = viewport.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    }); resize.observe(viewport);
    const clock = new THREE.Clock();
    function animate() {
      if (stopped || !visible || document.hidden) { frame = undefined; return; }
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), .05);
      if (rig) {
        if (playing) { demoTime = Math.min(SHOWCASE_CLIMB_DURATION, demoTime + delta); if (demoTime >= SHOWCASE_CLIMB_DURATION) playing = false; present(); }
        if (laserScanning) { scanTime += delta; presentLaser(delta); }
      }
      controls.update(delta); renderer.render(scene, camera);
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !frame) animate(); }); observer.observe(root);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !frame) animate(); });
    select.addEventListener('change', load);
    root.querySelector('[data-model-reset]').addEventListener('click', resetView);
    root.querySelector('[data-model-reset-pose]').addEventListener('click', resetPose);
    rotate.addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; updateRotationButton(); });
    scan.addEventListener('click', () => {
      laserScanning = !laserScanning;
      if (laserScanning) scanTime = Math.asin(THREE.MathUtils.clamp(Number(pan.value) * Math.PI / 180 / .9, -1, 1)) / .7;
      presentLaser();
    });
    [pan, tilt].forEach((input) => input.addEventListener('input', () => { laserScanning = false; presentLaser(); }));
    flipper.addEventListener('input', () => {
      if (!rig) return;
      playing = demonstration = false; demoTime = 0; present();
      status.textContent = 'The grounded tread end stays planted while ROB’s torso counter-leans above the upper wheel.';
    });
    climb.addEventListener('click', () => {
      if (!rig) return;
      if (!demonstration || demoTime >= SHOWCASE_CLIMB_DURATION) demoTime = 0;
      demonstration = true; playing = !playing; controls.autoRotate = false; updateRotationButton(); present();
    });
    progress.addEventListener('input', () => {
      if (!rig) return;
      playing = false; demonstration = true; demoTime = Number(progress.value); present();
    });
    renderer.domElement.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
      event.preventDefault(); controls.autoRotate = false; updateRotationButton();
      if (event.key === 'Home') { resetView(); return; }
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
      stopped = true; request += 1; cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); controls.dispose(); dispose(displayed); dispose(course); renderer.dispose();
    });
    resetView(); load(); animate();
  } catch {
    renderer?.dispose();
    root.querySelector('[data-model-controls]').hidden = true;
    status.textContent = 'ROB’s scan is shown above. Interactive 3D is unavailable in this browser.';
  }
});
