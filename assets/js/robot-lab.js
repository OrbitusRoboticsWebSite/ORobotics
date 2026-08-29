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
        { id: 'r2', type: 'resistor', label: 'R2 · 1 kΩ', x: 76, y: 55, resistance: 1000, orientation: 'vertical' },
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
    {
      icon: '〰️', tier: 'AC basics', difficulty: 'Explorer', kicker: 'Build 09 · Meet alternating current', title: 'Make electrons rock back and forth',
      intro: 'Build a safe 3 V RMS AC lamp loop and watch the source reverse direction again and again.',
      guide: 'AC means alternating current. Its voltage polarity reverses, so electrons in the metal wires drift one way, slow, stop, then drift the other way.',
      success: 'Your AC loop is live! The scope crosses zero because the source reverses polarity every half-cycle.',
      hints: ['Connect AC terminal A to one lamp terminal.', 'Return the other lamp terminal to AC terminal B.', 'AC has no permanently positive or negative terminal—the roles keep swapping.'],
      components: [
        { id: 'source', type: 'acsource', label: '3 V RMS AC source', x: 18, y: 50 },
        { id: 'lamp', type: 'lamp', label: 'AC workshop lamp', x: 78, y: 50, color: '#a27cff' },
      ],
      required: [edge('source.a', 'lamp.a'), edge('lamp.b', 'source.b')], mode: 'ac', action: 'ac-basics', supplyRms: 3, frequency: 2, resistance: 30,
      objectives: [
        ['Build a complete AC loop', (s) => s.exact],
        ['Observe voltage above and below zero', (s) => s.exact],
        ['Notice electron drift reverse direction', (s) => s.powered],
      ],
      noteTitle: 'AC changes direction', note: 'A generator uses a changing magnetic field to create a changing electric field. Frequency counts complete cycles per second in hertz (Hz). This is a safe low-voltage simulation—never experiment with wall-outlet AC.'
    },
    {
      icon: '▮▮', tier: 'Electric fields', difficulty: 'Explorer', kicker: 'Build 10 · Store an electric field', title: 'Charge and discharge a capacitor',
      intro: 'Use a resistor to safely fill a capacitor, then release its stored electric-field energy.',
      guide: 'Electrons collect on one metal plate and leave the other. They do not cross the insulating gap; the growing electric field stores energy.',
      success: 'You charged and discharged the capacitor. It resisted sudden voltage change and released its stored field energy gradually.',
      hints: ['Wire battery + → resistor → capacitor IN.', 'Return capacitor OUT to battery −.', 'After wiring, run both CHARGE and DISCHARGE in the experiment panel.'],
      components: [
        { id: 'cell', type: 'battery', label: '5 V DC supply', x: 13, y: 55, voltage: 5 },
        { id: 'r', type: 'resistor', label: 'R · 1 kΩ', x: 45, y: 27, resistance: 1000 },
        { id: 'c', type: 'capacitor', label: 'C · 1,000 µF', x: 76, y: 55, capacitance: .001, orientation: 'vertical' },
      ],
      required: [edge('cell.pos', 'r.in'), edge('r.out', 'c.in'), edge('c.out', 'cell.neg')], supply: 5, resistance: 1000, capacitance: .001, action: 'capacitor',
      objectives: [
        ['Build the RC charging path', (s) => s.exact],
        ['Charge the electric field above 80%', (s) => s.chargeSeen],
        ['Discharge the field below 20%', (s) => s.dischargeSeen],
      ],
      noteTitle: 'A capacitor stores an electric field', note: 'Its time constant is τ = R × C. After one τ it is about 63% charged; after about five τ it is nearly full. The resistor limits the initial surge.'
    },
    {
      icon: '🧲', tier: 'Magnetic fields', difficulty: 'Builder', kicker: 'Build 11 · Grow a magnetic field', title: 'Wake up an inductor coil',
      intro: 'Send DC through a coil, watch its magnetic field grow, then open the switch and watch the field collapse.',
      guide: 'Moving charge creates a magnetic field. An inductor resists sudden current change by creating a voltage that opposes the change.',
      success: 'You grew and collapsed a magnetic field. The current changed gradually because the inductor pushed back against sudden change.',
      hints: ['Wire battery + → switch → inductor.', 'Continue through the resistor and return to battery −.', 'Close the switch until the field grows, then open it to watch the decay.'],
      components: [
        { id: 'cell', type: 'battery', label: '5 V DC supply', x: 11, y: 58, voltage: 5 },
        { id: 'switch', type: 'switch', label: 'Field switch', x: 37, y: 25 },
        { id: 'coil', type: 'inductor', label: 'L · 100 mH', x: 70, y: 27, inductance: .1 },
        { id: 'r', type: 'resistor', label: 'R · 100 Ω', x: 73, y: 73, resistance: 100, orientation: 'vertical' },
      ],
      required: [edge('cell.pos', 'switch.in'), edge('switch.out', 'coil.in'), edge('coil.out', 'r.in'), edge('r.out', 'cell.neg')], supply: 5, resistance: 100, inductance: .1, action: 'inductor', hasSwitch: true,
      objectives: [
        ['Build the RL current path', (s) => s.exact],
        ['Close the switch and grow the field', (s) => s.fieldSeen],
        ['Open it and observe field decay', (s) => s.decaySeen],
      ],
      noteTitle: 'An inductor stores a magnetic field', note: 'Its time constant is τ = L ÷ R. Opening a real coil can create a large voltage spike, so motors and relays often use a flyback diode for protection.'
    },
    {
      icon: '🌊', tier: 'AC reactance', difficulty: 'Builder', kicker: 'Build 12 · Frequency gate', title: 'Let high-frequency AC pass a capacitor',
      intro: 'Place a capacitor in an AC lamp circuit and test how changing frequency changes brightness.',
      guide: 'A capacitor’s opposition is Xc = 1 ÷ (2πfC). Faster reversals make Xc smaller, so more AC current can flow.',
      success: 'You found the capacitor’s frequency trick: it blocks steady DC after charging but passes changing signals more easily as frequency rises.',
      hints: ['Wire AC A → capacitor → lamp.', 'Return the lamp to AC B.', 'Test both ends of the frequency slider and compare current.'],
      components: [
        { id: 'source', type: 'acsource', label: '3 V RMS AC source', x: 13, y: 55 },
        { id: 'c', type: 'capacitor', label: 'C · 100 µF', x: 47, y: 27, capacitance: .0001 },
        { id: 'lamp', type: 'lamp', label: 'Frequency lamp', x: 81, y: 56, color: '#2ee5eb' },
      ],
      required: [edge('source.a', 'c.in'), edge('c.out', 'lamp.a'), edge('lamp.b', 'source.b')], mode: 'ac', action: 'capacitive-ac', supplyRms: 3, frequency: 10, resistance: 30, capacitance: .0001,
      objectives: [
        ['Build the capacitive AC path', (s) => s.exact],
        ['Test a low frequency', (s) => s.lowSeen],
        ['Test a high frequency', (s) => s.highSeen],
      ],
      noteTitle: 'Capacitive reactance falls with frequency', note: 'No electrons cross the dielectric. Alternating charge on the plates creates a changing electric field, while electrons elsewhere in the loop shuffle back and forth.'
    },
    {
      icon: '➿', tier: 'AC reactance', difficulty: 'Builder', kicker: 'Build 13 · Magnetic choke', title: 'Let low-frequency AC pass an inductor',
      intro: 'Place a coil in an AC lamp circuit and compare its response at low and high frequency.',
      guide: 'An inductor’s opposition is XL = 2πfL. Faster current reversals demand faster magnetic-field changes, so XL grows.',
      success: 'You found the inductor’s opposite frequency trick: low frequency passes more easily, while high frequency meets greater reactance.',
      hints: ['Wire AC A → inductor → lamp.', 'Return the lamp to AC B.', 'Test low and high frequency while watching the field and RMS current.'],
      components: [
        { id: 'source', type: 'acsource', label: '3 V RMS AC source', x: 13, y: 55 },
        { id: 'coil', type: 'inductor', label: 'L · 100 mH', x: 47, y: 27, inductance: .1 },
        { id: 'lamp', type: 'lamp', label: 'Magnetic lamp', x: 81, y: 56, color: '#ffe43b' },
      ],
      required: [edge('source.a', 'coil.in'), edge('coil.out', 'lamp.a'), edge('lamp.b', 'source.b')], mode: 'ac', action: 'inductive-ac', supplyRms: 3, frequency: 10, resistance: 30, inductance: .1,
      objectives: [
        ['Build the inductive AC path', (s) => s.exact],
        ['Test a low frequency', (s) => s.lowSeen],
        ['Test a high frequency', (s) => s.highSeen],
      ],
      noteTitle: 'Inductive reactance rises with frequency', note: 'The current creates a magnetic field around the coil. When current changes, the changing magnetic field creates a counter-voltage called back EMF.'
    },
    {
      icon: '↗️', tier: 'Phase', difficulty: 'Engineer', kicker: 'Build 14 · Phase detective', title: 'See current lead voltage in an RC circuit',
      intro: 'Build a series resistor-capacitor circuit and compare the voltage and current waves on the scope.',
      guide: 'In a capacitive circuit, current reaches its peaks before source voltage does. Engineers say current leads voltage.',
      success: 'Correct: current leads source voltage in this RC circuit. The two waves share a frequency but not the same timing.',
      hints: ['Wire AC A → resistor → capacitor → AC B.', 'The capacitor stores and returns energy each cycle.', 'On the scope, identify which trace reaches its peak first.'],
      components: [
        { id: 'source', type: 'acsource', label: '5 V RMS AC source', x: 13, y: 55 },
        { id: 'r', type: 'resistor', label: 'R · 100 Ω', x: 46, y: 27, resistance: 100 },
        { id: 'c', type: 'capacitor', label: 'C · 100 µF', x: 76, y: 55, capacitance: .0001, orientation: 'vertical' },
      ],
      required: [edge('source.a', 'r.in'), edge('r.out', 'c.in'), edge('c.out', 'source.b')], mode: 'ac', action: 'phase', supplyRms: 5, frequency: 20, resistance: 100, capacitance: .0001,
      objectives: [
        ['Build the series RC circuit', (s) => s.exact],
        ['Compare both scope traces', (s) => s.exact],
        ['Identify the leading wave', (s) => s.answerCorrect],
      ],
      noteTitle: 'Phase describes timing', note: 'Resistance keeps voltage and current together. Capacitance shifts their timing because energy moves into and out of an electric field. In an RC circuit, current leads source voltage.'
    },
    {
      icon: '🎯', tier: 'Series RLC', difficulty: 'Engineer', kicker: 'Build 15 · Resonance tuner', title: 'Tune a series RLC circuit to resonance',
      intro: 'Combine resistance, inductance, and capacitance, then tune frequency until their reactances cancel.',
      guide: 'At resonance XL = Xc. Series impedance falls to R, current reaches a maximum, and voltage and current line up.',
      success: 'Resonance locked! Electric-field and magnetic-field energy trade places while the source replaces resistive losses.',
      hints: ['Wire AC A → R → L → C → AC B.', 'Tune toward f₀ = 1 ÷ (2π√LC).', 'At resonance, XL and Xc match and the two scope traces align.'],
      components: [
        { id: 'source', type: 'acsource', label: '5 V RMS AC source', x: 10, y: 60 },
        { id: 'r', type: 'resistor', label: 'R · 100 Ω', x: 35, y: 23, resistance: 100 },
        { id: 'coil', type: 'inductor', label: 'L · 100 mH', x: 64, y: 23, inductance: .1 },
        { id: 'c', type: 'capacitor', label: 'C · 25.3 µF', x: 82, y: 62, capacitance: .00002533029591058445, orientation: 'vertical' },
      ],
      required: [edge('source.a', 'r.in'), edge('r.out', 'coil.in'), edge('coil.out', 'c.in'), edge('c.out', 'source.b')], mode: 'ac', action: 'resonance', supplyRms: 5, frequency: 40, resistance: 100, inductance: .1, capacitance: .00002533029591058445,
      objectives: [
        ['Build the series RLC loop', (s) => s.exact],
        ['Tune XL and Xc to nearly equal', (s) => s.tuned],
        ['Observe maximum series current', (s) => s.resonanceSeen],
      ],
      noteTitle: 'Series resonance boosts current', note: 'Below resonance the circuit is net capacitive; above it, net inductive. At resonance their opposite reactances cancel, leaving resistance to set the current.'
    },
    {
      icon: '📻', tier: 'Parallel RLC', difficulty: 'Inventor', kicker: 'Build 16 · Radio energy tank', title: 'Tune a parallel RLC selector',
      intro: 'Create three parallel branches and tune the LC tank to select ROB Radio’s signal.',
      guide: 'At parallel resonance, capacitor and inductor branch currents are equal and opposite. Energy circulates between their fields while source current is minimized.',
      success: 'ROB Radio tuned! The electric and magnetic fields exchange energy at their natural resonant frequency.',
      hints: ['Connect R, L, and C as three separate branches across AC A and B.', 'A terminal may hold several wires in a parallel network.', 'Tune until the capacitor and inductor branch currents match.'],
      components: [
        { id: 'source', type: 'acsource', label: '5 V RMS signal source', x: 15, y: 50 },
        { id: 'r', type: 'resistor', label: 'R · 1 kΩ receiver', x: 68, y: 18, resistance: 1000 },
        { id: 'coil', type: 'inductor', label: 'L · 100 mH', x: 68, y: 50, inductance: .1 },
        { id: 'c', type: 'capacitor', label: 'C · 25.3 µF', x: 68, y: 82, capacitance: .00002533029591058445 },
      ],
      required: [
        edge('source.a', 'r.in'), edge('r.out', 'source.b'),
        edge('source.a', 'coil.in'), edge('coil.out', 'source.b'),
        edge('source.a', 'c.in'), edge('c.out', 'source.b'),
      ],
      mode: 'ac', action: 'tank', supplyRms: 5, frequency: 40, resistance: 1000, inductance: .1, capacitance: .00002533029591058445,
      objectives: [
        ['Build all three parallel branches', (s) => s.exact],
        ['Tune equal L and C branch currents', (s) => s.tuned],
        ['Lock onto the resonant signal', (s) => s.resonanceSeen],
      ],
      noteTitle: 'Parallel resonance creates an energy tank', note: 'The source mainly replaces energy lost in resistance. This frequency-selective behavior helps radios, filters, oscillators, and wireless systems choose one signal from many.'
    },
  ];

  // White particles show electron drift: negative-to-positive in DC metal paths and
  // back-and-forth oscillation in AC paths. Dim source segments represent the mechanism
  // that maintains voltage rather than electrons crossing battery electrolyte.
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
    {
      wires: [edge('source.b', 'lamp.b'), edge('lamp.a', 'source.a')],
      inside: [edge('lamp.b', 'lamp.a'), edge('source.a', 'source.b')],
    },
    {
      wires: [edge('cell.neg', 'c.out'), edge('c.in', 'r.out'), edge('r.in', 'cell.pos')],
      inside: [edge('r.out', 'r.in'), edge('cell.pos', 'cell.neg')],
    },
    {
      wires: [edge('cell.neg', 'r.out'), edge('r.in', 'coil.out'), edge('coil.in', 'switch.out'), edge('switch.in', 'cell.pos')],
      inside: [edge('r.out', 'r.in'), edge('coil.out', 'coil.in'), edge('switch.out', 'switch.in'), edge('cell.pos', 'cell.neg')],
    },
    {
      wires: [edge('source.b', 'lamp.b'), edge('lamp.a', 'c.out'), edge('c.in', 'source.a')],
      inside: [edge('lamp.b', 'lamp.a'), edge('source.a', 'source.b')],
    },
    {
      wires: [edge('source.b', 'lamp.b'), edge('lamp.a', 'coil.out'), edge('coil.in', 'source.a')],
      inside: [edge('lamp.b', 'lamp.a'), edge('coil.out', 'coil.in'), edge('source.a', 'source.b')],
    },
    {
      wires: [edge('source.b', 'c.out'), edge('c.in', 'r.out'), edge('r.in', 'source.a')],
      inside: [edge('r.out', 'r.in'), edge('source.a', 'source.b')],
    },
    {
      wires: [edge('source.b', 'c.out'), edge('c.in', 'coil.out'), edge('coil.in', 'r.out'), edge('r.in', 'source.a')],
      inside: [edge('coil.out', 'coil.in'), edge('r.out', 'r.in'), edge('source.a', 'source.b')],
    },
    {
      wires: [
        edge('source.b', 'r.out'), edge('r.in', 'source.a'),
        edge('source.b', 'coil.out'), edge('coil.in', 'source.a'),
        edge('source.b', 'c.out'), edge('c.in', 'source.a'),
      ],
      inside: [edge('r.out', 'r.in'), edge('coil.out', 'coil.in'), edge('source.a', 'source.b')],
    },
  ];

  const wireColors = ['#ff4fa3', '#2ee5eb', '#ffe43b', '#35d985', '#ff8a32', '#a27cff', '#ff4967', '#5bb6ff'];

  function defaultExperiment(mission) {
    return {
      frequency: mission.frequency || 60,
      capacitorCharge: 0,
      capacitorMode: 'charge',
      inductorField: 0,
      chargeSeen: false,
      dischargeRequested: false,
      dischargeSeen: false,
      fieldSeen: false,
      decayRequested: false,
      decaySeen: false,
      lowSeen: false,
      highSeen: false,
      resonanceSeen: false,
      lastTick: performance.now(),
    };
  }

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
    experiment: defaultExperiment(missions[0]),
    conceptMode: 'dc',
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
    voltageLabel: $('meter-voltage-label'), currentLabel: $('meter-current-label'), resistanceLabel: $('meter-resistance-label'), scopeLabel: $('scope-label'),
    directionLabel: $('direction-label'), directionPath: $('direction-path'), directionNote: $('direction-note'),
    conceptCanvas: $('concept-canvas'), conceptSummary: $('concept-summary'), conceptStatus: $('concept-status'),
    action: $('mission-action'), previous: $('previous-mission'), next: $('next-mission'), progress: $('lab-progress'),
  };

  function loadProgress() {
    try {
      const values = JSON.parse(localStorage.getItem('rob-circuit-quest-progress') || '[]');
      return new Set(Array.isArray(values) ? values.filter((value) => Number.isInteger(value) && value >= 0 && value < missions.length) : []);
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
    if (component.type === 'acsource') {
      body = `<div class="part-acsource__body"><span class="part-acsource__wave">~</span><i class="part-acsource__coil"></i><b>AC</b>${port(component.id, 'a', 'A', 'lab-port--signal port-right-top')}${port(component.id, 'b', 'B', 'lab-port--solar port-right-bottom')}</div>`;
    }
    if (component.type === 'lamp') {
      body = `<div class="part-lamp__body"><span class="part-lamp__glass"></span><span class="part-lamp__base"></span>${port(component.id, 'a', 'A', 'lab-port--positive port-left-top')}${port(component.id, 'b', 'B', 'lab-port--negative port-left-bottom')}</div>`;
    }
    if (component.type === 'switch') {
      body = `<div class="part-switch__body"><button type="button" class="part-switch__blade" data-switch-toggle aria-label="Close switch"></button>${port(component.id, 'in', 'IN', 'lab-port--positive port-left-middle')}${port(component.id, 'out', 'OUT', 'lab-port--signal port-right-middle')}</div><button type="button" class="part-switch__toggle" data-switch-toggle>OPEN · TAP TO CLOSE</button>`;
    }
    if (component.type === 'resistor') {
      const vertical = component.orientation === 'vertical';
      const inputPosition = vertical ? 'port-top-middle' : 'port-left-middle';
      const outputPosition = vertical ? 'port-bottom-middle' : 'port-right-middle';
      body = `<div class="part-resistor__body"><span class="part-resistor__core"><i style="--band:#8a4d26"></i><i style="--band:#242424"></i><i style="--band:#d54733"></i></span><b class="part-resistor__value" data-resistor-label>${formatResistance(component.resistance)}</b>${port(component.id, 'in', 'IN', `lab-port--signal ${inputPosition}`)}${port(component.id, 'out', 'OUT', `lab-port--signal ${outputPosition}`)}</div>`;
    }
    if (component.type === 'capacitor') {
      const vertical = component.orientation === 'vertical';
      const inputPosition = vertical ? 'port-top-middle' : 'port-left-middle';
      const outputPosition = vertical ? 'port-bottom-middle' : 'port-right-middle';
      body = `<div class="part-capacitor__body" style="--field-charge:0"><span class="part-capacitor__plates"><i></i><i></i></span><span class="part-capacitor__field" aria-hidden="true"><i></i><i></i><i></i></span><b>C</b>${port(component.id, 'in', 'IN', `lab-port--signal ${inputPosition}`)}${port(component.id, 'out', 'OUT', `lab-port--signal ${outputPosition}`)}</div>`;
    }
    if (component.type === 'inductor') {
      body = `<div class="part-inductor__body" style="--field-strength:0"><span class="part-inductor__field" aria-hidden="true"><i></i><i></i><i></i></span><span class="part-inductor__coil"><i></i><i></i><i></i><i></i></span><b>L</b>${port(component.id, 'in', 'IN', 'lab-port--signal port-left-middle')}${port(component.id, 'out', 'OUT', 'lab-port--signal port-right-middle')}</div>`;
    }
    if (component.type === 'led') {
      body = `<div class="part-led__body"><span class="part-led__dome"></span><span class="part-led__legs"></span>${port(component.id, 'a', 'A+', 'lab-port--positive port-left-top')}${port(component.id, 'k', 'K−', 'lab-port--negative port-left-bottom')}</div>`;
    }
    if (component.type === 'solar') {
      body = `<div class="part-solar__body"><i></i><i></i><i></i><i></i><i></i><i></i><span class="part-solar__status" data-solar-part-status>LIGHT 80% · 4.8 W</span>${port(component.id, 'pos', '+', 'lab-port--solar port-right-top')}${port(component.id, 'neg', '−', 'lab-port--negative port-right-bottom')}</div>`;
    }
    if (component.type === 'controller') {
      body = `<div class="part-controller__body"><strong>CONTROLLER</strong>${port(component.id, 'pvPos', 'PV+', 'lab-port--solar port-left-top')}${port(component.id, 'pvNeg', 'PV−', 'lab-port--negative port-left-bottom')}${port(component.id, 'battPos', 'B+', 'lab-port--positive port-right-top')}${port(component.id, 'battNeg', 'B−', 'lab-port--negative port-right-bottom')}${port(component.id, 'loadPos', 'L+', 'lab-port--signal port-bottom-left')}${port(component.id, 'loadNeg', 'L−', 'lab-port--negative port-bottom-right')}</div>`;
    }
    if (component.type === 'uno') {
      body = `<div class="part-uno__body"><span class="part-uno__usb"></span><span class="part-uno__brand">ARDUINO<small>UNO</small></span><span class="part-uno__infinity">∞</span><span class="part-uno__chip"></span><span class="part-uno__pins"></span><i class="part-uno__led" data-uno-led></i>${port(component.id, 'd13', 'D13', 'lab-port--signal port-right-top')}${port(component.id, 'gnd', 'GND', 'lab-port--ground port-right-bottom')}</div>`;
    }
    const orientationClass = component.orientation ? ` part-${component.type}--${component.orientation}` : '';
    return `<article class="lab-part part-${component.type}${orientationClass}" data-part="${component.id}" style="left:${component.x}%;top:${component.y}%;--lamp-color:${component.color || '#ffe43b'}"><div>${body}</div><span class="lab-part__label">${component.label}</span></article>`;
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
    state.experiment = defaultExperiment(mission);
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
    els.workbench.classList.toggle('is-ac', mission.mode === 'ac');
    els.workbench.style.setProperty('--sun', String(state.solar.sun));
    if (els.directionLabel) els.directionLabel.textContent = mission.mode === 'ac' ? 'AC ELECTRON OSCILLATION' : 'EXTERNAL ELECTRON DRIFT';
    if (els.directionPath) els.directionPath.innerHTML = mission.mode === 'ac' ? '<b>←</b> back and forth every cycle <b>→</b>' : '<b>−</b> → around the complete loop → <b>+</b>';
    if (els.directionNote) els.directionNote.textContent = mission.mode === 'ac' ? 'The source reverses the electric field; electrons do not race from the generator to the lamp.' : 'Battery chemistry keeps the charges separated.';
    if (els.scopeLabel) els.scopeLabel.textContent = mission.mode === 'ac' ? 'AC WAVEFORM SCOPE' : mission.action === 'solar' ? 'SOLAR OUTPUT SCOPE' : 'DC ENERGY SCOPE';
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
    if (missions[state.missionIndex].action === 'inductor' && !state.switchClosed && state.experiment.fieldSeen) {
      state.experiment.decayRequested = true;
    }
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
    state.experiment.capacitorCharge = 0;
    state.experiment.inductorField = 0;
    els.wireStatus.textContent = 'Workbench cleared — choose a terminal';
    evaluate();
  }

  function snapshot() {
    const mission = missions[state.missionIndex];
    const set = connectionSet(state.connections);
    const safeCurrent = mission.ledForward ? (mission.supply - mission.ledForward) / state.resistance <= .02 : true;
    const resonantFrequency = mission.inductance && mission.capacitance ? calculateResonantFrequency(mission.inductance, mission.capacitance) : 0;
    const tuned = resonantFrequency > 0 && Math.abs(state.experiment.frequency - resonantFrequency) <= 2.5;
    return {
      exact: state.exact, powered: state.powered, resistance: state.resistance, safeCurrent, answerCorrect: state.answerCorrect,
      daySeen: state.solar.daySeen, nightSeen: state.solar.nightSeen, program: state.program, programRunning: state.programRunning,
      chargeSeen: state.experiment.chargeSeen, dischargeSeen: state.experiment.dischargeSeen,
      fieldSeen: state.experiment.fieldSeen, decaySeen: state.experiment.decaySeen,
      lowSeen: state.experiment.lowSeen, highSeen: state.experiment.highSeen,
      resonanceSeen: state.experiment.resonanceSeen, tuned,
      has: (a, b) => set.has([a, b].sort().join('::')),
    };
  }

  function evaluate() {
    const mission = missions[state.missionIndex];
    state.exact = matchesCircuit(state.connections, mission.required);
    if (mission.action === 'solar' && state.exact && state.solar.sun >= 60) state.solar.daySeen = true;
    if (state.exact && ['capacitive-ac', 'inductive-ac'].includes(mission.action)) {
      if (state.experiment.frequency <= 20) state.experiment.lowSeen = true;
      if (state.experiment.frequency >= 150) state.experiment.highSeen = true;
    }
    if (state.exact && ['resonance', 'tank'].includes(mission.action)) {
      const resonantFrequency = calculateResonantFrequency(mission.inductance, mission.capacitance);
      if (Math.abs(state.experiment.frequency - resonantFrequency) <= 2.5) state.experiment.resonanceSeen = true;
    }
    const safeLed = !mission.ledForward || state.resistance >= calculateLedResistor(mission.supply, mission.ledForward, 20);
    if (mission.action === 'capacitor') state.powered = state.exact && state.experiment.capacitorMode === 'charge';
    else if (mission.hasSwitch) state.powered = state.exact && state.switchClosed;
    else if (mission.action === 'resistor') state.powered = state.exact && safeLed;
    else if (mission.action === 'solar') state.powered = state.exact && state.solar.loadOn && Boolean(state.solar.result?.loadPowered);
    else if (mission.action === 'code') state.powered = state.exact && state.programRunning && state.arduinoHigh;
    else if (state.missionIndex === 6) state.powered = false;
    else state.powered = state.exact;

    updatePortClasses();
    updateObjectives();
    updateParts();
    updateMeters();
    updateReactiveReadout();
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
    } else if (state.exact && mission.action === 'capacitor' && !state.experiment.chargeSeen) {
      setGuide('The path is complete. Keep CHARGE selected and watch the electric field grow beyond 80%.', 'CHARGING');
    } else if (state.exact && mission.action === 'capacitor' && !state.experiment.dischargeSeen) {
      setGuide('The capacitor has stored energy. Select DISCHARGE and watch the electric field shrink below 20%.', 'RELEASE');
    } else if (state.exact && mission.action === 'inductor' && !state.experiment.fieldSeen) {
      setGuide('Close the field switch and watch current—and the coil’s magnetic field—grow gradually.', 'GROW FIELD');
    } else if (state.exact && mission.action === 'inductor' && !state.experiment.decaySeen) {
      setGuide('Now open the switch and watch the magnetic field collapse while current decays.', 'FIELD DECAY');
    } else if (state.exact && ['capacitive-ac', 'inductive-ac'].includes(mission.action) && !completionCondition()) {
      setGuide('Sweep from low to high frequency and compare the reactance, RMS current, and lamp brightness.', 'SWEEP Hz');
    } else if (state.exact && ['resonance', 'tank'].includes(mission.action) && !completionCondition()) {
      setGuide('Tune the frequency until XL and Xc match. The resonance marker will lock when you are close.', 'TUNE f₀');
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
    if (missions[state.missionIndex].action === 'capacitor') return state.exact && state.experiment.chargeSeen && state.experiment.dischargeSeen;
    if (missions[state.missionIndex].action === 'inductor') return state.exact && state.experiment.fieldSeen && state.experiment.decaySeen;
    if (['capacitive-ac', 'inductive-ac'].includes(missions[state.missionIndex].action)) return state.exact && state.experiment.lowSeen && state.experiment.highSeen;
    if (missions[state.missionIndex].action === 'phase') return state.exact && state.answerCorrect;
    if (['resonance', 'tank'].includes(missions[state.missionIndex].action)) return state.exact && state.experiment.resonanceSeen;
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
    els.scoreBar.style.width = `${score / (missions.length * 3) * 100}%`;
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
    const solarPart = els.components.querySelector('[data-part="panel"]');
    if (solarPart) {
      const panelWatts = state.solar.result?.generatedWatts || 0;
      const panelGenerating = state.exact && panelWatts > .01;
      solarPart.style.setProperty('--panel-light', (state.solar.sun / 100).toFixed(2));
      solarPart.classList.toggle('is-generating', panelGenerating);
      solarPart.classList.toggle('is-dark', state.solar.sun <= 0);
      const status = solarPart.querySelector('[data-solar-part-status]');
      if (status) status.textContent = state.solar.sun <= 0 ? 'DARK · 0.0 W' : `LIGHT ${state.solar.sun}% · ${panelWatts.toFixed(1)} W`;
    }
    const unoLed = els.components.querySelector('[data-uno-led]');
    unoLed?.classList.toggle('is-on', state.programRunning && state.arduinoHigh);
    const wavePhase = state.experiment.wavePhase || 0;
    const capacitorCharge = mission.mode === 'ac' ? (Math.sin(wavePhase) + 1) / 2 : state.experiment.capacitorCharge;
    els.components.querySelectorAll('.part-capacitor__body').forEach((part) => {
      part.style.setProperty('--field-charge', capacitorCharge.toFixed(3));
      part.classList.toggle('is-alternating', mission.mode === 'ac' && state.exact);
    });
    const inductorField = mission.mode === 'ac' ? Math.abs(Math.sin(wavePhase - Math.PI / 4)) : state.experiment.inductorField;
    els.components.querySelectorAll('.part-inductor__body').forEach((part) => {
      part.style.setProperty('--field-strength', inductorField.toFixed(3));
      part.classList.toggle('is-field-live', state.exact && inductorField > .08);
    });
    els.components.querySelectorAll('.part-acsource__body').forEach((part) => part.style.setProperty('--ac-phase', String(Math.sin(wavePhase))));
    if (mission.mode === 'ac') {
      const metrics = reactiveMetrics(mission);
      const lampLevel = Math.min(1, metrics.currentRms / (mission.supplyRms / Math.max(1, mission.resistance || 30)));
      els.components.querySelectorAll('.part-lamp').forEach((part) => part.style.setProperty('--lamp-level', state.exact ? lampLevel.toFixed(3) : '0'));
    }
  }

  function reactiveMetrics(mission) {
    const frequency = state.experiment.frequency || mission.frequency || 60;
    const voltageRms = mission.supplyRms || 0;
    if (mission.action === 'tank') {
      const result = calculateParallelRLC({ voltageRms, frequencyHz: frequency, resistance: mission.resistance, inductance: mission.inductance, capacitance: mission.capacitance });
      return { ...result, currentRms: result.sourceCurrentRms };
    }
    if (mission.capacitance && mission.inductance) {
      return calculateSeriesRLC({ voltageRms, frequencyHz: frequency, resistance: mission.resistance, inductance: mission.inductance, capacitance: mission.capacitance });
    }
    if (mission.capacitance) {
      const capacitiveReactance = calculateCapacitiveReactance(frequency, mission.capacitance);
      const impedance = Math.hypot(mission.resistance || 0, capacitiveReactance);
      return {
        frequencyHz: frequency, impedance, capacitiveReactance, inductiveReactance: 0,
        currentRms: impedance > 0 ? voltageRms / impedance : 0,
        phaseRadians: -Math.atan2(capacitiveReactance, mission.resistance || 0),
      };
    }
    if (mission.inductance) {
      const inductiveReactance = calculateInductiveReactance(frequency, mission.inductance);
      const impedance = Math.hypot(mission.resistance || 0, inductiveReactance);
      return {
        frequencyHz: frequency, impedance, capacitiveReactance: 0, inductiveReactance,
        currentRms: impedance > 0 ? voltageRms / impedance : 0,
        phaseRadians: Math.atan2(inductiveReactance, mission.resistance || 0),
      };
    }
    const impedance = mission.resistance || 1;
    return { frequencyHz: frequency, impedance, currentRms: voltageRms / impedance, phaseRadians: 0, capacitiveReactance: 0, inductiveReactance: 0 };
  }

  function updateMeters() {
    const mission = missions[state.missionIndex];
    let voltage = mission.supply || 0;
    let resistance = mission.resistance || state.resistance || 0;
    let current = 0;
    let label = `${voltage.toFixed(1)} V DC · OPEN LOOP`;
    let danger = false;
    if (els.voltageLabel) els.voltageLabel.textContent = mission.mode === 'ac' ? 'AC RMS' : mission.action === 'solar' ? 'PANEL V' : 'SUPPLY';
    if (els.currentLabel) els.currentLabel.textContent = mission.mode === 'ac' ? 'RMS FLOW' : mission.action === 'solar' ? 'PANEL FLOW' : 'FLOW';
    if (els.resistanceLabel) els.resistanceLabel.textContent = mission.mode === 'ac' ? 'IMPEDANCE' : mission.action === 'solar' ? 'LAMP LOAD' : 'LOAD';
    if (mission.mode === 'ac') {
      const metrics = reactiveMetrics(mission);
      voltage = mission.supplyRms || 0;
      current = state.exact ? metrics.currentRms * 1000 : 0;
      resistance = Number.isFinite(metrics.impedance) ? metrics.impedance : 0;
      label = state.exact ? `${voltage.toFixed(1)} V RMS · ${Math.round(state.experiment.frequency)} Hz AC` : `${voltage.toFixed(1)} V RMS · OPEN AC LOOP`;
    } else if (mission.action === 'capacitor') {
      voltage = mission.supply;
      const capacitorVoltage = state.experiment.capacitorCharge * mission.supply;
      current = state.exact ? Math.abs((state.experiment.capacitorMode === 'charge' ? mission.supply - capacitorVoltage : capacitorVoltage) / mission.resistance * 1000) : 0;
      resistance = mission.resistance;
      label = state.exact ? `${capacitorVoltage.toFixed(1)} V DC · CAPACITOR ${state.experiment.capacitorMode === 'charge' ? 'CHARGING' : 'DISCHARGING'}` : `${voltage.toFixed(1)} V DC · OPEN LOOP`;
    } else if (mission.action === 'inductor') {
      voltage = mission.supply;
      current = state.exact ? state.experiment.inductorField * mission.supply / mission.resistance * 1000 : 0;
      resistance = mission.resistance;
      label = state.exact ? `${voltage.toFixed(1)} V DC · FIELD ${state.switchClosed ? 'GROWING' : 'DECAYING'}` : `${voltage.toFixed(1)} V DC · OPEN LOOP`;
    } else if (mission.action === 'solar') {
      const result = state.solar.result;
      const panelWatts = state.exact ? result?.generatedWatts || 0 : 0;
      voltage = panelWatts > 0 ? 5 : 0;
      current = voltage > 0 ? panelWatts / voltage * 1000 : 0;
      resistance = state.solar.loadOn ? 13.7 : 0;
      if (!state.exact) label = 'PANEL 0.0 W · OPEN LOOP';
      else if (result?.powerSource === 'battery') label = 'PANEL 0.0 W · BATTERY POWERS LAMP';
      else if (result?.powerSource === 'panel+battery') label = `PANEL ${panelWatts.toFixed(1)} W · BATTERY HELPS`;
      else if (result?.powerSource === 'panel') label = `PANEL ${panelWatts.toFixed(1)} W · POWERS LAMP`;
      else if (result?.state === 'charging') label = `PANEL ${panelWatts.toFixed(1)} W · CHARGING BATTERY`;
      else if (result?.state === 'empty') label = 'PANEL 0.0 W · LAMP OFF';
      else label = `PANEL ${panelWatts.toFixed(1)} W · NO LOAD`;
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
    els.meterResistance.textContent = resistance ? (resistance >= 1000 ? `${(resistance / 1000).toFixed(resistance >= 10000 ? 0 : 1)}k` : resistance >= 100 ? resistance.toFixed(0) : resistance.toFixed(1)) : '—';
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

  function frequencyConsoleMarkup(mission) {
    const resonanceLesson = ['resonance', 'tank'].includes(mission.action);
    const basicAc = mission.action === 'ac-basics';
    const min = basicAc ? 1 : resonanceLesson ? 20 : 5;
    const max = basicAc ? 10 : 200;
    const step = basicAc ? 1 : 2;
    return `<div class="reactive-console">
      <div class="reactive-controls">
        <label><span>Frequency <output data-frequency-output>${state.experiment.frequency.toFixed(0)} Hz</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${state.experiment.frequency}" data-frequency-slider></label>
        ${resonanceLesson ? `<div class="resonance-target"><small>NATURAL FREQUENCY</small><strong>${calculateResonantFrequency(mission.inductance, mission.capacitance).toFixed(1)} Hz</strong><span data-resonance-lock>SEARCHING FOR RESONANCE</span></div>` : '<p>Slide slowly and watch the scope, current, and fields respond together.</p>'}
      </div>
      <div class="reactive-readout" aria-live="polite">
        <div><small>CAPACITOR Xc</small><strong data-reactance-c>— Ω</strong></div>
        <div><small>INDUCTOR XL</small><strong data-reactance-l>— Ω</strong></div>
        <div><small>IMPEDANCE Z</small><strong data-reactance-z>— Ω</strong></div>
        <div><small>RMS CURRENT</small><strong data-reactive-current>0.0 mA</strong></div>
        <p data-reactive-explain>Complete the circuit to energize the frequency experiment.</p>
      </div>
    </div>`;
  }

  function bindFrequencyConsole(mission) {
    const slider = els.action.querySelector('[data-frequency-slider]');
    if (!slider) return;
    slider.addEventListener('input', () => {
      state.experiment.frequency = Number(slider.value);
      evaluate();
      updateReactiveReadout();
      updateParts();
    });
    updateReactiveReadout();
  }

  function updateReactiveReadout() {
    const mission = missions[state.missionIndex];
    const frequencyOutput = els.action.querySelector('[data-frequency-output]');
    if (frequencyOutput) frequencyOutput.textContent = `${state.experiment.frequency.toFixed(0)} Hz`;

    const chargeOutput = els.action.querySelector('[data-capacitor-charge]');
    if (chargeOutput) chargeOutput.textContent = `${Math.round(state.experiment.capacitorCharge * 100)}%`;
    const capacitorBar = els.action.querySelector('[data-capacitor-bar]');
    if (capacitorBar) capacitorBar.style.width = `${state.experiment.capacitorCharge * 100}%`;
    const capacitorVoltage = els.action.querySelector('[data-capacitor-voltage]');
    if (capacitorVoltage) capacitorVoltage.textContent = `${(state.experiment.capacitorCharge * (mission.supply || 0)).toFixed(2)} V`;
    const fieldOutput = els.action.querySelector('[data-inductor-field]');
    if (fieldOutput) fieldOutput.textContent = `${Math.round(state.experiment.inductorField * 100)}%`;
    const inductorBar = els.action.querySelector('[data-inductor-bar]');
    if (inductorBar) inductorBar.style.width = `${state.experiment.inductorField * 100}%`;
    const inductorCurrent = els.action.querySelector('[data-inductor-current]');
    if (inductorCurrent) inductorCurrent.textContent = `${(state.experiment.inductorField * (mission.supply || 0) / Math.max(1, mission.resistance || 1) * 1000).toFixed(1)} mA`;

    if (mission.mode !== 'ac') return;
    const metrics = reactiveMetrics(mission);
    const write = (selector, value) => { const target = els.action.querySelector(selector); if (target) target.textContent = value; };
    write('[data-reactance-c]', metrics.capacitiveReactance && Number.isFinite(metrics.capacitiveReactance) ? `${metrics.capacitiveReactance.toFixed(1)} Ω` : '—');
    write('[data-reactance-l]', metrics.inductiveReactance ? `${metrics.inductiveReactance.toFixed(1)} Ω` : '—');
    write('[data-reactance-z]', Number.isFinite(metrics.impedance) ? `${metrics.impedance.toFixed(1)} Ω` : 'OPEN');
    write('[data-reactive-current]', `${(state.exact ? metrics.currentRms * 1000 : 0).toFixed(1)} mA`);
    const resonantFrequency = mission.inductance && mission.capacitance ? calculateResonantFrequency(mission.inductance, mission.capacitance) : 0;
    const tuned = resonantFrequency && Math.abs(state.experiment.frequency - resonantFrequency) <= 2.5;
    const lock = els.action.querySelector('[data-resonance-lock]');
    if (lock) {
      lock.textContent = tuned ? '● RESONANCE LOCKED' : `${Math.abs(state.experiment.frequency - resonantFrequency).toFixed(1)} Hz FROM TARGET`;
      lock.classList.toggle('is-locked', Boolean(tuned));
    }
    let explanation = state.exact ? `${mission.supplyRms.toFixed(1)} V RMS at ${state.experiment.frequency.toFixed(0)} Hz produces ${(metrics.currentRms * 1000).toFixed(1)} mA RMS.` : 'Complete the circuit to energize the frequency experiment.';
    if (state.exact && mission.action === 'capacitive-ac') explanation = `Xc is ${metrics.capacitiveReactance.toFixed(1)} Ω. Raise frequency and the capacitor opposes the AC less.`;
    if (state.exact && mission.action === 'inductive-ac') explanation = `XL is ${metrics.inductiveReactance.toFixed(1)} Ω. Raise frequency and the coil opposes the AC more.`;
    if (state.exact && mission.action === 'phase') explanation = `Current leads source voltage by ${Math.abs(metrics.phaseRadians * 180 / Math.PI).toFixed(0)}°. Cyan is voltage; yellow is current.`;
    if (state.exact && mission.action === 'resonance') explanation = tuned ? 'XL and Xc cancel. Series impedance is smallest and current is largest.' : `Net reactance is ${(metrics.inductiveReactance - metrics.capacitiveReactance).toFixed(1)} Ω. Tune until it reaches zero.`;
    if (state.exact && mission.action === 'tank') explanation = tuned ? `LC branch currents match at ${(metrics.inductorCurrentRms * 1000).toFixed(1)} mA and circulate between fields.` : 'Tune until the inductor and capacitor branch currents are equal and opposite.';
    write('[data-reactive-explain]', explanation);
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
    if (mission.action === 'ac-basics') {
      els.action.innerHTML = `${note}${frequencyConsoleMarkup(mission)}`;
      bindFrequencyConsole(mission);
      return;
    }
    if (mission.action === 'capacitor') {
      els.action.innerHTML = `${note}<div class="field-console"><div class="field-console__controls"><strong>Electric-field experiment</strong><div><button type="button" class="is-active" data-capacitor-mode="charge">⚡ CHARGE</button><button type="button" data-capacitor-mode="discharge">↘ DISCHARGE</button></div><p>The virtual relay disconnects the battery and reroutes the capacitor through R for DISCHARGE.</p><p>τ = R × C = ${(mission.resistance * mission.capacitance).toFixed(1)} s</p></div><div class="field-console__meter"><div><small>STORED FIELD</small><strong data-capacitor-charge>0%</strong><span><i data-capacitor-bar></i></span></div><div><small>CAPACITOR VOLTAGE</small><strong data-capacitor-voltage>0.00 V</strong></div><p data-field-explain>Complete the circuit, then watch electrons collect on opposite plates.</p></div></div>`;
      els.action.querySelectorAll('[data-capacitor-mode]').forEach((button) => button.addEventListener('click', () => {
        state.experiment.capacitorMode = button.dataset.capacitorMode;
        if (state.experiment.capacitorMode === 'discharge') state.experiment.dischargeRequested = true;
        els.action.querySelectorAll('[data-capacitor-mode]').forEach((item) => item.classList.toggle('is-active', item === button));
        evaluate();
      }));
      updateReactiveReadout();
      return;
    }
    if (mission.action === 'inductor') {
      els.action.innerHTML = `${note}<div class="field-console"><div class="field-console__controls"><strong>Magnetic-field experiment</strong><p>Use the switch on the workbench: close it to grow the field, then open it to release the stored energy.</p><p>τ = L ÷ R = ${(mission.inductance / mission.resistance * 1000).toFixed(1)} ms (animation slowed for learning)</p></div><div class="field-console__meter"><div><small>MAGNETIC FIELD</small><strong data-inductor-field>0%</strong><span><i data-inductor-bar></i></span></div><div><small>COIL CURRENT</small><strong data-inductor-current>0.0 mA</strong></div><p data-field-explain>The field grows only after the circuit is complete and the switch closes.</p></div></div>`;
      updateReactiveReadout();
      return;
    }
    if (['capacitive-ac', 'inductive-ac', 'resonance', 'tank'].includes(mission.action)) {
      els.action.innerHTML = `${note}${frequencyConsoleMarkup(mission)}`;
      bindFrequencyConsole(mission);
      return;
    }
    if (mission.action === 'phase') {
      els.action.innerHTML = `${note}${frequencyConsoleMarkup(mission)}<div class="phase-question"><strong>Which wave reaches its peak first?</strong><div><button type="button" data-phase-answer="voltage">Voltage leads</button><button type="button" data-phase-answer="together">They stay together</button><button type="button" data-phase-answer="current">Current leads</button></div><output data-phase-output>Compare the cyan V trace with the yellow I trace.</output></div>`;
      bindFrequencyConsole(mission);
      els.action.querySelectorAll('[data-phase-answer]').forEach((button) => button.addEventListener('click', () => {
        state.answerCorrect = button.dataset.phaseAnswer === 'current';
        els.action.querySelectorAll('[data-phase-answer]').forEach((item) => item.classList.toggle('is-active', item === button));
        els.action.querySelector('[data-phase-output]').textContent = state.answerCorrect ? 'Correct—current leads source voltage in a capacitive circuit.' : 'Look at which trace reaches each crest first, then try again.';
        evaluate();
      }));
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
    if (state.exact && result.state === 'discharging') explanation = result.generatedWatts <= .01
      ? `Darkness means the panel makes 0.0 W. The battery supplies the ${result.loadWatts.toFixed(1)} W lamp; about ${result.runtimeHours.toFixed(1)} h remain.`
      : `The panel is short by ${Math.abs(result.batteryWatts).toFixed(1)} W, so the battery fills the gap. About ${result.runtimeHours.toFixed(1)} h remain.`;
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
    [els.wireCanvas, els.electronCanvas, els.scopeCanvas, els.conceptCanvas].filter(Boolean).forEach((canvas) => {
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
    if (missions[state.missionIndex].action !== 'solar') return configured;
    return state.solar.result?.powerSource?.includes('battery') ? configured.night : configured.day;
  }

  function electronFlowIsActive() {
    const mission = missions[state.missionIndex];
    if (!state.exact) return false;
    if (mission.action === 'capacitor') return state.experiment.capacitorCharge > .01 && state.experiment.capacitorCharge < .99;
    if (mission.action === 'inductor') return state.experiment.inductorField > .01;
    if (mission.hasSwitch) return state.switchClosed;
    if (mission.action === 'solar') return state.exact && (Boolean(state.solar.result?.loadPowered && state.solar.loadOn) || Math.abs(state.solar.result?.batteryWatts || 0) > .01);
    if (state.missionIndex === 6) return false;
    if (mission.action === 'code') return state.powered;
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
    return type === 'battery' || type === 'solar' || type === 'uno' || type === 'acsource';
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
        const forwardMotion = (time / 1450 + particle / particleCount + segmentIndex / segments.length) % 1;
        const dcMotion = missions[state.missionIndex].action === 'capacitor' && state.experiment.capacitorMode === 'discharge' ? 1 - forwardMotion : forwardMotion;
        const acMotion = .12 + .76 * ((Math.sin(time / 520 + particle * .9 + segmentIndex * .12) + 1) / 2);
        const motion = state.reducedMotion ? .58 : missions[state.missionIndex].mode === 'ac' ? acMotion : dcMotion;
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

  function updateReactiveExperiment(time) {
    const mission = missions[state.missionIndex];
    const elapsed = Math.min(.08, Math.max(0, (time - state.experiment.lastTick) / 1000));
    state.experiment.lastTick = time;
    if (mission.mode === 'ac') {
      const visualFrequency = Math.min(3.2, .55 + Math.log10(state.experiment.frequency + 1));
      state.experiment.wavePhase = time / 1000 * Math.PI * 2 * visualFrequency;
    }

    let milestoneChanged = false;
    if (mission.action === 'capacitor' && state.exact) {
      const transient = calculateRCTransient({ sourceVoltage: 1, resistance: 1, capacitance: .75, elapsedSeconds: elapsed, initialVoltage: state.experiment.capacitorCharge, charging: state.experiment.capacitorMode === 'charge' });
      state.experiment.capacitorCharge = transient.voltage;
      if (!state.experiment.chargeSeen && state.experiment.capacitorCharge >= .8) {
        state.experiment.chargeSeen = true;
        milestoneChanged = true;
      }
      if (!state.experiment.dischargeSeen && state.experiment.dischargeRequested && state.experiment.capacitorCharge <= .2) {
        state.experiment.dischargeSeen = true;
        milestoneChanged = true;
      }
    }

    if (mission.action === 'inductor' && state.exact) {
      const transient = calculateRLTransient({ sourceVoltage: 1, resistance: 1, inductance: .65, elapsedSeconds: elapsed, initialCurrent: state.experiment.inductorField, energizing: state.switchClosed });
      state.experiment.inductorField = transient.current;
      if (!state.experiment.fieldSeen && state.experiment.inductorField >= .8) {
        state.experiment.fieldSeen = true;
        milestoneChanged = true;
      }
      if (!state.experiment.decaySeen && state.experiment.decayRequested && state.experiment.inductorField <= .2) {
        state.experiment.decaySeen = true;
        milestoneChanged = true;
      }
    }

    if (milestoneChanged) evaluate();
    if (mission.mode === 'ac' || ['capacitor', 'inductor'].includes(mission.action)) {
      updateParts();
      if (!state.experiment.lastUiTick || time - state.experiment.lastUiTick > 80) {
        state.experiment.lastUiTick = time;
        updateMeters();
        updateReactiveReadout();
        const fieldExplain = els.action.querySelector('[data-field-explain]');
        if (fieldExplain && mission.action === 'capacitor') fieldExplain.textContent = state.experiment.capacitorMode === 'charge' ? 'Electrons collect on opposite plates while the electric field grows.' : 'Stored field energy drives charge through the resistor while voltage falls.';
        if (fieldExplain && mission.action === 'inductor') fieldExplain.textContent = state.switchClosed ? 'Current and magnetic field are rising toward a steady value.' : state.experiment.fieldSeen ? 'The collapsing magnetic field keeps current moving briefly after the switch opens.' : 'Close the workbench switch to begin growing the field.';
      }
    }
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
    for (let y = 0; y < rect.height; y += 18) { context.beginPath(); context.moveTo(0, y); context.lineTo(rect.width, y); context.stroke(); }
    const mission = missions[state.missionIndex];
    if (mission.mode === 'ac') {
      const centerY = rect.height / 2;
      const amplitude = Math.max(10, rect.height * .3);
      context.strokeStyle = '#ffffff42';
      context.lineWidth = 1;
      context.beginPath(); context.moveTo(0, centerY); context.lineTo(rect.width, centerY); context.stroke();
      context.fillStyle = '#a8acd1';
      context.font = '700 8px ui-monospace, monospace';
      context.fillText('+', 4, 10);
      context.fillText('0', 4, centerY - 3);
      context.fillText('−', 4, rect.height - 4);
      context.fillStyle = '#2ee5eb'; context.fillText('V', rect.width - 24, 10);
      context.fillStyle = '#ffe43b'; context.fillText('I', rect.width - 12, 10);
      if (!state.exact) {
        context.strokeStyle = '#666a90'; context.lineWidth = 2.5;
        context.beginPath(); context.moveTo(0, centerY); context.lineTo(rect.width, centerY); context.stroke();
        return;
      }

      const metrics = reactiveMetrics(mission);
      const currentPhase = mission.action === 'tank' ? metrics.phaseRadians : -metrics.phaseRadians;
      const movingPhase = state.reducedMotion ? 0 : time / 850;
      const drawWave = (color, phase, scale, dashed = false) => {
        context.beginPath();
        for (let x = 0; x <= rect.width; x += 2) {
          const angle = x / Math.max(1, rect.width) * Math.PI * 4.5 - movingPhase + phase;
          const y = centerY - Math.sin(angle) * amplitude * scale;
          if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.strokeStyle = color;
        context.lineWidth = 2.5;
        context.setLineDash(dashed ? [6, 4] : []);
        context.shadowColor = color;
        context.shadowBlur = 7;
        context.stroke();
        context.shadowBlur = 0;
        context.setLineDash([]);
      };
      drawWave('#2ee5eb', 0, 1);
      drawWave('#ffe43b', currentPhase, .72, true);
      return;
    }
    const flowing = electronFlowIsActive();
    const danger = state.missionIndex === 2 && state.exact && state.resistance < 150;
    const highY = rect.height * .3;
    const zeroY = rect.height * .72;
    const reactiveLevel = mission.action === 'capacitor' ? state.experiment.capacitorCharge : mission.action === 'inductor' ? state.experiment.inductorField : mission.action === 'solar' ? Math.min(1, (state.solar.result?.generatedWatts || 0) / 6) : flowing ? 1 : 0;
    const traceY = zeroY - (zeroY - highY) * reactiveLevel;
    const activeTrace = mission.action === 'solar' ? reactiveLevel > .01 : flowing || reactiveLevel > .01;
    const traceColor = danger ? '#ff4967' : activeTrace ? '#35d985' : '#666a90';

    context.strokeStyle = traceColor;
    context.lineWidth = danger ? 4 : 2.5;
    context.shadowColor = activeTrace ? traceColor : 'transparent';
    context.shadowBlur = activeTrace ? 9 : 0;
    context.beginPath();
    context.moveTo(0, zeroY);
    if (activeTrace) {
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
    if (activeTrace && !state.reducedMotion) {
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

  function drawConceptDemo(time) {
    const canvas = els.conceptCanvas;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / Math.max(1, rect.width);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    const width = rect.width;
    const height = rect.height;
    const top = 78;
    const bottom = height - 105;
    const left = Math.max(70, width * .14);
    const right = Math.min(width - 70, width * .86);
    const centerX = width / 2;
    const centerY = (top + bottom) / 2;
    const cyan = '#2ee5eb';
    const yellow = '#ffe43b';
    const pink = '#ff4fa3';
    const purple = '#8c52ff';
    const white = '#ffffff';

    context.strokeStyle = '#ffffff0d';
    context.lineWidth = 1;
    for (let x = 0; x < width; x += 28) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
    for (let y = 0; y < height; y += 28) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }

    const glowStroke = (color, lineWidth = 5) => {
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.lineCap = 'round';
      context.shadowColor = color;
      context.shadowBlur = 13;
    };
    const particle = (x, y, color = white, radius = 4) => {
      context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = color; context.shadowColor = color; context.shadowBlur = 13; context.fill(); context.shadowBlur = 0;
    };
    const loopPoint = (progress) => {
      const w = right - left;
      const h = bottom - top;
      const perimeter = 2 * (w + h);
      let distance = ((progress % 1) + 1) % 1 * perimeter;
      if (distance <= w) return { x: left + distance, y: top };
      distance -= w;
      if (distance <= h) return { x: right, y: top + distance };
      distance -= h;
      if (distance <= w) return { x: right - distance, y: bottom };
      return { x: left, y: bottom - (distance - w) };
    };
    const drawLoop = (colorA = pink, colorB = cyan) => {
      glowStroke(colorA, 6);
      context.beginPath(); context.moveTo(left, top); context.lineTo(right, top); context.lineTo(right, bottom); context.stroke();
      glowStroke(colorB, 6);
      context.beginPath(); context.moveTo(right, bottom); context.lineTo(left, bottom); context.lineTo(left, top); context.stroke();
      context.shadowBlur = 0;
    };
    const drawBulb = (x, y, strength = 1) => {
      context.beginPath(); context.arc(x, y, 32, 0, Math.PI * 2); context.fillStyle = `rgba(255,228,59,${.16 + strength * .65})`; context.fill();
      context.strokeStyle = white; context.lineWidth = 4; context.shadowColor = yellow; context.shadowBlur = 25 * strength; context.stroke(); context.shadowBlur = 0;
      context.fillStyle = yellow; context.font = '900 11px ui-monospace, monospace'; context.textAlign = 'center'; context.fillText('LOAD', x, y + 54);
    };
    const drawWave = (phase = 0, color = cyan, y = 53, amplitude = 24) => {
      context.beginPath();
      for (let x = 30; x <= width - 30; x += 3) {
        const waveY = y - Math.sin((x - 30) / Math.max(1, width - 60) * Math.PI * 5 + phase) * amplitude;
        if (x === 30) context.moveTo(x, waveY); else context.lineTo(x, waveY);
      }
      glowStroke(color, 2.5); context.stroke(); context.shadowBlur = 0;
    };
    const label = (text, x, y, color = white) => { context.fillStyle = color; context.font = '900 11px ui-monospace, monospace'; context.textAlign = 'center'; context.fillText(text, x, y); };

    if (state.conceptMode === 'dc' || state.conceptMode === 'ac') {
      drawLoop();
      if (state.conceptMode === 'dc') {
        context.fillStyle = '#313653'; context.strokeStyle = white; context.lineWidth = 5; context.fillRect(left - 32, centerY - 45, 64, 90); context.strokeRect(left - 32, centerY - 45, 64, 90);
        label('−  BATTERY  +', left, centerY + 4, yellow);
        drawBulb(right, centerY, 1);
        const base = time / 3000;
        for (let index = 0; index < 8; index += 1) { const point = loopPoint(base + index / 8); particle(point.x, point.y); }
        context.strokeStyle = '#35d985'; context.lineWidth = 3; context.beginPath(); context.moveTo(30, 52); context.lineTo(width - 30, 52); context.stroke();
        label('STEADY DC VOLTAGE', centerX, 34, '#35d985');
      } else {
        context.beginPath(); context.arc(left, centerY, 48, 0, Math.PI * 2); context.fillStyle = '#5b35f2'; context.fill(); context.strokeStyle = white; context.lineWidth = 5; context.stroke();
        context.fillStyle = white; context.font = '950 4rem ui-monospace, monospace'; context.textAlign = 'center'; context.fillText('~', left, centerY + 13);
        drawBulb(right, centerY, .8);
        const swing = Math.sin(time / 600) * .22;
        for (let index = 0; index < 8; index += 1) { const point = loopPoint(index / 8 + swing); particle(point.x, point.y); }
        drawWave(-time / 650, cyan);
        label(Math.cos(time / 600) > 0 ? 'ELECTRONS DRIFT →' : '← ELECTRONS DRIFT', centerX, bottom - 18, yellow);
      }
    }

    if (state.conceptMode === 'capacitor') {
      const charge = (Math.sin(time / 1300) + 1) / 2;
      const plateGap = 28;
      glowStroke(pink, 6); context.beginPath(); context.moveTo(left, centerY); context.lineTo(centerX - plateGap, centerY); context.stroke();
      glowStroke(cyan, 6); context.beginPath(); context.moveTo(centerX + plateGap, centerY); context.lineTo(right, centerY); context.stroke(); context.shadowBlur = 0;
      context.fillStyle = '#b8c0d4'; context.fillRect(centerX - plateGap - 8, top + 25, 8, bottom - top - 50); context.fillRect(centerX + plateGap, top + 25, 8, bottom - top - 50);
      for (let index = 0; index < 6; index += 1) {
        const y = top + 45 + index * Math.max(15, (bottom - top - 90) / 5);
        context.strokeStyle = `rgba(46,229,235,${.15 + charge * .8})`; context.lineWidth = 2; context.beginPath(); context.moveTo(centerX - plateGap + 3, y); context.lineTo(centerX + plateGap - 3, y); context.stroke();
        particle(centerX - plateGap - 15, y, white, 3 + charge * 1.5); particle(centerX + plateGap + 15, y, yellow, 3 + charge * 1.5);
      }
      label('ELECTRONS PILE UP', centerX - 110, bottom + 25, white); label('ELECTRIC FIELD', centerX, top + 5, cyan); label('INSULATOR GAP', centerX + 110, bottom + 25, yellow);
      drawWave(time / 1100, purple, 48, 18 * charge);
    }

    if (state.conceptMode === 'inductor') {
      const field = (Math.sin(time / 1050) + 1) / 2;
      glowStroke(pink, 6); context.beginPath(); context.moveTo(left, centerY); context.lineTo(centerX - 120, centerY); context.stroke(); context.moveTo(centerX + 120, centerY); context.lineTo(right, centerY); context.stroke(); context.shadowBlur = 0;
      for (let index = 0; index < 6; index += 1) {
        context.beginPath(); context.arc(centerX - 90 + index * 36, centerY, 25, Math.PI, 0); glowStroke('#d99032', 7); context.stroke();
      }
      context.shadowBlur = 0;
      for (let ring = 0; ring < 3; ring += 1) {
        context.beginPath(); context.ellipse(centerX, centerY, 145 + ring * 30, 55 + ring * 20, 0, 0, Math.PI * 2); context.strokeStyle = ring === 0 ? cyan : ring === 1 ? purple : pink; context.globalAlpha = .15 + field * .6; context.lineWidth = 2; context.stroke();
      }
      context.globalAlpha = 1;
      for (let index = 0; index < 7; index += 1) particle(left + (right - left) * ((time / 2300 + index / 7) % 1), centerY, white, 3.5);
      label('CURRENT CREATES MAGNETIC FIELD', centerX, top - 8, yellow); label('FIELD STRENGTH GROWS AND SHRINKS', centerX, bottom + 28, cyan);
    }

    if (state.conceptMode === 'rlc') {
      const exchange = (Math.sin(time / 650) + 1) / 2;
      context.strokeStyle = '#ffffff40'; context.lineWidth = 5; context.beginPath(); context.moveTo(left, centerY); context.lineTo(right, centerY); context.stroke();
      const capacitorX = width * .34;
      const coilX = width * .67;
      context.fillStyle = '#c3cad6'; context.fillRect(capacitorX - 20, centerY - 55, 8, 110); context.fillRect(capacitorX + 12, centerY - 55, 8, 110);
      context.strokeStyle = `rgba(46,229,235,${.2 + exchange * .8})`; context.lineWidth = 3;
      for (let row = -2; row <= 2; row += 1) { context.beginPath(); context.moveTo(capacitorX - 12, centerY + row * 18); context.lineTo(capacitorX + 12, centerY + row * 18); context.stroke(); }
      for (let index = 0; index < 5; index += 1) { context.beginPath(); context.arc(coilX - 72 + index * 36, centerY, 25, Math.PI, 0); context.strokeStyle = '#d99032'; context.lineWidth = 7; context.stroke(); }
      for (let ring = 0; ring < 3; ring += 1) { context.beginPath(); context.ellipse(coilX, centerY, 95 + ring * 18, 45 + ring * 12, 0, 0, Math.PI * 2); context.strokeStyle = ring === 0 ? yellow : pink; context.globalAlpha = .2 + (1 - exchange) * .65; context.lineWidth = 2; context.stroke(); }
      context.globalAlpha = 1;
      const orbX = capacitorX + (coilX - capacitorX) * (1 - exchange);
      particle(orbX, centerY - 75, exchange > .5 ? cyan : yellow, 8);
      label('ELECTRIC FIELD ENERGY', capacitorX, bottom + 28, cyan); label('MAGNETIC FIELD ENERGY', coilX, bottom + 28, yellow); label('RESONANT ENERGY EXCHANGE', centerX, 35, white);
      drawWave(-time / 600, purple, 61, 19);
    }
  }

  function animationFrame(time) {
    updateReactiveExperiment(time);
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
    drawConceptDemo(time);
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
  const conceptCopy = {
    dc: ['DC · ONE DIRECTION', 'A battery maintains one polarity. Electrons drift around the external metal loop from negative toward positive while conventional current points the other way.'],
    ac: ['AC · REVERSING DIRECTION', 'An AC source reverses its electric field each half-cycle. Electrons in the wire oscillate back and forth while energy continues from the generator to the load.'],
    capacitor: ['C · ELECTRIC FIELD STORAGE', 'Electrons collect on one plate and leave the other. They never cross the insulating dielectric; energy is stored in the electric field between the plates.'],
    inductor: ['L · MAGNETIC FIELD STORAGE', 'Moving electrons create a magnetic field around the coil. A changing field creates a counter-voltage, so current cannot jump instantly.'],
    rlc: ['RLC · RESONANT EXCHANGE', 'At resonance, the capacitor’s electric field and the inductor’s magnetic field trade energy at their natural rhythm while resistance turns some energy into heat.'],
  };
  root.querySelectorAll('[data-concept-mode]').forEach((button) => button.addEventListener('click', () => {
    state.conceptMode = button.dataset.conceptMode;
    root.querySelectorAll('[data-concept-mode]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    if (els.conceptStatus) els.conceptStatus.textContent = conceptCopy[state.conceptMode][0];
    if (els.conceptSummary) els.conceptSummary.textContent = conceptCopy[state.conceptMode][1];
  }));
  window.addEventListener('resize', resizeCanvases, { passive: true });
  if ('ResizeObserver' in window) {
    const canvasObserver = new ResizeObserver(resizeCanvases);
    canvasObserver.observe(els.workbench);
    if (els.conceptCanvas?.parentElement) canvasObserver.observe(els.conceptCanvas.parentElement);
  }

  selectMission(0);
  requestAnimationFrame(animationFrame);
}
