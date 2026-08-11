import * as THREE from 'three';

const root = document.querySelector('[data-rob-simulator]');
if (root) {
  const canvas = root.querySelector('[data-sim-canvas]');
  const viewport = root.querySelector('[data-sim-viewport]');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07111b);
  scene.fog = new THREE.Fog(0x07111b, 18, 34);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 60);
  const clock = new THREE.Clock();
  const controls = { left: 0, right: 0 };
  const touch = { left: 0, right: 0 };
  const keys = new Set();
  const obstacles = [];
  const cells = [];
  const room = { width: 22, depth: 16 };
  let running = false, complete = false, elapsed = 0, score = 0, gateDone = false, cellCount = 0;

  scene.add(new THREE.HemisphereLight(0xa5edff, 0x101820, 2.3));
  const light = new THREE.DirectionalLight(0xffffff, 3.4);
  light.position.set(5, 12, 7); light.castShadow = true; scene.add(light);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), new THREE.MeshStandardMaterial({ color: 0x172734, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(22, 22, 0x2ca4bb, 0x284452); grid.position.y = 0.01; scene.add(grid);

  const material = (color, emissive = 0) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 1.7 : 0, roughness: 0.55, metalness: 0.2 });
  const box = (x, z, w, d, h, color = 0x405363, collision = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    mesh.position.set(x, h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    if (collision) obstacles.push({ x, z, w: w / 2, d: d / 2 });
    return mesh;
  };
  box(0, -8, 22, .3, 2.2, 0x263746, false); box(0, 8, 22, .3, 2.2, 0x263746, false);
  box(-11, 0, .3, 16, 2.2, 0x263746, false); box(11, 0, .3, 16, 2.2, 0x263746, false);
  box(-3.2, -.8, 2.7, 1.3, 1.1); box(3.8, 1.6, 1.5, 3.2, 1.35); box(-1.3, 4.7, 3.1, 1.2, .85); box(6.6, -3.6, 1.2, 2.1, 1.6);

  const gate = new THREE.Group();
  [-1.45, 1.45].forEach((x) => { const p = new THREE.Mesh(new THREE.BoxGeometry(.18, 2.6, .18), material(0x18d9f3, 0x075b6a)); p.position.set(x, 1.3, 0); gate.add(p); });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.1, .18, .18), material(0x18d9f3, 0x075b6a)); lintel.position.y = 2.5; gate.add(lintel); gate.position.set(0, 0, -3.6); scene.add(gate);
  const dock = new THREE.Mesh(new THREE.BoxGeometry(3.2, .08, 2.6), material(0x2bdf8a, 0x09623e)); dock.position.set(7.8, .05, 5.7); scene.add(dock);
  [[-7.5, -4.8], [.8, 3.3], [7.5, -.8]].forEach(([x, z]) => {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .7, 14), material(0xffc83d, 0x805000));
    cell.rotation.z = Math.PI / 2; cell.position.set(x, .55, z); cell.castShadow = true; scene.add(cell); cells.push(cell);
  });

  const robot = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.25, .92, 1.3), material(0x222c36)); body.position.y = .72; body.castShadow = true; robot.add(body);
  [-.78, .78].forEach((x) => { const tread = new THREE.Mesh(new THREE.BoxGeometry(.38, .48, 1.8), material(0x080b0e)); tread.position.set(x, .38, 0); tread.castShadow = true; robot.add(tread); });
  [-.3, .3].forEach((x) => { const eye = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .08, 20), material(0x3bdcff, 0x1287a7)); eye.rotation.x = Math.PI / 2; eye.position.set(x, .82, -.69); robot.add(eye); });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, .75, 12), material(0x222c36)); mast.position.y = 1.52; robot.add(mast);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 18, 12), material(0x222c36)); head.position.y = 2; robot.add(head); scene.add(robot);

  const ui = {
    time: root.querySelector('[data-sim-time]'), score: root.querySelector('[data-sim-score]'), left: root.querySelector('[data-sim-left]'), right: root.querySelector('[data-sim-right]'),
    message: root.querySelector('[data-sim-message]'), start: root.querySelector('[data-sim-start]'), reset: root.querySelector('[data-sim-reset]'),
  };
  const objectives = Object.fromEntries([...root.querySelectorAll('[data-objective]')].map((item) => [item.dataset.objective, item]));
  const say = (text) => { ui.message.textContent = text; };
  const mark = (name, text, points) => { if (objectives[name].classList.contains('is-complete')) return; objectives[name].classList.add('is-complete'); score += points; say(text); };
  const reset = () => {
    robot.position.set(0, 0, 6.2); robot.rotation.set(0, 0, 0); running = false; complete = false; elapsed = 0; score = 0; gateDone = false; cellCount = 0;
    touch.left = 0; touch.right = 0;
    controls.left = 0; controls.right = 0; cells.forEach((cell) => { cell.visible = true; cell.userData.got = false; });
    Object.values(objectives).forEach((item) => item.classList.remove('is-complete')); ui.start.hidden = false; ui.start.textContent = 'Begin training'; say('Systems ready. Begin when you are ready.');
  };
  const collision = (p) => Math.abs(p.x) > 10.25 || Math.abs(p.z) > 7.25 || obstacles.some((o) => Math.abs(p.x - o.x) < o.w + .72 && Math.abs(p.z - o.z) < o.d + .72);
  const readInput = () => {
    controls.left = touch.left || ((keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0)); controls.right = touch.right || ((keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0));
    const pad = [...(navigator.getGamepads?.() || [])].find(Boolean);
    if (pad && (Math.abs(pad.axes[1] || 0) > .12 || Math.abs(pad.axes[3] || 0) > .12)) { controls.left = -(pad.axes[1] || 0); controls.right = -(pad.axes[3] || 0); }
  };
  const tick = (dt) => {
    readInput(); if (!running || complete) return; elapsed += dt;
    const old = robot.position.clone(), left = controls.left * 3.1, right = controls.right * 3.1, linear = (left + right) / 2, yaw = (left - right) / 1.55 * dt, mid = robot.rotation.y + yaw / 2;
    robot.position.x -= Math.sin(mid) * linear * dt; robot.position.z -= Math.cos(mid) * linear * dt; robot.rotation.y += yaw;
    if (collision(robot.position)) { robot.position.copy(old); score = Math.max(0, score - 1); say('Obstacle contact—reverse one tread and choose another path.'); }
    if (!gateDone && robot.position.distanceTo(gate.position) < 1.55) { gateDone = true; mark('gate', 'Calibration complete. Find the three gold energy cells.', 250); }
    cells.forEach((cell) => { if (!cell.userData.got && robot.position.distanceTo(cell.position) < 1) { cell.userData.got = true; cell.visible = false; cellCount += 1; score += 150; say(`Energy cell ${cellCount} of 3 secured.`); if (cellCount === 3) mark('cells', 'All cells secured. Dock in the green Mission Control bay.', 300); } });
    if (gateDone && cellCount === 3 && robot.position.distanceTo(dock.position) < 1.15) { mark('dock', 'Mission complete! ROB is charged and safely parked.', 500); complete = true; running = false; ui.start.hidden = false; ui.start.textContent = 'Train again'; }
  };
  const resize = () => { const w = viewport.clientWidth, h = Math.max(420, Math.min(720, w * .58)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const animate = () => { requestAnimationFrame(animate); const dt = Math.min(clock.getDelta(), .05); tick(dt); cells.forEach((c, i) => { if (c.visible) { c.rotation.y += dt * 1.4; c.position.y = .55 + Math.sin(elapsed * 2 + i) * .08; } }); camera.position.lerp(new THREE.Vector3(robot.position.x, 10.5, robot.position.z + 6.8), .05); camera.lookAt(robot.position.x, .5, robot.position.z - 1.2); ui.time.textContent = new Date(elapsed * 1000).toISOString().slice(14, 22); ui.score.textContent = score; ui.left.textContent = controls.left.toFixed(2); ui.right.textContent = controls.right.toFixed(2); renderer.render(scene, camera); };

  addEventListener('keydown', (e) => { if (['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(e.code)) { e.preventDefault(); keys.add(e.code); } }); addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
  root.querySelectorAll('[data-tread]').forEach((button) => { const side = button.dataset.tread, value = Number(button.dataset.demand); button.addEventListener('pointerdown', (e) => { e.preventDefault(); touch[side] = value; button.setPointerCapture?.(e.pointerId); }); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => button.addEventListener(name, () => { touch[side] = 0; })); });
  ui.start.addEventListener('click', () => { if (complete) reset(); running = true; ui.start.hidden = true; say('Drive through the cyan calibration gate.'); viewport.focus(); }); ui.reset.addEventListener('click', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); controls.left = 0; controls.right = 0; } }); new ResizeObserver(resize).observe(viewport); reset(); resize(); animate();
}
