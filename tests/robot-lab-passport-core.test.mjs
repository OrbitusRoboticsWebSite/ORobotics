import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROB_SCHOOL_TOTAL,
  cleanMakerName,
  decodeProgress,
  encodeProgress,
  mergeCompleted,
  normalizeCompleted,
  rewardCodeFromHex,
} from '../assets/js/robot-lab-passport-core.mjs';

test('learner passport round-trips all 80 mission bits', () => {
  const completed = Array.from({ length: ROB_SCHOOL_TOTAL }, (_, index) => index);
  const encoded = encodeProgress(completed);
  assert.match(encoded, /^school-80-v1:[0-9a-f]{20}$/);
  assert.deepEqual(decodeProgress(encoded), completed);
});

test('progress merge is a bounded, sorted union', () => {
  assert.deepEqual(mergeCompleted([0, 2, 79], [1, 2, 80, -1], ['3']), [0, 1, 2, 79]);
  assert.deepEqual(normalizeCompleted([79, 0, 79]), [0, 79]);
  assert.deepEqual(decodeProgress('wrong-version:ffff'), []);
});

test('maker names and reward codes expose only constrained display values', () => {
  assert.equal(cleanMakerName('  Kid <script> ROB!!  '), 'Kid script ROB');
  assert.equal(cleanMakerName(''), 'ROB MAKER');
  assert.equal(rewardCodeFromHex('abcdef1234567890'), 'ABCD-EF12-3456');
});
