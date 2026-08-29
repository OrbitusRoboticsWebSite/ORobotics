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
  const batteryWatts = surplusWatts >= 0 ? surplusWatts * chargeEfficiency : surplusWatts;
  const nextWh = Math.min(capacity, Math.max(0, startWh + batteryWatts * Math.max(0, Number(elapsedSeconds) || 0) / 3600));
  const nextPercent = nextWh / capacity * 100;
  const loadPowered = load === 0 || generatedWatts > 0 || nextWh > 0;
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
