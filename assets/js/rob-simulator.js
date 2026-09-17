import * as THREE from 'three';
import { createRocketFlight, stepRocketFlight, ROCKET_ENERGY_PER_SECOND } from './rob-rocket-flight.mjs';
import { loadCapturedROB } from './rob-captured-model.mjs';
import { buildROBVisual } from './rob-visual-model.mjs';
import { meleeDuration, meleePose } from './rob-melee-animation.mjs';
import { createROBSupportMotion, stepROBSupportMotion, advanceTorsoLean, robTorsoPresentation } from './rob-support-motion.mjs';
import {
  BASE_DRIVE_SPEED,
  BASE_TURN_SPEED,
  BASE_FLIPPER_ENERGY_COST,
  BASE_FLIPPER_REAR_ANGLE,
  BASE_FLIPPER_FORWARD_ANGLE,
  BASE_FLIPPER_REAR_ASSIST_ANGLE,
  BASE_FLIPPER_MOTOR_SPEED,
  ROB_CONTACT_SPAN,
  flipperGroundPitch,
  ledgeClimbProgress,
  MAX_ROB_HEALTH,
  MAX_ROB_SHIELDS,
  SHIELD_ACTIVATION_DURATION,
  stepBubbleShield,
  MAX_TRIAL_LIVES,
  FLIPPER_HACK_DURATION,
  FLIPPER_HACK_REWARD,
  SECURITY_CAMERA_HALF_ANGLE,
  applyROBDamage,
  advanceBaseFlipper,
  battleScore,
  enemyContactDamage,
  enemySkillReward,
  levelSkillReward,
  skillPointBalance,
  saberDamage,
  upgradeRequiredCompletedLevel,
  baseFlipperPresentation,
  bossStats,
  cameraHeading,
  circularBodiesOverlap,
  consumeLaserEnergy,
  consumeTrialLife,
  conveyorArrowOffset,
  conveyorDisplacement,
  driveSpeedMultiplier,
  energyPickupAmount,
  faceColors,
  finishes,
  firstProjectileImpact,
  isUnlocked,
  laserEnergyCost,
  laserAimHeading,
  targetingComputerStats,
  meleeAnimationIsClear,
  meleeWeapons,
  maximumEnergy,
  maximumLaserLocks,
  rangedWeapons,
  repairROBHealth,
  replenishROBShields,
  resolveAxisSlidingMotion,
  resolveWallTurn,
  securityCameraSees,
  securityCameraVisionDistances,
  securityMiniBossStats,
  unlockReward,
  updateDriveEnergy,
  upgradeCost,
  upgradedWeaponDamage,
  upgrades,
  weaponDamage,
} from './rob-game-rules.mjs';
import {
  droidHousingMaterials,
  readDroidProfile,
  sanitizeDroidProfile,
  writeDroidProfile,
} from './rob-droid-profile.mjs';
import { KEY_BEACON_HEIGHT, ARENA_HALF_WIDTH, ARENA_HALF_DEPTH, createCampaignLevels } from './rob-simulator-levels.mjs';
import { shooterTurretYaw, shooterWheelAngle, spiderLegPose } from './rob-enemy-animation.mjs';

const root = document.querySelector('[data-rob-simulator]');
if (root) {
  const canvas = root.querySelector('[data-sim-canvas]');
  const viewport = root.querySelector('[data-sim-viewport]');
  const shell = root.querySelector('[data-sim-shell]');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07111b); scene.fog = new THREE.Fog(0x07111b, 28, 52);
  const camera = new THREE.PerspectiveCamera(55, 1, .1, 90); const clock = new THREE.Clock();
  const controls = { left: 0, right: 0 }, touch = { forward: 0, steering: 0, left: 0, right: 0, leftActive: false, rightActive: false }; const keys = new Set(), activeDrivePointers = new Map(), activeTreadPointers = new Map();
  const obstacles = [], cells = [], shieldPickups = [], repairPickups = [], bolts = [], enemyBolts = [], enemies = [], levelParts = [], conveyors = [], securityCameras = [], shadowZones = [];
  const levels = createCampaignLevels();
  const ROBOT_HALF_WIDTH = .95, ROBOT_HALF_LENGTH = 1.08, ARENA_CLEARANCE = .18;
  const LEDGE = { x: 0, z: -12.1, w: 15.82, d: 7.9, height: .62, approachEdgeZ: -4.2 };
  const pointOnLedge = (point) => Math.abs(point.x - LEDGE.x) <= LEDGE.w && Math.abs(point.z - LEDGE.z) <= LEDGE.d;
  const platformAt = (point) => levels[levelIndex]?.platforms.find((p) => Math.abs(point.x - p.x) <= p.w && Math.abs(point.z - p.z) <= p.d);
  const surfaceHeight = (point) => platformAt(point)?.height ?? (pointOnLedge(point) ? LEDGE.height : 0);
  const readProgress = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  const saveProgress = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };
  let running = false, complete = false, levelComplete = false, elapsed = 0, levelElapsed = 0, score = 0, gateDone = false, cellCount = 0, lastShot = -Infinity, levelIndex = 0, hasKey = false, doorOpen = true, hacking = false, hackingCamera, hackingProgress = 0, securityAlertRemaining = 0, securityMiniBossReleased = false, laserLock, secondaryLaserLock, laserChargeStarted, saberCombo = 0, lastSaberAttack = -Infinity, saberAnimation, gamepadLaserHeld = false, baseFlipperAngle = BASE_FLIPPER_REAR_ANGLE, baseFlipperTarget = 'rear';
  let health = MAX_ROB_HEALTH, shields = MAX_ROB_SHIELDS, lives = MAX_TRIAL_LIVES, damageInvulnerableUntil = -Infinity, highestCompletedLevel = Math.max(0, Math.min(levels.length, Number(readProgress('robHighestCompletedLevel', 0)) || 0));
  const savedSkillPoints = readProgress('robSkillPoints', null), legacyPoints = Number(readProgress('robUpgradePoints', 0)) || 0;
  let upgradePoints = skillPointBalance(savedSkillPoints, legacyPoints);
  if (savedSkillPoints === null) saveProgress('robSkillPoints', upgradePoints);
  const economyMigrationMessage = savedSkillPoints === null && legacyPoints > 0 ? `Balance update: ${legacyPoints} old points converted to ${upgradePoints} skill points. Earn more by defeating robots and clearing levels.` : undefined;
  const upgradeLevels = Object.fromEntries(upgrades.map((upgrade) => [upgrade.id, Math.max(0, Math.min(upgrade.maximumLevel, Number(readProgress(`rob${upgrade.id}Level`, 0)) || 0))]));
  let energy = maximumEnergy(upgradeLevels.energyCapacity);
  let shieldTimeRemaining = 0, gamepadShieldHeld = false;
  let rocketFlight = createRocketFlight(), rocketHeld = false, gamepadRocketHeld = false;
  let climbingLedge = false;
  let supportMotion = createROBSupportMotion(), torsoLeanAngle = 0;
  const climbProgress = (point = robot.position) => ledgeClimbProgress({ z: point.z, heading: robot.rotation.y, approachEdgeZ: LEDGE.approachEdgeZ, scale: 2.15 });
  const robotBasePose = () => {
    const pose = baseFlipperPresentation({ angle: baseFlipperAngle, target: baseFlipperTarget, onLedge: pointOnLedge(robot.position), climbProgress: climbingLedge ? climbProgress() : undefined, stepHeight: LEDGE.height, supportHeight: robot.position.y, scale: 2.15 });
    if (rocketFlight.airborne) return { ...pose, pitch: 0, lift: robot.position.y };
    return !climbingLedge && supportMotion.phase !== 'grounded' ? { ...pose, pitch: supportMotion.pitch, lift: robot.position.y } : pose;
  };
  let droidProfile = readDroidProfile();
  let selectedFinishID = droidProfile.finish, selectedFaceColorID = droidProfile.faceColor, selectedRangedID = readProgress('robRangedWeapon', 'shoulderGatling'), selectedMeleeID = readProgress('robMeleeWeapon', 'dualSabers');
  const selectedFinish = () => finishes.find(({ id }) => id === selectedFinishID) || finishes[0];
  const selectedFaceColor = () => faceColors.find(({ id }) => id === selectedFaceColorID) || faceColors[0];
  const selectedRanged = () => rangedWeapons.find((weapon) => weapon.id === selectedRangedID && isUnlocked(weapon, highestCompletedLevel)) || rangedWeapons[0];
  const targetingComputer = () => targetingComputerStats(upgradeLevels.targetingComputer);
  const selectedMelee = () => meleeWeapons.find((weapon) => weapon.id === selectedMeleeID && isUnlocked(weapon, highestCompletedLevel)) || meleeWeapons[0];
  const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  root.classList.toggle('is-touch', isTouch);
  let soundEnabled = true;
  const sounds = Object.fromEntries(['mission-start', 'laser', 'pickup', 'level-complete'].map((name) => [name, new Audio(`${root.dataset.audioBase}${name}.m4a`)]));
  const playSound = (name) => { if (!soundEnabled) return; const sound = sounds[name]; sound.currentTime = 0; sound.play().catch(() => {}); };
  let musicEnabled = true, audioContext, musicTimer, musicStep = 0, lastDalekSpeech = -Infinity;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const ensureAudioContext = () => { if (!AudioContextClass) return undefined; audioContext ||= new AudioContextClass(); audioContext.resume().catch(() => {}); return audioContext; };
  const technoNotes = [36, 36, 43, 36, 39, 36, 46, 43, 36, 48, 43, 39, 36, 43, 46, 34];
  const tone = (frequency, start, duration, type, volume, cutoff = 1800) => { const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), filter = audioContext.createBiquadFilter(); oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); filter.type = 'lowpass'; filter.frequency.setValueAtTime(cutoff, start); gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.0001, start + duration); oscillator.connect(filter).connect(gain).connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + duration); };
  const noiseHit = (start, duration, volume, highpass) => { const frames = Math.ceil(audioContext.sampleRate * duration), buffer = audioContext.createBuffer(1, frames, audioContext.sampleRate), data = buffer.getChannelData(0); for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1; const source = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain(); source.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = highpass; gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.0001, start + duration); source.connect(filter).connect(gain).connect(audioContext.destination); source.start(start); };
  const scheduleTechno = () => { if (!audioContext || !musicEnabled) return; const now = audioContext.currentTime + .03, beat = .125, intensity = 1 + levelIndex * .025; for (let i = 0; i < 8; i += 1) { const step = musicStep + i, at = now + i * beat, midi = technoNotes[step % technoNotes.length]; if (step % 4 === 0) { tone(58, at, .16, 'sine', .13, 180); tone(95, at, .08, 'triangle', .07, 260); } if (step % 4 === 2) noiseHit(at, .08, .035, 1200); noiseHit(at, .025, step % 2 ? .018 : .028, 6500); tone(440 * 2 ** ((midi - 69) / 12), at, .105, 'sawtooth', .035 * intensity, 720 + levelIndex * 90); if (step % 8 === 6) tone(440 * 2 ** ((midi + 12 - 69) / 12), at, .07, 'square', .015, 2200); } musicStep += 8; };
  const playSpiderSound = (cue = 'lunge') => {
    if (!soundEnabled) return; const context = ensureAudioContext(); if (!context) return; const now = context.currentTime + .01;
    if (cue === 'skitter') { [0, .035, .075, .12, .17, .225].forEach((offset, i) => { noiseHit(now + offset, .018, .014 + (i % 2) * .006, 4200 + i * 380); tone(1720 + (i % 3) * 310, now + offset, .026, 'square', .01, 6400); }); return; }
    if (cue === 'impact') { noiseHit(now, .16, .065, 650); [520, 390, 270].forEach((frequency, i) => tone(frequency, now + i * .055, .11, 'sawtooth', .035, 1200)); return; }
    if (cue === 'shutdown') { noiseHit(now, .38, .048, 1100); [1180, 910, 640, 370].forEach((frequency, i) => tone(frequency, now + i * .085, .14, i % 2 ? 'square' : 'sawtooth', .03, 2600)); return; }
    [0, .05, .105, .17, .245].forEach((offset, i) => { noiseHit(now + offset, .04, .026 + i * .004, 3000 + i * 620); tone(980 + i * 310, now + offset, .055, i % 2 ? 'square' : 'sawtooth', .02, 5600); });
  };
  const playDalekSentry = () => { if (!soundEnabled) return; const context = ensureAudioContext(); if (!context) return; const now = context.currentTime + .01; [720, 1280, 860, 1640, 620].forEach((frequency, i) => tone(frequency, now + i * .055, .09, i % 2 ? 'square' : 'sawtooth', .035, 2600)); noiseHit(now, .32, .026, 900); };
  const playLaserShot = (charge) => { if (!soundEnabled) return; if (charge < .12) { playSound('laser'); return; } const context = ensureAudioContext(); if (!context) return; const now = context.currentTime + .01, pitch = 310 - charge * 190, duration = .16 + charge * .34; tone(pitch, now, duration, 'sawtooth', .08 + charge * .08, 950 - charge * 420); tone(pitch * .49, now, duration * 1.08, 'sine', .09 + charge * .09, 620); noiseHit(now, .08 + charge * .08, .04 + charge * .045, 180 + charge * 120); };
  const speakDalek = () => { if (!soundEnabled || !('speechSynthesis' in window) || elapsed - lastDalekSpeech < 3.2) return; lastDalekSpeech = elapsed; window.speechSynthesis.cancel(); const warning = new SpeechSynthesisUtterance('Exterminate!'); warning.rate = .72; warning.pitch = .28; warning.volume = .78; const voice = window.speechSynthesis.getVoices().find((candidate) => /^en[-_]/i.test(candidate.lang)); if (voice) warning.voice = voice; window.speechSynthesis.speak(warning); };
  const startMusic = () => { if (!musicEnabled || !ensureAudioContext()) return; if (!musicTimer) { scheduleTechno(); musicTimer = setInterval(scheduleTechno, 1000); } };
  const stopMusic = () => { clearInterval(musicTimer); musicTimer = undefined; };

  scene.add(new THREE.HemisphereLight(0xa5edff, 0x101820, 2.5)); const sun = new THREE.DirectionalLight(0xffffff, 3.5); sun.position.set(5, 12, 7); sun.castShadow = true; scene.add(sun);
  const mat = (color, emissive = 0, metalness = .25) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 1.8 : 0, roughness: .5, metalness });
  const mesh = (geometry, material, parent, x = 0, y = 0, z = 0) => { const part = new THREE.Mesh(geometry, material); part.position.set(x, y, z); part.castShadow = true; part.receiveShadow = true; parent.add(part); return part; };
  // Dense rays keep the red edge tight to corners while the camera sweeps.
  const SECURITY_CAMERA_VISION_RAYS = 49;
  const SECURITY_CAMERA_HACK_RANGE = 2.4;
  const makeSecurityCameraBeam = (cameraData, parent) => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((SECURITY_CAMERA_VISION_RAYS + 1) * 3);
    const indices = [];
    for (let index = 0; index < SECURITY_CAMERA_VISION_RAYS; index += 1) {
      const angle = -SECURITY_CAMERA_HALF_ANGLE + (SECURITY_CAMERA_HALF_ANGLE * 2 * index) / (SECURITY_CAMERA_VISION_RAYS - 1);
      positions[(index + 1) * 3] = -Math.sin(angle) * cameraData.range;
      positions[(index + 1) * 3 + 2] = -Math.cos(angle) * cameraData.range;
      if (index < SECURITY_CAMERA_VISION_RAYS - 1) indices.push(0, index + 1, index + 2);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({ color: 0xff203c, transparent: true, opacity: .1, depthWrite: false, side: THREE.DoubleSide });
    const beam = mesh(geometry, material, parent, 0, .04, 0);
    beam.castShadow = false; beam.receiveShadow = false; beam.renderOrder = 2;
    return beam;
  };
  const updateSecurityCameraBeam = (cameraData, heading, blockers) => {
    const distances = securityCameraVisionDistances({ camera: cameraData, heading, blockers, rayCount: SECURITY_CAMERA_VISION_RAYS });
    const positions = cameraData.beam.geometry.getAttribute('position');
    distances.forEach((distance, index) => {
      const angle = -SECURITY_CAMERA_HALF_ANGLE + (SECURITY_CAMERA_HALF_ANGLE * 2 * index) / (distances.length - 1);
      positions.setXYZ(index + 1, -Math.sin(angle) * distance, 0, -Math.cos(angle) * distance);
    });
    positions.needsUpdate = true;
  };
  const floor = mesh(new THREE.PlaneGeometry(ARENA_HALF_WIDTH * 2, ARENA_HALF_DEPTH * 2), mat(0x172734), scene); floor.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(ARENA_HALF_WIDTH * 2, 32, 0x2ca4bb, 0x284452); grid.position.y = .01; grid.scale.z = ARENA_HALF_DEPTH / ARENA_HALF_WIDTH; scene.add(grid);
  const box = (x, z, w, d, h, color = 0x405363, collision = true, dynamic = false) => { const b = mesh(new THREE.BoxGeometry(w, h, d), mat(color), scene, x, (dynamic ? surfaceHeight({ x, z }) : 0) + h / 2, z); if (collision) obstacles.push({ x, z, w: w / 2, d: d / 2 }); if (dynamic) levelParts.push(b); return b; };
  box(0, -ARENA_HALF_DEPTH, ARENA_HALF_WIDTH * 2, .3, 2.2, 0x263746, false); box(0, ARENA_HALF_DEPTH, ARENA_HALF_WIDTH * 2, .3, 2.2, 0x263746, false); box(-ARENA_HALF_WIDTH, 0, .3, ARENA_HALF_DEPTH * 2, 2.2, 0x263746, false); box(ARENA_HALF_WIDTH, 0, .3, ARENA_HALF_DEPTH * 2, 2.2, 0x263746, false);
  mesh(new THREE.BoxGeometry(LEDGE.w * 2, LEDGE.height, LEDGE.d * 2), mat(0x344552), scene, LEDGE.x, LEDGE.height / 2, LEDGE.z).name = 'Ledge Platform';
  mesh(new THREE.BoxGeometry(LEDGE.w * 2, .055, LEDGE.d * 2), mat(0x172734), scene, LEDGE.x, LEDGE.height + .0275, LEDGE.z).name = 'Ledge Deck';
  mesh(new THREE.BoxGeometry(LEDGE.w * 2, .1, .16), mat(0xff8b2f, 0x652504), scene, LEDGE.x, LEDGE.height + .07, LEDGE.approachEdgeZ).name = 'Ledge Lip';

  const gate = new THREE.Group(); [-1.45, 1.45].forEach((x) => mesh(new THREE.BoxGeometry(.18, 2.6, .18), mat(0x18d9f3, 0x075b6a), gate, x, 1.3)); mesh(new THREE.BoxGeometry(3.1, .18, .18), mat(0x18d9f3, 0x075b6a), gate, 0, 2.5); gate.position.set(0, 0, -3.6); scene.add(gate);
  const dock = mesh(new THREE.BoxGeometry(3.2, .08, 2.6), mat(0x2bdf8a, 0x09623e), scene, 7.8, .05, 5.7);
  const keyObject = new THREE.Group(); keyObject.name = 'Access Key Beacon';
  const keyMaterial = mat(0xffe04a, 0xc77d00, .72);
  mesh(new THREE.TorusGeometry(.34, .1, 12, 28), keyMaterial, keyObject, 0, .68);
  mesh(new THREE.BoxGeometry(1.05, .16, .16), keyMaterial, keyObject, .6, .68);
  mesh(new THREE.BoxGeometry(.16, .34, .16), keyMaterial, keyObject, .98, .53);
  const keyHalo = mesh(new THREE.TorusGeometry(.72, .055, 10, 36), keyMaterial, keyObject, 0, .14); keyHalo.rotation.x = Math.PI / 2;
  const keyBeaconMaterial = new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: .55, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const keyBeacon = mesh(new THREE.CylinderGeometry(.09, .3, KEY_BEACON_HEIGHT, 16, 1, true), keyBeaconMaterial, keyObject, 0, KEY_BEACON_HEIGHT / 2 + .08); keyBeacon.name = 'Access Key Visibility Line'; keyBeacon.renderOrder = 30; keyBeacon.frustumCulled = false;
  const keyBeaconTip = mesh(new THREE.SphereGeometry(.18, 14, 10), keyBeaconMaterial, keyObject, 0, KEY_BEACON_HEIGHT + .08); keyBeaconTip.name = 'Access Key Beacon Tip'; keyBeaconTip.renderOrder = 30; keyBeaconTip.frustumCulled = false;
  scene.add(keyObject);
  const doorObject = mesh(new THREE.BoxGeometry(4, 1.8, .35), mat(0xd14c42, 0x5c1714), scene); doorObject.position.y = .9;
  const hackTerminal = new THREE.Group(); mesh(new THREE.BoxGeometry(.28, 1.05, .28), mat(0x434b52), hackTerminal, 0, .525); mesh(new THREE.BoxGeometry(.62, .48, .22), mat(0xf2872f, 0x5e2208), hackTerminal, 0, 1.08); const hackTerminalLamp = mesh(new THREE.SphereGeometry(.11, 12, 8), mat(0xff3030, 0x8b0505), hackTerminal, 0, 1.08, -.15); scene.add(hackTerminal);
  for (let i = 0; i < Math.max(...levels.map((level) => level.cells.length)); i += 1) { const c = mesh(new THREE.CylinderGeometry(.24, .24, .7, 14), mat(0xffc83d, 0x805000), scene); c.rotation.z = Math.PI / 2; cells.push(c); }
  for (let i = 0; i < Math.max(...levels.map((level) => level.shieldPickups.length)); i += 1) {
    const pickup = new THREE.Group(), core = mesh(new THREE.IcosahedronGeometry(.34, 1), mat(0x55eaff, 0x087995), pickup, 0, .45);
    const halo = mesh(new THREE.TorusGeometry(.48, .065, 10, 28), mat(0x3f78ff, 0x17399b), pickup, 0, .45); halo.rotation.x = Math.PI / 2; core.rotation.z = .35;
    scene.add(pickup); shieldPickups.push(pickup);
  }
  for (let i = 0; i < Math.max(...levels.map((level) => level.repairPickups.length)); i += 1) {
    const pickup = new THREE.Group(); mesh(new THREE.BoxGeometry(.62, .45, .48), mat(0xd93149, 0x6d0717), pickup, 0, .36);
    mesh(new THREE.BoxGeometry(.34, .09, .025), mat(0xffffff, 0x555555), pickup, 0, .36, -.255);
    mesh(new THREE.BoxGeometry(.09, .34, .025), mat(0xffffff, 0x555555), pickup, 0, .36, -.255);
    scene.add(pickup); repairPickups.push(pickup);
  }

  const armAssemblies = [], robotRig = { treadWheels: [], finishMaterials: [], faceMaterials: [], sabers: [], speakerCones: [] };
  const buildROB = () => {
    const visual = buildROBVisual({ scale: 2.15, finish: selectedFinish().color, faceColor: selectedFaceColor().color });
    loadCapturedROB(visual, root.dataset.modelBase, 2.15).then(() => {
      const material = visual.captureMaterial; material.color.setHex(selectedFinishID === 'graphite' ? 0xffffff : selectedFinish().color);
      robotRig.finishMaterials.push(material);
    }).catch(() => {});
    const r = visual.root, torso = visual.torso;
    const dark = mat(0x111820), steel = visual.materials.aluminum, cyan = mat(0x38dfff, 0x087995), green = mat(0x4cff76, 0x168c32);
    Object.assign(robotRig, { driveBase: visual.driveBase, baseFlipper: visual.baseFlipper, torso,
      treadWheels: visual.treadWheels, speakerCones: visual.speakerCones });
    robotRig.finishMaterials.push(visual.materials.body); robotRig.faceMaterials.push(visual.materials.face);
    robotRig.baseFlipper.rotation.x = BASE_FLIPPER_REAR_ANGLE;
    armAssemblies.push(...visual.arms);
    visual.arms.forEach((arm) => {
      const side = arm.userData.side;
      const grip = mesh(new THREE.CylinderGeometry(.035, .035, .20, 12), dark, arm, side * .18, -1.22, -.08); grip.rotation.x = Math.PI / 2;
      const saber = mesh(new THREE.CylinderGeometry(.035, .035, 1.55, 10), side < 0 ? green : cyan, arm, side * .18, -1.22, -.94);
      saber.rotation.x = Math.PI / 2; saber.visible = selectedMeleeID === 'dualSabers'; robotRig.sabers.push(saber);
    });
    const hacker = mesh(new THREE.BoxGeometry(.16, .25, .06), mat(0xf2872f), torso, .39, 1.54, -.19); hacker.name = 'Flipper Zero Hacker';
    mesh(new THREE.BoxGeometry(.11, .075, .018), mat(0x35c56e), torso, .39, 1.57, -.229);
    const gatling = r.getObjectByName('Right Shoulder Gatling'); robotRig.gatling = gatling;
    robotRig.gatlingTilt = r.getObjectByName('Gatling Tilt Servo');
    const laserMuzzle = r.getObjectByName('Shoulder Laser Muzzle'); robotRig.laserMuzzle = laserMuzzle;
    const lockLamp = mesh(new THREE.SphereGeometry(.026, 12, 8), mat(0xff182f, 0xff0018, .5), laserMuzzle); lockLamp.visible = false; robotRig.lockLamp = lockLamp;
    const blueEmitter = mesh(new THREE.SphereGeometry(.019, 12, 8), mat(0x38a8ff, 0x1578ff, .2), laserMuzzle, 0, -.039, 0); blueEmitter.name = 'Virtual Blue Balloon Beam Emitter';
    const targetBeam = mesh(new THREE.CylinderGeometry(.006, .006, 3, 6), new THREE.MeshBasicMaterial({ color: 0xff1838, transparent: true, opacity: .32, depthWrite: false }), laserMuzzle, 0, 0, -1.5); targetBeam.rotation.x = Math.PI / 2; targetBeam.visible = false; robotRig.targetBeam = targetBeam;
    const twinBlasters = new THREE.Group(); twinBlasters.name = 'Twin Blasters'; torso.add(twinBlasters); robotRig.twinBlasters = twinBlasters; robotRig.twinBlasterMounts = [];
    [-.54, .54].forEach((x, index) => { const mount = new THREE.Group(); mount.name = index ? 'Right Blaster Mount' : 'Left Blaster Mount'; mount.position.set(x, 1.25, 0); twinBlasters.add(mount); robotRig.twinBlasterMounts.push(mount); mesh(new THREE.BoxGeometry(.18, .16, .45), dark, mount, 0, 0, -.42); const barrel = mesh(new THREE.CylinderGeometry(.035, .045, .58, 10), cyan, mount, 0, 0, -.78); barrel.rotation.x = Math.PI / 2; });
    const arcCannon = new THREE.Group(); arcCannon.name = 'Arc Cannon'; arcCannon.position.set(.68, 1.65, -.1); torso.add(arcCannon); robotRig.arcCannon = arcCannon;
    mesh(new THREE.BoxGeometry(.46, .38, .62), dark, arcCannon, 0, 0, -.12); const arcBarrel = mesh(new THREE.CylinderGeometry(.09, .15, .92, 12), mat(0x8c63ff, 0x3b1ca8), arcCannon, 0, 0, -.68); arcBarrel.rotation.x = Math.PI / 2;
    const hammer = new THREE.Group(); hammer.name = 'Power Hammer'; hammer.position.set(.82, .5, -.68); torso.add(hammer); robotRig.hammer = hammer; const hammerHandle = mesh(new THREE.CylinderGeometry(.045, .055, 1.15, 10), steel, hammer); hammerHandle.rotation.z = -.28; mesh(new THREE.BoxGeometry(.65, .28, .28), mat(0xf1a43c, 0x5b2c05), hammer, .16, .5, 0);
    const shieldField = mesh(new THREE.SphereGeometry(1.72, 24, 16), new THREE.MeshBasicMaterial({ color: 0x56eaff, transparent: true, opacity: .13, wireframe: true, depthWrite: false }), r, 0, 1.35);
    shieldField.scale.y = .9; shieldField.castShadow = false; shieldField.receiveShadow = false; robotRig.shieldField = shieldField;
    const boosters = new THREE.Group(); boosters.name = 'Plasma Booster'; r.add(boosters);
    const jets = [];
    [-1, 1].forEach((side) => {
      mesh(new THREE.CylinderGeometry(.16, .2, .65, 16), steel, boosters, side * .62, 1.05, .58);
      mesh(new THREE.TorusGeometry(.17, .04, 8, 20), cyan, boosters, side * .62, .73, .58).rotation.x = Math.PI / 2;
      const jet = new THREE.Group(); jet.position.set(side * .62, .7, .58); boosters.add(jet);
      const plasma = mesh(new THREE.ConeGeometry(.19, 1.0, 16), new THREE.MeshBasicMaterial({ color: 0x167bff, transparent: true, opacity: .65, depthWrite: false, blending: THREE.AdditiveBlending }), jet, 0, -.5);
      plasma.rotation.z = Math.PI;
      mesh(new THREE.ConeGeometry(.095, .78, 12), new THREE.MeshBasicMaterial({ color: 0xc4f5ff, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending }), jet, 0, -.34).rotation.z = Math.PI;
      jet.add(new THREE.PointLight(0x168bff, 2.4, 4)); jets.push(jet);
    });
    Object.assign(robotRig, { boosters, jets });
    return r;
  };
  const robot = buildROB(); scene.add(robot);

  const hackPositionForLevel = (level) => {
    if (!level.door) return undefined;
    const [x, z, width, depth] = level.door;
    return width > depth ? [x, z + 2] : [x - 2, z];
  };
  const buildEnvironmentalFeatures = (index) => {
    conveyors.length = 0; securityCameras.length = 0; shadowZones.length = 0;
    if (index >= 1) {
      const dx = (index + 1) % 2 === 0 ? 1 : 0, dz = dx ? 0 : -1, horizontal = Boolean(dx), center = { x: horizontal ? -4.2 : 4.2, z: (index + 1) % 3 === 0 ? -2.6 : 2.8 }, width = horizontal ? 5.4 : 2.4, depth = horizontal ? 2.4 : 5.4;
      const conveyor = { id: 0, x: center.x, z: center.z, w: width / 2, d: depth / 2, dx, dz, speed: Math.min(1.45, .62 + (index + 1) * .055) }; conveyors.push(conveyor);
      const group = new THREE.Group(); group.position.set(center.x, surfaceHeight(center) + .03, center.z);
      mesh(new THREE.BoxGeometry(width, .08, depth), mat(0x555d64, 0, .6), group);
      const span = horizontal ? width : depth, arrows = [];
      for (let arrow = -3; arrow <= 3; arrow += 1) [-1, 1].forEach((side) => {
        const baseOffset = arrow * span / 7;
        const stripe = mesh(new THREE.BoxGeometry(.92, .035, .16), mat(arrow % 2 ? 0xf6c633 : 0xb9bec2, arrow % 2 ? 0x4b3500 : 0), group, horizontal ? baseOffset : side * .3, .07, horizontal ? side * .3 : baseOffset);
        stripe.rotation.y = (horizontal ? 0 : Math.PI / 2) + side * .62;
        arrows.push({ stripe, side, baseOffset });
      });
      Object.assign(conveyor, { group, arrows, horizontal, span });
      scene.add(group); levelParts.push(group);
    }
    if (index < 2) return;
    const cameraX = (index + 1) % 2 === 0 ? -13.2 : 13.2, cameraZ = -2.2, target = { x: 0, z: 1.2 }, heading = Math.atan2(-(target.x - cameraX), -(target.z - cameraZ));
    const cameraData = { id: 0, x: cameraX, z: cameraZ, heading, sweep: .7, range: 14.5, disabled: false };
    const cameraGroup = new THREE.Group(); cameraGroup.position.set(cameraX, surfaceHeight({ x: cameraX, z: cameraZ }), cameraZ); cameraGroup.rotation.y = heading;
    mesh(new THREE.CylinderGeometry(.09, .11, 2.2, 10), mat(0x3f484e), cameraGroup, 0, 1.1); mesh(new THREE.BoxGeometry(.7, .45, .9), mat(0xb4bbc0, 0, .7), cameraGroup, 0, 2.05, -.3); const lens = mesh(new THREE.SphereGeometry(.14, 12, 8), mat(0xff243f, 0xa60018), cameraGroup, 0, 2.05, -.82);
    cameraData.group = cameraGroup; cameraData.lens = lens; cameraData.beam = makeSecurityCameraBeam(cameraData, cameraGroup); securityCameras.push(cameraData); scene.add(cameraGroup); levelParts.push(cameraGroup);
    const shadow = { x: -cameraX * .36, z: 5.3, w: 2.4, d: 1.4 }; shadowZones.push(shadow); const shadowFloor = mesh(new THREE.BoxGeometry(shadow.w * 2, .045, shadow.d * 2), new THREE.MeshStandardMaterial({ color: 0x05070c, transparent: true, opacity: .9 }), scene, shadow.x, surfaceHeight(shadow) + .025, shadow.z); levelParts.push(shadowFloor);
  };

  const buildSpider = () => {
    const g = new THREE.Group(), bone = mat(0xe6dcb9), steel = mat(0x697178, 0, .7);
    mesh(new THREE.BoxGeometry(1.5, .45, 1.25), steel, g, 0, .72);
    const skull = mesh(new THREE.DodecahedronGeometry(.52, 0), bone, g, 0, 1.16, -.45); skull.scale.z = 1.25;
    g.userData.legJoints = [];
    [-1, 1].forEach((side) => {
      [-.48, -.16, .16, .48].forEach((z, legIndex) => {
        const hip = new THREE.Group(); hip.name = `Spider ${side < 0 ? 'Left' : 'Right'} Leg ${legIndex + 1} Hip`; hip.position.set(side * .48, .67, z); g.add(hip);
        mesh(new THREE.BoxGeometry(.82, .13, .16), steel, hip, side * .4, 0);
        const knee = new THREE.Group(); knee.name = `Spider ${side < 0 ? 'Left' : 'Right'} Leg ${legIndex + 1} Knee`; knee.position.set(side * .8, 0, 0); hip.add(knee);
        mesh(new THREE.BoxGeometry(.17, .72, .18), bone, knee, side * .12, -.32);
        g.userData.legJoints.push({ hip, knee, side, legIndex });
      });
    });
    return g;
  };
  const buildDalek = () => {
    const g = new THREE.Group(), silver = mat(0xaeb9c4, 0, .75), blue = mat(0x279de0, 0x063b61), tire = mat(0x050608, 0, .78), hub = mat(0xffb13b, 0xff5a00, .7);
    mesh(new THREE.CylinderGeometry(.6, .76, 1.55, 8), silver, g, 0, .82);
    for (let y = .35; y < 1.25; y += .3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) mesh(new THREE.SphereGeometry(.11, 10, 8), blue, g, Math.sin(a) * (.63 - y * .06), y, Math.cos(a) * (.63 - y * .06));
    g.userData.driveWheels = [];
    [-1, 1].forEach((side) => {
      [-.46, 0, .46].forEach((z, index) => {
        const wheel = new THREE.Group(); wheel.name = `Shooter ${side < 0 ? 'Left' : 'Right'} Wheel ${index + 1}`; wheel.position.set(side * .84, .34, z); g.add(wheel);
        const rubber = mesh(new THREE.CylinderGeometry(.27, .27, .2, 18), tire, wheel); rubber.rotation.z = Math.PI / 2;
        const wheelHub = mesh(new THREE.CylinderGeometry(.16, .16, .23, 14), hub, wheel); wheelHub.rotation.z = Math.PI / 2;
        mesh(new THREE.BoxGeometry(.045, .4, .055), hub, wheel, side * .13);
        g.userData.driveWheels.push(wheel);
      });
    });
    const turret = new THREE.Group(); turret.name = 'Shooter Turret Assembly'; g.add(turret); g.userData.turret = turret;
    mesh(new THREE.CylinderGeometry(.65, .65, .5, 16), mat(0x242b31), turret, 0, 1.75);
    mesh(new THREE.SphereGeometry(.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), silver, turret, 0, 2);
    const eye = mesh(new THREE.CylinderGeometry(.055, .085, .9, 10), silver, turret, 0, 2.2, -.63); eye.rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(.12, 10, 8), blue, turret, 0, 2.2, -1.08);
    [-1, 1].forEach((side) => { const arm = mesh(new THREE.CylinderGeometry(.035, .05, 1, 8), silver, turret, side * .48, 1.6, -.65); arm.rotation.x = Math.PI / 2; });
    return g;
  };
  for (let i = 0; i < 8; i += 1) { const spider = buildSpider(); spider.userData.type = 'spider'; scene.add(spider); enemies.push(spider); const dalek = buildDalek(); dalek.userData.type = 'dalek'; scene.add(dalek); enemies.push(dalek); }

  const ui = { rocketButtons: [...root.querySelectorAll('[data-sim-rocket]')], shieldButtons: [...root.querySelectorAll('[data-sim-shield]')], time: root.querySelector('[data-sim-time]'), score: root.querySelector('[data-sim-score]'), points: root.querySelector('[data-sim-points]'), lives: root.querySelector('[data-sim-lives]'), level: root.querySelector('[data-sim-level]'), levelName: root.querySelector('[data-sim-level-name]'), left: root.querySelector('[data-sim-left]'), right: root.querySelector('[data-sim-right]'), enemies: root.querySelector('[data-sim-enemies]'), lock: root.querySelector('[data-sim-lock]'), message: root.querySelector('[data-sim-message]'), start: root.querySelector('[data-sim-start]'), reset: root.querySelector('[data-sim-reset]'), fullscreen: root.querySelector('[data-sim-fullscreen]'), hack: root.querySelector('[data-sim-hack]'), laserButtons: [...root.querySelectorAll('[data-sim-laser]')], saberButtons: [...root.querySelectorAll('[data-sim-saber]')], flipperButtons: [...root.querySelectorAll('[data-sim-flipper]')], health: root.querySelector('[data-sim-health]'), healthText: root.querySelector('[data-sim-health-text]'), shields: root.querySelector('[data-sim-shields]'), shieldsText: root.querySelector('[data-sim-shields-text]'), energy: root.querySelector('[data-sim-energy]'), energyText: root.querySelector('[data-sim-energy-text]'), security: root.querySelector('[data-sim-security]'), boss: root.querySelector('[data-sim-boss]'), bossName: root.querySelector('[data-sim-boss-name]'), bossText: root.querySelector('[data-sim-boss-text]'), bossHealth: root.querySelector('[data-sim-boss-health]'), progress: root.querySelector('[data-sim-progress]'), nextUnlock: root.querySelector('[data-sim-next-unlock]'), finish: root.querySelector('[data-sim-finish]'), faceColor: root.querySelector('[data-sim-face-color]'), ranged: root.querySelector('[data-sim-ranged]'), melee: root.querySelector('[data-sim-melee]'), workshopPoints: root.querySelector('[data-sim-workshop-points]'), upgradeButtons: [...root.querySelectorAll('[data-upgrade]')], loadoutStatus: root.querySelector('[data-sim-loadout-status]') };
  Object.assign(ui, {
    intermission: root.querySelector('[data-sim-intermission]'),
    intermissionTitle: root.querySelector('[data-sim-intermission-title]'),
    intermissionPoints: root.querySelector('[data-sim-intermission-points]'),
    intermissionStatus: root.querySelector('[data-sim-intermission-status]'),
    intermissionContinue: root.querySelector('[data-sim-intermission-continue]'),
    replay: root.querySelector('[data-sim-replay]'),
  });
  const awardMissionPoints = (points, skillPoints = 0) => { score += Math.max(0, points); if (skillPoints <= 0) return; upgradePoints += skillPoints; saveProgress('robSkillPoints', upgradePoints); updateWorkshop(); };
  const objectives = Object.fromEntries([...root.querySelectorAll('[data-objective]')].map((item) => [item.dataset.objective, item])); const say = (t) => { ui.message.textContent = t; ui.intermissionStatus.textContent = t; }; const mark = (n, t, p, skillPoints = 0) => { if (objectives[n].classList.contains('is-complete')) return; objectives[n].classList.add('is-complete'); awardMissionPoints(p, skillPoints); say(t); };
  const currentBoss = () => enemies.find((enemy) => enemy.userData.alive && enemy.userData.isBoss);
  const updateWorkshop = () => {
    selectedFinishID = selectedFinish().id; selectedFaceColorID = selectedFaceColor().id; selectedRangedID = selectedRanged().id; selectedMeleeID = selectedMelee().id;
    ui.progress.textContent = `${highestCompletedLevel} / ${levels.length} levels complete`;
    ui.nextUnlock.textContent = highestCompletedLevel < 3 ? 'Next unlock: Plasma Booster after Level 3.' : highestCompletedLevel < 5 ? 'Next unlock: Twin Blasters after Level 5.' : highestCompletedLevel < 10 ? 'Next unlock: Power Hammer after Level 10.' : highestCompletedLevel < 15 ? 'Next unlock: Arc Cannon after Level 15.' : 'Every workshop weapon is unlocked.';
    ui.finish.value = selectedFinishID; ui.faceColor.value = selectedFaceColorID; ui.ranged.value = selectedRangedID; ui.melee.value = selectedMeleeID;
    [...ui.ranged.options].forEach((option) => { const weapon = rangedWeapons.find(({ id }) => id === option.value); option.disabled = Boolean(weapon && !isUnlocked(weapon, highestCompletedLevel)); });
    [...ui.melee.options].forEach((option) => { const weapon = meleeWeapons.find(({ id }) => id === option.value); option.disabled = Boolean(weapon && !isUnlocked(weapon, highestCompletedLevel)); });
    ui.replay.hidden = !(levelComplete && levels[levelIndex + 1]?.requiresBooster && !upgradeLevels.rocketBooster);
    ui.intermissionContinue.disabled = Boolean(levels[levelIndex + 1]?.requiresBooster && !upgradeLevels.rocketBooster);
    robotRig.boosters.visible = upgradeLevels.rocketBooster > 0;
    ui.workshopPoints.textContent = `${upgradePoints.toLocaleString()} skill points`;
    ui.intermissionPoints.textContent = `${upgradePoints.toLocaleString()} skill points available`;
    ui.upgradeButtons.forEach((button) => {
      const upgrade = upgrades.find(({ id }) => id === button.dataset.upgrade), level = upgradeLevels[upgrade.id], cost = upgradeCost(upgrade, level);
      const requiredLevel = upgradeRequiredCompletedLevel(upgrade, level), locked = highestCompletedLevel < requiredLevel;
      button.textContent = cost === undefined ? `${upgrade.name} · MAX` : `${upgrade.name} L${level} · ${cost}${locked ? ` · Clear Level ${requiredLevel}` : ''}`;
      button.disabled = cost === undefined || upgradePoints < cost || locked;
    });
    ui.loadoutStatus.textContent = `${selectedFinish().name} finish · ${selectedFaceColor().name} smile · ${selectedRanged().name} · ${selectedMelee().name} · Speed L${upgradeLevels.speedBoost} (${Math.round(driveSpeedMultiplier(upgradeLevels.speedBoost) * 100)}%) · Energy L${upgradeLevels.energyCapacity} (${maximumEnergy(upgradeLevels.energyCapacity)} max) · Laser L${upgradeLevels.weaponPower} · ${upgradeLevels.rocketBooster ? 'Plasma Booster · 18 E/s' : 'Booster locked · 900 points after Level 3'} · Kyber L${upgradeLevels.kyberCrystals} (${saberDamage(upgradeLevels.kyberCrystals)} saber damage) · ${targetingComputer().autoLock ? 'Auto Targeting · 0.25s cycle' : 'Basic Manual Aim · 0.8s cycle'}`;
  };
  const applyLoadout = () => {
    const housingMaterial = droidHousingMaterials.find(({ id }) => id === droidProfile.material) || droidHousingMaterials[0];
    robotRig.finishMaterials.forEach((material) => { material.color.setHex(material.userData.captured && selectedFinishID === 'graphite' ? 0xffffff : selectedFinish().color); material.metalness = housingMaterial.metalness; material.roughness = housingMaterial.roughness; material.needsUpdate = true; });
    robotRig.faceMaterials.forEach((material) => { material.color.setHex(selectedFaceColor().color); material.emissive.setHex(selectedFaceColor().color); });
    robotRig.gatling.visible = selectedRangedID === 'shoulderGatling'; robotRig.twinBlasters.visible = selectedRangedID === 'twinBlasters'; robotRig.arcCannon.visible = selectedRangedID === 'arcCannon'; robotRig.hammer.visible = selectedMeleeID === 'powerHammer';
    robotRig.sabers.forEach((saber) => { saber.visible = selectedMeleeID === 'dualSabers'; });
    ui.laserButtons.forEach((button) => { button.setAttribute('aria-label', `Hold to charge ROB's ${selectedRanged().name}`); });
    ui.saberButtons.forEach((button) => { button.setAttribute('aria-label', `Attack with ROB's ${selectedMelee().name}`); });
    updateWorkshop();
  };
  const loadLevel = (index) => {
    const level = levels[index];
    ui.intermission.hidden = true;
    levelParts.splice(0).forEach((part) => scene.remove(part)); obstacles.length = 0;
    level.obstacles.forEach((o, i) => box(...o, i % 2 ? 0x465262 : 0x344552, true, true));
    level.platforms.forEach((platform, i) => {
      const base = mesh(new THREE.BoxGeometry(platform.w * 2, platform.height, platform.d * 2), mat(0x223952), scene, platform.x, platform.height / 2, platform.z);
      const deck = mesh(new THREE.BoxGeometry(platform.w * 2, .07, platform.d * 2), mat(0x178dcc, 0x063257), scene, platform.x, platform.height + .035, platform.z);
      base.name = `Booster Platform ${i + 1}`; deck.name = `Blue Landing Pad ${i + 1}`;
      levelParts.push(base, deck);
    });
    buildEnvironmentalFeatures(index);
    floor.material.color.setHex(level.floor); grid.material.color.setHex(level.grid); gate.position.set(level.gate[0], surfaceHeight({ x: level.gate[0], z: level.gate[1] }), level.gate[1]); dock.position.set(level.dock[0], surfaceHeight({ x: level.dock[0], z: level.dock[1] }) + .05, level.dock[1]);
    rocketFlight = createRocketFlight(); rocketHeld = gamepadRocketHeld = false; baseFlipperAngle = BASE_FLIPPER_REAR_ANGLE; baseFlipperTarget = 'rear'; climbingLedge = false; supportMotion = createROBSupportMotion(); torsoLeanAngle = 0; robot.position.set(level.spawn[0], 0, level.spawn[1]); robot.rotation.set(0, 0, 0); robotRig.driveBase.rotation.set(0, 0, 0); robotRig.baseFlipper.rotation.set(BASE_FLIPPER_REAR_ANGLE, 0, 0); robotRig.torso.position.set(0, 0, 0); robotRig.torso.rotation.set(0, 0, 0); armAssemblies.forEach((arm) => arm.rotation.set(0, 0, 0)); levelElapsed = 0; health = MAX_ROB_HEALTH; shields = MAX_ROB_SHIELDS; shieldTimeRemaining = 0; energy = maximumEnergy(upgradeLevels.energyCapacity); damageInvulnerableUntil = -Infinity; gateDone = false; cellCount = 0; levelComplete = false; hasKey = false; doorOpen = !level.key; hacking = false; hackingCamera = undefined; hackingProgress = 0; securityAlertRemaining = 0; securityMiniBossReleased = false; laserLock = undefined; secondaryLaserLock = undefined; laserChargeStarted = undefined; lastShot = -Infinity; saberCombo = 0; lastSaberAttack = -Infinity; saberAnimation = undefined; gamepadLaserHeld = false;
    releaseAllInput(); keyObject.visible = Boolean(level.key); if (level.key) keyObject.position.set(level.key[0], surfaceHeight({ x: level.key[0], z: level.key[1] }) + .08, level.key[1]);
    doorObject.visible = Boolean(level.door); if (level.door) { doorObject.position.set(level.door[0], surfaceHeight({ x: level.door[0], z: level.door[1] }) + .9, level.door[1]); doorObject.scale.set(level.door[2] / 4, 1, level.door[3] / .35); }
    const initialCameraBlockers = projectileBlockers();
    securityCameras.forEach((securityCamera) => updateSecurityCameraBeam(securityCamera, securityCamera.heading, initialCameraBlockers));
    const hackPosition = hackPositionForLevel(level); hackTerminal.visible = Boolean(hackPosition); if (hackPosition) hackTerminal.position.set(hackPosition[0], surfaceHeight({ x: hackPosition[0], z: hackPosition[1] }), hackPosition[1]);
    bolts.splice(0).forEach((bolt) => scene.remove(bolt)); enemyBolts.splice(0).forEach((bolt) => scene.remove(bolt)); window.speechSynthesis?.cancel?.();
    cells.forEach((cell, i) => { const position = level.cells[i]; cell.visible = Boolean(position); cell.userData.got = false; if (position) { cell.userData.surfaceHeight = surfaceHeight({ x: position[0], z: position[1] }); cell.position.set(position[0], cell.userData.surfaceHeight + .55, position[1]); } });
    shieldPickups.forEach((pickup, i) => { const position = level.shieldPickups[i]; pickup.visible = Boolean(position); pickup.userData.got = false; if (position) { pickup.userData.surfaceHeight = surfaceHeight({ x: position[0], z: position[1] }); pickup.position.set(position[0], pickup.userData.surfaceHeight, position[1]); } });
    repairPickups.forEach((pickup, i) => { const position = level.repairPickups[i]; pickup.visible = Boolean(position); pickup.userData.got = false; if (position) { pickup.userData.surfaceHeight = surfaceHeight({ x: position[0], z: position[1] }); pickup.position.set(position[0], pickup.userData.surfaceHeight, position[1]); } });
    enemies.forEach((enemy) => { enemy.visible = false; enemy.userData.alive = false; enemy.userData.isMiniBoss = false; });
    level.enemies.forEach((spec, enemyIndex) => {
      const enemy = enemies.find((candidate) => !candidate.visible && candidate.userData.type === spec[0]);
      if (!enemy) return;
      const stats = enemyIndex === 0 ? bossStats(index + 1, level.health) : { isBoss: false, shields: level.health };
      enemy.visible = true; enemy.userData.alive = true; enemy.userData.isBoss = stats.isBoss; enemy.userData.isMiniBoss = false; enemy.userData.health = stats.shields; enemy.userData.maxHealth = stats.shields; enemy.userData.contactDamage = enemyContactDamage({ kind: spec[0], isBoss: stats.isBoss }); enemy.userData.projectileDamage = stats.projectileDamage || 4; enemy.userData.combatScale = stats.isBoss ? 1.35 : 1; enemy.userData.defeatReward = stats.isBoss ? 1000 : 300; enemy.userData.name = `${stats.isBoss ? 'Boss ' : ''}${spec[0] === 'spider' ? 'Spider bot' : 'Dalek-style sentry robot'}`; enemy.scale.setScalar(enemy.userData.combatScale);
      enemy.position.set(spec[1], surfaceHeight({ x: spec[1], z: spec[2] }), spec[2]); enemy.userData.origin = enemy.position.clone(); enemy.userData.patrolPhase = enemyIndex * 2.17; enemy.userData.nextAttack = elapsed + 1.6 + enemyIndex * .65; enemy.userData.nextSkitterSound = elapsed + .8 + enemyIndex * .38; enemy.userData.lungeUntil = 0; enemy.userData.travelDistance = 0;
    });
    Object.values(objectives).forEach((objective) => objective.classList.remove('is-complete')); objectives.cells.querySelector('[data-objective-text]').textContent = `Energy cells: 0 / ${level.cells.length}`; objectives.enemies.querySelector('[data-objective-text]').textContent = `Disable ${level.enemies.length} hostile robots`; objectives.dock.querySelector('[data-objective-text]').textContent = level.requiresBooster ? 'Use the Plasma Booster to collect elevated cells and land at the summit dock' : level.key ? 'Find the key, hack the door, use the flipper ledge, then dock' : 'Use the flipper to mount the ledge, then dock';
    ui.level.textContent = `${index + 1} / ${levels.length}`; ui.levelName.textContent = `Level ${index + 1} · ${level.name}`; ui.start.hidden = false; ui.start.textContent = index ? `Start level ${index + 1}` : 'Begin campaign'; applyLoadout(); say(`${level.name}: ${index ? 'difficulty increased' : 'systems ready'}.`);
  };
  const reset = () => { running = complete = false; elapsed = score = 0; lives = MAX_TRIAL_LIVES; levelIndex = 0; root.dispatchEvent(new CustomEvent('rob:campaign-reset')); loadLevel(0); };
  const circleHitsBox = (p, o, radius = .48) => { const dx = p.x - THREE.MathUtils.clamp(p.x, o.x - o.w, o.x + o.w), dz = p.z - THREE.MathUtils.clamp(p.z, o.z - o.d, o.z + o.d); return dx * dx + dz * dz < radius * radius; };
  const robotAxes = (heading) => ({ right: { x: Math.cos(heading), z: -Math.sin(heading) }, length: { x: Math.sin(heading), z: Math.cos(heading) } });
  const robotHitsBox = (p, heading, o) => {
    const { right, length } = robotAxes(heading), delta = { x: o.x - p.x, z: o.z - p.z }, axes = [right, length, { x: 1, z: 0 }, { x: 0, z: 1 }];
    return axes.every((axis) => {
      const distance = Math.abs(delta.x * axis.x + delta.z * axis.z), robotRadius = ROBOT_HALF_WIDTH * Math.abs(right.x * axis.x + right.z * axis.z) + ROBOT_HALF_LENGTH * Math.abs(length.x * axis.x + length.z * axis.z), boxRadius = o.w * Math.abs(axis.x) + o.d * Math.abs(axis.z);
      return distance < robotRadius + boxRadius;
    });
  };
  const robotHitsCircle = (p, heading, center, radius) => { const { right, length } = robotAxes(heading), dx = center.x - p.x, dz = center.z - p.z, localX = dx * right.x + dz * right.z, localZ = dx * length.x + dz * length.z, nearestX = THREE.MathUtils.clamp(localX, -ROBOT_HALF_WIDTH, ROBOT_HALF_WIDTH), nearestZ = THREE.MathUtils.clamp(localZ, -ROBOT_HALF_LENGTH, ROBOT_HALF_LENGTH), gapX = localX - nearestX, gapZ = localZ - nearestZ; return gapX * gapX + gapZ * gapZ < radius * radius; };
  const enemyRadius = (enemy) => (enemy.userData.type === 'spider' ? .72 : .64) * (enemy.userData.combatScale || 1);
  const collision = (p, heading = robot.rotation.y, start = robot.position) => {
    const { right, length } = robotAxes(heading), extentX = ROBOT_HALF_WIDTH * Math.abs(right.x) + ROBOT_HALF_LENGTH * Math.abs(length.x), extentZ = ROBOT_HALF_WIDTH * Math.abs(right.z) + ROBOT_HALF_LENGTH * Math.abs(length.z), door = levels[levelIndex].door, doorBox = door && { x: door[0], z: door[1], w: door[2] / 2, d: door[3] / 2 };
    const destinationHeight = surfaceHeight(p);
    const blockedByLedge = destinationHeight > p.y + .03 && destinationHeight > surfaceHeight(start) + .03 && !(climbingLedge && destinationHeight <= LEDGE.height);
    const blockedByTower = levels[levelIndex].platforms.some((platform) => p.y < platform.height - .03 && robotHitsBox(p, heading, platform));
    return blockedByLedge || blockedByTower || Math.abs(p.x) + extentX > ARENA_HALF_WIDTH - ARENA_CLEARANCE || Math.abs(p.z) + extentZ > ARENA_HALF_DEPTH - ARENA_CLEARANCE || obstacles.some((o) => robotHitsBox(p, heading, o)) || (!doorOpen && doorBox && robotHitsBox(p, heading, doorBox)) || enemies.some((enemy) => enemy.userData.alive && Math.abs(p.y - enemy.position.y) < 1.1 && robotHitsCircle(p, heading, enemy.position, enemyRadius(enemy)));
  };
  const enemyCollision = (p, radius, movingEnemy) => levels[levelIndex].platforms.some((platform) => circleHitsBox(p, platform, radius)) || Math.abs(p.x) > ARENA_HALF_WIDTH - .75 || Math.abs(p.z) > ARENA_HALF_DEPTH - .75 || obstacles.some((o) => circleHitsBox(p, o, radius)) || (!doorOpen && levels[levelIndex].door && circleHitsBox(p, { x: levels[levelIndex].door[0], z: levels[levelIndex].door[1], w: levels[levelIndex].door[2] / 2, d: levels[levelIndex].door[3] / 2 }, radius)) || robotHitsCircle(robot.position, robot.rotation.y, p, radius) || enemies.some((other) => other !== movingEnemy && other.userData.alive && circularBodiesOverlap(p, radius, other.position, enemyRadius(other)));
  const projectileBlockers = () => {
    const blockers = [...obstacles, { x: 0, z: -ARENA_HALF_DEPTH, w: ARENA_HALF_WIDTH, d: .09 }, { x: 0, z: ARENA_HALF_DEPTH, w: ARENA_HALF_WIDTH, d: .09 }, { x: -ARENA_HALF_WIDTH, z: 0, w: .09, d: ARENA_HALF_DEPTH }, { x: ARENA_HALF_WIDTH, z: 0, w: .09, d: ARENA_HALF_DEPTH }];
    const door = levels[levelIndex].door; if (!doorOpen && door) blockers.push({ x: door[0], z: door[1], w: door[2] / 2, d: door[3] / 2 });
    return blockers;
  };
  const moveEnemy = (enemy, target, speed, dt) => { const offset = target.clone().sub(enemy.position); offset.y = 0; const distance = offset.length(); if (distance < .04) return false; const step = Math.min(distance, speed * dt), direction = offset.normalize(), proposedX = enemy.position.clone(), proposedZ = enemy.position.clone(), radius = enemyRadius(enemy); proposedX.x += direction.x * step; proposedZ.z += direction.z * step; let moved = false; if (!enemyCollision(proposedX, radius, enemy)) { enemy.position.x = proposedX.x; moved = true; } if (!enemyCollision(proposedZ, radius, enemy)) { enemy.position.z = proposedZ.z; moved = true; } enemy.position.y = surfaceHeight(enemy.position); if (!moved) enemy.userData.patrolPhase += .9; return moved; };
  const releaseSecurityMiniBoss = (securityCamera) => {
    if (securityMiniBossReleased) return false;
    const enemy = enemies.find((candidate) => !candidate.visible && candidate.userData.type === 'spider'); if (!enemy) return false;
    const stats = securityMiniBossStats(), preferred = new THREE.Vector3(-securityCamera.x * .72, 0, -securityCamera.z * .72), candidates = [preferred, new THREE.Vector3(-10, 0, -8), new THREE.Vector3(10, 0, -8), new THREE.Vector3(0, 0, -8)];
    const spawn = candidates.find((candidate) => candidate.distanceTo(robot.position) > 4 && !enemyCollision(candidate, .82)) || preferred;
    enemy.visible = true; enemy.userData.alive = true; enemy.userData.isBoss = stats.isBoss; enemy.userData.isMiniBoss = stats.isMiniBoss; enemy.userData.health = stats.shields; enemy.userData.maxHealth = stats.shields; enemy.userData.contactDamage = stats.contactDamage; enemy.userData.projectileDamage = stats.projectileDamage; enemy.userData.combatScale = stats.scale; enemy.userData.defeatReward = stats.defeatReward; enemy.userData.name = 'Mini Boss Spider bot'; enemy.scale.setScalar(stats.scale);
    enemy.position.copy(spawn); enemy.position.y = surfaceHeight(enemy.position); enemy.userData.origin = enemy.position.clone(); enemy.userData.patrolPhase = elapsed * .37; enemy.userData.nextAttack = elapsed + 1.8; enemy.userData.nextSkitterSound = elapsed + .5; enemy.userData.lungeUntil = 0; enemy.userData.travelDistance = 0; securityMiniBossReleased = true;
    objectives.enemies.classList.remove('is-complete'); objectives.enemies.querySelector('[data-objective-text]').textContent = 'Disable hostile robots and the released mini boss';
    return true;
  };
  const damageEnemy = (hit, weapon, amount = 1) => {
    if (!hit.userData.alive) return;
    const damage = Math.min(hit.userData.health, Math.max(0, amount));
    hit.userData.health -= damage; awardMissionPoints(battleScore({ damage }));
    if (hit.userData.type === 'spider') playSpiderSound(hit.userData.health <= 0 ? 'shutdown' : 'impact');
    say(`${hit.userData.name} hit by ${weapon} — ${hit.userData.health} shields remain.`);
    if (hit.userData.health <= 0) {
      const skillPoints = enemySkillReward(hit.userData);
      hit.userData.alive = false; hit.visible = false;
      awardMissionPoints(battleScore({ defeatReward: hit.userData.defeatReward ?? (hit.userData.isBoss ? 1000 : 300) }), skillPoints);
      if (laserLock === hit) laserLock = undefined; if (secondaryLaserLock === hit) secondaryLaserLock = undefined;
      if (hit.userData.type !== 'spider') playDalekSentry();
      say(`${hit.userData.name} disabled by ${weapon}. +${skillPoints} skill points. ${enemies.filter((enemy) => enemy.userData.alive).length} targets remain.`);
      if (enemies.every((enemy) => !enemy.userData.alive)) mark('enemies', 'Training-room defense complete.', 400);
    }
  };
  const damageROB = (attack, damage) => {
    if (!running || elapsed < damageInvulnerableUntil) return false;
    const result = applyROBDamage({ health, shields, damage, shieldActive: shieldTimeRemaining > 0 }); health = result.health; shields = result.shields; score = Math.max(0, score - result.scorePenalty); damageInvulnerableUntil = elapsed + .75;
    if (shields <= 0) shieldTimeRemaining = 0;
    if (health > 0) {
      if (result.healthDamage > 0 && result.shieldDamage > 0) say(`${attack} broke ROB’s shield and dealt ${result.healthDamage} hull damage. Health: ${health}/${MAX_ROB_HEALTH}.`);
      else if (result.shieldDamage > 0) say(`${attack} drained ${result.shieldDamage} shield points. ROB shields: ${shields}/${MAX_ROB_SHIELDS}.`);
      else say(`${attack} dealt ${result.healthDamage} hull damage. ROB health: ${health}/${MAX_ROB_HEALTH}.`);
      return true;
    }
    const life = consumeTrialLife(lives); lives = life.lives;
    if (!life.trialFailed) {
      loadLevel(levelIndex); running = true; ui.start.hidden = true; damageInvulnerableUntil = elapsed + 1; say(`ROB was disabled by ${attack}. Life lost — ${lives} remaining. Restarting level ${levelIndex + 1}.`); return true;
    }
    score = 0; upgradePoints = 0; upgrades.forEach((upgrade) => { upgradeLevels[upgrade.id] = 0; saveProgress(`rob${upgrade.id}Level`, 0); }); saveProgress('robSkillPoints', 0);
    levelIndex = 0; complete = false; loadLevel(0); running = false; ui.start.hidden = false; ui.start.textContent = 'Start new three-life trial'; stopMusic(); updateWorkshop(); say(`Trial over after ${attack}. All points and installed upgrades were lost. Start Level 1 to try again with three lives.`); return true;
  };
  const combatNow = () => performance.now() / 1000;
  const laserChargeAmount = () => laserChargeStarted === undefined ? 0 : THREE.MathUtils.clamp((combatNow() - laserChargeStarted) / targetingComputer().chargeDuration, 0, 1);
  const scanForLaserTarget = () => {
    if (!running || complete || !targetingComputer().autoLock) { laserLock = undefined; secondaryLaserLock = undefined; return; }
    const active = enemies.filter((enemy) => enemy.userData.alive && enemy.visible).map((enemy) => ({ enemy, distance: enemy.position.distanceTo(robot.position) })).filter(({ distance }) => distance <= 28).sort((a, b) => a.distance - b.distance);
    laserLock = active[0]?.enemy;
    secondaryLaserLock = maximumLaserLocks(selectedRanged(), upgradeLevels.targetingComputer) > 1 ? active[1]?.enemy : undefined;
  };
  const fireLaser = (charge = 0) => {
    scanForLaserTarget(); if (!running || complete || elapsed - lastShot < targetingComputer().cycleDuration) return;
    const weapon = selectedRanged(); charge = THREE.MathUtils.clamp(charge, 0, 1);
    const discharge = consumeLaserEnergy({ energy, weapon, charge }), energyCost = discharge.cost;
    if (!discharge.fired) { say(`${weapon.name} needs ${Math.ceil(energyCost)} system energy. Hold position or collect an energy cell.`); return; }
    energy = discharge.energy;
    lastShot = elapsed; const targets = weapon.id === 'twinBlasters' ? [laserLock, secondaryLaserLock || laserLock] : [laserLock], lateralOffsets = weapon.id === 'twinBlasters' ? [-.62, .62] : [.78], shotHeight = weapon.id === 'twinBlasters' ? 1.25 : 1.65, radius = .04 + charge * .11 + (weapon.id === 'arcCannon' ? .06 : 0), length = .95 + charge * 1.9;
    const color = weapon.id === 'arcCannon' ? 0xa66cff : 0x38dfff;
    playLaserShot(charge);
    targets.forEach((lockedTarget, index) => {
      const start = selectedRangedID === 'shoulderGatling' ? robotRig.laserMuzzle.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(lateralOffsets[index], shotHeight, -.58).applyQuaternion(robot.quaternion).add(robot.position);
      const target = lockedTarget?.position.clone().add(new THREE.Vector3(0, 1, 0));
      const heading = laserAimHeading({ origin: start, heading: robot.rotation.y, target, targetingComputerLevel: upgradeLevels.targetingComputer });
      const verticalAim = target ? (target.y - start.y) / Math.max(.001, Math.hypot(target.x - start.x, target.z - start.z)) : 0;
      const direction = new THREE.Vector3(-Math.sin(heading), verticalAim, -Math.cos(heading)).normalize();
      const bolt = mesh(new THREE.CylinderGeometry(radius, radius, length, 12), mat(color, color), scene);
      bolt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction); bolt.position.copy(start).addScaledVector(direction, .7 + charge * .55);
      bolt.userData.velocity = direction.multiplyScalar(weapon.projectileSpeed + charge * 3.5); bolt.userData.damage = upgradedWeaponDamage(weaponDamage(weapon, charge), upgradeLevels.weaponPower); bolt.userData.charge = charge; bolt.userData.weapon = weapon; bolts.push(bolt);
    });
    if (weapon.id === 'twinBlasters' && secondaryLaserLock) say(`Twin Blasters dual lock — two beams fired for ${Math.ceil(energyCost)} energy.`);
    else if (laserLock) say(`${weapon.name} fired at ${laserLock.userData.name} for ${Math.ceil(energyCost)} energy.`);
    else say(`${weapon.name} manual shot fired forward for ${Math.ceil(energyCost)} energy. ${targetingComputer().autoLock ? 'No target in range.' : 'Upgrade the Targeting Computer for automatic lock-on.'}`);
  };
  const beginLaserCharge = () => {
    if (!running || complete || laserChargeStarted !== undefined || elapsed - lastShot < targetingComputer().cycleDuration) return;
    const weapon = selectedRanged();
    if (energy < laserEnergyCost(weapon, 0)) { say(`Not enough system energy for the ${weapon.name}. Hold position or collect an energy cell.`); return; }
    scanForLaserTarget(); laserChargeStarted = combatNow();
    say(laserLock ? `${secondaryLaserLock ? 'Dual lock' : 'Red lock'}: hold to charge ${weapon.name}.`
      : targetingComputer().autoLock ? `${weapon.name} scanning. Without a lock, shots fire forward.`
      : `Basic computer: steer ROB to aim forward. Hold to charge ${weapon.name}; upgrade for faster automatic targeting.`);
  };
  const releaseLaserCharge = () => { if (laserChargeStarted === undefined) return; const charge = laserChargeAmount(); laserChargeStarted = undefined; fireLaser(charge); };
  const cancelLaserCharge = () => { laserChargeStarted = undefined; ui.laserButtons.forEach((button) => button.classList.remove('is-charging')); };
  const enemyBoltGeometry = new THREE.CylinderGeometry(.055, .055, 1.05, 8), enemyBoltMaterial = mat(0x70c8ff, 0x194ec4);
  const fireEnemyLaser = (enemy) => { const start = enemy.position.clone().add(new THREE.Vector3(0, enemy.userData.type === 'dalek' ? 1.55 : .9, 0)), target = robot.position.clone().add(new THREE.Vector3(0, .9, 0)), direction = target.sub(start).normalize(), bolt = mesh(enemyBoltGeometry, enemyBoltMaterial, scene); bolt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction); bolt.position.copy(start).addScaledVector(direction, .85); bolt.userData.velocity = direction.multiplyScalar(7.5 + levelIndex * .18); bolt.userData.damage = enemy.userData.projectileDamage; bolt.userData.sourceName = `${enemy.userData.name} laser`; enemyBolts.push(bolt); };
  const saberSlash = () => {
    if (!running || complete || saberAnimation) return;
    const now = combatNow(), weapon = selectedMelee(), forward = new THREE.Vector3(0, 0, -1).applyQuaternion(robot.quaternion).normalize(), origin = { x: robot.position.x, z: robot.position.z };
    if (weapon.id === 'powerHammer') {
      const radius = 3.8;
      saberCombo = 0; lastSaberAttack = now; saberAnimation = { style: 'hammer', started: now, duration: meleeDuration('hammer') };
      const hits = enemies.filter((enemy) => enemy.userData.alive).filter((enemy) => { const offset = enemy.position.clone().sub(robot.position), enemyPoint = { x: enemy.position.x, z: enemy.position.z }; return offset.length() <= radius && offset.clone().normalize().dot(forward) > .08 && meleeAnimationIsClear({ origin, target: enemyPoint, blockers: projectileBlockers() }); });
      hits.forEach((enemy) => damageEnemy(enemy, 'power hammer', 2)); playSound('laser'); say(hits.length ? `Power hammer smash struck ${hits.length} ${hits.length === 1 ? 'target' : 'targets'}.` : 'Power hammer smash missed. Face a target within reach.'); return;
    }
    saberCombo = now - lastSaberAttack <= 1.15 ? saberCombo + 1 : 1; const style = saberCombo >= 3 ? 'spin' : saberCombo % 2 ? 'left' : 'right', radius = style === 'spin' ? 4.1 : 3.15;
    lastSaberAttack = now; if (style === 'spin') saberCombo = 0; saberAnimation = { style, started: now, duration: meleeDuration(style) }; playSound('laser');
    const hits = enemies.filter((enemy) => enemy.userData.alive).filter((enemy) => { const offset = enemy.position.clone().sub(robot.position), enemyPoint = { x: enemy.position.x, z: enemy.position.z }; return offset.length() <= radius && (style === 'spin' || offset.clone().normalize().dot(forward) > -.08) && meleeAnimationIsClear({ origin, target: enemyPoint, blockers: projectileBlockers() }); }); hits.forEach((enemy) => damageEnemy(enemy, style === 'spin' ? 'dual-saber spin' : `dual-saber ${style} sweep`, saberDamage(upgradeLevels.kyberCrystals))); say(style === 'spin' ? `Spin attack! ROB extended both sabers and struck ${hits.length} ${hits.length === 1 ? 'enemy' : 'enemies'}.` : hits.length ? `${style === 'left' ? 'Left' : 'Right'} dual-arm sweep connected.` : `${style === 'left' ? 'Left' : 'Right'} sweep missed. Close the distance, then chain three attacks for a spin.`);
  };
  const updateRobotWeapons = () => {
    scanForLaserTarget(); const now = combatNow(), charge = laserChargeAmount(); robotRig.torso.rotation.set(0, 0, 0); armAssemblies.forEach((arm) => arm.rotation.set(0, 0, 0));
    const progress = saberAnimation ? (now - saberAnimation.started) / saberAnimation.duration : 1;
    const pose = meleePose(saberAnimation?.style, progress);
    robotRig.torso.rotation.y = pose.torsoYaw;
    robotRig.hammer.rotation.x = pose.hammerPitch;
    armAssemblies.forEach((arm) => { arm.rotation.y = pose.armYaw; arm.rotation.z = arm.userData.side * pose.armRoll; });
    if (progress >= 1) saberAnimation = undefined;
    robotRig.sabers.forEach((saber) => { saber.visible = selectedMeleeID === 'dualSabers'; });
    const aimAt = (rig, target, scanPhase = 0) => { if (target) { const offset = target.position.clone().sub(robot.position), worldYaw = Math.atan2(-offset.x, -offset.z), localYaw = Math.atan2(Math.sin(worldYaw - robot.rotation.y), Math.cos(worldYaw - robot.rotation.y)); rig.rotation.y += (localYaw - rig.rotation.y) * .18; } else rig.rotation.y = targetingComputer().autoLock ? Math.sin(now * 1.35 + scanPhase) * .9 : -robotRig.torso.rotation.y; };
    if (selectedRangedID === 'twinBlasters') { aimAt(robotRig.twinBlasterMounts[0], laserLock, 0); aimAt(robotRig.twinBlasterMounts[1], secondaryLaserLock || laserLock, .5); }
    else aimAt(selectedRangedID === 'arcCannon' ? robotRig.arcCannon : robotRig.gatling, laserLock);
    robotRig.gatlingTilt.rotation.x = laserLock ? -.06 : targetingComputer().autoLock ? Math.sin(now * .7) * .13 : 0;
    robotRig.lockLamp.visible = Boolean(laserLock); robotRig.targetBeam.visible = Boolean(laserLock && selectedRangedID === 'shoulderGatling'); robotRig.lockLamp.scale.setScalar(laserLock ? 1 + Math.sin(now * 12) * .24 : 1);
    if (ui.lock) {
      const lockLabel = !targetingComputer().autoLock ? 'BASIC COMPUTER · MANUAL AIM'
        : secondaryLaserLock ? `DUAL LOCK · ${laserLock.userData.name} + ${secondaryLaserLock.userData.name}`
        : laserLock ? `AUTO LOCK · ${laserLock.userData.name}` : 'AUTO TARGETING · SCANNING';
      if (ui.lock.textContent !== lockLabel) ui.lock.textContent = lockLabel;
      ui.lock.classList.toggle('is-locked', Boolean(laserLock));
    }
    ui.laserButtons.forEach((button) => {
      const charging = laserChargeStarted !== undefined, cooldown = Math.max(0, targetingComputer().cycleDuration - (elapsed - lastShot));
      const cost = Math.ceil(laserEnergyCost(selectedRanged(), charge)), compact = button.classList.contains('rob-sim__fire');
      button.classList.toggle('is-charging', charging); button.style.setProperty('--laser-charge', `${Math.round(charge * 100)}%`);
      button.disabled = !running || (!charging && (energy < laserEnergyCost(selectedRanged(), 0) || cooldown > 0));
      button.textContent = charging ? `CHARGE ${Math.round(charge * 100)}% · ${cost} E`
        : cooldown > 0 ? `COMPUTER ${cooldown.toFixed(1)}s` : `${compact ? selectedRanged().shortName.toUpperCase() : selectedRanged().name} · ${cost} E${compact ? '' : ' · hold Q'}`;
    });
    ui.saberButtons.forEach((button) => { button.textContent = button.classList.contains('rob-sim__fire') ? selectedMelee().shortName.toUpperCase() : `${selectedMelee().name} · Space`; });
  };
  const activateShield = () => {
    if (!running || shields <= 0 || shieldTimeRemaining > 0) return;
    shieldTimeRemaining = stepBubbleShield({ remaining: shieldTimeRemaining, shields, running, activate: true }).remaining;
    say(`Bubble shield active for ${SHIELD_ACTIVATION_DURATION.toFixed(1)} seconds.`);
  };
  const setRocketHeld = (held) => {
    if (!held) { rocketHeld = false; return; }
    if (!running || !upgradeLevels.rocketBooster || energy < 1 || hacking || hackingCamera) return;
    rocketHeld = true; climbingLedge = false; baseFlipperAngle = BASE_FLIPPER_REAR_ANGLE; baseFlipperTarget = 'rear';
  };
  const readInput = () => { let forward = touch.forward || (((keys.has('ArrowUp') || keys.has('KeyW')) ? 1 : 0) - ((keys.has('ArrowDown') || keys.has('KeyS')) ? 1 : 0)), steering = touch.steering || (((keys.has('ArrowLeft') || keys.has('KeyA')) ? 1 : 0) - ((keys.has('ArrowRight') || keys.has('KeyD')) ? 1 : 0)), leftTarget, rightTarget; const pad = [...(navigator.getGamepads?.() || [])].find(Boolean); if (pad && (Math.abs(pad.axes[0] || 0) > .12 || Math.abs(pad.axes[1] || 0) > .12)) { forward = -(pad.axes[1] || 0); steering = -(pad.axes[0] || 0); } leftTarget = THREE.MathUtils.clamp(forward - steering * .72, -1, 1); rightTarget = THREE.MathUtils.clamp(forward + steering * .72, -1, 1); if (touch.leftActive || touch.rightActive) { leftTarget = touch.leftActive ? touch.left : 0; rightTarget = touch.rightActive ? touch.right : 0; } const gamepadLaserPressed = Boolean(pad?.buttons.some((b, i) => (i === 0 || i === 6 || i === 7) && b.pressed)); if (gamepadLaserPressed && !gamepadLaserHeld) beginLaserCharge(); else if (!gamepadLaserPressed && gamepadLaserHeld) releaseLaserCharge(); gamepadLaserHeld = gamepadLaserPressed; const shieldPressed = Boolean(pad?.buttons[3]?.pressed); if (shieldPressed && !gamepadShieldHeld) activateShield(); gamepadShieldHeld = shieldPressed; const rocketPressed = Boolean(pad?.buttons[4]?.pressed); if (rocketPressed !== gamepadRocketHeld) setRocketHeld(rocketPressed); gamepadRocketHeld = rocketPressed; controls.left += (leftTarget - controls.left) * .28; controls.right += (rightTarget - controls.right) * .28; };
  const nearestHackableCamera = (range = SECURITY_CAMERA_HACK_RANGE) => securityCameras
    .filter((securityCamera) => !securityCamera.disabled)
    .map((securityCamera) => ({ securityCamera, distance: robot.position.distanceTo(securityCamera.group.position) }))
    .filter(({ distance }) => distance <= range)
    .sort((a, b) => a.distance - b.distance)[0]?.securityCamera;
  const startDoorHack = () => {
    const level = levels[levelIndex]; if (!running || !level.door || doorOpen || hacking || hackingCamera) return;
    if (!hasKey) { say('The security lock needs its access key before ROB can hack it.'); return; }
    if (robot.position.distanceTo(hackTerminal.position) > 2.25) { say('Move ROB beside the orange hack panel first.'); return; }
    hacking = true; hackingProgress = 0; releaseAllInput(); say('Flipper Zero connected. ROB is running the door hack automatically…');
  };
  const startCameraHack = (securityCamera = nearestHackableCamera()) => {
    if (!running || hacking || hackingCamera || !securityCamera || securityCamera.disabled) return;
    hackingCamera = securityCamera; hackingProgress = 0; releaseAllInput(); say('Flipper Zero connected to the security camera. Hold position while ROB disables its sensor and alarm…');
  };
  const startFlipperHack = () => {
    const securityCamera = nearestHackableCamera();
    if (securityCamera) startCameraHack(securityCamera);
    else startDoorHack();
  };
  const commandBaseFlipper = (target) => {
    if (!running || complete || levelComplete || target === baseFlipperTarget) return;
    if (climbingLedge && target === 'forward') return;
    if (supportMotion.phase !== 'grounded' || rocketFlight.airborne || rocketHeld) return;
    if (hacking || hackingCamera) { say('Finish or cancel the security task before using the base lift.'); return; }
    if (energy < BASE_FLIPPER_ENERGY_COST) { say(`Base lift needs ${BASE_FLIPPER_ENERGY_COST} system energy. Hold position or collect a cell.`); return; }
    energy -= BASE_FLIPPER_ENERGY_COST; baseFlipperTarget = target;
    say(target === 'forward' ? 'Flippers lowering: the front rises while the rear stays grounded. Drive forward to mount the ledge.' : 'Flippers raising. Continue forward as the rear climbs and ROB levels out.');
  };
  const updateGroundSupport = (dt, previousPose, forward) => {
    const halfSpan = ROB_CONTACT_SPAN * 2.15 / 2;
    const front = { x: robot.position.x - Math.sin(robot.rotation.y) * halfSpan, z: robot.position.z - Math.cos(robot.rotation.y) * halfSpan };
    const rear = { x: robot.position.x + Math.sin(robot.rotation.y) * halfSpan, z: robot.position.z + Math.cos(robot.rotation.y) * halfSpan };
    const centerFloor = surfaceHeight(robot.position);
    if (climbingLedge) {
      if (pointOnLedge(robot.position) && pointOnLedge(rear)) {
        climbingLedge = false; baseFlipperTarget = 'rear'; supportMotion = createROBSupportMotion(LEDGE.height);
      } else if (climbProgress() < -.03 || Math.abs(robot.position.x - LEDGE.x) > LEDGE.w || robot.position.z < LEDGE.z - LEDGE.d) {
        climbingLedge = false; baseFlipperTarget = 'rear';
        supportMotion = { ...createROBSupportMotion(previousPose.lift), pitch: previousPose.pitch, supportHeight: LEDGE.height };
      } else {
        robot.position.y = centerFloor; supportMotion = createROBSupportMotion(centerFloor); return;
      }
    }
    if (supportMotion.phase === 'grounded') supportMotion.pitch = previousPose.pitch;
    supportMotion = stepROBSupportMotion({ motion: supportMotion, frontFloor: surfaceHeight(front), rearFloor: surfaceHeight(rear), centerFloor, contactSpan: ROB_CONTACT_SPAN * 2.15, scale: 2.15, forward, delta: dt });
    robot.position.y = supportMotion.height;
    if (supportMotion.phase !== 'grounded') baseFlipperTarget = 'rear';
  };
  const tick = (dt) => {
    readInput(); if (!running || complete || levelComplete) return;
    shieldTimeRemaining = stepBubbleShield({ remaining: shieldTimeRemaining, shields, running, delta: dt }).remaining;
    elapsed += dt; levelElapsed += dt; securityAlertRemaining = Math.max(0, securityAlertRemaining - dt);
    const flipperStep = advanceBaseFlipper({ angle: baseFlipperAngle, target: baseFlipperTarget, delta: dt, climbing: climbingLedge }); baseFlipperAngle = flipperStep.angle;
    const level = levels[levelIndex], old = robot.position.clone(), oldHeading = robot.rotation.y, powered = energy > .05 ? 1 : 0, speedMultiplier = driveSpeedMultiplier(upgradeLevels.speedBoost), flipperPose = robotBasePose(), ledgeDriveScale = climbingLedge ? Math.min(1, ROB_CONTACT_SPAN * 2.15 * Math.cos(flipperGroundPitch(BASE_FLIPPER_FORWARD_ANGLE)) / ((BASE_FLIPPER_REAR_ASSIST_ANGLE - BASE_FLIPPER_FORWARD_ANGLE) / BASE_FLIPPER_MOTOR_SPEED * BASE_DRIVE_SPEED * speedMultiplier) * .75) : 1, left = controls.left * BASE_DRIVE_SPEED * speedMultiplier * powered * ledgeDriveScale, right = controls.right * BASE_DRIVE_SPEED * speedMultiplier * powered * ledgeDriveScale, linear = (left + right) / 2, yaw = (controls.right - controls.left) * BASE_TURN_SPEED * powered * ledgeDriveScale * dt;
    let resolvedHeading = oldHeading;
    for (const fraction of [1, .66, .33]) {
      const candidateHeading = oldHeading + yaw * fraction;
      if (!collision(old, candidateHeading)) { resolvedHeading = candidateHeading; break; }
      const door = level.door;
      const walls = [...obstacles, ...(!doorOpen && door ? [{ x: door[0], z: door[1], w: door[2] / 2, d: door[3] / 2 }] : [])];
      const recovered = resolveWallTurn({ point: { x: old.x, z: old.z }, heading: candidateHeading, walls,
        canOccupy: (p) => !collision(new THREE.Vector3(p.x, old.y, p.z), candidateHeading, old) });
      if (recovered) { old.x = recovered.x; old.z = recovered.z; resolvedHeading = candidateHeading; break; }
    }
    const travelHeading = oldHeading + (resolvedHeading - oldHeading) / 2, intended = { x: old.x - Math.sin(travelHeading) * linear * dt, z: old.z - Math.cos(travelHeading) * linear * dt };
    if (!rocketFlight.airborne && !rocketHeld && !climbingLedge && supportMotion.phase === 'grounded' && !pointOnLedge(old) && linear > 0 && Math.cos(robot.rotation.y) > .7 && flipperPose.phase >= .9) {
      const reach = ROB_CONTACT_SPAN * 2.15 * (Math.cos(flipperPose.pitch) - .5);
      const front = { x: intended.x - Math.sin(robot.rotation.y) * reach, z: intended.z - Math.cos(robot.rotation.y) * reach };
      if (pointOnLedge(front) && old.z >= LEDGE.approachEdgeZ && LEDGE.height <= ROB_CONTACT_SPAN * 2.15 * Math.sin(flipperPose.pitch)) {
        climbingLedge = true; baseFlipperTarget = 'rear';
        say('Front engaging the step. Flippers raising automatically to support the rear.');
      }
    }
    const motion = resolveAxisSlidingMotion({
      start: { x: old.x, z: old.z },
      end: intended,
      canOccupy: (position) => !collision(new THREE.Vector3(position.x, old.y, position.z), resolvedHeading, old),
    });
    robot.position.set(motion.position.x, old.y, motion.position.z); robot.rotation.y = resolvedHeading;
    const conveyorMove = rocketFlight.airborne || rocketHeld ? { x: 0, z: 0 } : conveyorDisplacement({ point: { x: robot.position.x, z: robot.position.z }, conveyors, delta: dt });
    const conveyorPosition = robot.position.clone(); conveyorPosition.x += conveyorMove.x; conveyorPosition.z += conveyorMove.z;
    if (!collision(conveyorPosition, robot.rotation.y, robot.position)) robot.position.copy(conveyorPosition);
    const newSurfaceHeight = surfaceHeight(robot.position);
    const wasFlying = rocketFlight.airborne || rocketHeld;
    if (wasFlying) {
      const result = stepRocketFlight({ motion: rocketFlight, height: robot.position.y, floor: surfaceHeight(robot.position), energy, held: rocketHeld, installed: upgradeLevels.rocketBooster > 0, delta: dt, scale: 2.15 });
      rocketFlight = result.motion; robot.position.y = result.height; energy = result.energy;
      supportMotion = createROBSupportMotion(robot.position.y);
      if (energy <= .05) rocketHeld = false;
    } else updateGroundSupport(dt, flipperPose, linear);
    torsoLeanAngle = advanceTorsoLean(torsoLeanAngle, robotBasePose().pitch, dt);
    const treadsPowered = Boolean(powered && Math.abs(controls.left) + Math.abs(controls.right) > .02);
    if (!flipperStep.active && !wasFlying && supportMotion.phase === 'grounded') energy = updateDriveEnergy({ energy, maximum: maximumEnergy(upgradeLevels.energyCapacity), moving: treadsPowered, delta: dt, capacityLevel: upgradeLevels.energyCapacity, charging: laserChargeStarted !== undefined, secondsSinceShot: elapsed - lastShot });
    robotRig.treadWheels.forEach(({ wheel, side }) => { wheel.rotation.x -= controls[side] * dt * 10.5 * speedMultiplier; });
    if (!wasFlying && newSurfaceHeight > surfaceHeight(old)) say('Front tracks on the ledge. Flippers are reversing automatically; keep driving to lift the rear and level ROB.');
    else if (motion.collided && Math.abs(linear) > .1) say(!pointOnLedge(old) && !pointOnLedge(robot.position) && intended.z < old.z ? 'Ledge too high for the treads. Lower the flippers to lift the front, then keep driving into the orange lip.' : robot.position.distanceTo(old) > .001 ? 'Wall assist active — ROB is sliding along the open edge.' : 'Wall contact — reverse or pivot away; ROB will release cleanly.');
    if (hackingCamera) {
      if (robot.position.distanceTo(hackingCamera.group.position) > SECURITY_CAMERA_HACK_RANGE) { hackingCamera = undefined; hackingProgress = 0; say('Camera hack interrupted. Move back within Flipper Zero range.'); }
      else { hackingProgress = Math.min(1, hackingProgress + dt / FLIPPER_HACK_DURATION); if (hackingProgress >= 1) { const disabledCamera = hackingCamera; hackingCamera = undefined; hackingProgress = 0; disabledCamera.disabled = true; disabledCamera.beam.visible = false; securityAlertRemaining = 0; awardMissionPoints(FLIPPER_HACK_REWARD); playSound('pickup'); say(`Flipper Zero camera hack complete. Camera ${disabledCamera.id + 1} sensor and alarm disabled.`); } }
    }
    const robotPoint = { x: robot.position.x, z: robot.position.z }, wasAlerted = securityAlertRemaining > 0, cameraBlockers = projectileBlockers();
    const detectingCamera = securityCameras.find((securityCamera) => securityCameraSees({ camera: securityCamera, robot: robotPoint, elapsed, blockers: cameraBlockers, shadows: shadowZones }));
    if (detectingCamera) { securityAlertRemaining = 5; if (!wasAlerted) say(releaseSecurityMiniBoss(detectingCamera) ? 'Security camera caught ROB! A six-shield mini boss has been released — disable it or escape into shadow.' : 'Security camera spotted ROB again! Dodge into a dark shadow pad.'); }
    securityCameras.forEach((securityCamera) => { const heading = cameraHeading(securityCamera, elapsed), isHackTarget = hackingCamera === securityCamera; securityCamera.group.rotation.y = heading; securityCamera.beam.visible = !securityCamera.disabled; if (!securityCamera.disabled) updateSecurityCameraBeam(securityCamera, heading, cameraBlockers); const lensColor = securityCamera.disabled ? 0x55ff95 : isHackTarget ? 0xffcf33 : 0xff243f, lensEmissive = securityCamera.disabled ? 0x0b7a38 : isHackTarget ? 0xb37700 : 0xa60018; securityCamera.lens.material.color.setHex(lensColor); securityCamera.lens.material.emissive.setHex(lensEmissive); securityCamera.lens.material.emissiveIntensity = securityCamera.disabled ? 1.25 : isHackTarget ? 2.6 + Math.sin(elapsed * 9) * .6 : securityAlertRemaining > 0 ? 3.2 : 1.8; });
    if (hacking) {
      if (robot.position.distanceTo(hackTerminal.position) > 2.25) { hacking = false; hackingProgress = 0; say('Hack interrupted. Move back beside the orange panel.'); }
      else { hackingProgress = Math.min(1, hackingProgress + dt / FLIPPER_HACK_DURATION); if (hackingProgress >= 1) { hacking = false; doorOpen = true; doorObject.visible = false; hackTerminal.visible = false; awardMissionPoints(FLIPPER_HACK_REWARD); playSound('pickup'); say('Flipper Zero hack complete. Security lock bypassed and door open.'); } }
    }
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i]; if (!enemy.userData.alive) continue;
      const toRobot = robot.position.clone().sub(enemy.position); toRobot.y = 0; const distance = toRobot.length(), isSpider = enemy.userData.type === 'spider', aggressive = securityAlertRemaining > 0 || gateDone || distance < (isSpider ? 10.25 : 14), patrolAngle = elapsed * (isSpider ? .62 : .34) + enemy.userData.patrolPhase, patrolRadius = isSpider ? 2.2 : 1.7;
      let target = enemy.userData.origin.clone().add(new THREE.Vector3(Math.cos(patrolAngle) * patrolRadius, 0, Math.sin(patrolAngle) * patrolRadius)), speed = isSpider ? .52 : .38;
      if (isSpider && aggressive) {
        target = robot.position.clone(); speed = .92 + level.speed * 2.1 + (securityAlertRemaining > 0 ? .32 : 0);
        if (elapsed >= enemy.userData.nextSkitterSound) { enemy.userData.nextSkitterSound = elapsed + 2.1 + (i % 3) * .42; playSpiderSound('skitter'); }
        if (elapsed >= enemy.userData.nextAttack && distance < 4.25) { enemy.userData.lungeUntil = elapsed + .72; enemy.userData.nextAttack = elapsed + Math.max(2.5, 3.5 - levelIndex * .06); playSpiderSound('lunge'); say('Spider bot skittering into a lunge — evade or use the saber!'); }
        if (elapsed < enemy.userData.lungeUntil) speed = 2.65 + level.speed * 1.4;
      } else if (!isSpider && aggressive) {
        if (distance > 5.8) target = robot.position.clone();
        else if (distance < 3.6) target = enemy.position.clone().addScaledVector(toRobot.clone().normalize(), -2.5);
        else { const orbit = new THREE.Vector3(-toRobot.z, 0, toRobot.x).normalize().multiplyScalar(Math.sin(enemy.userData.patrolPhase) < 0 ? -1.6 : 1.6); target = enemy.position.clone().add(orbit); }
        speed = .58 + level.speed * 1.25 + (securityAlertRemaining > 0 ? .25 : 0);
        if (elapsed >= enemy.userData.nextAttack && distance < (securityAlertRemaining > 0 ? 15 : 12)) { enemy.userData.nextAttack = elapsed + Math.max(1.35, 3.9 - levelIndex * .09 - (securityAlertRemaining > 0 ? .65 : 0)); fireEnemyLaser(enemy); playDalekSentry(); speakDalek(); say('Dalek-style sentry robot: “Exterminate!” Incoming laser — keep moving.'); }
      }
      const facing = (aggressive ? robot.position : target).clone().sub(enemy.position); facing.y = 0; if (facing.lengthSq() > .001) enemy.rotation.y = Math.atan2(-facing.x, -facing.z);
      const beforeMoveX = enemy.position.x, beforeMoveZ = enemy.position.z;
      moveEnemy(enemy, target, speed, dt);
      enemy.userData.travelDistance = (enemy.userData.travelDistance || 0) + Math.hypot(enemy.position.x - beforeMoveX, enemy.position.z - beforeMoveZ);
      if (isSpider) {
        const lunging = elapsed < enemy.userData.lungeUntil;
        enemy.userData.legJoints.forEach(({ hip, knee, side, legIndex }) => {
          const pose = spiderLegPose({ travelDistance: enemy.userData.travelDistance, elapsed, legIndex, side, lunging });
          hip.rotation.set(0, pose.swing, side * (-.34 + pose.lift));
          knee.rotation.z = side * pose.knee;
        });
      } else {
        const wheelAngle = shooterWheelAngle(enemy.userData.travelDistance);
        enemy.userData.driveWheels.forEach((wheel) => { wheel.rotation.x = wheelAngle; });
        enemy.userData.turret.rotation.y = shooterTurretYaw(elapsed, i);
      }
      enemy.position.y = surfaceHeight(enemy.position) + (isSpider ? Math.sin(elapsed * 10 + i) * .055 : Math.sin(elapsed * 2.4 + i) * .028);
      if (Math.abs(robot.position.y - enemy.position.y) < 1.1 && robotHitsCircle(robot.position, robot.rotation.y, enemy.position, enemyRadius(enemy) + .08)) { if (isSpider) playSpiderSound('impact'); else playDalekSentry(); if (damageROB(isSpider ? `${enemy.userData.name} lunge` : `${enemy.userData.name} collision`, enemy.userData.contactDamage)) return; }
    }
    for (let i = enemyBolts.length - 1; i >= 0; i -= 1) { const bolt = enemyBolts[i], start = bolt.position.clone(); bolt.position.addScaledVector(bolt.userData.velocity, dt); const impact = firstProjectileImpact({ start: { x: start.x, z: start.z }, end: { x: bolt.position.x, z: bolt.position.z }, blockers: projectileBlockers(), targets: Math.abs(bolt.position.y - (robot.position.y + 1)) < 1.1 ? [{ id: 'rob', x: robot.position.x, z: robot.position.z, radius: .72 }] : [] }); if (impact || bolt.position.distanceTo(robot.position) > 42) { scene.remove(bolt); enemyBolts.splice(i, 1); if (impact?.kind === 'target') { playDalekSentry(); if (damageROB(bolt.userData.sourceName, bolt.userData.damage)) return; } } }
    for (let i = bolts.length - 1; i >= 0; i -= 1) { const bolt = bolts[i], start = bolt.position.clone(); bolt.position.addScaledVector(bolt.userData.velocity, dt); const targets = enemies.filter((enemy) => enemy.userData.alive).map((enemy) => ({ enemy, x: enemy.position.x, z: enemy.position.z, radius: (enemy.userData.type === 'spider' ? .72 : .8) * (enemy.userData.combatScale || 1) })), impact = firstProjectileImpact({ start: { x: start.x, z: start.z }, end: { x: bolt.position.x, z: bolt.position.z }, blockers: projectileBlockers(), targets }); if (impact) { scene.remove(bolt); bolts.splice(i, 1); if (impact.kind === 'wall') { say(`${bolt.userData.weapon.name} struck the wall. Reposition for a clear shot.`); continue; } const hit = impact.target.enemy, weaponLabel = bolt.userData.charge > .72 ? `charged ${bolt.userData.weapon.name.toLowerCase()}` : bolt.userData.weapon.name.toLowerCase(); damageEnemy(hit, weaponLabel, bolt.userData.damage || 1); if (bolt.userData.weapon.id === 'arcCannon') { const secondary = enemies.find((enemy) => enemy.userData.alive && enemy !== hit && enemy.position.distanceTo(hit.position) <= 2.2); if (secondary) damageEnemy(secondary, 'arc cannon chain', Math.max(1, Math.floor((bolt.userData.damage || 1) / 2))); } } else if (bolt.position.distanceTo(robot.position) > 42) { scene.remove(bolt); bolts.splice(i, 1); } }
    if (!gateDone && robot.position.distanceTo(gate.position) < 1.55) { gateDone = true; awardMissionPoints(250); say('Calibration gate bonus collected. Continue with the shared mission objectives.'); }
    if (keyObject.visible && robot.position.distanceTo(keyObject.position) < 1.45) { hasKey = true; keyObject.visible = false; awardMissionPoints(250); playSound('pickup'); say('Access key secured. Reach the orange panel and start ROB’s Flipper Zero hack.'); }
    cells.forEach((c) => { if (c.visible && !c.userData.got && robot.position.distanceTo(c.position) < 1) { c.userData.got = true; c.visible = false; cellCount += 1; objectives.cells.querySelector('[data-objective-text]').textContent = `Energy cells: ${cellCount} / ${level.cells.length}`; const restoredEnergy = energyPickupAmount(upgradeLevels.energyCapacity); energy = Math.min(maximumEnergy(upgradeLevels.energyCapacity), energy + restoredEnergy); awardMissionPoints(150); playSound('pickup'); say(`Energy cell ${cellCount} of ${level.cells.length} secured. Battery boosted by up to ${restoredEnergy}.`); if (cellCount === level.cells.length) mark('cells', 'All cells secured. Dock after the room is safe.', 300); } });
    shieldPickups.forEach((pickup) => { if (pickup.visible && !pickup.userData.got && shields < MAX_ROB_SHIELDS && robot.position.distanceTo(pickup.position) < 1.1) { const before = shields; shields = replenishROBShields(shields); pickup.userData.got = true; pickup.visible = false; awardMissionPoints(100); playSound('pickup'); say(`Shield capacitor restored ${shields - before} points. ROB shields: ${shields}/${MAX_ROB_SHIELDS}.`); } });
    repairPickups.forEach((pickup) => { if (pickup.visible && !pickup.userData.got && health < MAX_ROB_HEALTH && robot.position.distanceTo(pickup.position) < 1.1) { const before = health; health = repairROBHealth(health); pickup.userData.got = true; pickup.visible = false; awardMissionPoints(100); playSound('pickup'); say(`Repair kit restored ${health - before} hull points. ROB health: ${health}/${MAX_ROB_HEALTH}.`); } });
    if (!rocketFlight.airborne && Math.abs(robot.position.y - surfaceHeight(robot.position)) < .2 && cellCount === level.cells.length && enemies.every((e) => !e.userData.alive) && doorOpen && robot.position.distanceTo(dock.position) < 1.15) {
      const timeBonus = Math.max(0, level.bonus - Math.floor(levelElapsed) * 10), completedLevel = levelIndex + 1, earnedProgress = completedLevel > highestCompletedLevel, reward = earnedProgress ? unlockReward(completedLevel) : undefined;
      highestCompletedLevel = Math.max(highestCompletedLevel, completedLevel); saveProgress('robHighestCompletedLevel', highestCompletedLevel); updateWorkshop();
      const skillPoints = levelSkillReward(completedLevel);
      mark('dock', [reward, `Level cleared! +${skillPoints} skill points. Time score bonus: ${timeBonus}.`].filter(Boolean).join(' '), 500 + timeBonus, skillPoints);
      playSound('level-complete'); running = false; levelComplete = true; releaseAllInput(); stopMusic();
      if (levelIndex < levels.length - 1) {
        ui.start.hidden = true;
        ui.intermissionTitle.textContent = `Level ${completedLevel} cleared · Upgrade Bay`;
        ui.intermissionContinue.textContent = `Deploy to level ${completedLevel + 1}`;
        ui.intermission.hidden = false;
        updateWorkshop();
      } else {
        complete = true; ui.start.hidden = false; ui.start.textContent = 'Play campaign again';
        root.dispatchEvent(new CustomEvent('rob:campaign-complete', { detail: { score, durationSeconds: Math.round(elapsed), levelsCompleted: levels.length } }));
        say([reward, `Campaign complete with ${score.toLocaleString()} points. Add your call sign!`].filter(Boolean).join(' '));
      }
    }
  };
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const isFullscreen = () => fullscreenElement() === shell || shell.classList.contains('is-pseudo-fullscreen');
  const viewportHeight = () => Math.round(window.visualViewport?.height || innerHeight);
  const resize = () => { const w = viewport.clientWidth, h = isFullscreen() ? viewportHeight() : Math.max(isTouch ? 460 : 420, Math.min(720, w * .58)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const animate = () => {
    requestAnimationFrame(animate); const dt = Math.min(clock.getDelta(), .05); tick(dt); updateRobotWeapons();
    const flipperPose = robotBasePose();
    robotRig.baseFlipper.rotation.x = flipperPose.angle; robotRig.driveBase.rotation.x = flipperPose.pitch;
    robotRig.driveBase.position.y = flipperPose.lift - robot.position.y;
    const bodyPose = robTorsoPresentation({ basePitch: flipperPose.pitch, leanAngle: torsoLeanAngle, rearHeight: flipperPose.lift, rootHeight: robot.position.y, scale: 2.15, yaw: robotRig.torso.rotation.y });
    robotRig.torso.rotation.x = bodyPose.pitch; robotRig.torso.position.set(bodyPose.position.x, bodyPose.position.y, bodyPose.position.z); ui.flipperButtons.forEach((button) => { const target = button.dataset.flipperDirection; button.disabled = !running || rocketFlight.airborne || rocketHeld || supportMotion.phase !== 'grounded' || target === baseFlipperTarget || (climbingLedge && target === 'forward'); const compact = button.classList.contains('rob-sim__fire'); button.textContent = target === 'forward' ? (compact ? 'FLIPPER DOWN' : 'Flipper Down · F') : (compact ? 'FLIPPER UP' : 'Flipper Up · B'); button.setAttribute('aria-pressed', String(target === baseFlipperTarget)); });
    const speakerPulse = musicEnabled && running ? 1 + Math.max(0, Math.sin(elapsed * Math.PI * 8)) * .13 : 1; robotRig.speakerCones.forEach((cone, index) => cone.scale.set(1 + (speakerPulse - 1) * (index ? .78 : 1), 1, 1 + (speakerPulse - 1) * (index ? .78 : 1)));
    if (keyObject.visible) { keyObject.rotation.y += dt * 1.7; keyObject.position.y = surfaceHeight(keyObject.position) + .1 + Math.sin(elapsed * 3.2) * .09; keyBeaconMaterial.opacity = .42 + (Math.sin(elapsed * 4.4) + 1) * .13; }
    cells.forEach((c, i) => { if (c.visible) { c.rotation.y += dt * 1.4; c.position.y = (c.userData.surfaceHeight || 0) + .55 + Math.sin(elapsed * 2 + i) * .08; } });
    shieldPickups.forEach((pickup, i) => { if (pickup.visible) { pickup.rotation.y += dt * 1.8; pickup.position.y = (pickup.userData.surfaceHeight || 0) + Math.sin(elapsed * 2.3 + i) * .1; } });
    repairPickups.forEach((pickup, i) => { if (pickup.visible) { pickup.rotation.y -= dt * .9; pickup.position.y = (pickup.userData.surfaceHeight || 0) + Math.sin(elapsed * 1.8 + i) * .07; } });
    conveyors.forEach((conveyor) => conveyor.arrows.forEach(({ stripe, side, baseOffset }) => {
      const offset = conveyorArrowOffset({ baseOffset, elapsed, speed: conveyor.speed, span: conveyor.span, direction: conveyor.horizontal ? conveyor.dx : conveyor.dz });
      if (conveyor.horizontal) stripe.position.set(offset, .07, side * .3);
      else stripe.position.set(side * .3, .07, offset);
    }));
    const shield = stepBubbleShield({ remaining: shieldTimeRemaining, shields, running });
    shieldTimeRemaining = shield.remaining;
    robotRig.boosters.visible = upgradeLevels.rocketBooster > 0;
    robotRig.jets.forEach((jet, i) => { jet.visible = running && rocketFlight.thrusting; jet.scale.y = .8 + Math.sin(elapsed * 37 + i * 2) * .12; });
    ui.rocketButtons.forEach((button) => {
      button.disabled = !running || !upgradeLevels.rocketBooster;
      button.textContent = !upgradeLevels.rocketBooster ? 'BOOSTER · UPGRADE' : rocketFlight.thrusting ? 'BOOST ON · TAP TO LAND' : rocketFlight.airborne ? 'DESCENDING · TAP TO RISE' : 'BOOST · R / TAP · 18 E/s';
      if (button.hasAttribute('data-rocket-compact')) button.textContent = !upgradeLevels.rocketBooster ? 'Boost · Upgrade' : rocketFlight.thrusting ? 'Land · 18 E/s' : 'Boost · R';
      button.setAttribute('aria-pressed', String(rocketFlight.thrusting));
    });
    robotRig.shieldField.visible = shield.active;
    robotRig.shieldField.rotation.y += dt * .35;
    robotRig.shieldField.material.opacity = .22 * shield.fraction;
    ui.shieldButtons.forEach((button) => {
      button.disabled = !running || shields <= 0 || shield.active;
      button.setAttribute('aria-pressed', String(shield.active));
      button.textContent = shield.active ? `Shield ${shield.remaining.toFixed(1)}s` : 'Shield · E';
      button.setAttribute('aria-label', shield.active ? 'Bubble shield active' : 'Activate bubble shield');
    });
    camera.position.lerp(new THREE.Vector3(robot.position.x + 6.2, robot.position.y + 11.2, robot.position.z + 8.2), .06); camera.lookAt(robot.position.x, robot.position.y + .65, robot.position.z - 1.8);
    ui.time.textContent = new Date(elapsed * 1000).toISOString().slice(14, 22); ui.score.textContent = score; ui.points.textContent = upgradePoints; ui.lives.textContent = `${lives} / ${MAX_TRIAL_LIVES}`; ui.left.textContent = controls.left.toFixed(2); ui.right.textContent = controls.right.toFixed(2); ui.enemies.textContent = enemies.filter((e) => e.userData.alive).length;
    ui.health.value = health; ui.healthText.textContent = `${health} / ${MAX_ROB_HEALTH}`; ui.shields.value = shields; ui.shieldsText.textContent = `${shields} / ${MAX_ROB_SHIELDS}`; const energyMaximum = maximumEnergy(upgradeLevels.energyCapacity); ui.energy.max = energyMaximum; ui.energy.value = energy; ui.energyText.textContent = `${Math.floor(energy)} / ${energyMaximum}`; ui.security.hidden = securityAlertRemaining <= 0;
    const level = levels[levelIndex], hackDistance = robot.position.distanceTo(hackTerminal.position), doorHackAvailable = Boolean(level.door && !doorOpen && hackDistance <= 2.7), nearbyCamera = nearestHackableCamera(), hasActiveCamera = securityCameras.some((securityCamera) => !securityCamera.disabled), hackAvailable = doorHackAvailable || hasActiveCamera || hacking || Boolean(hackingCamera); ui.hack.hidden = !hackAvailable; ui.hack.disabled = hacking || Boolean(hackingCamera) || (!nearbyCamera && !doorHackAvailable); ui.hack.textContent = hackingCamera ? `▣ Hacking camera ${Math.round(hackingProgress * 100)}%` : hacking ? `▣ Hacking door ${Math.round(hackingProgress * 100)}%` : nearbyCamera ? '▣ Hack camera' : doorHackAvailable ? hasKey ? '▣ Hack door' : '▣ Key required' : '▣ Reach security camera';
    hackTerminalLamp.material.color.setHex(hacking ? 0xffcf33 : hasKey ? 0x37e887 : 0xff3030); hackTerminalLamp.material.emissive.setHex(hacking ? 0xb37700 : hasKey ? 0x087a35 : 0x8b0505);
    if (ui.resume) { ui.resume.hidden = running || highestCompletedLevel < 1; ui.resume.textContent = `Continue at Level ${Math.min(highestCompletedLevel + 1, levels.length)}`; }
    ui.workshopPoints.textContent = `${upgradePoints.toLocaleString()} skill points`;
    const boss = currentBoss(); ui.boss.hidden = !boss; if (boss) { ui.bossName.textContent = `${boss.userData.name} shields`; ui.bossText.textContent = `${boss.userData.health} / ${boss.userData.maxHealth}`; ui.bossHealth.max = boss.userData.maxHealth; ui.bossHealth.value = Math.max(0, boss.userData.health); }
    renderer.render(scene, camera);
  };

  const updateTouchDrive = () => { touch.forward = THREE.MathUtils.clamp([...activeDrivePointers.values()].reduce((sum, input) => sum + input.forward, 0), -1, 1); touch.steering = THREE.MathUtils.clamp([...activeDrivePointers.values()].reduce((sum, input) => sum + input.steering, 0), -1, 1); };
  const releaseDrive = (pointerId) => { const input = activeDrivePointers.get(pointerId); if (!input) return; input.button.classList.remove('is-pressed'); input.button.setAttribute('aria-pressed', 'false'); activeDrivePointers.delete(pointerId); updateTouchDrive(); };
  const resetTreadStick = (stick, side) => { touch[side] = 0; touch[`${side}Active`] = false; stick.style.setProperty('--stick-x', '0px'); stick.style.setProperty('--stick-y', '0px'); stick.setAttribute('aria-valuenow', '0'); stick.setAttribute('aria-valuetext', 'Stopped'); stick.classList.remove('is-active'); };
  const updateTreadStick = (stick, side, clientX, clientY) => { const rect = stick.getBoundingClientRect(), x = clientX - rect.left - rect.width / 2, y = clientY - rect.top - rect.height / 2, visualLimit = Math.min(rect.width, rect.height) * .31, distance = Math.hypot(x, y), visualScale = distance > visualLimit ? visualLimit / distance : 1, rawValue = THREE.MathUtils.clamp(-y / (rect.height * .34), -1, 1), value = Math.abs(rawValue) < .06 ? 0 : rawValue; touch[side] = value; touch[`${side}Active`] = true; stick.style.setProperty('--stick-x', `${x * visualScale}px`); stick.style.setProperty('--stick-y', `${y * visualScale}px`); stick.setAttribute('aria-valuenow', value.toFixed(2)); stick.setAttribute('aria-valuetext', value === 0 ? 'Stopped' : `${Math.round(Math.abs(value) * 100)}% ${value > 0 ? 'forward' : 'reverse'}`); stick.classList.add('is-active'); };
  const releaseTread = (pointerId) => { const input = activeTreadPointers.get(pointerId); if (!input) return; activeTreadPointers.delete(pointerId); resetTreadStick(input.stick, input.side); };
  const releaseAllInput = () => { keys.clear(); [...activeDrivePointers.keys()].forEach(releaseDrive); [...activeTreadPointers.keys()].forEach(releaseTread); root.querySelectorAll('[data-tread-stick]').forEach((stick) => resetTreadStick(stick, stick.dataset.treadStick)); touch.forward = touch.steering = controls.left = controls.right = 0; gamepadLaserHeld = false; gamepadShieldHeld = false; rocketHeld = gamepadRocketHeld = false; shieldTimeRemaining = 0; cancelLaserCharge(); };
  addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyQ', 'KeyF', 'KeyB', 'KeyE', 'KeyR'].includes(e.code)) e.preventDefault(); const firstPress = !keys.has(e.code); keys.add(e.code); if (firstPress && e.code === 'KeyR') setRocketHeld(true); if (firstPress && e.code === 'KeyE') activateShield(); if (firstPress && e.code === 'Space') saberSlash(); if (firstPress && e.code === 'KeyQ') beginLaserCharge(); if (firstPress && e.code === 'KeyF') commandBaseFlipper('forward'); if (firstPress && e.code === 'KeyB') commandBaseFlipper('rear'); }); addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'KeyR') setRocketHeld(false); if (e.code === 'KeyQ') releaseLaserCharge(); }); addEventListener('blur', releaseAllInput);
  root.querySelectorAll('[data-drive]').forEach((button) => { const forward = Number(button.dataset.forward || 0), steering = Number(button.dataset.steering || 0); button.setAttribute('aria-pressed', 'false'); button.addEventListener('pointerdown', (e) => { e.preventDefault(); activeDrivePointers.set(e.pointerId, { forward, steering, button }); updateTouchDrive(); button.classList.add('is-pressed'); button.setAttribute('aria-pressed', 'true'); button.setPointerCapture?.(e.pointerId); }); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((eventName) => button.addEventListener(eventName, (e) => releaseDrive(e.pointerId))); });
  root.querySelectorAll('[data-tread-stick]').forEach((stick) => { const side = stick.dataset.treadStick; stick.addEventListener('pointerdown', (e) => { e.preventDefault(); if (touch[`${side}Active`]) return; activeTreadPointers.set(e.pointerId, { side, stick }); stick.setPointerCapture?.(e.pointerId); updateTreadStick(stick, side, e.clientX, e.clientY); }); stick.addEventListener('pointermove', (e) => { if (activeTreadPointers.get(e.pointerId)?.stick === stick) updateTreadStick(stick, side, e.clientX, e.clientY); }); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((eventName) => stick.addEventListener(eventName, (e) => { e.preventDefault(); releaseTread(e.pointerId); })); stick.addEventListener('keydown', (e) => { if (!['ArrowUp', 'ArrowDown'].includes(e.code)) return; e.preventDefault(); e.stopPropagation(); const value = e.code === 'ArrowUp' ? 1 : -1, rect = stick.getBoundingClientRect(); updateTreadStick(stick, side, rect.left + rect.width / 2, rect.top + rect.height * (.5 - value * .34)); }); stick.addEventListener('keyup', (e) => { if (!['ArrowUp', 'ArrowDown'].includes(e.code)) return; e.preventDefault(); e.stopPropagation(); resetTreadStick(stick, side); }); });
  ui.laserButtons.forEach((button) => { button.addEventListener('pointerdown', (e) => { e.preventDefault(); beginLaserCharge(); button.setPointerCapture?.(e.pointerId); }); button.addEventListener('pointerup', (e) => { e.preventDefault(); releaseLaserCharge(); }); button.addEventListener('pointercancel', (e) => { e.preventDefault(); cancelLaserCharge(); }); button.addEventListener('lostpointercapture', releaseLaserCharge); }); root.querySelectorAll('[data-sim-saber]').forEach((button) => button.addEventListener('pointerdown', (e) => { e.preventDefault(); saberSlash(); }));
  ui.rocketButtons.forEach((button) => button.addEventListener('click', () => setRocketHeld(!rocketHeld)));
  ui.replay.addEventListener('click', () => { if (!levelComplete) return; loadLevel(levelIndex); running = true; ui.start.hidden = true; startMusic(); });
  ui.flipperButtons.forEach((button) => button.addEventListener('click', () => commandBaseFlipper(button.dataset.flipperDirection)));
  ui.shieldButtons.forEach((button) => button.addEventListener('click', activateShield));
  ui.hack.addEventListener('click', startFlipperHack);
  const enterPseudoFullscreen = () => { shell.classList.add('is-pseudo-fullscreen'); document.body.classList.add('rob-game-open'); };
  const leavePseudoFullscreen = () => { shell.classList.remove('is-pseudo-fullscreen'); document.body.classList.remove('rob-game-open'); };
  const syncFullscreen = () => { const open = Boolean(fullscreenElement()) || shell.classList.contains('is-pseudo-fullscreen'); shell.classList.toggle('is-fullscreen', open); ui.fullscreen.textContent = open ? '× Exit' : '⛶ Fullscreen'; ui.fullscreen.setAttribute('aria-label', open ? 'Exit fullscreen' : 'Enter fullscreen'); releaseAllInput(); requestAnimationFrame(resize); };
  ui.fullscreen.addEventListener('click', async () => { try { if (fullscreenElement()) await (document.exitFullscreen?.() || document.webkitExitFullscreen?.()); else if (shell.classList.contains('is-pseudo-fullscreen')) leavePseudoFullscreen(); else if (shell.requestFullscreen) await shell.requestFullscreen({ navigationUI: 'hide' }); else if (shell.webkitRequestFullscreen) shell.webkitRequestFullscreen(); else enterPseudoFullscreen(); if (isFullscreen()) screen.orientation?.lock?.('landscape')?.catch?.(() => {}); syncFullscreen(); } catch { enterPseudoFullscreen(); syncFullscreen(); } }); ['fullscreenchange', 'webkitfullscreenchange'].forEach((eventName) => document.addEventListener(eventName, syncFullscreen)); window.visualViewport?.addEventListener('resize', resize); addEventListener('orientationchange', () => requestAnimationFrame(resize));
  const levelStartMessage = () => levels[levelIndex].requiresBooster
    ? `Level ${levelIndex + 1}: hold R / gamepad LB, or tap Boost, to rise. Release or tap Land to descend onto the blue pads. Collect the elevated cells and land at the summit dock; rockets use 18 energy per second.`
    : `Level ${levelIndex + 1}: lower the flippers with F to lift the front, then drive onto the step for automatic rear support. Use B to raise them manually. ${levels[levelIndex].key ? 'Find the key and use the orange hack panel.' : 'Clear the targets and collect every cell.'}`;
  ui.intermissionContinue.addEventListener('click', () => {
    if (!levelComplete || levelIndex >= levels.length - 1) return;
    if (levels[levelIndex + 1]?.requiresBooster && !upgradeLevels.rocketBooster) { say('Install the 900-point Plasma Booster before deploying. Replay this level if you need more skill points.'); return; }
    levelIndex += 1; loadLevel(levelIndex); running = true; startMusic(); playSound('mission-start'); ui.start.hidden = true;
    say(levelStartMessage());
    viewport.focus();
  });
  ui.start.addEventListener('click', () => { if (complete) reset(); else if (levelComplete) { if (levels[levelIndex + 1]?.requiresBooster && !upgradeLevels.rocketBooster) return; levelIndex += 1; loadLevel(levelIndex); } if (lives === 0) lives = MAX_TRIAL_LIVES; running = true; startMusic(); playSound('mission-start'); ui.start.hidden = true; say(levelStartMessage()); viewport.focus(); }); ui.reset.addEventListener('click', reset); root.querySelector('[data-sim-sound]').addEventListener('click', (event) => { soundEnabled = !soundEnabled; if (!soundEnabled) window.speechSynthesis?.cancel?.(); event.currentTarget.setAttribute('aria-pressed', String(soundEnabled)); event.currentTarget.textContent = soundEnabled ? '♪ Effects' : 'Effects off'; }); root.querySelector('[data-sim-music]').addEventListener('click', (event) => { musicEnabled = !musicEnabled; event.currentTarget.setAttribute('aria-pressed', String(musicEnabled)); event.currentTarget.textContent = musicEnabled ? '♫ Techno' : 'Music off'; if (musicEnabled && running) startMusic(); else stopMusic(); });
  ui.resume = root.querySelector('[data-sim-resume]'); ui.resume.hidden = highestCompletedLevel < 1; ui.resume.textContent = `Continue at Level ${Math.min(highestCompletedLevel + 1, levels.length)}`; ui.resume.addEventListener('click', () => { running = false; levelIndex = Math.min(highestCompletedLevel, levels.length - 1); if (levels[levelIndex].requiresBooster && !upgradeLevels.rocketBooster) levelIndex = 14; loadLevel(levelIndex); viewport.focus(); });
  ui.finish.addEventListener('change', () => { selectedFinishID = ui.finish.value; droidProfile = writeDroidProfile({ ...droidProfile, finish: selectedFinishID }); applyLoadout(); say(`${selectedFinish().name} finish equipped.`); });
  ui.faceColor.addEventListener('change', () => { selectedFaceColorID = ui.faceColor.value; droidProfile = writeDroidProfile({ ...droidProfile, faceColor: selectedFaceColorID }); applyLoadout(); say(`${selectedFaceColor().name} smile equipped.`); });
  ui.ranged.addEventListener('change', () => { const requested = rangedWeapons.find(({ id }) => id === ui.ranged.value); if (!requested || !isUnlocked(requested, highestCompletedLevel)) { say(`Complete Level ${requested?.requiredLevel ?? 0} to unlock ${requested?.name ?? 'that weapon'}.`); updateWorkshop(); return; } selectedRangedID = requested.id; saveProgress('robRangedWeapon', selectedRangedID); applyLoadout(); say(`${requested.name} equipped.`); });
  ui.melee.addEventListener('change', () => { const requested = meleeWeapons.find(({ id }) => id === ui.melee.value); if (!requested || !isUnlocked(requested, highestCompletedLevel)) { say(`Complete Level ${requested?.requiredLevel ?? 0} to unlock ${requested?.name ?? 'that weapon'}.`); updateWorkshop(); return; } selectedMeleeID = requested.id; saveProgress('robMeleeWeapon', selectedMeleeID); applyLoadout(); say(`${requested.name} equipped.`); });
  ui.upgradeButtons.forEach((button) => button.addEventListener('click', () => {
    const upgrade = upgrades.find(({ id }) => id === button.dataset.upgrade), level = upgradeLevels[upgrade.id], cost = upgradeCost(upgrade, level);
    if (cost === undefined) { say(`${upgrade.name} is already fully upgraded.`); return; }
    const requiredLevel = upgradeRequiredCompletedLevel(upgrade, level);
    if (highestCompletedLevel < requiredLevel) { say(`Clear Level ${requiredLevel} for the next ${upgrade.name} rank.`); return; }
    if (upgradePoints < cost) { say(`${cost - upgradePoints} more skill points needed for ${upgrade.name}.`); return; }
    upgradePoints -= cost; upgradeLevels[upgrade.id] += 1; saveProgress('robSkillPoints', upgradePoints); saveProgress(`rob${upgrade.id}Level`, upgradeLevels[upgrade.id]); if (upgrade.id === 'energyCapacity') energy = Math.min(maximumEnergy(upgradeLevels.energyCapacity), energy + 60); updateWorkshop(); const benefit = upgrade.id === 'speedBoost' ? `${Math.round(driveSpeedMultiplier(upgradeLevels.speedBoost) * 100)}% drive speed` : upgrade.id === 'energyCapacity' ? `${maximumEnergy(upgradeLevels.energyCapacity)} max energy` : undefined; say(`${upgrade.name} upgraded to Level ${upgradeLevels[upgrade.id]}${benefit ? ` — ${benefit}.` : '.'}`);
  }));
  window.addEventListener('rob:droid-profile', (event) => {
    droidProfile = sanitizeDroidProfile(event.detail?.profile);
    selectedFinishID = droidProfile.finish;
    selectedFaceColorID = droidProfile.faceColor;
    applyLoadout();
    if (event.detail?.announce) say(`${droidProfile.name} loaded with ${droidProfile.material.replace(/([A-Z])/g, ' $1').toLowerCase()} housing.`);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAllInput(); }); addEventListener('pagehide', releaseAllInput); new ResizeObserver(resize).observe(viewport); reset(); if (economyMigrationMessage) say(economyMigrationMessage); resize(); animate();
}
