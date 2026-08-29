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

function stripArduinoComments(source) {
  return String(source || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function parseArduinoBlink(source) {
  const code = stripArduinoComments(source);
  const constants = new Map();
  for (const match of code.matchAll(/(?:const\s+)?int\s+([A-Za-z_]\w*)\s*=\s*(\d+)\s*;/g)) {
    constants.set(match[1], Number(match[2]));
  }
  const resolvePin = (token) => /^\d+$/.test(token) ? Number(token) : constants.get(token);
  const writes = [...code.matchAll(/digitalWrite\s*\(\s*([A-Za-z_]\w*|\d+)\s*,\s*(HIGH|LOW)\s*\)\s*;/g)]
    .map((match) => ({ pin: resolvePin(match[1]), value: match[2] }));
  const delays = [...code.matchAll(/delay\s*\(\s*(\d+)\s*\)\s*;/g)].map((match) => Number(match[1]));
  const setup = code.match(/void\s+setup\s*\(\s*\)\s*\{[\s\S]*?\}/)?.[0] || '';
  const loop = code.match(/void\s+loop\s*\(\s*\)\s*\{[\s\S]*?\}/)?.[0] || '';
  const high = writes.find((write) => write.value === 'HIGH');
  const low = writes.find((write) => write.value === 'LOW' && (!high || write.pin === high.pin));
  const pin = high?.pin;
  const configuredPins = [...setup.matchAll(/pinMode\s*\(\s*([A-Za-z_]\w*|\d+)\s*,\s*OUTPUT\s*\)/g)]
    .map((match) => resolvePin(match[1]));
  const pinConfigured = Number.isFinite(pin) && configuredPins.includes(pin);
  const highDelay = delays[0];
  const lowDelay = delays[1];

  if (!setup || !loop) return { valid: false, reason: 'Arduino sketches need both setup() and loop().' };
  if (!high || !low || high.pin !== low.pin) return { valid: false, reason: 'Set the same LED pin HIGH and then LOW inside loop().' };
  if (!pinConfigured) return { valid: false, reason: `Configure pin ${pin ?? '13'} as OUTPUT inside setup().` };
  if (!Number.isFinite(highDelay) || !Number.isFinite(lowDelay) || highDelay < 25 || lowDelay < 25) {
    return { valid: false, reason: 'Add a delay of at least 25 ms after each LED state.' };
  }
  return { valid: true, pin, highMs: highDelay, lowMs: lowDelay, cycleMs: highDelay + lowDelay };
}

export function arduinoOutputAt(elapsedMs, program) {
  if (!program?.valid || !program.cycleMs) return false;
  const time = Math.max(0, Number(elapsedMs) || 0) % program.cycleMs;
  return time < program.highMs;
}
