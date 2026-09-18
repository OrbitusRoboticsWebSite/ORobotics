import * as THREE from 'three';
import { TACTICAL, stepJammer, signalJammed, gelDischarge, nextPEQMode } from './rob-tactical.mjs';
import { buildTacticalVisual, applyTacticalVisual } from './rob-tactical-visual.mjs';
import { firstProjectileImpact } from './rob-game-rules.mjs';

export function createTacticalGame({ root, scene, robot, rig, arms, enemies, state, energyChanged, shotFired, damageEnemy, reward, openDoor, blockers, say, cancelCharge = () => {} }) {
  const visual = buildTacticalVisual(rig.torso, 2.15); scene.add(visual.ring);
  let active = false, equipped = false, held = false, mode = 'off', lastShot = -Infinity, activated = false;
  const shots = [], pelletGeometry = new THREE.SphereGeometry(.085, 10, 8), pelletMaterial = new THREE.MeshBasicMaterial({ color: 0x59ffce });
  const target = new THREE.Group(); target.name = 'Long-distance gel relay switch'; scene.add(target);
  const targetFace = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .09, 24), new THREE.MeshStandardMaterial({ color: 0xffae32, emissive: 0x713900 }));
  targetFace.rotation.x = Math.PI / 2; target.add(targetFace);
  const targetRing = new THREE.Mesh(new THREE.TorusGeometry(.41, .04, 8, 32), new THREE.MeshBasicMaterial({ color: 0x50e6ff })); target.add(targetRing);
  const markers = [];
  const syncMarkers = () => {
    for (const enemy of enemies) {
      if (markers.some(item => item.enemy === enemy)) continue;
      const marker = new THREE.Mesh(new THREE.TorusGeometry(.8, .035, 6, 24), new THREE.MeshBasicMaterial({ color: 0xba83ff }));
      marker.visible = false; scene.add(marker); markers.push({ enemy, marker });
    }
  };
  const buttonGroups = Object.fromEntries(['jammer', 'gel', 'peq'].map(name => [name, [...root.querySelectorAll(`[data-sim-${name}]`)]]));
  const api = {
    get active() { return active; }, get equipped() { return equipped; },
    isJammed(point, flags = {}) { return signalJammed({ active: active && state().running, origin: robot.position, target: point, ...flags }); },
    toggleJammer() {
      const s = state(); if (!s.running) return;
      if (!s.upgrades.jammer) { say('Install the Jammer: 1,800 skill points after Level 5.'); return; }
      if (!active && s.energy < 1) { say('Jammer needs energy. Let ROB recharge.'); return; }
      active = !active; say(active ? 'Jammer ON · 14 E/s. Nearby basic robots and camera signals scrambled; bosses resist.' : 'Jammer OFF.');
    },
    toggleGel() {
      const s = state(); if (!s.running) return;
      if (!s.upgrades.gelBlaster) { say('StrikeForce Gel Kit costs 6,000 skill points after Level 10.'); return; }
      if (!equipped && s.handsBusy) { say('Stand upright and free both hands before drawing the gel blaster.'); return; }
      cancelCharge(); equipped = !equipped; held = false; say(equipped ? 'Two-hand gel blaster ready. Hold Q to fire · V cycles PEQ. Aim at amber relay switches for a bonus.' : 'Gel blaster stowed.');
    },
    cyclePEQ() { if (!equipped) return; mode = nextPEQMode(mode); say(`PEQ: ${mode === 'infrared' ? 'infrared sensor view — nearby targets outlined' : mode}.`); },
    stow() { equipped = held = false; },
    release() { held = false; },
    releaseInput() { held = active = false; },
    press() { if (!equipped) return false; held = true; api.fire(); return true; },
    fire() {
      const s = state(), discharge = gelDischarge({ installed: s.upgrades.gelBlaster, equipped, running: s.running, handsBusy: s.handsBusy, energy: s.energy, elapsed: s.elapsed, lastShot });
      if (!discharge.fired) { if (s.energy < TACTICAL.gelCost) held = false; return; }
      lastShot = discharge.lastShot; energyChanged(discharge.energy); shotFired();
      robot.updateMatrixWorld(true);
      const pellet = new THREE.Mesh(pelletGeometry, pelletMaterial);
      // The torso moves with terrain support; projectiles keep the visible muzzle's world transform.
      visual.muzzle.getWorldPosition(pellet.position);
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(visual.muzzle.getWorldQuaternion(new THREE.Quaternion()));
      scene.add(pellet); shots.push({ pellet, direction, distance: 0 });
    },
    reset(position) {
      api.releaseInput(); equipped = false; mode = 'off'; lastShot = -Infinity; activated = false;
      shots.splice(0).forEach(({ pellet }) => scene.remove(pellet)); target.position.copy(position); targetFace.material.color.setHex(0xffae32);
    },
    tick(delta) {
      const s = state(); if (!s.running) { api.releaseInput(); return; }
      const jam = stepJammer({ active, installed: s.upgrades.jammer, running: s.running, energy: s.energy, delta });
      if (active && !jam.active) say('Jammer battery depleted — switched off.');
      active = jam.active; energyChanged(jam.energy);
      if (s.handsBusy) api.stow();
      if (held) api.fire();
      for (let i = shots.length - 1; i >= 0; i--) {
        const shot = shots[i], start = shot.pellet.position.clone(), step = Math.min(TACTICAL.gelSpeed * delta, TACTICAL.gelRange - shot.distance);
        shot.pellet.position.addScaledVector(shot.direction, step); shot.distance += step;
        const targets = enemies.filter(e => e.userData.alive && Math.abs(shot.pellet.position.y - (e.position.y + 1)) < 1.25)
          .map(e => ({ enemy: e, x: e.position.x, z: e.position.z, radius: .8 * (e.userData.combatScale || 1) }));
        if (!activated && Math.abs(shot.pellet.position.y - target.position.y) < .5) targets.push({ relay: true, x: target.position.x, z: target.position.z, radius: .43 });
        const impact = firstProjectileImpact({ start, end: shot.pellet.position, blockers: blockers(), targets });
        if (impact?.kind === 'target') {
          if (impact.target.relay) { activated = true; targetFace.material.color.setHex(0x51ffad); openDoor(); reward(TACTICAL.switchScore, TACTICAL.switchSkill); say('Remote relay activated! Security door released · +60 skill points.'); }
          else damageEnemy(impact.target.enemy, 'gel blaster', TACTICAL.gelDamage);
        }
        if (impact || shot.distance >= TACTICAL.gelRange) { scene.remove(shot.pellet); shots.splice(i, 1); }
      }
    },
    render() {
      const s = state(), drawn = equipped && !s.handsBusy;
      applyTacticalVisual(visual, { installed: s.upgrades.jammer > 0, active: active && s.running, equipped: drawn, mode, elapsed: s.elapsed });
      arms.forEach(arm => { arm.visible = !drawn; });
      if (drawn) { rig.sabers.forEach(saber => { saber.visible = false; }); rig.hammer.visible = false; rig.lockLamp.visible = rig.targetBeam.visible = false; }
      visual.ring.position.copy(robot.position); visual.ring.position.y += .03;
      target.visible = s.upgrades.gelBlaster > 0; targetRing.rotation.z = s.elapsed * .4;
      syncMarkers();
      markers.forEach(({ enemy, marker }) => {
        marker.visible = enemy.userData.alive && (api.isJammed(enemy.position, enemy.userData) || (drawn && mode === 'infrared' && enemy.position.distanceTo(robot.position) < 18
          && !firstProjectileImpact({ start: robot.position, end: enemy.position, blockers: blockers(), targets: [] })));
        marker.scale.setScalar(api.isJammed(enemy.position, enemy.userData) ? 1 + Math.sin(s.elapsed * 25) * .07 : 1);
        marker.position.copy(enemy.position); marker.position.y += 1.7; marker.quaternion.copy(robot.quaternion);
      });
      buttonGroups.jammer.forEach(b => { b.hidden = !s.upgrades.jammer; b.disabled = !s.running; b.textContent = active ? 'JAM ON · 14 E/s' : 'Jammer · J'; b.setAttribute('aria-pressed', String(active)); });
      buttonGroups.gel.forEach(b => { b.hidden = !s.upgrades.gelBlaster; b.disabled = !s.running; b.textContent = drawn ? 'Stow Gel · T' : 'Draw Gel · T'; b.setAttribute('aria-pressed', String(drawn)); });
      buttonGroups.peq.forEach(b => { b.hidden = !s.upgrades.gelBlaster; b.disabled = !drawn; b.textContent = `PEQ ${mode} · V`; });
      if (drawn) root.querySelectorAll('[data-sim-lock]').forEach(label => { label.textContent = `GEL · MANUAL AIM · PEQ ${mode.toUpperCase()}`; label.classList.remove('is-locked'); });
      if (drawn) root.querySelectorAll('[data-sim-laser]').forEach(b => { b.disabled = !s.running || s.energy < TACTICAL.gelCost; b.textContent = 'GEL · 3 E · hold Q'; b.setAttribute('aria-label', 'Hold to fire gel pellets'); });
    },
  };
  buttonGroups.jammer.forEach(b => b.addEventListener('click', api.toggleJammer));
  buttonGroups.gel.forEach(b => b.addEventListener('click', api.toggleGel));
  buttonGroups.peq.forEach(b => b.addEventListener('click', api.cyclePEQ));
  return api;
}
