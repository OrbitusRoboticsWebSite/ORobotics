import {
  arduinoOutputAt,
  calculateLedResistor,
  calculateSeries,
  calculateVoltageDivider,
  connectionSet,
  hasConnection,
  matchesCircuit,
  parseArduinoBlink,
  simulateSolar,
  solveOhmsLaw,
} from './electronics-lab-core.mjs';

const root = document.querySelector('[data-circuit-lab]');

if (root) {
  const edge = (a, b) => [a, b];
  const requiredLedEdges = [edge('uno.d13', 'r.in'), edge('r.out', 'led.a'), edge('led.k', 'uno.gnd')];
  const missions = [
    {
      icon: '💡', tier: 'Basics', difficulty: 'Rookie', kicker: 'Build 01 · First circuit', title: 'Light the workshop lamp',
      intro: 'Connect a battery to a bulb and give electrons a complete circular path from − through the lamp to +.',
      guide: 'Electrons in the external wires drift out of battery −, pass through the lamp, and enter battery +. Inside the battery, chemistry keeps the charges separated so the loop can continue.',
      success: 'The loop is closed! Watch the white electrons circle from battery −, through the lamp, toward battery +.',
      hints: ['Start where external electron flow starts: connect battery − to one lamp terminal.', 'Complete the circle by connecting the lamp’s other terminal to battery +.'],
      components: [
        { id: 'cell', type: 'battery', label: '3 V battery pack', x: 20, y: 50, voltage: 3 },
        { id: 'lamp', type: 'lamp', label: 'Workshop lamp', x: 78, y: 50, color: '#ffe43b' },
      ],
      required: [edge('cell.pos', 'lamp.a'), edge('cell.neg', 'lamp.b')], supply: 3, resistance: 12,
      objectives: [
        ['Wire battery − to the lamp', (s) => s.has('cell.neg', 'lamp.b')],
        ['Wire the lamp onward to battery +', (s) => s.has('cell.pos', 'lamp.a')],
        ['Create light with a closed loop', (s) => s.powered],
      ],
      noteTitle: 'Why did it light?', note: 'In the external metal wires, electrons drift from − through the entire load and toward +. Battery chemistry maintains the voltage that keeps the loop moving. Remove either wire and the circular path opens, so current becomes zero.'
    },
    {
      icon: '⏻', tier: 'Basics', difficulty: 'Rookie', kicker: 'Build 02 · Control the flow', title: 'Put a switch in charge',
      intro: 'Route power through a switch, then close it to control the lamp without pulling wires.',
      guide: 'A switch opens or closes a deliberate gap. Put it in the complete loop so electron drift from − toward + must pass through the switch and lamp.',
      success: 'One small mechanical movement closed the path. Switches control when energy can flow.',
      hints: ['Connect battery + to the switch IN terminal.', 'Continue from switch OUT to the lamp, then return the lamp to battery −.', 'The wires are ready—press the switch itself to close the final gap.'],
      components: [
        { id: 'cell', type: 'battery', label: '3 V battery pack', x: 15, y: 58, voltage: 3 },
        { id: 'switch', type: 'switch', label: 'Toggle switch', x: 48, y: 30 },
        { id: 'lamp', type: 'lamp', label: 'Controlled lamp', x: 82, y: 58, color: '#2ee5eb' },
      ],
      required: [edge('cell.pos', 'switch.in'), edge('switch.out', 'lamp.a'), edge('lamp.b', 'cell.neg')], supply: 3, resistance: 15, hasSwitch: true,
      objectives: [
        ['Route battery + through the switch', (s) => s.has('cell.pos', 'switch.in') && s.has('switch.out', 'lamp.a')],
        ['Complete the return path', (s) => s.has('lamp.b', 'cell.neg')],
        ['Close the switch and light the lamp', (s) => s.powered],
      ],
      noteTitle: 'Open is off. Closed is on.', note: 'An open switch behaves like a missing wire: resistance is effectively enormous and current stops. A closed switch provides a conducting path.'
    },
    {
      icon: '🌈', tier: 'Ohm’s law', difficulty: 'Maker', kicker: 'Build 03 · Protect the LED', title: 'Tame the current with resistance',
      intro: 'Build a 5 V LED circuit, then choose a resistor that keeps the tiny light safe.',
      guide: 'An LED can take too much current very quickly. The resistor uses some voltage and limits the flow.',
      success: 'Nice choice! The resistor limits current while leaving enough energy for the LED to glow.',
      hints: ['Wire 5 V → resistor → LED anode (+).', 'The LED cathode (−) returns to battery −.', 'At 5 V with a 2 V LED, 220 Ω gives about 13.6 mA: I = (5 − 2) ÷ 220.'],
      components: [
        { id: 'cell', type: 'battery', label: '5 V supply', x: 13, y: 53, voltage: 5 },
        { id: 'r', type: 'resistor', label: 'Current limiter', x: 48, y: 30, resistance: 100 },
        { id: 'led', type: 'led', label: 'Red LED', x: 81, y: 55, color: '#ff4967' },
      ],
      required: [edge('cell.pos', 'r.in'), edge('r.out', 'led.a'), edge('led.k', 'cell.neg')], supply: 5, ledForward: 2,
      objectives: [
        ['Wire the resistor and LED in series', (s) => s.exact],
        ['Choose at least 150 Ω', (s) => s.resistance >= 150],
        ['Keep LED current at or below 20 mA', (s) => s.safeCurrent && s.exact],
      ],
      action: 'resistor', noteTitle: 'V = I × R at work', note: 'The LED drops about 2 V, leaving about 3 V across the resistor. Increasing resistance lowers current and brightness; decreasing it raises current and risk.'
    },
    {
      icon: '📟', tier: 'Ohm’s law', difficulty: 'Maker', kicker: 'Build 04 · Voltage detective', title: 'Find the hidden voltage drop',
      intro: 'Create a two-resistor voltage divider and predict the midpoint voltage before you measure it.',
      guide: 'In a series loop the same current passes through both resistors. Their voltage drops add up to the battery voltage.',
      success: 'Exactly 4.5 V! Equal resistors share the 9 V supply equally, and both drops add back to 9 V.',
      hints: ['Wire battery + → R1 → R2 → battery −.', 'Total resistance is 2,000 Ω, so I = 9 ÷ 2,000 = 0.0045 A.', 'Each 1,000 Ω resistor drops V = 0.0045 × 1,000 = 4.5 V.'],
      components: [
        { id: 'cell', type: 'battery', label: '9 V battery', x: 13, y: 55, voltage: 9 },
        { id: 'r1', type: 'resistor', label: 'R1 · 1 kΩ', x: 46, y: 28, resistance: 1000 },
        { id: 'r2', type: 'resistor', label: 'R2 · 1 kΩ', x: 79, y: 55, resistance: 1000 },
      ],
      required: [edge('cell.pos', 'r1.in'), edge('r1.out', 'r2.in'), edge('r2.out', 'cell.neg')], supply: 9, resistance: 2000,
      objectives: [
        ['Build one continuous series path', (s) => s.exact],
        ['Predict the R2 voltage drop', (s) => s.answerCorrect],
        ['Confirm both drops total 9 V', (s) => s.exact && s.answerCorrect],
      ],
      action: 'divider', noteTitle: 'Kirchhoff joins Ohm', note: 'Energy is conserved around the loop: 4.5 V across R1 + 4.5 V across R2 = the 9 V supplied. Change the resistor ratio and the midpoint changes too.'
    },
    {
      icon: '✨', tier: 'Networks', difficulty: 'Builder', kicker: 'Build 05 · Branch out', title: 'Make two lamps shine independently',
      intro: 'Give each lamp its own parallel branch across the battery.',
      guide: 'Parallel branches share the same two connection points. Each lamp receives the full supply voltage.',
      success: 'Both branches have 3 V. If one lamp opens, the other branch still has a complete path.',
      hints: ['Both lamp A terminals connect to battery +.', 'Both lamp B terminals connect to battery −.', 'One terminal can hold more than one virtual wire—branches need shared connection points.'],
      components: [
        { id: 'cell', type: 'battery', label: '3 V battery pack', x: 14, y: 50, voltage: 3 },
        { id: 'lamp1', type: 'lamp', label: 'Lamp branch A', x: 77, y: 28, color: '#ffe43b' },
        { id: 'lamp2', type: 'lamp', label: 'Lamp branch B', x: 77, y: 73, color: '#ff4fa3' },
      ],
      required: [edge('cell.pos', 'lamp1.a'), edge('cell.neg', 'lamp1.b'), edge('cell.pos', 'lamp2.a'), edge('cell.neg', 'lamp2.b')], supply: 3, resistance: 6,
      objectives: [
        ['Build the yellow lamp branch', (s) => s.has('cell.pos', 'lamp1.a') && s.has('cell.neg', 'lamp1.b')],
        ['Build the pink lamp branch', (s) => s.has('cell.pos', 'lamp2.a') && s.has('cell.neg', 'lamp2.b')],
        ['Power both lamps in parallel', (s) => s.powered],
      ],
      noteTitle: 'Series or parallel?', note: 'Series loads share one current path and divide voltage. Parallel loads have independent paths and share the same voltage. Adding branches also increases total source current.'
    },
    {
      icon: '☀️', tier: 'Energy', difficulty: 'Engineer', kicker: 'Build 06 · Solar station', title: 'Save sunshine for after dark',
      intro: 'Wire a panel, charge controller, battery, and lamp. Then move the sun from noon to night.',
      guide: 'A panel’s output changes with light. A charge controller safely manages the battery and load as conditions change.',
      success: 'You saw the full energy story: sunlight powers and charges by day; stored chemical energy powers the lamp at night.',
      hints: ['Connect panel +/− to the controller PV +/− inputs.', 'Connect controller BAT +/− to the matching battery terminals.', 'Connect controller LOAD +/− to the lamp, then test bright sun and zero sun.'],
      components: [
        { id: 'panel', type: 'solar', label: '6 W solar panel', x: 12, y: 28 },
        { id: 'controller', type: 'controller', label: 'Charge controller', x: 47, y: 48 },
        { id: 'battery', type: 'battery', label: '10 Wh protected battery', x: 82, y: 25, voltage: 3.7, rechargeable: true },
        { id: 'lamp', type: 'lamp', label: '1 W night lamp', x: 82, y: 73, color: '#ffe43b' },
      ],
      required: [
        edge('panel.pos', 'controller.pvPos'), edge('panel.neg', 'controller.pvNeg'),
        edge('controller.battPos', 'battery.pos'), edge('controller.battNeg', 'battery.neg'),
        edge('controller.loadPos', 'lamp.a'), edge('controller.loadNeg', 'lamp.b'),
      ],
      objectives: [
        ['Connect panel, controller, battery, and load', (s) => s.exact],
        ['Observe charging in bright sun', (s) => s.daySeen],
        ['Set sun to 0% and run from the battery', (s) => s.nightSeen],
      ],
      action: 'solar', noteTitle: 'Where does the energy go?', note: 'When panel power exceeds the lamp load, extra energy charges the battery. When clouds or night reduce panel power, the battery discharges. Runtime depends on stored watt-hours and load watts.'
    },
    {
      icon: '♾️', tier: 'Arduino', difficulty: 'Coder', kicker: 'Build 07 · Arduino output', title: 'Wire the Arduino signal path',
      intro: 'Connect digital pin 13 through a resistor and LED, then return the LED to GND.',
      guide: 'An Arduino pin is a control signal, not a big power supply. A resistor protects both the LED and the microcontroller pin.',
      success: 'Your hardware path is ready: D13 → resistor → LED → GND. Now software can control the signal.',
      hints: ['Start at Arduino D13 and connect it to the resistor.', 'Continue from the resistor to LED A (the anode).', 'Finish at LED K (the cathode) and Arduino GND.'],
      components: [
        { id: 'uno', type: 'uno', label: 'Arduino Uno', x: 22, y: 52 },
        { id: 'r', type: 'resistor', label: '220 Ω resistor', x: 58, y: 29, resistance: 220 },
        { id: 'led', type: 'led', label: 'Program LED', x: 83, y: 57, color: '#35d985' },
      ],
      required: requiredLedEdges, supply: 5, resistance: 220,
      objectives: [
        ['Connect D13 through 220 Ω', (s) => s.has('uno.d13', 'r.in')],
        ['Connect the resistor to LED A', (s) => s.has('r.out', 'led.a')],
        ['Return LED K to Arduino GND', (s) => s.exact],
      ],
      noteTitle: 'Hardware meets software', note: 'D13 can switch between HIGH (about 5 V) and LOW (about 0 V). GND completes the reference and return path. The next mission gives the board instructions.'
    },
    {
      icon: '⌨️', tier: 'Arduino', difficulty: 'Inventor', kicker: 'Build 08 · First sketch', title: 'Code an LED heartbeat',
      intro: 'The circuit is prewired. Complete or change the Arduino sketch, then run it on the virtual Uno.',
      guide: 'setup() prepares the pin once. loop() repeats HIGH, wait, LOW, wait—creating a visible blink.',
      success: 'You built hardware, wrote software, and made them work as one system. That is robotics!',
      hints: ['pinMode(ledPin, OUTPUT) belongs in setup().', 'In loop(), write the same pin HIGH, delay, LOW, and delay again.', 'Try changing both delay values from 500 to 150 for a faster heartbeat.'],
      components: [
        { id: 'uno', type: 'uno', label: 'Arduino Uno', x: 22, y: 52 },
        { id: 'r', type: 'resistor', label: '220 Ω resistor', x: 58, y: 29, resistance: 220 },
        { id: 'led', type: 'led', label: 'Program LED', x: 83, y: 57, color: '#35d985' },
      ],
      required: requiredLedEdges, preconnected: requiredLedEdges, supply: 5, resistance: 220,
      objectives: [
        ['Configure pin 13 as OUTPUT', (s) => s.program?.valid],
        ['Write HIGH, LOW, and two delays', (s) => s.program?.valid],
        ['Run the sketch and watch it blink', (s) => s.programRunning],
      ],
      action: 'code', noteTitle: 'You are controlling time', note: 'The LED is on during the HIGH delay and off during the LOW delay. Unequal delays change duty cycle. Real projects avoid long delays when the computer must do other work at the same time.'
    },
  ];

  // White particles follow electron drift in the external metal circuit: negative to positive.
  // The dim internal source segment represents the chemistry that maintains charge separation.
  const electronFlows = [
    {
      wires: [edge('cell.neg', 'lamp.b'), edge('lamp.a', 'cell.pos')],
      inside: [edge('lamp.b', 'lamp.a'), edge('cell.pos', 'cell.neg')],
    },
    {
      wires: [edge('cell.neg', 'lamp.b'), edge('lamp.a', 'switch.out'), edge('switch.in', 'cell.pos')],
      inside: [edge('lamp.b', 'lamp.a'), edge('switch.out', 'switch.in'), edge('cell.pos', 'cell.neg')],
    },
    {
      wires: [edge('cell.neg', 'led.k'), edge('led.a', 'r.out'), edge('r.in', 'cell.pos')],
      inside: [edge('led.k', 'led.a'), edge('r.out', 'r.in'), edge('cell.pos', 'cell.neg')],
    },
    {
      wires: [edge('cell.neg', 'r2.out'), edge('r2.in', 'r1.out'), edge('r1.in', 'cell.pos')],
      inside: [edge('r2.out', 'r2.in'), edge('r1.out', 'r1.in'), edge('cell.pos', 'cell.neg')],
    },
    {
      wires: [
        edge('cell.neg', 'lamp1.b'), edge('lamp1.a', 'cell.pos'),
        edge('cell.neg', 'lamp2.b'), edge('lamp2.a', 'cell.pos'),
      ],
      inside: [edge('lamp1.b', 'lamp1.a'), edge('lamp2.b', 'lamp2.a'), edge('cell.pos', 'cell.neg')],
    },
    {
      day: {
        wires: [
          edge('panel.neg', 'controller.pvNeg'), edge('controller.loadNeg', 'lamp.b'), edge('lamp.a', 'controller.loadPos'), edge('controller.pvPos', 'panel.pos'),
          edge('controller.battNeg', 'battery.neg'), edge('battery.pos', 'controller.battPos'),
        ],
        inside: [
          edge('controller.pvNeg', 'controller.loadNeg'), edge('controller.loadPos', 'controller.pvPos'), edge('lamp.b', 'lamp.a'), edge('panel.pos', 'panel.neg'),
          edge('controller.pvNeg', 'controller.battNeg'), edge('controller.battPos', 'controller.pvPos'), edge('battery.neg', 'battery.pos'),
        ],
      },
      night: {
        wires: [edge('battery.neg', 'controller.battNeg'), edge('controller.loadNeg', 'lamp.b'), edge('lamp.a', 'controller.loadPos'), edge('controller.battPos', 'battery.pos')],
        inside: [edge('controller.battNeg', 'controller.loadNeg'), edge('lamp.b', 'lamp.a'), edge('controller.loadPos', 'controller.battPos'), edge('battery.pos', 'battery.neg')],
      },
    },
    {
      wires: [edge('uno.gnd', 'led.k'), edge('led.a', 'r.out'), edge('r.in', 'uno.d13')],
      inside: [edge('led.k', 'led.a'), edge('r.out', 'r.in'), edge('uno.d13', 'uno.gnd')],
    },
    {
      wires: [edge('uno.gnd', 'led.k'), edge('led.a', 'r.out'), edge('r.in', 'uno.d13')],
      inside: [edge('led.k', 'led.a'), edge('r.out', 'r.in'), edge('uno.d13', 'uno.gnd')],
    },
  ];

  const wireColors = ['#ff4fa3', '#2ee5eb', '#ffe43b', '#35d985', '#ff8a32', '#a27cff', '#ff4967', '#5bb6ff'];
  const state = {
    missionIndex: 0,
    connections: [],
    selectedPort: null,
    switchClosed: false,
    resistance: 100,
    answerCorrect: false,
    exact: false,
    powered: false,
    achieved: false,
    hintIndex: 0,
    completed: loadProgress(),
    wireDraft: null,
    suppressClickUntil: 0,
    solar: { sun: 80, battery: 55, loadOn: true, daySeen: false, nightSeen: false, result: null },
    solarTimer: null,
    program: null,
    programRunning: false,
    programStartedAt: 0,
    arduinoHigh: false,
    lastFrame: 0,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  const $ = (name) => root.querySelector(`[data-${name}]`);
  const els = {
    rail: $('mission-rail'), guide: $('guide-message'), guideStatus: $('guide-status'), objectives: $('objective-list'), score: $('lab-score'), scoreBar: $('score-bar'),
    kicker: $('mission-kicker'), title: $('mission-title'), intro: $('mission-intro'), difficulty: $('mission-difficulty'), components: $('components'),
    workbench: $('workbench'), loading: $('workbench-loading'), wireCanvas: $('wire-canvas'), electronCanvas: $('electron-canvas'), scopeCanvas: $('scope-canvas'), toast: $('lab-toast'),
    success: $('success'), successCopy: $('success-copy'), plug: $('plug-indicator'), wireStatus: $('wire-status'), undo: $('undo-wire'), clear: $('clear-wires'),
    meterVoltage: $('meter-voltage'), meterCurrent: $('meter-current'), meterResistance: $('meter-resistance'), powerState: $('power-state'),
    action: $('mission-action'), previous: $('previous-mission'), next: $('next-mission'), progress: $('lab-progress'),
  };

  function loadProgress() {
    try {
      const values = JSON.parse(localStorage.getItem('rob-circuit-quest-progress') || '[]');
      return new Set(Array.isArray(values) ? values.filter((value) => Number.isInteger(value) && value >= 0 && value < 8) : []);
    } catch { return new Set(); }
  }

  function saveProgress() {
    try { localStorage.setItem('rob-circuit-quest-progress', JSON.stringify([...state.completed])); } catch { /* Device storage is optional. */ }
  }

  function missionUnlocked(index) {
    return index === 0 || state.completed.has(index) || state.completed.has(index - 1);
  }

  function renderRail() {
    els.rail.replaceChildren(...missions.map((mission, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `mission-tab${index === state.missionIndex ? ' is-active' : ''}${state.completed.has(index) ? ' is-complete' : ''}`;
      button.disabled = !missionUnlocked(index);
      button.setAttribute('aria-label', `${state.completed.has(index) ? 'Completed' : button.disabled ? 'Locked' : 'Open'} build ${index + 1}: ${mission.title}`);
      if (index === state.missionIndex) button.setAttribute('aria-current', 'step');
      button.innerHTML = `<span class="mission-tab__top"><span class="mission-tab__number">${state.completed.has(index) ? '✓' : String(index + 1).padStart(2, '0')}</span><span class="mission-tab__icon" aria-hidden="true">${button.disabled ? '🔒' : mission.icon}</span></span><strong>${mission.title}</strong><small>${mission.tier}</small>`;
      button.addEventListener('click', () => selectMission(index, true));
      return button;
    }));
  }

  function port(id, key, label, className) {
    return `<button type="button" class="lab-port ${className}" data-node="${id}.${key}" aria-label="${label} terminal">${label}</button>`;
  }

  function partMarkup(component) {
    let body = '';
    if (component.type === 'battery') {
      body = `<div class="part-battery__body" data-voltage="${component.voltage}" style="--charge:${component.rechargeable ? state.solar.battery : 76}%"><span class="part-battery__charge"></span>${port(component.id, 'pos', '+', 'lab-port--positive port-right-top')}${port(component.id, 'neg', '−', 'lab-port--negative port-right-bottom')}</div>`;
    }
    if (component.type === 'lamp') {
      body = `<div class="part-lamp__body"><span class="part-lamp__glass"></span><span class="part-lamp__base"></span>${port(component.id, 'a', 'A', 'lab-port--positive port-left-top')}${port(component.id, 'b', 'B', 'lab-port--negative port-left-bottom')}</div>`;
    }
    if (component.type === 'switch') {
      body = `<div class="part-switch__body"><button type="button" class="part-switch__blade" data-switch-toggle aria-label="Close switch"></button>${port(component.id, 'in', 'IN', 'lab-port--positive port-left-middle')}${port(component.id, 'out', 'OUT', 'lab-port--signal port-right-middle')}</div><button type="button" class="part-switch__toggle" data-switch-toggle>OPEN · TAP TO CLOSE</button>`;
    }
    if (component.type === 'resistor') {
      body = `<div class="part-resistor__body"><span class="part-resistor__core"><i style="--band:#8a4d26"></i><i style="--band:#242424"></i><i style="--band:#d54733"></i></span><b class="part-resistor__value" data-resistor-label>${formatResistance(component.resistance)}</b>${port(component.id, 'in', 'IN', 'lab-port--signal port-left-middle')}${port(component.id, 'out', 'OUT', 'lab-port--signal port-right-middle')}</div>`;
    }
    if (component.type === 'led') {
      body = `<div class="part-led__body"><span class="part-led__dome"></span><span class="part-led__legs"></span>${port(component.id, 'a', 'A+', 'lab-port--positive port-left-top')}${port(component.id, 'k', 'K−', 'lab-port--negative port-left-bottom')}</div>`;
    }
    if (component.type === 'solar') {
      body = `<div class="part-solar__body"><i></i><i></i><i></i><i></i><i></i><i></i>${port(component.id, 'pos', '+', 'lab-port--solar port-right-top')}${port(component.id, 'neg', '−', 'lab-port--negative port-right-bottom')}</div>`;
    }
    if (component.type === 'controller') {
      body = `<div class="part-controller__body"><strong>CONTROLLER</strong>${port(component.id, 'pvPos', 'PV+', 'lab-port--solar port-left-top')}${port(component.id, 'pvNeg', 'PV−', 'lab-port--negative port-left-bottom')}${port(component.id, 'battPos', 'B+', 'lab-port--positive port-right-top')}${port(component.id, 'battNeg', 'B−', 'lab-port--negative port-right-bottom')}${port(component.id, 'loadPos', 'L+', 'lab-port--signal port-bottom-left')}${port(component.id, 'loadNeg', 'L−', 'lab-port--negative port-bottom-right')}</div>`;
    }
    if (component.type === 'uno') {
      body = `<div class="part-uno__body"><span class="part-uno__usb"></span><span class="part-uno__brand">ARDUINO<small>UNO</small></span><span class="part-uno__infinity">∞</span><span class="part-uno__chip"></span><span class="part-uno__pins"></span><i class="part-uno__led" data-uno-led></i>${port(component.id, 'd13', 'D13', 'lab-port--signal port-right-top')}${port(component.id, 'gnd', 'GND', 'lab-port--ground port-right-bottom')}</div>`;
    }
    return `<article class="lab-part part-${component.type}" data-part="${component.id}" style="left:${component.x}%;top:${component.y}%;--lamp-color:${component.color || '#ffe43b'}"><div>${body}</div><span class="lab-part__label">${component.label}</span></article>`;
  }

  function formatResistance(value) {
    return value >= 1000 ? `${value / 1000} kΩ` : `${value} Ω`;
  }

  function selectMission(index, shouldScroll = false) {
    if (!missionUnlocked(index)) return;
    clearInterval(state.solarTimer);
    state.missionIndex = index;
    state.connections = [];
    state.selectedPort = null;
    state.wireDraft = null;
    state.switchClosed = false;
    state.answerCorrect = false;
    state.exact = false;
    state.powered = false;
    state.achieved = state.completed.has(index);
    state.hintIndex = 0;
    state.program = null;
    state.programRunning = false;
    state.arduinoHigh = false;
    state.solar = { sun: 80, battery: 55, loadOn: true, daySeen: false, nightSeen: false, result: null };
    const mission = missions[index];
    state.resistance = mission.components.find((component) => component.type === 'resistor')?.resistance || mission.resistance || 0;
    if (mission.preconnected) {
      state.connections = mission.preconnected.map(([a, b], wireIndex) => ({ a, b, color: wireColors[wireIndex % wireColors.length] }));
    }

    els.kicker.textContent = mission.kicker;
    els.title.textContent = mission.title;
    els.intro.textContent = mission.intro;
    els.difficulty.textContent = mission.difficulty;
    els.guide.textContent = mission.guide;
    els.guideStatus.textContent = 'READY';
    els.components.innerHTML = mission.components.map(partMarkup).join('');
    els.loading.hidden = true;
    els.success.hidden = true;
    els.workbench.classList.toggle('is-solar', mission.action === 'solar');
    els.workbench.style.setProperty('--sun', String(state.solar.sun));
    els.previous.disabled = index === 0;
    els.next.disabled = !state.achieved;
    els.next.innerHTML = index === missions.length - 1 ? 'Finish quest <span aria-hidden="true">✦</span>' : 'Next build <span aria-hidden="true">→</span>';
    els.progress.textContent = `Build ${index + 1} of ${missions.length}`;
    renderRail();
    renderMissionAction(mission);
    bindPartEvents();
    evaluate();
    updateScore();
    requestAnimationFrame(resizeCanvases);
    if (shouldScroll) document.querySelector('.lab-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindPartEvents() {
    els.components.querySelectorAll('.lab-port').forEach((button) => {
      button.addEventListener('click', () => {
        if (Date.now() < state.suppressClickUntil) return;
        choosePort(button.dataset.node);
      });
      button.addEventListener('pointerdown', (event) => beginWireDrag(event, button.dataset.node));
    });
    els.components.querySelectorAll('[data-switch-toggle]').forEach((button) => button.addEventListener('click', toggleSwitch));
  }

  function beginWireDrag(event, node) {
    const rect = els.workbench.getBoundingClientRect();
    state.wireDraft = { from: node, startX: event.clientX, startY: event.clientY, x: event.clientX - rect.left, y: event.clientY - rect.top, moved: false };
  }

  window.addEventListener('pointermove', (event) => {
    if (!state.wireDraft) return;
    const rect = els.workbench.getBoundingClientRect();
    state.wireDraft.x = event.clientX - rect.left;
    state.wireDraft.y = event.clientY - rect.top;
    state.wireDraft.moved ||= Math.hypot(event.clientX - state.wireDraft.startX, event.clientY - state.wireDraft.startY) > 9;
  });

  window.addEventListener('pointerup', (event) => {
    if (!state.wireDraft) return;
    const draft = state.wireDraft;
    state.wireDraft = null;
    if (!draft.moved) return;
    state.suppressClickUntil = Date.now() + 250;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.lab-port');
    if (target && target.dataset.node !== draft.from) connectPorts(draft.from, target.dataset.node);
    else showToast('Drop the plug onto another glowing terminal.');
  });

  window.addEventListener('pointercancel', () => { state.wireDraft = null; });

  function choosePort(node) {
    if (!state.selectedPort) {
      state.selectedPort = node;
      updatePortClasses();
      els.wireStatus.textContent = `${terminalName(node)} selected — choose its destination`;
      els.plug.classList.add('is-active');
      return;
    }
    if (state.selectedPort === node) {
      state.selectedPort = null;
      updatePortClasses();
      els.wireStatus.textContent = 'Selection canceled — choose a terminal';
      els.plug.classList.remove('is-active');
      return;
    }
    const from = state.selectedPort;
    state.selectedPort = null;
    connectPorts(from, node);
  }

  function connectPorts(a, b) {
    if (a.split('.')[0] === b.split('.')[0]) {
      showToast('Use wires between components. Internal connections are already built in.', true);
      updatePortClasses();
      return;
    }
    if (hasConnection(state.connections, a, b)) {
      showToast('Those terminals are already connected.');
      updatePortClasses();
      return;
    }
    state.connections.push({ a, b, color: wireColors[state.connections.length % wireColors.length] });
    els.wireStatus.textContent = `${terminalName(a)} connected to ${terminalName(b)}`;
    els.plug.classList.remove('is-active');
    evaluate();
  }

  function terminalName(node) {
    const [componentId, terminal] = node.split('.');
    const mission = missions[state.missionIndex];
    const label = mission.components.find((component) => component.id === componentId)?.label || componentId;
    return `${label} ${terminal}`;
  }

  function toggleSwitch() {
    state.switchClosed = !state.switchClosed;
    const part = els.components.querySelector('[data-part="switch"]');
    part?.classList.toggle('is-closed', state.switchClosed);
    part?.querySelectorAll('[data-switch-toggle]').forEach((button) => {
      button.setAttribute('aria-label', state.switchClosed ? 'Open switch' : 'Close switch');
      if (button.classList.contains('part-switch__toggle')) button.textContent = state.switchClosed ? 'CLOSED · TAP TO OPEN' : 'OPEN · TAP TO CLOSE';
    });
    evaluate();
  }

  function undoWire() {
    state.connections.pop();
    state.selectedPort = null;
    els.wireStatus.textContent = state.connections.length ? 'Last wire removed' : 'Select a terminal to start a wire';
    evaluate();
  }

  function clearWires() {
    state.connections = [];
    state.selectedPort = null;
    state.switchClosed = false;
    state.programRunning = false;
    els.wireStatus.textContent = 'Workbench cleared — choose a terminal';
    evaluate();
  }

  function snapshot() {
    const mission = missions[state.missionIndex];
    const set = connectionSet(state.connections);
    const safeCurrent = mission.ledForward ? (mission.supply - mission.ledForward) / state.resistance <= .02 : true;
    return {
      exact: state.exact, powered: state.powered, resistance: state.resistance, safeCurrent, answerCorrect: state.answerCorrect,
      daySeen: state.solar.daySeen, nightSeen: state.solar.nightSeen, program: state.program, programRunning: state.programRunning,
      has: (a, b) => set.has([a, b].sort().join('::')),
    };
  }

  function evaluate() {
    const mission = missions[state.missionIndex];
    state.exact = matchesCircuit(state.connections, mission.required);
    if (mission.action === 'solar' && state.exact && state.solar.sun >= 60) state.solar.daySeen = true;
    const safeLed = !mission.ledForward || state.resistance >= calculateLedResistor(mission.supply, mission.ledForward, 20);
    if (mission.hasSwitch) state.powered = state.exact && state.switchClosed;
    else if (mission.action === 'resistor') state.powered = state.exact && safeLed;
    else if (mission.action === 'solar') state.powered = state.exact && state.solar.loadOn && (state.solar.sun > 0 || state.solar.battery > 0);
    else if (mission.action === 'code') state.powered = state.exact && state.programRunning && state.arduinoHigh;
    else if (state.missionIndex === 6) state.powered = false;
    else state.powered = state.exact;

    updatePortClasses();
    updateObjectives();
    updateParts();
    updateMeters();
    els.undo.disabled = state.connections.length === 0;
    const complete = completionCondition();
    if (complete && !state.achieved) completeMission();
    else els.next.disabled = !state.completed.has(state.missionIndex);

    if (!state.exact && state.connections.length > mission.required.length) {
      setGuide('There is an extra branch on the bench. Undo or clear wires, then compare the circuit with the mission checklist.', 'REVISE');
    } else if (state.exact && mission.action === 'resistor' && !safeLed) {
      setGuide('Circuit path found—but current is too high for the LED. Increase resistance before we call it safe.', 'LIMIT!');
    } else if (state.exact && mission.action === 'divider' && !state.answerCorrect) {
      setGuide('The loop is live. Use V = I × R to predict the voltage across R2.', 'MEASURE');
    } else if (state.exact && mission.action === 'solar' && !state.solar.nightSeen) {
      setGuide('Great energy system! Watch it charge, then slide the sun to 0% and see who powers the lamp.', 'TEST NIGHT');
    } else if (state.exact && state.missionIndex === 6) {
      setGuide('The hardware signal path is ready. Build 08 will turn that path on and off with code.', 'WIRED');
    } else if (!complete && !state.achieved) {
      els.guideStatus.textContent = state.connections.length ? 'TESTING' : 'READY';
    }
  }

  function completionCondition() {
    if (state.missionIndex === 1) return state.exact && state.switchClosed;
    if (state.missionIndex === 2) return state.exact && state.resistance >= 150;
    if (state.missionIndex === 3) return state.exact && state.answerCorrect;
    if (state.missionIndex === 5) return state.exact && state.solar.daySeen && state.solar.nightSeen;
    if (state.missionIndex === 7) return state.exact && state.programRunning && state.program?.valid;
    return state.exact;
  }

  function completeMission() {
    const mission = missions[state.missionIndex];
    state.achieved = true;
    state.completed.add(state.missionIndex);
    saveProgress();
    els.successCopy.textContent = mission.success;
    els.success.hidden = false;
    els.next.disabled = false;
    setGuide(mission.success, 'COMPLETE');
    celebrate();
    updateScore();
    renderRail();
    window.setTimeout(() => { els.success.hidden = true; }, 2600);
  }

  function updateScore() {
    const score = state.completed.size * 3;
    els.score.textContent = String(score);
    els.scoreBar.style.width = `${score / 24 * 100}%`;
  }

  function updateObjectives() {
    const mission = missions[state.missionIndex];
    const current = snapshot();
    els.objectives.replaceChildren(...mission.objectives.map(([text, check]) => {
      const item = document.createElement('li');
      item.textContent = text;
      item.classList.toggle('is-done', Boolean(check(current)));
      return item;
    }));
  }

  function updatePortClasses() {
    const colors = new Map();
    state.connections.forEach((connection) => {
      colors.set(connection.a, connection.color);
      colors.set(connection.b, connection.color);
    });
    els.components.querySelectorAll('.lab-port').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.node === state.selectedPort);
      button.classList.toggle('is-connected', colors.has(button.dataset.node));
      button.style.setProperty('--wire-color', colors.get(button.dataset.node) || 'transparent');
    });
  }

  function updateParts() {
    const mission = missions[state.missionIndex];
    els.components.querySelectorAll('.lab-part').forEach((part) => part.classList.remove('is-powered'));
    if (state.powered) {
      if (state.missionIndex === 4) {
        els.components.querySelector('[data-part="lamp1"]')?.classList.add('is-powered');
        els.components.querySelector('[data-part="lamp2"]')?.classList.add('is-powered');
      } else {
        els.components.querySelectorAll('.part-lamp, .part-led').forEach((part) => part.classList.add('is-powered'));
      }
    }
    const resistorLabel = els.components.querySelector('[data-resistor-label]');
    if (resistorLabel && mission.action === 'resistor') resistorLabel.textContent = formatResistance(state.resistance);
    const switchPart = els.components.querySelector('[data-part="switch"]');
    switchPart?.classList.toggle('is-closed', state.switchClosed);
    const charge = els.components.querySelector('[data-part="battery"] .part-battery__body');
    if (charge) charge.style.setProperty('--charge', `${state.solar.battery}%`);
    const unoLed = els.components.querySelector('[data-uno-led]');
    unoLed?.classList.toggle('is-on', state.programRunning && state.arduinoHigh);
  }

  function updateMeters() {
    const mission = missions[state.missionIndex];
    let voltage = mission.supply || 0;
    let resistance = mission.resistance || state.resistance || 0;
    let current = 0;
    let label = `${voltage.toFixed(1)} V DC · OPEN LOOP`;
    let danger = false;
    if (mission.action === 'solar') {
      voltage = state.exact ? 3.7 : 0;
      current = state.exact && state.solar.loadOn ? 270 : 0;
      resistance = state.solar.loadOn ? 3.7 : 0;
      label = state.exact ? `DC · ${state.solar.result?.state?.toUpperCase() || 'ENERGY READY'}` : '0 V DC · OPEN LOOP';
    } else if (mission.ledForward) {
      resistance = state.resistance;
      current = state.exact ? Math.max(0, (mission.supply - mission.ledForward) / state.resistance * 1000) : 0;
      danger = state.exact && state.resistance < 150;
      label = danger ? '⚠ DC · CURRENT TOO HIGH!' : state.powered ? `${voltage.toFixed(1)} V DC · LED SAFE` : `${voltage.toFixed(1)} V DC · OPEN LOOP`;
    } else if (state.missionIndex === 7) {
      current = state.powered ? (5 - 2) / 220 * 1000 : 0;
      label = state.programRunning ? `${state.powered ? '5.0' : '0.0'} V PULSED DC · PIN ${state.powered ? 'HIGH' : 'LOW'}` : state.exact ? '0 V DC · READY FOR CODE' : '0 V DC · OPEN LOOP';
    } else if (state.missionIndex === 6) {
      current = 0;
      label = state.exact ? '0 V DC · SIGNAL READY' : '0 V DC · OPEN LOOP';
    } else if (state.exact && (!mission.hasSwitch || state.switchClosed)) {
      current = resistance ? voltage / resistance * 1000 : 0;
      label = `${voltage.toFixed(1)} V DC · STEADY FLOW`;
    }
    els.meterVoltage.textContent = voltage.toFixed(1);
    els.meterCurrent.textContent = current < 10 ? current.toFixed(1) : current.toFixed(0);
    els.meterResistance.textContent = resistance ? (resistance >= 1000 ? `${resistance / 1000}k` : String(resistance)) : '—';
    els.powerState.textContent = label;
    els.powerState.classList.toggle('is-live', state.powered || state.exact);
    els.powerState.classList.toggle('is-danger', danger);
    els.meterCurrent.closest('div')?.classList.toggle('has-danger', danger);
    updateCurrentAlert(current, danger);
  }

  function updateCurrentAlert(current, danger) {
    const alert = els.action.querySelector('[data-current-alert]');
    const prediction = els.action.querySelector('[data-resistor-output]');
    if (prediction) prediction.classList.toggle('is-danger', state.resistance < 150);
    if (!alert) return;
    alert.hidden = !danger;
    if (danger) alert.innerHTML = `<strong>⚠ CURRENT TOO HIGH: ${current.toFixed(1)} mA</strong><span>This exceeds the LED’s 20 mA limit. Choose 150 Ω or more before continuing.</span>`;
  }

  function setGuide(message, status = 'READY') {
    els.guide.textContent = message;
    els.guideStatus.textContent = status;
  }

  function showToast(message, alert = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle('is-alert', alert);
    els.toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 2100);
  }

  function celebrate() {
    const colors = ['#ffe43b', '#ff4fa3', '#2ee5eb', '#35d985', '#a27cff'];
    for (let index = 0; index < 38; index += 1) {
      const confetti = document.createElement('i');
      confetti.className = 'lab-confetti';
      confetti.style.left = `${15 + Math.random() * 70}%`;
      confetti.style.top = `${20 + Math.random() * 30}%`;
      confetti.style.setProperty('--confetti', colors[index % colors.length]);
      confetti.style.setProperty('--fall-x', `${-130 + Math.random() * 260}px`);
      confetti.style.animationDelay = `${Math.random() * .25}s`;
      els.workbench.append(confetti);
      window.setTimeout(() => confetti.remove(), 1900);
    }
  }

  function renderMissionAction(mission) {
    const note = `<div class="lesson-note"><span aria-hidden="true">⚡</span><div><h3>${mission.noteTitle}</h3><p>${mission.note}</p></div></div>`;
    if (mission.action === 'resistor') {
      els.action.innerHTML = `${note}<div class="current-alert" data-current-alert role="alert" aria-live="assertive" hidden></div><div class="resistor-picker"><span>Choose a resistor:</span>${[100, 150, 220, 330].map((value) => `<button type="button" data-resistance="${value}"${value === state.resistance ? ' class="is-active"' : ''}>${value} Ω</button>`).join('')}<output class="is-danger" data-resistor-output>30.0 mA · TOO HIGH</output></div>`;
      els.action.querySelectorAll('[data-resistance]').forEach((button) => button.addEventListener('click', () => {
        state.resistance = Number(button.dataset.resistance);
        els.action.querySelectorAll('[data-resistance]').forEach((item) => item.classList.toggle('is-active', item === button));
        const current = (mission.supply - mission.ledForward) / state.resistance * 1000;
        const output = els.action.querySelector('[data-resistor-output]');
        output.textContent = `${current.toFixed(1)} mA · ${current <= 20 ? 'SAFE GLOW' : 'TOO HIGH'}`;
        output.classList.toggle('is-danger', current > 20);
        evaluate();
      }));
      return;
    }
    if (mission.action === 'divider') {
      els.action.innerHTML = `${note}<div class="divider-test"><span>Predict voltage across R2:</span><label><input type="number" min="0" max="9" step="0.1" inputmode="decimal" data-divider-answer aria-label="Predicted voltage across R2"> volts</label><button type="button" data-divider-check>Test prediction</button><output data-divider-output>Use I = V ÷ R(total), then V(drop) = I × R2.</output></div>`;
      els.action.querySelector('[data-divider-check]').addEventListener('click', () => {
        const answer = Number(els.action.querySelector('[data-divider-answer]').value);
        const result = calculateVoltageDivider(9, 1000, 1000);
        state.answerCorrect = Math.abs(answer - result.outputVoltage) < .06;
        els.action.querySelector('[data-divider-output]').textContent = state.answerCorrect
          ? `Measured ${result.outputVoltage.toFixed(1)} V. R1 drop + R2 drop = ${result.drops.reduce((total, value) => total + value, 0).toFixed(1)} V. Evidence matches!`
          : `The virtual meter reads ${result.outputVoltage.toFixed(1)} V. Follow 9 V ÷ 2,000 Ω, then multiply by 1,000 Ω and revise.`;
        evaluate();
      });
      return;
    }
    if (mission.action === 'solar') {
      els.action.innerHTML = `${note}<div class="solar-console"><div class="solar-controls"><label>Sunlight <output data-sun-output>80%</output><input type="range" min="0" max="100" value="80" step="1" data-sun-slider></label><button type="button" data-solar-load>Night lamp: ON</button></div><div class="solar-readout"><div><small>PANEL</small><strong data-solar-panel>0.0 W</strong></div><div><small>BATTERY</small><strong data-solar-battery>55.0%</strong></div><div><small>ENERGY</small><strong data-solar-state>WAITING</strong></div><p data-solar-explain>Finish the wiring to begin the energy simulation.</p></div></div>`;
      const slider = els.action.querySelector('[data-sun-slider]');
      slider.addEventListener('input', () => {
        state.solar.sun = Number(slider.value);
        if (state.exact && state.solar.sun >= 60) state.solar.daySeen = true;
        if (state.exact && state.solar.sun <= 5) state.solar.nightSeen = true;
        els.action.querySelector('[data-sun-output]').textContent = `${state.solar.sun}%`;
        els.workbench.style.setProperty('--sun', String(state.solar.sun));
        runSolarTick(0);
        evaluate();
      });
      els.action.querySelector('[data-solar-load]').addEventListener('click', (event) => {
        state.solar.loadOn = !state.solar.loadOn;
        event.currentTarget.textContent = `Night lamp: ${state.solar.loadOn ? 'ON' : 'OFF'}`;
        runSolarTick(0);
        evaluate();
      });
      state.solarTimer = window.setInterval(() => runSolarTick(300), 500);
      runSolarTick(0);
      return;
    }
    if (mission.action === 'code') {
      els.action.innerHTML = `${note}<div class="code-studio"><div class="code-editor"><div class="code-editor__bar"><span>circuit_quest_blink.ino</span><div><button type="button" data-code-reset>Reset code</button><button type="button" data-code-stop>■ Stop</button><button type="button" data-code-run>▶ Run sketch</button></div></div><textarea data-code-source aria-label="Arduino sketch editor" spellcheck="false"></textarea></div><aside class="code-guide"><h3>ROB’s code map</h3><ol><li>Give the LED pin a memorable name.</li><li>Set that pin to OUTPUT once in setup().</li><li>Send HIGH, wait, send LOW, and wait.</li><li>Change the delays and run again to experiment.</li></ol><div class="serial-monitor" data-serial-monitor>ROB:// Virtual Uno connected\nReady to compile your sketch.</div></aside></div>`;
      const source = els.action.querySelector('[data-code-source]');
      const starter = `const int ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  delay(500);\n  digitalWrite(ledPin, LOW);\n  delay(500);\n}`;
      source.value = starter;
      els.action.querySelector('[data-code-reset]').addEventListener('click', () => { source.value = starter; stopProgram('Starter sketch restored.'); });
      els.action.querySelector('[data-code-stop]').addEventListener('click', () => stopProgram('Sketch stopped. Pin 13 is LOW.'));
      els.action.querySelector('[data-code-run]').addEventListener('click', () => runProgram(source.value));
      source.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
          event.preventDefault();
          const start = source.selectionStart;
          source.setRangeText('  ', start, source.selectionEnd, 'end');
        }
      });
      return;
    }
    els.action.innerHTML = note;
  }

  function runSolarTick(elapsedSeconds) {
    if (state.missionIndex !== 5) return;
    const result = simulateSolar({
      sunPercent: state.solar.sun, panelWatts: 6, batteryPercent: state.solar.battery,
      batteryCapacityWh: 10, loadWatts: state.solar.loadOn ? 1 : 0, elapsedSeconds: state.exact ? elapsedSeconds : 0,
    });
    state.solar.result = result;
    state.solar.battery = result.batteryPercent;
    const panel = els.action.querySelector('[data-solar-panel]');
    if (!panel) return;
    panel.textContent = `${result.generatedWatts.toFixed(1)} W`;
    els.action.querySelector('[data-solar-battery]').textContent = `${result.batteryPercent.toFixed(1)}%`;
    els.action.querySelector('[data-solar-state]').textContent = state.exact ? result.state.toUpperCase() : 'WAITING';
    let explanation = 'Finish the wiring to begin the energy simulation.';
    if (state.exact && result.state === 'charging') explanation = `Panel covers the ${result.loadWatts.toFixed(1)} W load and sends ${result.batteryWatts.toFixed(1)} W into storage. About ${result.hoursToFull.toFixed(1)} h to full.`;
    if (state.exact && result.state === 'discharging') explanation = `The panel is short by ${Math.abs(result.batteryWatts).toFixed(1)} W, so the battery fills the gap. About ${result.runtimeHours.toFixed(1)} h remain.`;
    if (state.exact && result.state === 'balanced') explanation = 'Panel power and load are balanced, so battery charge stays nearly steady.';
    if (state.exact && result.state === 'full') explanation = 'The battery is full. The controller prevents unsafe overcharging while the panel carries the load.';
    if (state.exact && result.state === 'empty') explanation = 'No sunlight and no stored energy: the lamp turns off until energy returns.';
    els.action.querySelector('[data-solar-explain]').textContent = explanation;
    updateParts();
    updateMeters();
  }

  function runProgram(source) {
    state.program = parseArduinoBlink(source);
    const monitor = els.action.querySelector('[data-serial-monitor]');
    if (!state.program.valid) {
      state.programRunning = false;
      monitor.textContent = `COMPILE NEEDS A FIX\n${state.program.reason}\nROB:// Check the code map and try again.`;
      setGuide(state.program.reason, 'DEBUG');
      evaluate();
      return;
    }
    state.programRunning = true;
    state.programStartedAt = performance.now();
    monitor.textContent = `COMPILE OK ✓\nPin ${state.program.pin} OUTPUT\nHIGH ${state.program.highMs} ms → LOW ${state.program.lowMs} ms\nROB:// Sketch running in a ${state.program.cycleMs} ms loop.`;
    setGuide(`Pin ${state.program.pin} is blinking: ${state.program.highMs} ms on, ${state.program.lowMs} ms off.`, 'RUNNING');
    evaluate();
  }

  function stopProgram(message) {
    state.programRunning = false;
    state.arduinoHigh = false;
    const monitor = els.action.querySelector('[data-serial-monitor]');
    if (monitor) monitor.textContent = `ROB:// ${message}`;
    evaluate();
  }

  function calculateOhmMystery() {
    const voltage = $('ohm-voltage');
    const current = $('ohm-current');
    const resistance = $('ohm-resistance');
    const result = solveOhmsLaw({
      voltage: voltage.value,
      current: current.value === '' ? '' : Number(current.value) / 1000,
      resistance: resistance.value,
    });
    const output = $('ohm-result');
    if (!result.valid) { output.textContent = result.reason; return; }
    if (result.missing === 'voltage') voltage.value = Number(result.voltage.toFixed(4));
    if (result.missing === 'current') current.value = Number((result.current * 1000).toFixed(3));
    if (result.missing === 'resistance') resistance.value = Number(result.resistance.toFixed(2));
    output.textContent = `Solved! ${result.voltage.toFixed(3)} V = ${(result.current * 1000).toFixed(3)} mA × ${result.resistance.toFixed(2)} Ω. Keep units consistent: the equation itself uses amps.`;
  }

  function resizeCanvases() {
    [els.wireCanvas, els.electronCanvas, els.scopeCanvas].forEach((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) {
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
      }
    });
  }

  function portPosition(node) {
    const button = els.components.querySelector(`[data-node="${node}"]`);
    if (!button) return null;
    const portRect = button.getBoundingClientRect();
    const benchRect = els.workbench.getBoundingClientRect();
    return { x: portRect.left - benchRect.left + portRect.width / 2, y: portRect.top - benchRect.top + portRect.height / 2 };
  }

  function drawWires() {
    const canvas = els.wireCanvas;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / Math.max(1, rect.width);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    const drawCable = (from, to, color, temporary = false) => {
      if (!from || !to) return;
      const bend = Math.max(55, Math.abs(to.x - from.x) * .42);
      const c1 = { x: from.x + (to.x >= from.x ? bend : -bend), y: from.y };
      const c2 = { x: to.x - (to.x >= from.x ? bend : -bend), y: to.y };
      context.beginPath(); context.moveTo(from.x, from.y); context.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
      context.lineCap = 'round'; context.lineWidth = temporary ? 5 : 10; context.strokeStyle = temporary ? '#ffffff88' : '#07081799'; context.stroke();
      context.beginPath(); context.moveTo(from.x, from.y); context.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
      context.lineWidth = temporary ? 3 : 6; context.strokeStyle = color; context.setLineDash(temporary ? [7, 7] : []); context.stroke(); context.setLineDash([]);
    };
    state.connections.forEach((connection) => drawCable(portPosition(connection.a), portPosition(connection.b), connection.color));
    if (state.wireDraft?.moved) drawCable(portPosition(state.wireDraft.from), state.wireDraft, '#ffe43b', true);
  }

  function activeElectronFlow() {
    const configured = electronFlows[state.missionIndex];
    if (state.missionIndex !== 5) return configured;
    return state.solar.result?.batteryWatts < 0 ? configured.night : configured.day;
  }

  function electronFlowIsActive() {
    if (!state.exact) return false;
    if (state.missionIndex === 1) return state.switchClosed;
    if (state.missionIndex === 5) return state.exact && (state.powered || Math.abs(state.solar.result?.batteryWatts || 0) > .01);
    if (state.missionIndex === 6) return false;
    if (state.missionIndex === 7) return state.powered;
    return true;
  }

  function connectedWireColor(fromNode, toNode) {
    const wanted = [fromNode, toNode].sort().join('::');
    return state.connections.find((connection) => [connection.a, connection.b].sort().join('::') === wanted)?.color || '#2ee5eb';
  }

  function isSourceSegment(fromNode, toNode) {
    const fromId = fromNode.split('.')[0];
    if (fromId !== toNode.split('.')[0]) return false;
    const type = missions[state.missionIndex].components.find((component) => component.id === fromId)?.type;
    return type === 'battery' || type === 'solar' || type === 'uno';
  }

  function bezierPoints(from, to) {
    const bend = Math.max(55, Math.abs(to.x - from.x) * .42);
    return {
      from,
      c1: { x: from.x + (to.x >= from.x ? bend : -bend), y: from.y },
      c2: { x: to.x - (to.x >= from.x ? bend : -bend), y: to.y },
      to,
    };
  }

  function pointOnBezier(curve, progress) {
    const inverse = 1 - progress;
    return {
      x: inverse ** 3 * curve.from.x + 3 * inverse ** 2 * progress * curve.c1.x + 3 * inverse * progress ** 2 * curve.c2.x + progress ** 3 * curve.to.x,
      y: inverse ** 3 * curve.from.y + 3 * inverse ** 2 * progress * curve.c1.y + 3 * inverse * progress ** 2 * curve.c2.y + progress ** 3 * curve.to.y,
    };
  }

  function drawElectrons(time) {
    const canvas = els.electronCanvas;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / Math.max(1, rect.width);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    if (!electronFlowIsActive()) return;

    const flow = activeElectronFlow();
    const segments = [
      ...flow.wires.map(([fromNode, toNode]) => ({ fromNode, toNode, kind: 'wire', color: connectedWireColor(fromNode, toNode) })),
      ...flow.inside.map(([fromNode, toNode]) => ({ fromNode, toNode, kind: 'inside', source: isSourceSegment(fromNode, toNode), color: '#ffffff' })),
    ];
    const danger = state.missionIndex === 2 && state.resistance < 150;

    segments.forEach((segment, segmentIndex) => {
      const from = portPosition(segment.fromNode);
      const to = portPosition(segment.toNode);
      if (!from || !to) return;
      const curve = segment.kind === 'wire' ? bezierPoints(from, to) : {
        from,
        c1: { x: from.x + (to.x - from.x) * .33, y: from.y + (to.y - from.y) * .12 },
        c2: { x: from.x + (to.x - from.x) * .66, y: to.y - (to.y - from.y) * .12 },
        to,
      };

      if (segment.kind === 'inside') {
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.bezierCurveTo(curve.c1.x, curve.c1.y, curve.c2.x, curve.c2.y, to.x, to.y);
        context.setLineDash([3, 7]);
        context.lineWidth = 1.5;
        context.strokeStyle = segment.source ? '#ffe43b70' : danger ? '#ff496788' : '#ffffff48';
        context.stroke();
        context.setLineDash([]);
      }

      const particleCount = state.reducedMotion ? 1 : 2;
      for (let particle = 0; particle < particleCount; particle += 1) {
        const motion = state.reducedMotion ? .58 : (time / 1450 + particle / particleCount + segmentIndex / segments.length) % 1;
        const point = pointOnBezier(curve, motion);
        const color = segment.source ? '#ffe43b' : danger ? '#ff4967' : segment.color;
        context.beginPath();
        if (segment.source) context.rect(point.x - 4, point.y - 4, 8, 8);
        else context.arc(point.x, point.y, danger ? 5 : 4, 0, Math.PI * 2);
        context.fillStyle = segment.source ? '#ffe43b' : '#fff';
        context.shadowColor = color;
        context.shadowBlur = danger ? 18 : 12;
        context.fill();
        context.shadowBlur = 0;
      }
    });
  }

  function drawScope(time) {
    const canvas = els.scopeCanvas;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / Math.max(1, rect.width);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.strokeStyle = '#2ee5eb20'; context.lineWidth = 1;
    for (let x = 0; x < rect.width; x += 20) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, rect.height); context.stroke(); }
    const flowing = electronFlowIsActive();
    const danger = state.missionIndex === 2 && state.exact && state.resistance < 150;
    const highY = rect.height * .3;
    const zeroY = rect.height * .72;
    const traceY = flowing ? highY : zeroY;
    const traceColor = danger ? '#ff4967' : flowing ? '#35d985' : '#666a90';

    context.strokeStyle = traceColor;
    context.lineWidth = danger ? 4 : 2.5;
    context.shadowColor = flowing ? traceColor : 'transparent';
    context.shadowBlur = flowing ? 9 : 0;
    context.beginPath();
    context.moveTo(0, zeroY);
    if (flowing) {
      context.lineTo(14, zeroY);
      context.lineTo(14, highY);
    }
    context.lineTo(rect.width, traceY);
    context.stroke();
    context.shadowBlur = 0;

    context.fillStyle = '#8589ae';
    context.font = '700 8px ui-monospace, monospace';
    context.fillText('DC', 4, 11);
    context.fillText('0 V', 4, Math.min(rect.height - 3, zeroY + 12));
    if (flowing && !state.reducedMotion) {
      const dotX = 18 + (time * .08) % Math.max(1, rect.width - 22);
      context.beginPath();
      context.arc(dotX, traceY, danger ? 4.5 : 3.5, 0, Math.PI * 2);
      context.fillStyle = '#fff';
      context.shadowColor = traceColor;
      context.shadowBlur = 12;
      context.fill();
      context.shadowBlur = 0;
    }
  }

  function animationFrame(time) {
    if (state.programRunning && state.program?.valid) {
      const nextHigh = arduinoOutputAt(time - state.programStartedAt, state.program);
      if (nextHigh !== state.arduinoHigh) {
        state.arduinoHigh = nextHigh;
        state.powered = state.exact && state.arduinoHigh;
        updateParts();
        updateMeters();
      }
    }
    drawWires();
    drawElectrons(time);
    drawScope(time);
    state.lastFrame = time;
    requestAnimationFrame(animationFrame);
  }

  els.undo.addEventListener('click', undoWire);
  els.clear.addEventListener('click', clearWires);
  $('lab-hint').addEventListener('click', () => {
    const mission = missions[state.missionIndex];
    setGuide(mission.hints[state.hintIndex % mission.hints.length], 'HINT');
    state.hintIndex += 1;
  });
  $('lab-start').addEventListener('click', () => document.querySelector('.lab-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  els.previous.addEventListener('click', () => selectMission(Math.max(0, state.missionIndex - 1), true));
  els.next.addEventListener('click', () => {
    if (!state.completed.has(state.missionIndex)) return;
    if (state.missionIndex < missions.length - 1) selectMission(state.missionIndex + 1, true);
    else document.querySelector('.ohm-lab')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('ohm-calculate').addEventListener('click', calculateOhmMystery);
  $('ohm-clear').addEventListener('click', () => {
    ['ohm-voltage', 'ohm-current', 'ohm-resistance'].forEach((name) => { $(name).value = ''; });
    $('ohm-result').textContent = 'Enter any two values and leave exactly one blank.';
  });
  root.querySelectorAll('[data-ohm-preset]').forEach((button) => button.addEventListener('click', () => {
    const led = button.dataset.ohmPreset === 'led';
    $('ohm-voltage').value = led ? '5' : '9';
    $('ohm-current').value = '';
    $('ohm-resistance').value = led ? '220' : '2000';
    $('ohm-result').textContent = led ? 'LED example loaded. Calculate current.' : 'Voltage-divider loop loaded. Calculate series current.';
  }));
  window.addEventListener('resize', resizeCanvases, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvases).observe(els.workbench);

  selectMission(0);
  requestAnimationFrame(animationFrame);
}
