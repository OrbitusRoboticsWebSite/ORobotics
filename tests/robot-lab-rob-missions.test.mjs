import assert from 'node:assert/strict';
import test from 'node:test';
import { createRobElectronFlows, createRobSystemsMissions } from '../assets/js/robot-lab-rob-missions.mjs';

const edge = (a, b) => [a, b];
const fixedPorts = {
  battery: ['pos', 'neg'],
  button: ['in', 'out'],
  capacitor: ['in', 'out'],
  estop: ['in', 'out'],
  resistor: ['in', 'out'],
};

test('ROB systems campaign adds exactly 25 ordered missions and flow maps', () => {
  const missions = createRobSystemsMissions(edge);
  assert.equal(missions.length, 25);
  assert.equal(createRobElectronFlows(edge).length, 25);
  assert.match(missions[0].kicker, /Build 26/);
  assert.match(missions.at(-1).kicker, /Build 50/);
});

test('every ROB mission wire ends on a rendered terminal', () => {
  createRobSystemsMissions(edge).forEach((mission, missionIndex) => {
    const endpoints = new Set();
    mission.components.forEach((component) => {
      const portIds = component.ports?.map((port) => port.id) || fixedPorts[component.type] || [];
      portIds.forEach((portId) => endpoints.add(`${component.id}.${portId}`));
    });
    mission.required.forEach(([from, to]) => {
      assert.equal(endpoints.has(from), true, `Build ${missionIndex + 26} is missing ${from}`);
      assert.equal(endpoints.has(to), true, `Build ${missionIndex + 26} is missing ${to}`);
    });
  });
});

test('every completion objective can be reached by a simulator control', () => {
  createRobSystemsMissions(edge).forEach((mission, missionIndex) => {
    const controlKeys = new Set(mission.robot.controls.flatMap((control) => Object.keys(control.set)));
    mission.completeKeys.forEach((key) => {
      assert.equal(controlKeys.has(key), true, `Build ${missionIndex + 26} has no control for ${key}`);
    });
  });
});
