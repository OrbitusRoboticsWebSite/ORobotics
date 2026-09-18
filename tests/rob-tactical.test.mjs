import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TACTICAL, stepJammer, signalJammed, gelDischarge, nextPEQMode } from '../assets/js/rob-tactical.mjs';
import { createTacticalGame } from '../assets/js/rob-tactical-game.mjs';
import { buildROBVisual } from '../assets/js/rob-visual-model.mjs';
import { upgrades, upgradeCost, upgradeRequiredCompletedLevel, updateDriveEnergy } from '../assets/js/rob-game-rules.mjs';
import model from '../assets/js/rob-tactical-model.mjs';

test('tactical upgrades are premium, level-gated, single purchases', () => {
  const jammer = upgrades.find(u => u.id === 'jammer'), gel = upgrades.find(u => u.id === 'gelBlaster');
  assert.equal(upgradeCost(jammer, 0), 1800); assert.equal(upgradeRequiredCompletedLevel(jammer, 0), 5);
  assert.equal(upgradeCost(gel, 0), 6000); assert.equal(upgradeRequiredCompletedLevel(gel, 0), 10);
  assert.equal(upgradeCost(gel, 1), undefined);
});
test('jammer drains while stationary, stops on depletion, and permits subsequent recharge', () => {
  let s = { active: true, installed: true, running: true, energy: 20, delta: 1 };
  s = { ...s, ...stepJammer(s) }; assert.equal(s.energy, 6); assert.equal(s.active, true);
  s = { ...s, ...stepJammer(s) }; assert.equal(s.energy, 0); assert.equal(s.active, false);
  assert.equal(updateDriveEnergy({ energy: 0, maximum: 100, moving: false, charging: s.active, delta: 1 }), 6);
  assert.equal(stepJammer({ ...s, active: true, energy: 100, running: false }).energy, 100);
  assert.equal(stepJammer({ ...s, active: true, energy: 100, installed: false }).active, false);
});
test('signal scramble is bounded in 3D and excludes boss and mini-boss robots', () => {
  const s = { active: true, origin: { x: 0, y: 0, z: 0 }, target: { x: 8, y: 0, z: 0 } };
  assert.equal(signalJammed(s), true); assert.equal(signalJammed({ ...s, target: { x: 8.01, z: 0 } }), false);
  assert.equal(signalJammed({ ...s, target: { x: 0, y: 9, z: 0 } }), false);
  assert.equal(signalJammed({ ...s, isBoss: true }), false); assert.equal(signalJammed({ ...s, isMiniBoss: true }), false);
});
test('gel fire requires ownership, free hands, energy and its firing interval', () => {
  const s = { installed: true, equipped: true, running: true, handsBusy: false, energy: 5, elapsed: 1, lastShot: 0 };
  assert.equal(gelDischarge(s).energy, 2);
  for (const patch of [{ installed: false }, { equipped: false }, { running: false }, { handsBusy: true }, { energy: 2 }, { lastShot: .9 }]) {
    assert.equal(gelDischarge({ ...s, ...patch }).fired, false);
  }
  assert.deepEqual(['off', 'blue', 'infrared', 'flashlight'].map(nextPEQMode), ['blue', 'infrared', 'flashlight', 'off']);
});

function fixture(walls = []) {
  const scene = new THREE.Scene(), base = buildROBVisual({ scale: 2.15 }); scene.add(base.root);
  base.root.position.x = -.14 * 2.15;
  const rig = { torso: base.torso, sabers: [], hammer: {}, lockLamp: {}, targetBeam: {} };
  let state = { running: true, energy: 100, elapsed: 0, upgrades: { jammer: 1, gelBlaster: 1 }, handsBusy: false }, points = 0, opened = 0, damage = 0;
  const enemies = [];
  const game = createTacticalGame({ root: { querySelectorAll: () => [] }, scene, robot: base.root, rig, arms: base.arms, enemies,
    state: () => state, energyChanged: value => { state.energy = value; }, shotFired() {}, say() {},
    damageEnemy: (enemy, weapon, amount) => { damage += amount; enemy.userData.alive = false; },
    reward: (score, skill) => { points += skill; }, openDoor: () => { opened++; }, blockers: () => walls });
  game.reset(new THREE.Vector3(0, .846 * 2.15, -6));
  return { game, state, scene, enemies, base, step: (n = 12) => { for (let i = 0; i < n; i++) { state.elapsed += .05; game.tick(.05); } }, result: () => ({ points, opened, damage }) };
}
test('a distant relay opens the door and rewards only once; walls absorb gel pellets first', () => {
  const f = fixture(); f.game.toggleGel(); f.game.press(); f.game.release(); f.step();
  assert.deepEqual(f.result(), { points: 60, opened: 1, damage: 0 });
  f.game.press(); f.game.release(); f.step(); assert.equal(f.result().points, 60);
  const blocked = fixture([{ x: 0, z: -3, w: 2, d: .2 }]); blocked.game.toggleGel(); blocked.game.press(); blocked.game.release(); blocked.step();
  assert.deepEqual(blocked.result(), { points: 0, opened: 0, damage: 0 });
});
test('gel pellets hit intervening enemies and cargo stows the two-hand pose', () => {
  const f = fixture(), enemy = new THREE.Group(); enemy.position.set(0, 0, -3); enemy.userData = { alive: true };
  f.enemies.push(enemy); f.game.toggleGel(); f.game.render(); assert.equal(f.base.arms[0].visible, false);
  f.game.press(); f.game.release(); f.step(); assert.equal(f.result().damage, TACTICAL.gelDamage); assert.equal(f.result().opened, 0);
  f.state.handsBusy = true; f.step(1); f.game.render(); assert.equal(f.game.equipped, false); assert.equal(f.base.arms[0].visible, true);
  f.game.toggleJammer(); f.game.releaseInput(); assert.equal(f.game.active, false);
});
test('shared model has upward backpack antennas, two gripping hands and all three PEQ apertures', () => {
  const antennas = model.parts.filter(p => p.name.startsWith('Upright antenna'));
  assert.equal(antennas.length, 16);
  assert.ok(antennas.every(p => p.position[2] > 0 && p.position[1] > .9 && p.rotation[3] === 1));
  const palms = model.parts.filter(p => p.name.includes('gripping palm'));
  assert.equal(palms.length, 2); assert.ok(palms.every(p => p.position[0] > 0 && p.position[2] < 0));
  for (const name of ['PEQ Blue laser lens', 'PEQ Infrared laser lens', 'PEQ Flashlight lens']) assert.ok(model.parts.some(p => p.name === name));
});
