import assert from 'node:assert/strict';
import test from 'node:test';
import {
  arduinoOutputAt,
  calculate555Astable,
  calculate555Monostable,
  calculateArduinoAdc,
  calculateArduinoPwm,
  calculateCapacitiveReactance,
  calculateInductiveReactance,
  calculateLedResistor,
  calculateParallelRLC,
  calculateOpAmpComparator,
  calculateOpAmpNonInverting,
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

test('Arduino PWM and ADC models match Uno-sized values', () => {
  const pwm = calculateArduinoPwm({ sourceVoltage: 5, pwmValue: 128, resistance: 220, ledForwardVoltage: 2 });
  assert.ok(Math.abs(pwm.dutyPercent - 50.196078) < 1e-5);
  assert.ok(Math.abs(pwm.averageVoltage - 2.509804) < 1e-5);
  assert.ok(Math.abs(pwm.peakCurrent - 3 / 220) < 1e-12);
  assert.ok(Math.abs(pwm.averageCurrent - pwm.peakCurrent * pwm.dutyCycle) < 1e-12);

  assert.deepEqual(calculateArduinoAdc({ inputVoltage: 2.5, referenceVoltage: 5, bits: 10 }), {
    inputVoltage: 2.5, referenceVoltage: 5, bits: 10, maxCode: 1023, code: 512,
  });
  assert.equal(calculateArduinoAdc({ inputVoltage: 8, referenceVoltage: 5 }).code, 1023);
});

test('555 timer models calculate astable frequency and monostable pulse width', () => {
  const astable = calculate555Astable({ resistanceOne: 10000, resistanceTwo: 47000, capacitance: 10e-6 });
  assert.equal(astable.valid, true);
  assert.ok(Math.abs(astable.frequencyHz - 1.3872) < 0.001);
  assert.ok(astable.dutyCycle > 0.5 && astable.dutyCycle < 0.6);
  assert.ok(Math.abs(astable.highSeconds + astable.lowSeconds - astable.periodSeconds) < 1e-12);

  const monostable = calculate555Monostable({ resistance: 100000, capacitance: 10e-6 });
  assert.equal(monostable.valid, true);
  assert.ok(Math.abs(monostable.pulseSeconds - 1.1) < 1e-12);
});

test('op-amp models show closed-loop gain, saturation, and comparator polarity', () => {
  const linear = calculateOpAmpNonInverting({ inputVoltage: 1, feedbackResistance: 10000, groundResistance: 10000, outputMax: 3.8 });
  assert.equal(linear.gain, 2);
  assert.equal(linear.outputVoltage, 2);
  assert.equal(linear.saturated, false);

  const clipped = calculateOpAmpNonInverting({ inputVoltage: 2.5, feedbackResistance: 10000, groundResistance: 10000, outputMax: 3.8 });
  assert.equal(clipped.idealOutput, 5);
  assert.equal(clipped.outputVoltage, 3.8);
  assert.equal(clipped.saturated, true);

  assert.deepEqual(calculateOpAmpComparator({ nonInvertingVoltage: 3, invertingVoltage: 2.5, outputLow: 0.05, outputHigh: 3.8 }), {
    nonInvertingVoltage: 3, invertingVoltage: 2.5, differentialVoltage: 0.5, high: true, outputVoltage: 3.8,
  });
});

test('solar simulation charges in sun and discharges after sunset', () => {
  const day = simulateSolar({ sunPercent: 100, panelWatts: 6, batteryPercent: 50, batteryCapacityWh: 10, loadWatts: 1, elapsedSeconds: 3600 });
  assert.equal(day.state, 'charging');
  assert.equal(day.generatedWatts, 6);
  assert.equal(day.powerSource, 'panel');
  assert.ok(day.batteryPercent > 50);

  const night = simulateSolar({ sunPercent: 0, panelWatts: 6, batteryPercent: 50, batteryCapacityWh: 10, loadWatts: 1, elapsedSeconds: 3600 });
  assert.equal(night.state, 'discharging');
  assert.equal(night.generatedWatts, 0);
  assert.equal(night.powerSource, 'battery');
  assert.equal(night.loadPowered, true);
  assert.equal(night.batteryPercent, 40);
  assert.equal(night.runtimeHours, 4);

  const emptyNight = simulateSolar({ sunPercent: 0, panelWatts: 6, batteryPercent: 0, batteryCapacityWh: 10, loadWatts: 1, elapsedSeconds: 300 });
  assert.equal(emptyNight.generatedWatts, 0);
  assert.equal(emptyNight.batteryWatts, 0);
  assert.equal(emptyNight.powerSource, 'off');
  assert.equal(emptyNight.loadPowered, false);
  assert.equal(emptyNight.state, 'empty');

  const weakSunEmptyBattery = simulateSolar({ sunPercent: 10, panelWatts: 6, batteryPercent: 0, batteryCapacityWh: 10, loadWatts: 1, elapsedSeconds: 300 });
  assert.equal(weakSunEmptyBattery.generatedWatts, 0.6);
  assert.equal(weakSunEmptyBattery.powerSource, 'off');
  assert.equal(weakSunEmptyBattery.loadPowered, false);
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
  assert.match(wrongOutput.reason, /configure pin 13/);
});

test('Arduino compiler rejects malformed and unsupported added lines', () => {
  const unsupported = parseArduinoBlink(`const int ledPin = 13;
void setup() {
  pinMode(ledPin, OUTPUT);
}
void loop() {
  makeTheLightBlinkNow();
  digitalWrite(ledPin, HIGH);
  delay(500);
  digitalWrite(ledPin, LOW);
  delay(500);
}`);
  assert.equal(unsupported.valid, false);
  assert.equal(unsupported.line, 6);
  assert.match(unsupported.reason, /Line 6.*makeTheLightBlinkNow/);

  const missingSemicolon = parseArduinoBlink(`const int ledPin = 13;
void setup() {
  pinMode(ledPin, OUTPUT)
}
void loop() {
  digitalWrite(ledPin, HIGH);
  delay(500);
  digitalWrite(ledPin, LOW);
  delay(500);
}`);
  assert.equal(missingSemicolon.valid, false);
  assert.equal(missingSemicolon.line, 3);
  assert.match(missingSemicolon.reason, /expected ';'/);

  const brokenBrace = parseArduinoBlink('void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH);');
  assert.equal(brokenBrace.valid, false);
  assert.equal(brokenBrace.line, 2);
  assert.match(brokenBrace.reason, /missing the closing character/);

  const misspelledCommand = parseArduinoBlink('void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalwrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }');
  assert.equal(misspelledCommand.valid, false);
  assert.equal(misspelledCommand.line, 2);
  assert.match(misspelledCommand.reason, /digitalwrite/);
});

test('Arduino compiler ignores comments but checks command scope and names', () => {
  const commentedCode = parseArduinoBlink(`const int ledPin = 13;
// makeTheLightBlinkNow(); is only a note
void setup() { pinMode(ledPin, OUTPUT); }
void loop() {
  /* brokenStuff();
     still only a comment */
  digitalWrite(ledPin, HIGH);
  delay(100);
  digitalWrite(ledPin, LOW);
  delay(100);
}`);
  assert.equal(commentedCode.valid, true);

  const undeclaredPin = parseArduinoBlink('void setup() { pinMode(myPin, OUTPUT); } void loop() { digitalWrite(myPin, HIGH); delay(100); digitalWrite(myPin, LOW); delay(100); }');
  assert.equal(undeclaredPin.valid, false);
  assert.match(undeclaredPin.reason, /myPin.*not declared/);

  const validSetupCall = parseArduinoBlink('void setup() { digitalWrite(13, LOW); pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); delay(100); digitalWrite(13, LOW); delay(100); }');
  assert.equal(validSetupCall.valid, true);

  const topLevelCall = parseArduinoBlink('digitalWrite(13, LOW); void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); delay(100); digitalWrite(13, LOW); delay(100); }');
  assert.equal(topLevelCall.valid, false);
  assert.match(topLevelCall.reason, /outside setup.*loop/);

  const setupOnlyPinName = parseArduinoBlink('void setup() { const int localPin = 13; pinMode(localPin, OUTPUT); } void loop() { digitalWrite(localPin, HIGH); delay(100); digitalWrite(localPin, LOW); delay(100); }');
  assert.equal(setupOnlyPinName.valid, false);
  assert.match(setupOnlyPinName.reason, /localPin.*not declared/);
});
