import assert from 'node:assert/strict';
import test from 'node:test';
import { createRobMotorElectronFlows, createRobMotorMissions } from '../assets/js/robot-lab-motor-missions.mjs';

test('twelve appended motor lessons have connectable terminals and reachable completion', () => {
  const edge = (a, b) => [a, b];
  const missions = createRobMotorMissions(edge), flows = createRobMotorElectronFlows(edge);
  assert.equal(missions.length, 12);
  assert.match(missions[0].kicker, /Build 91/);
  assert.match(missions.at(-1).kicker, /Build 102/);
  missions.forEach((mission, index) => {
    const endpoints = new Set(mission.components.flatMap((part) => part.ports.map((port) => `${part.id}.${port.id}`)));
    for (const connection of [...mission.required, ...flows[index].wires]) for (const end of connection) assert.ok(endpoints.has(end), end);
    const state = { exact: true };
    for (const control of mission.robot.controls) Object.assign(state, control.set);
    assert.ok(mission.completeKeys.every((key) => state[key]));
    assert.ok(mission.objectives.every(([, check]) => check(state)));
  });
});
