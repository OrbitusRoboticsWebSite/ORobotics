export function normalizeEdge(a, b) {
  return [a, b].sort().join('::');
}

export function connectionSet(connections = []) {
  return new Set(connections.map((connection) => {
    if (Array.isArray(connection)) return normalizeEdge(connection[0], connection[1]);
    return normalizeEdge(connection.a, connection.b);
  }));
}

export function matchesCircuit(connections, requiredEdges) {
  const actual = connectionSet(connections);
  const required = connectionSet(requiredEdges);
  if (actual.size !== required.size) return false;
  return [...required].every((edge) => actual.has(edge));
}

export function matchesAnyCircuit(connections, requiredCircuitOptions) {
  return requiredCircuitOptions.some((requiredEdges) => matchesCircuit(connections, requiredEdges));
}

export function hasConnection(connections, a, b) {
  return connectionSet(connections).has(normalizeEdge(a, b));
}

export function calculateSeries(sourceVoltage, resistances) {
  const safeVoltage = Math.max(0, Number(sourceVoltage) || 0);
  const values = resistances.map((resistance) => Math.max(0, Number(resistance) || 0));
  const totalResistance = values.reduce((total, resistance) => total + resistance, 0);
  const current = totalResistance > 0 ? safeVoltage / totalResistance : Infinity;
  return {
    voltage: safeVoltage,
    totalResistance,
    current,
    drops: values.map((resistance) => current * resistance),
    powers: values.map((resistance) => current * current * resistance),
  };
}

export function calculateLedResistor(supplyVoltage, forwardVoltage, targetMilliAmps) {
  const supply = Math.max(0, Number(supplyVoltage) || 0);
  const forward = Math.max(0, Number(forwardVoltage) || 0);
  const current = Math.max(0, Number(targetMilliAmps) || 0) / 1000;
  if (current === 0 || supply <= forward) return Infinity;
  return (supply - forward) / current;
}

export function solveOhmsLaw({ voltage, current, resistance }) {
  const values = { voltage, current, resistance };
  const missing = Object.entries(values).filter(([, value]) => value === '' || value === null || value === undefined || Number.isNaN(Number(value)));
  if (missing.length !== 1) return { valid: false, reason: 'Leave exactly one value blank.' };

  const known = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)]));
  if (Object.entries(known).some(([key, value]) => key !== missing[0][0] && (!Number.isFinite(value) || value < 0))) {
    return { valid: false, reason: 'Use two positive, finite values.' };
  }

  const missingKey = missing[0][0];
  if (missingKey === 'voltage') known.voltage = known.current * known.resistance;
  if (missingKey === 'current') known.current = known.resistance > 0 ? known.voltage / known.resistance : Infinity;
  if (missingKey === 'resistance') known.resistance = known.current > 0 ? known.voltage / known.current : Infinity;
  if (!Number.isFinite(known[missingKey])) return { valid: false, reason: 'That combination would be an open or short circuit.' };
  return { valid: true, missing: missingKey, ...known };
}

export function calculateVoltageDivider(sourceVoltage, upperResistance, lowerResistance) {
  const series = calculateSeries(sourceVoltage, [upperResistance, lowerResistance]);
  return {
    ...series,
    outputVoltage: series.drops[1] || 0,
  };
}

export function calculateCapacitiveReactance(frequencyHz, capacitanceFarads) {
  const frequency = Math.max(0, Number(frequencyHz) || 0);
  const capacitance = Math.max(0, Number(capacitanceFarads) || 0);
  if (frequency === 0 || capacitance === 0) return Infinity;
  return 1 / (2 * Math.PI * frequency * capacitance);
}

export function calculateInductiveReactance(frequencyHz, inductanceHenries) {
  const frequency = Math.max(0, Number(frequencyHz) || 0);
  const inductance = Math.max(0, Number(inductanceHenries) || 0);
  return 2 * Math.PI * frequency * inductance;
}

export function calculateResonantFrequency(inductanceHenries, capacitanceFarads) {
  const inductance = Math.max(0, Number(inductanceHenries) || 0);
  const capacitance = Math.max(0, Number(capacitanceFarads) || 0);
  if (inductance === 0 || capacitance === 0) return Infinity;
  return 1 / (2 * Math.PI * Math.sqrt(inductance * capacitance));
}

export function calculateSeriesRLC({ voltageRms, frequencyHz, resistance, inductance, capacitance }) {
  const voltage = Math.max(0, Number(voltageRms) || 0);
  const safeResistance = Math.max(0, Number(resistance) || 0);
  const capacitiveReactance = calculateCapacitiveReactance(frequencyHz, capacitance);
  const inductiveReactance = calculateInductiveReactance(frequencyHz, inductance);
  const reactance = inductiveReactance - capacitiveReactance;
  const impedance = Math.hypot(safeResistance, reactance);
  const currentRms = impedance > 0 && Number.isFinite(impedance) ? voltage / impedance : 0;
  const phaseRadians = Math.atan2(reactance, safeResistance);
  return {
    voltageRms: voltage,
    frequencyHz: Math.max(0, Number(frequencyHz) || 0),
    resistance: safeResistance,
    capacitiveReactance,
    inductiveReactance,
    reactance,
    impedance,
    currentRms,
    phaseRadians,
    phaseDegrees: phaseRadians * 180 / Math.PI,
    resistorVoltageRms: currentRms * safeResistance,
    capacitorVoltageRms: currentRms * capacitiveReactance,
    inductorVoltageRms: currentRms * inductiveReactance,
    resonantFrequencyHz: calculateResonantFrequency(inductance, capacitance),
  };
}

export function calculateParallelRLC({ voltageRms, frequencyHz, resistance, inductance, capacitance }) {
  const voltage = Math.max(0, Number(voltageRms) || 0);
  const safeResistance = Math.max(0, Number(resistance) || 0);
  const frequency = Math.max(0, Number(frequencyHz) || 0);
  const angularFrequency = 2 * Math.PI * frequency;
  const safeInductance = Math.max(0, Number(inductance) || 0);
  const safeCapacitance = Math.max(0, Number(capacitance) || 0);
  const conductance = safeResistance > 0 ? 1 / safeResistance : 0;
  const inductiveSusceptance = angularFrequency > 0 && safeInductance > 0 ? -1 / (angularFrequency * safeInductance) : 0;
  const capacitiveSusceptance = angularFrequency * safeCapacitance;
  const susceptance = inductiveSusceptance + capacitiveSusceptance;
  const admittance = Math.hypot(conductance, susceptance);
  const impedance = admittance > 0 ? 1 / admittance : Infinity;
  const phaseRadians = Math.atan2(susceptance, conductance);
  return {
    voltageRms: voltage,
    frequencyHz: frequency,
    resistance: safeResistance,
    conductance,
    inductiveSusceptance,
    capacitiveSusceptance,
    susceptance,
    admittance,
    impedance,
    sourceCurrentRms: voltage * admittance,
    resistorCurrentRms: voltage * conductance,
    inductorCurrentRms: Math.abs(voltage * inductiveSusceptance),
    capacitorCurrentRms: Math.abs(voltage * capacitiveSusceptance),
    phaseRadians,
    phaseDegrees: phaseRadians * 180 / Math.PI,
    resonantFrequencyHz: calculateResonantFrequency(inductance, capacitance),
  };
}

export function calculateRCTransient({ sourceVoltage, resistance, capacitance, elapsedSeconds, initialVoltage = 0, charging = true }) {
  const source = Math.max(0, Number(sourceVoltage) || 0);
  const safeResistance = Math.max(0, Number(resistance) || 0);
  const safeCapacitance = Math.max(0, Number(capacitance) || 0);
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const start = Math.max(0, Number(initialVoltage) || 0);
  const timeConstantSeconds = safeResistance * safeCapacitance;
  if (timeConstantSeconds === 0) return { voltage: charging ? source : 0, current: 0, timeConstantSeconds };
  const decay = Math.exp(-elapsed / timeConstantSeconds);
  const target = charging ? source : 0;
  const voltage = target + (start - target) * decay;
  const current = (target - voltage) / safeResistance;
  return { voltage, current, timeConstantSeconds };
}

export function calculateRLTransient({ sourceVoltage, resistance, inductance, elapsedSeconds, initialCurrent = 0, energizing = true }) {
  const source = Math.max(0, Number(sourceVoltage) || 0);
  const safeResistance = Math.max(0, Number(resistance) || 0);
  const safeInductance = Math.max(0, Number(inductance) || 0);
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const start = Math.max(0, Number(initialCurrent) || 0);
  const timeConstantSeconds = safeResistance > 0 ? safeInductance / safeResistance : Infinity;
  if (!Number.isFinite(timeConstantSeconds) || timeConstantSeconds === 0) {
    return { current: energizing && safeResistance > 0 ? source / safeResistance : 0, inductorVoltage: 0, timeConstantSeconds };
  }
  const decay = Math.exp(-elapsed / timeConstantSeconds);
  const target = energizing ? source / safeResistance : 0;
  const current = target + (start - target) * decay;
  const inductorVoltage = energizing ? source - current * safeResistance : -current * safeResistance;
  return { current, inductorVoltage, timeConstantSeconds };
}

export function calculateArduinoPwm({ sourceVoltage = 5, pwmValue, resistance = 220, ledForwardVoltage = 2 }) {
  const source = Math.max(0, Number(sourceVoltage) || 0);
  const pwm = Math.min(255, Math.max(0, Number(pwmValue) || 0));
  const dutyCycle = pwm / 255;
  const safeResistance = Math.max(0, Number(resistance) || 0);
  const forward = Math.max(0, Number(ledForwardVoltage) || 0);
  const peakCurrent = safeResistance > 0 ? Math.max(0, source - forward) / safeResistance : 0;
  return {
    pwmValue: pwm,
    dutyCycle,
    dutyPercent: dutyCycle * 100,
    averageVoltage: source * dutyCycle,
    peakCurrent,
    averageCurrent: peakCurrent * dutyCycle,
  };
}

export function calculateArduinoAdc({ inputVoltage, referenceVoltage = 5, bits = 10 }) {
  const reference = Math.max(0.001, Number(referenceVoltage) || 5);
  const safeBits = Math.min(24, Math.max(1, Math.round(Number(bits) || 10)));
  const maxCode = 2 ** safeBits - 1;
  const voltage = Math.min(reference, Math.max(0, Number(inputVoltage) || 0));
  const code = Math.round(voltage / reference * maxCode);
  return { inputVoltage: voltage, referenceVoltage: reference, bits: safeBits, maxCode, code };
}

export function calculate555Astable({ resistanceOne, resistanceTwo, capacitance }) {
  const r1 = Math.max(0, Number(resistanceOne) || 0);
  const r2 = Math.max(0, Number(resistanceTwo) || 0);
  const c = Math.max(0, Number(capacitance) || 0);
  if (r1 + r2 === 0 || r2 === 0 || c === 0) return { valid: false, highSeconds: Infinity, lowSeconds: Infinity, periodSeconds: Infinity, frequencyHz: 0, dutyCycle: 0 };
  const highSeconds = Math.log(2) * (r1 + r2) * c;
  const lowSeconds = Math.log(2) * r2 * c;
  const periodSeconds = highSeconds + lowSeconds;
  return { valid: true, highSeconds, lowSeconds, periodSeconds, frequencyHz: 1 / periodSeconds, dutyCycle: highSeconds / periodSeconds };
}

export function calculate555Monostable({ resistance, capacitance }) {
  const safeResistance = Math.max(0, Number(resistance) || 0);
  const safeCapacitance = Math.max(0, Number(capacitance) || 0);
  const pulseSeconds = 1.1 * safeResistance * safeCapacitance;
  return { valid: pulseSeconds > 0, pulseSeconds };
}

export function calculateOpAmpNonInverting({ inputVoltage, feedbackResistance = 0, groundResistance = Infinity, outputMin = 0.05, outputMax = 3.8 }) {
  const input = Number(inputVoltage) || 0;
  const feedback = Math.max(0, Number(feedbackResistance) || 0);
  const ground = Number(groundResistance);
  const gain = Number.isFinite(ground) && ground > 0 ? 1 + feedback / ground : 1;
  const idealOutput = input * gain;
  const low = Number(outputMin) || 0;
  const high = Math.max(low, Number(outputMax) || 0);
  const outputVoltage = Math.min(high, Math.max(low, idealOutput));
  return { inputVoltage: input, gain, idealOutput, outputVoltage, saturated: Math.abs(outputVoltage - idealOutput) > 1e-9 };
}

export function calculateOpAmpComparator({ nonInvertingVoltage, invertingVoltage, outputLow = 0.05, outputHigh = 3.8 }) {
  const plus = Number(nonInvertingVoltage) || 0;
  const minus = Number(invertingVoltage) || 0;
  const high = plus > minus;
  return {
    nonInvertingVoltage: plus,
    invertingVoltage: minus,
    differentialVoltage: plus - minus,
    high,
    outputVoltage: high ? Number(outputHigh) || 0 : Number(outputLow) || 0,
  };
}

export function simulateSolar({
  sunPercent,
  panelWatts,
  batteryPercent,
  batteryCapacityWh,
  loadWatts,
  elapsedSeconds,
  chargeEfficiency = 0.9,
}) {
  const sun = Math.min(100, Math.max(0, Number(sunPercent) || 0));
  const panel = Math.max(0, Number(panelWatts) || 0);
  const capacity = Math.max(0.001, Number(batteryCapacityWh) || 0.001);
  const load = Math.max(0, Number(loadWatts) || 0);
  const startWh = capacity * Math.min(100, Math.max(0, Number(batteryPercent) || 0)) / 100;
  const generatedWatts = panel * sun / 100;
  const surplusWatts = generatedWatts - load;
  const requestedBatteryWatts = surplusWatts >= 0 ? surplusWatts * chargeEfficiency : surplusWatts;
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const nextWh = Math.min(capacity, Math.max(0, startWh + requestedBatteryWatts * elapsed / 3600));
  const nextPercent = nextWh / capacity * 100;
  let batteryWatts = requestedBatteryWatts;
  if (elapsed > 0) batteryWatts = (nextWh - startWh) * 3600 / elapsed;
  else if ((requestedBatteryWatts < 0 && startWh <= 0) || (requestedBatteryWatts > 0 && startWh >= capacity)) batteryWatts = 0;
  const loadPowered = load === 0 || generatedWatts >= load || nextWh > 0;
  let powerSource = 'off';
  if (load === 0) powerSource = 'no-load';
  else if (loadPowered && generatedWatts >= load) powerSource = 'panel';
  else if (loadPowered && generatedWatts > 0) powerSource = 'panel+battery';
  else if (loadPowered) powerSource = 'battery';
  let state = 'balanced';
  if (batteryWatts > 0.01 && nextWh < capacity) state = 'charging';
  if (batteryWatts < -0.01 && nextWh > 0) state = 'discharging';
  if (nextWh >= capacity && surplusWatts > 0) state = 'full';
  if (nextWh <= 0 && load > generatedWatts) state = 'empty';

  return {
    sunPercent: sun,
    generatedWatts,
    loadWatts: load,
    batteryWatts,
    batteryPercent: nextPercent,
    batteryWh: nextWh,
    loadPowered,
    powerSource,
    state,
    runtimeHours: load > generatedWatts ? nextWh / (load - generatedWatts) : Infinity,
    hoursToFull: batteryWatts > 0 ? (capacity - nextWh) / batteryWatts : Infinity,
  };
}

export function calculateDcMotor({ supplyVoltage = 12, pwmValue = 0, direction = 1, freeSpeedRpm = 120, runningCurrent = 1.2 } = {}) {
  const supply = Math.max(0, Number(supplyVoltage) || 0);
  const pwm = Math.min(255, Math.max(0, Number(pwmValue) || 0));
  const sign = Number(direction) < 0 ? -1 : 1;
  const dutyCycle = pwm / 255;
  return {
    supplyVoltage: supply,
    pwmValue: pwm,
    dutyCycle,
    averageVoltage: supply * dutyCycle * sign,
    estimatedRpm: Math.max(0, Number(freeSpeedRpm) || 0) * dutyCycle * sign,
    estimatedCurrent: dutyCycle === 0 ? 0 : Math.max(0, Number(runningCurrent) || 0) * (.25 + .75 * dutyCycle),
  };
}

export function calculateDifferentialDrive({ leftDemand = 0, rightDemand = 0 } = {}) {
  const clamp = (value) => Math.min(1, Math.max(-1, Number(value) || 0));
  const left = clamp(leftDemand);
  const right = clamp(rightDemand);
  return { leftDemand: left, rightDemand: right, linearDemand: (left + right) / 2, turnDemand: (right - left) / 2 };
}

export function calculateEncoderSpeed({ pulses = 0, countsPerRevolution = 360, intervalSeconds = .2, wheelDiameterMeters = .1 } = {}) {
  const counts = Number(pulses) || 0;
  const cpr = Math.max(1, Number(countsPerRevolution) || 1);
  const seconds = Math.max(Number.EPSILON, Number(intervalSeconds) || 0);
  const diameter = Math.max(0, Number(wheelDiameterMeters) || 0);
  const revolutionsPerSecond = counts / cpr / seconds;
  return { pulses: counts, rpm: revolutionsPerSecond * 60, surfaceSpeedMetersPerSecond: revolutionsPerSecond * Math.PI * diameter };
}

export function calculateProportionalControl({ target = 0, measured = 0, kp = 2.5, feedforward = 0, limit = 255 } = {}) {
  const error = (Number(target) || 0) - (Number(measured) || 0);
  const requestedOutput = (Number(feedforward) || 0) + (Number(kp) || 0) * error;
  const safeLimit = Math.max(0, Number(limit) || 0);
  return { target: Number(target) || 0, measured: Number(measured) || 0, error, requestedOutput, output: Math.min(safeLimit, Math.max(-safeLimit, requestedOutput)), saturated: Math.abs(requestedOutput) > safeLimit };
}

export function calculateSerialChecksum(payload = '') {
  return [...String(payload)].reduce((checksum, character) => checksum ^ character.codePointAt(0), 0) & 0xff;
}

export function applyMotorWatchdog({ leftDemand = 0, rightDemand = 0, frameAgeMs = 0, timeoutMs = 600 } = {}) {
  const stale = Math.max(0, Number(frameAgeMs) || 0) >= Math.max(0, Number(timeoutMs) || 0);
  const demands = calculateDifferentialDrive({ leftDemand, rightDemand });
  return { ...demands, leftDemand: stale ? 0 : demands.leftDemand, rightDemand: stale ? 0 : demands.rightDemand, stale, brake: stale };
}

function stripArduinoComments(source) {
  return String(source || '')
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

export function parseArduinoBlink(source) {
  const code = stripArduinoComments(source);
  const fail = (line, message) => ({ valid: false, line, reason: `${line ? `Line ${line}: ` : ''}${message}` });
  const lineAt = (index) => code.slice(0, index).split('\n').length;
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const openers = new Set(Object.values(pairs));
  const delimiterStack = [];
  let delimiterLine = 1;
  for (const character of code) {
    if (character === '\n') delimiterLine += 1;
    else if (openers.has(character)) delimiterStack.push({ character, line: delimiterLine });
    else if (pairs[character]) {
      const opener = delimiterStack.pop();
      if (!opener || opener.character !== pairs[character]) return fail(delimiterLine, `unexpected '${character}'. Check the brackets and braces.`);
    }
  }
  if (delimiterStack.length) {
    const opener = delimiterStack.at(-1);
    return fail(opener.line, `missing the closing character for '${opener.character}'.`);
  }

  const constants = { global: new Map(), setup: new Map(), loop: new Map() };
  const resolvePin = (token, section) => /^\d+$/.test(token) ? Number(token) : constants[section]?.get(token) ?? constants.global.get(token);
  const configuredPins = [];
  const loopOperations = [];
  const functions = new Set();
  let section = null;
  let index = 0;

  const matchAt = (pattern) => {
    pattern.lastIndex = index;
    return pattern.exec(code);
  };
  const advance = (match) => { index = match.index + match[0].length; };

  while (index < code.length) {
    if (/\s/.test(code[index])) { index += 1; continue; }
    const line = lineAt(index);

    let match = matchAt(/(?:const\s+)?(?:int|byte)\s+([A-Za-z_]\w*)\s*=\s*(\d+)\s*;/y);
    if (match) {
      const scope = section || 'global';
      if (constants[scope].has(match[1])) return fail(line, `'${match[1]}' was declared more than once in the same scope.`);
      constants[scope].set(match[1], Number(match[2]));
      advance(match);
      continue;
    }

    match = matchAt(/void\s+(setup|loop)\s*\(\s*\)\s*\{/y);
    if (match) {
      if (section) return fail(line, `a function cannot begin inside ${section}().`);
      if (functions.has(match[1])) return fail(line, `${match[1]}() was defined more than once.`);
      functions.add(match[1]);
      section = match[1];
      advance(match);
      continue;
    }

    match = matchAt(/pinMode\s*\(\s*([A-Za-z_]\w*|\d+)\s*,\s*OUTPUT\s*\)\s*;/y);
    if (match) {
      if (!section) return fail(line, 'function calls are not allowed outside setup() or loop().');
      const pin = resolvePin(match[1], section);
      if (!Number.isFinite(pin)) return fail(line, `'${match[1]}' was not declared in this sketch.`);
      configuredPins.push(pin);
      advance(match);
      continue;
    }

    match = matchAt(/digitalWrite\s*\(\s*([A-Za-z_]\w*|\d+)\s*,\s*(HIGH|LOW)\s*\)\s*;/y);
    if (match) {
      if (!section) return fail(line, 'function calls are not allowed outside setup() or loop().');
      const pin = resolvePin(match[1], section);
      if (!Number.isFinite(pin)) return fail(line, `'${match[1]}' was not declared in this sketch.`);
      if (section === 'loop') loopOperations.push({ type: 'write', pin, value: match[2], line });
      advance(match);
      continue;
    }

    match = matchAt(/delay\s*\(\s*(\d+)\s*\)\s*;/y);
    if (match) {
      if (!section) return fail(line, 'function calls are not allowed outside setup() or loop().');
      if (section === 'loop') loopOperations.push({ type: 'delay', milliseconds: Number(match[1]), line });
      advance(match);
      continue;
    }

    if (code[index] === '}') {
      if (!section) return fail(line, "unexpected '}'.");
      section = null;
      index += 1;
      continue;
    }
    if (code[index] === ';') { index += 1; continue; }

    const remaining = code.slice(index);
    const missingSemicolon = remaining.match(/^((?:const\s+)?(?:int|byte)\s+[A-Za-z_]\w*\s*=\s*\d+|(?:pinMode|digitalWrite|delay)\s*\([^\n{};]*\))\s*(?=\n|}|$)/);
    if (missingSemicolon) return fail(line, `expected ';' after ${missingSemicolon[1].trim()}.`);
    const missingBrace = remaining.match(/^void\s+(setup|loop)\s*\(\s*\)\s*(?=\n|$)/);
    if (missingBrace) return fail(line, `expected '{' after ${missingBrace[1]}().`);
    const snippet = (remaining.match(/^[^\n{};]*/)?.[0] || remaining[0]).trim().slice(0, 52);
    return fail(line, `unknown or unsupported statement${snippet ? ` "${snippet}"` : ''}. Use the commands in ROB's code map.`);
  }

  if (!functions.has('setup') || !functions.has('loop')) return fail(0, 'Arduino sketches need both setup() and loop().');
  const highIndex = loopOperations.findIndex((operation) => operation.type === 'write' && operation.value === 'HIGH');
  const high = loopOperations[highIndex];
  const highDelay = loopOperations.slice(highIndex + 1).find((operation) => operation.type === 'delay');
  const lowIndex = loopOperations.findIndex((operation, operationIndex) => operationIndex > highIndex && operation.type === 'write' && operation.value === 'LOW' && operation.pin === high?.pin);
  const low = loopOperations[lowIndex];
  const lowDelay = loopOperations.slice(lowIndex + 1).find((operation) => operation.type === 'delay');
  const pin = high?.pin;
  const pinConfigured = Number.isFinite(pin) && configuredPins.includes(pin);

  if (!high || !low || high.pin !== low.pin) return fail(0, 'Set the same LED pin HIGH and then LOW inside loop().');
  if (!pinConfigured) return fail(high.line, `configure pin ${pin ?? '13'} as OUTPUT inside setup().`);
  if (!highDelay || !lowDelay || highDelay.milliseconds < 25 || lowDelay.milliseconds < 25) {
    return fail((highDelay || lowDelay || high).line, 'add a delay of at least 25 ms after each LED state.');
  }
  return { valid: true, pin, highMs: highDelay.milliseconds, lowMs: lowDelay.milliseconds, cycleMs: highDelay.milliseconds + lowDelay.milliseconds };
}

export function arduinoOutputAt(elapsedMs, program) {
  if (!program?.valid || !program.cycleMs) return false;
  const time = Math.max(0, Number(elapsedMs) || 0) % program.cycleMs;
  return time < program.highMs;
}
