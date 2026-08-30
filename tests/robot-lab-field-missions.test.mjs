import assert from 'node:assert/strict';
import test from 'node:test';
import { createRobFieldElectronFlows, createRobFieldMissions } from '../assets/js/robot-lab-field-missions.mjs';

const edge = (a, b) => [a, b];
const fixedPorts = {
  battery: ['pos', 'neg'],
  fuse: ['in', 'out'],
};

function endpointsFor(mission) {
  const endpoints = new Set();
  mission.components.forEach((component) => {
    const portIds = component.ports?.map((port) => port.id) || fixedPorts[component.type] || [];
    portIds.forEach((portId) => endpoints.add(`${component.id}.${portId}`));
  });
  return endpoints;
}

test('field systems campaign adds 30 ordered missions and aligned flow maps', () => {
  const missions = createRobFieldMissions(edge);
  assert.equal(missions.length, 30);
  assert.equal(createRobFieldElectronFlows(edge).length, 30);
  assert.match(missions[0].kicker, /Build 51/);
  assert.match(missions.at(-1).kicker, /Build 80/);
});

test('every field-system wire ends on a rendered terminal', () => {
  createRobFieldMissions(edge).forEach((mission, missionIndex) => {
    const endpoints = endpointsFor(mission);
    mission.required.forEach(([from, to]) => {
      assert.equal(endpoints.has(from), true, `Build ${missionIndex + 51} is missing ${from}`);
      assert.equal(endpoints.has(to), true, `Build ${missionIndex + 51} is missing ${to}`);
    });
  });
});

test('every field-system completion key is reachable from a simulator control', () => {
  createRobFieldMissions(edge).forEach((mission, missionIndex) => {
    const controlKeys = new Set(mission.robot.controls.flatMap((control) => Object.keys(control.set)));
    mission.completeKeys.forEach((key) => {
      assert.equal(controlKeys.has(key), true, `Build ${missionIndex + 51} has no control for ${key}`);
    });
  });
});

test('animated field flows reference real terminals and preserve complete power returns', () => {
  const missions = createRobFieldMissions(edge);
  createRobFieldElectronFlows(edge).forEach((flow, missionIndex) => {
    const endpoints = endpointsFor(missions[missionIndex]);
    [...(flow.wires || []), ...(flow.inside || [])].forEach(([from, to]) => {
      assert.equal(endpoints.has(from), true, `Build ${missionIndex + 51} flow is missing ${from}`);
      assert.equal(endpoints.has(to), true, `Build ${missionIndex + 51} flow is missing ${to}`);
    });
  });
  assert.ok(missions[21].required.some((wire) => wire.includes('leftArm.return')));
  assert.ok(missions[21].required.some((wire) => wire.includes('rightArm.return')));
});

test('advanced campaign names every requested ROB subsystem', () => {
  const copy = JSON.stringify(createRobFieldMissions(edge));
  ['Orbi', 'Insta360 Pro II', 'RPLIDAR', 'USB-to-CAN', 'Ubuntu', '48 V', '24 V', '12 V', 'CloudKit', 'Maker Faire'].forEach((term) => assert.match(copy, new RegExp(term)));
});
