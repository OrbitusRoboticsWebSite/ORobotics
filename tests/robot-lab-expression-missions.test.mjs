import assert from 'node:assert/strict';
import test from 'node:test';
import { createRobExpressionElectronFlows, createRobExpressionMissions } from '../assets/js/robot-lab-expression-missions.mjs';

const edge = (a, b) => [a, b];

function endpointsFor(mission) {
  const endpoints = new Set();
  mission.components.forEach((component) => {
    (component.ports || []).forEach((port) => endpoints.add(`${component.id}.${port.id}`));
  });
  return endpoints;
}

test('book bridge adds ten ordered missions and aligned flow maps', () => {
  const missions = createRobExpressionMissions(edge);
  assert.equal(missions.length, 10);
  assert.equal(createRobExpressionElectronFlows(edge).length, 10);
  assert.match(missions[0].kicker, /Build 81/);
  assert.match(missions.at(-1).kicker, /Build 90/);
});

test('every expression-system wire and animated flow uses a rendered terminal', () => {
  const missions = createRobExpressionMissions(edge);
  const flows = createRobExpressionElectronFlows(edge);
  missions.forEach((mission, missionIndex) => {
    const endpoints = endpointsFor(mission);
    [...mission.required, ...(flows[missionIndex].wires || []), ...(flows[missionIndex].inside || [])].forEach(([from, to]) => {
      assert.equal(endpoints.has(from), true, `Build ${missionIndex + 81} is missing ${from}`);
      assert.equal(endpoints.has(to), true, `Build ${missionIndex + 81} is missing ${to}`);
      assert.notEqual(from, to, `Build ${missionIndex + 81} contains a zero-length flow`);
    });
  });
});

test('every book-bridge completion key is reachable from a simulator control', () => {
  createRobExpressionMissions(edge).forEach((mission, missionIndex) => {
    const controlKeys = new Set(mission.robot.controls.flatMap((item) => Object.keys(item.set)));
    mission.completeKeys.forEach((key) => assert.equal(controlKeys.has(key), true, `Build ${missionIndex + 81} has no control for ${key}`));
  });
});

test('the bridge covers flipper recovery, ROB audio, far-field voice, and public-show boundaries', () => {
  const copy = JSON.stringify(createRobExpressionMissions(edge));
  ['flipper', 'center of mass', 'speaker', 'transducer', 'magnetic', 'techno', 'conference microphone', 'signal-to-noise', 'echo', 'privacy', 'STOP'].forEach((term) => assert.match(copy, new RegExp(term, 'i')));
});
