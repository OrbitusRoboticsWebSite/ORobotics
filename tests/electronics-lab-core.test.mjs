import assert from 'node:assert/strict';
import test from 'node:test';
import {
  arduinoOutputAt,
  calculateCapacitiveReactance,
  calculateInductiveReactance,
  calculateLedResistor,
  calculateParallelRLC,
  calculateRCTransient,
  calculateResonantFrequency,
  calculateRLTransient,
  calculateSeries,
  calculateSeriesRLC,
  calculateVoltageDivider,
  matchesCircuit,
  parseArduinoBlink,
  simulateSolar,
  solveOhmsLaw,
} from '../assets/js/electronics-lab-core.mjs';

test('circuit matching ignores wire direction but rejects missing and extra wires', () => {
  const required = [['battery.pos', 'lamp.a'], ['lamp.b', 'battery.neg']];
  assert.equal(matchesCircuit([
    { a: 'lamp.a', b: 'battery.pos' },
    { a: 'battery.neg', b: 'lamp.b' },
  ], required), true);
  assert.equal(matchesCircuit([{ a: 'lamp.a', b: 'battery.pos' }], required), false);
  assert.equal(matchesCircuit([...required, ['battery.pos', 'battery.neg']], required), false);
});

test('series circuit reports current, component drops, and power', () => {
  const result = calculateSeries(9, [1000, 1000]);
  assert.equal(result.totalResistance, 2000);
  assert.equal(result.current, 0.0045);
  assert.deepEqual(result.drops, [4.5, 4.5]);
  assert.ok(Math.abs(result.powers[0] - 0.02025) < 1e-10);
});

test('LED resistor calculation applies the resistor voltage rather than full supply', () => {
  assert.equal(calculateLedResistor(5, 2, 20), 150);
  assert.equal(calculateLedResistor(2, 2, 20), Infinity);
});

test('Ohm law solves each missing value and handles milliamp conversion at the UI boundary', () => {
  assert.deepEqual(solveOhmsLaw({ voltage: 5, current: '', resistance: 220 }), {
    valid: true, missing: 'current', voltage: 5, current: 5 / 220, resistance: 220,
  });
  assert.equal(solveOhmsLaw({ voltage: '', current: 0.02, resistance: 150 }).voltage, 3);
  assert.ok(Math.abs(solveOhmsLaw({ voltage: 9, current: 0.0045, resistance: '' }).resistance - 2000) < 1e-9);
  assert.equal(solveOhmsLaw({ voltage: '', current: '', resistance: 220 }).valid, false);
});

test('equal-resistor divider splits the source voltage evenly', () => {
  const result = calculateVoltageDivider(9, 1000, 1000);
  assert.equal(result.outputVoltage, 4.5);
  assert.equal(result.drops[0] + result.drops[1], 9);
});

test('capacitors and inductors respond oppositely as AC frequency rises', () => {
  assert.ok(calculateCapacitiveReactance(10, 100e-6) > calculateCapacitiveReactance(100, 100e-6));
  assert.ok(calculateInductiveReactance(100, 0.1) > calculateInductiveReactance(10, 0.1));
  assert.ok(Math.abs(calculateCapacitiveReactance(100, 100e-6) - 15.915494) < 1e-5);
  assert.ok(Math.abs(calculateInductiveReactance(100, 0.1) - 62.831853) < 1e-5);
});

test('series RLC reaches minimum impedance and maximum current at resonance', () => {
  const inductance = 0.1;
  const capacitance = 25.330295910584447e-6;
  const resonantFrequencyHz = calculateResonantFrequency(inductance, capacitance);
  const resonance = calculateSeriesRLC({ voltageRms: 5, frequencyHz: resonantFrequencyHz, resistance: 100, inductance, capacitance });
  const offTune = calculateSeriesRLC({ voltageRms: 5, frequencyHz: 40, resistance: 100, inductance, capacitance });
  assert.ok(Math.abs(resonantFrequencyHz - 100) < 1e-9);
  assert.ok(Math.abs(resonance.impedance - 100) < 1e-9);
  assert.ok(Math.abs(resonance.phaseDegrees) < 1e-9);
  assert.ok(resonance.currentRms > offTune.currentRms);
});

test('parallel RLC cancels reactive branch current at resonance', () => {
  const result = calculateParallelRLC({ voltageRms: 5, frequencyHz: 100, resistance: 1000, inductance: 0.1, capacitance: 25.330295910584447e-6 });
  assert.ok(Math.abs(result.susceptance) < 1e-12);
  assert.ok(Math.abs(result.impedance - 1000) < 1e-8);
  assert.ok(Math.abs(result.inductorCurrentRms - result.capacitorCurrentRms) < 1e-12);
});

test('RC and RL transients reveal their one-time-constant behavior', () => {
  const rc = calculateRCTransient({ sourceVoltage: 5, resistance: 1000, capacitance: .001, elapsedSeconds: 1 });
  assert.ok(Math.abs(rc.voltage - 5 * (1 - Math.exp(-1))) < 1e-12);
  assert.equal(rc.timeConstantSeconds, 1);

  const rl = calculateRLTransient({ sourceVoltage: 5, resistance: 10, inductance: 10, elapsedSeconds: 1 });
  assert.ok(Math.abs(rl.current - .5 * (1 - Math.exp(-1))) < 1e-12);
  assert.equal(rl.timeConstantSeconds, 1);
});

test('solar simulation charges in sun and discharges after sunset', () => {
  const day = simulateSolar({ sunPercent: 100, panelWatts: 6, batteryPercent: 50, batteryCapacityWh: 10, loadWatts: 1, elapsedSeconds: 3600 });
  assert.equal(day.state, 'charging');
  assert.equal(day.generatedWatts, 6);
  assert.ok(day.batteryPercent > 50);

  const night = simulateSolar({ sunPercent: 0, panelWatts: 6, batteryPercent: 50, batteryCapacityWh: 10, loadWatts: 1, elapsedSeconds: 3600 });
  assert.equal(night.state, 'discharging');
  assert.equal(night.generatedWatts, 0);
  assert.equal(night.batteryPercent, 40);
  assert.equal(night.runtimeHours, 4);
});

test('Arduino parser accepts a standard named-pin blink sketch', () => {
  const source = `
    const int ledPin = 13;
    void setup() { pinMode(ledPin, OUTPUT); }
    void loop() {
      digitalWrite(ledPin, HIGH);
      delay(500);
      digitalWrite(ledPin, LOW);
      delay(250);
    }
  `;
  const program = parseArduinoBlink(source);
  assert.deepEqual(program, { valid: true, pin: 13, highMs: 500, lowMs: 250, cycleMs: 750 });
  assert.equal(arduinoOutputAt(0, program), true);
  assert.equal(arduinoOutputAt(499, program), true);
  assert.equal(arduinoOutputAt(500, program), false);
  assert.equal(arduinoOutputAt(750, program), true);
});

test('Arduino parser gives focused feedback for incomplete sketches', () => {
  const missingSetup = parseArduinoBlink('void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }');
  assert.equal(missingSetup.valid, false);
  assert.match(missingSetup.reason, /setup/);

  const missingLow = parseArduinoBlink('void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); delay(500); }');
  assert.equal(missingLow.valid, false);
  assert.match(missingLow.reason, /HIGH.*LOW/);

  const wrongOutput = parseArduinoBlink('void setup() { pinMode(12, OUTPUT); } void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }');
  assert.equal(wrongOutput.valid, false);
  assert.match(wrongOutput.reason, /Configure pin 13/);
});
