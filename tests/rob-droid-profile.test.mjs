import test from 'node:test';
import assert from 'node:assert/strict';
import {
  droidFinishes,
  decodeDroidProfile,
  droidSectionProgress,
  encodeDroidProfile,
  profileWithCurriculum,
  sanitizeDroidProfile,
} from '../assets/js/rob-droid-profile.mjs';
import { finishes } from '../assets/js/rob-game-rules.mjs';

test('a Droid Code round-trips every shared cosmetic and assembled section', () => {
  const profile = sanitizeDroidProfile({
    name: 'Nova 7', finish: 'plasmaPurple', faceColor: 'cyan', material: 'brushedAluminum', housing: 'festivalArmor',
    sections: ['treads', 'torso', 'cameraNetwork', 'baseFlipper', 'voiceAudio', 'showReady'],
  });
  assert.deepEqual(decodeDroidProfile(encodeDroidProfile(profile)), profile);
});

test('Droid Codes reject copy damage and unsupported values are sanitized', () => {
  const code = encodeDroidProfile({ name: '<script>', finish: 'invisible', material: 'unobtainium' });
  const profile = decodeDroidProfile(code);
  assert.equal(profile.name, 'script');
  assert.equal(profile.finish, 'graphite');
  assert.equal(profile.material, 'powderCoatedSteel');
  assert.throws(() => decodeDroidProfile(`${code.slice(0, -1)}${code.endsWith('0') ? '1' : '0'}`), /damaged/);
});

test('robot sections assemble only after every build in their range is complete', () => {
  const through37 = Array.from({ length: 37 }, (_, index) => index);
  let treads = droidSectionProgress(through37).find(({ id }) => id === 'treads');
  assert.equal(treads.completed, 12);
  assert.equal(treads.assembled, false);

  const through38 = [...through37, 37];
  treads = droidSectionProgress(through38).find(({ id }) => id === 'treads');
  assert.equal(treads.completed, 13);
  assert.equal(treads.assembled, true);
  assert.deepEqual(profileWithCurriculum({}, through38).sections, ['treads']);
});

test('imported robot sections survive on a device without matching local progress', () => {
  const profile = profileWithCurriculum({ sections: ['treads', 'torso'] }, []);
  assert.deepEqual(profile.sections, ['treads', 'torso']);
});

test('book-bridge build ranges assemble the lift, audio, and show-ready sections', () => {
  const through90 = Array.from({ length: 90 }, (_, index) => index);
  const progress = droidSectionProgress(through90);
  assert.equal(progress.find(({ id }) => id === 'baseFlipper').required, 4);
  assert.equal(progress.find(({ id }) => id === 'voiceAudio').required, 5);
  assert.equal(progress.find(({ id }) => id === 'showReady').required, 1);
  assert.deepEqual(profileWithCurriculum({}, through90).sections.slice(-3), ['baseFlipper', 'voiceAudio', 'showReady']);
});

test('droid builder and training game expose the same finish palette', () => {
  assert.deepEqual(droidFinishes, finishes);
});
