import { amberStatusRequest, baseFrame, hex, maestroTarget, smcSpeed, ticPosition } from './motor-workshop-core.mjs';

// Each terminal pair is a labelled conceptual connection, not a harness drawing.
const lessons = [
  {
    title: 'Turn electrical energy into brushed-motor motion', icon: '⚡', topic: 'Brushed DC',
    source: 'Protected supply + H-bridge', target: 'Brushed DC motor', links: [['a', 'MOTOR A'], ['b', 'MOTOR B']],
    intro: 'Brushes and a commutator switch the rotor current as it turns. Reverse the voltage across the motor to reverse its torque.',
    guide: 'Wire both motor leads to the driver. A microcontroller commands the H-bridge; its GPIO pin cannot supply motor current.',
    note: 'The two wires carry motor energy. A real build also needs the driver supply, current limit, inductive-current path, fuse, and a tested stop. Effort is not measured speed.',
    code: 'polarity → torque direction\nduty fraction → average applied voltage',
    tests: [['Apply forward polarity', ['A + / B −', 'FORWARD TORQUE', 'MODEL ONLY']], ['Reverse polarity', ['A − / B +', 'REVERSE TORQUE', 'MODEL ONLY']]],
  },
  {
    title: 'Read ROB’s active-low BLDC input', icon: '〰', topic: 'Brushless motors',
    source: 'Arduino Mega base', target: 'Hengdrive integrated controller', links: [['pwm', 'PWM'], ['dir', 'DIR'], ['gnd', 'LOGIC GND']],
    intro: 'The brushless motor uses electronic commutation. ROB commands its integrated controller rather than switching the three motor phases itself.',
    guide: 'Connect PWM, direction, and the signal reference. The preserved sketch writes 255 − abs(command) because this PWM input is active-low.',
    note: 'The 2017 B5685G OD-24V outline says blue PWM LOW means full speed and yellow direction LOW means CW viewed from the shaft. It does not establish PWM frequency, logic thresholds, tach pulses per revolution, or the sixth pin. Motor power is a separate rated branch.',
    code: 'analogWrite(pwmPin, 255 - abs(command));\ncommand 64 → register 191 → about 25% LOW',
    tests: [['Predict command zero', ['REGISTER 255', 'HIGH', 'ZERO EFFORT']], ['Predict command +64', ['REGISTER 191', '25.1% LOW', 'BOUNDED EFFORT']]],
  },
  {
    title: 'Give the LACT a forward and reverse path', icon: '↕', topic: 'LACT hardware',
    source: 'Pololu Simple Motor Controller', target: 'Glideforce MD122004 LACT', links: [['a', 'MOTOR A'], ['b', 'MOTOR B']],
    intro: 'A geared brushed motor turns a screw inside the linear actuator. The extending rod changes ROB’s body lean.',
    guide: 'Connect the two motor leads. The April 2022 purchase identifies the 12 V, nominal 4-inch MD122004 with internal end switches and no position-feedback option.',
    note: 'The actuator is the body-lean mechanism. The base lift flipper is a separate motor channel. End switches limit travel but do not report intermediate position. Do not infer motion direction from wire color.',
    code: 'motor rotation → screw travel → linkage angle\nMD122004: 100 mm catalog stroke; 12 V motor',
    tests: [['Follow extension through the linkage', ['ROD EXTENDS', 'BODY LEAN CHANGES', 'ANGLE UNCALIBRATED']], ['Inspect the end switch', ['END TRAVEL', 'INTERNAL LIMIT', 'NO POSITION VALUE']]],
  },
  {
    title: 'Separate actuator length from body angle', icon: '📐', topic: 'LACT geometry',
    source: 'Two pivot anchors', target: 'Body-lean linkage model', links: [['fixed', 'BASE ANCHOR'], ['moving', 'BODY ANCHOR']],
    intro: 'A straight distance can become a changing angle, but the conversion depends on the two anchor locations and the pivot.',
    guide: 'Connect both anchors in this conceptual geometry model. Compare the catalog dimensions with the builder’s measured pin-to-pin observations.',
    note: 'Catalog lengths are 205 to 305 mm. September 17 observations are approximately 200 to 302 mm; earlier 210 mm was an intermediate pose. Record the difference and measure the anchors before calculating a lean angle.',
    code: 'measured travel = 302 - 200 = 102 mm\nL² = a² + b² - 2ab cos(theta)',
    tests: [['Calculate observed travel', ['302 − 200 mm', '102 mm', 'APPROXIMATE']], ['Check an angle claim', ['ANCHORS UNKNOWN', 'NO CALIBRATION', 'DO NOT INVENT DEGREES']]],
  },
  {
    title: 'Pack the LACT speed into three bytes', icon: '01', topic: 'SMC compact protocol',
    source: 'Arduino D23 TX', target: 'Simple Motor Controller RX', links: [['tx', 'SERIAL DATA'], ['gnd', 'SIGNAL GND']],
    intro: 'ROB’s preserved Arduino sketch sends a direction opcode followed by five low magnitude bits and seven high bits.',
    guide: 'Wire TX to RX and share the reference. For +1600, 1600 & 31 is 0 and 1600 >> 5 is 50 (hex 32).',
    note: 'The exact 18v board suffix remains unconfirmed. The family protocol is verified. These bytes request effort, not a measured rod position; zero speed does not guarantee a load-holding state.',
    code: 'opcode = speed < 0 ? 0x86 : 0x85\npacket = [opcode, abs(speed) & 31, abs(speed) >> 5]',
    tests: [['Encode +1600', [hex(smcSpeed(1600)), 'FORWARD', '50% SCALE']], ['Encode −3200', [hex(smcSpeed(-3200)), 'REVERSE', 'FULL SCALE EXAMPLE']]],
  },
  {
    title: 'Find the start bit in the LACT signal', icon: '⏱', topic: 'UART pulses',
    source: '19200 baud UART transmitter', target: '8N1 receiver', links: [['tx', 'TX → RX'], ['gnd', 'REFERENCE']],
    intro: 'Serial sends bytes as timed voltage levels. One UART frame has a LOW start bit, eight least-significant-bit-first data bits, and a HIGH stop bit.',
    guide: 'Connect data and reference. At 19200 baud, one bit lasts about 52.08 microseconds and a ten-bit frame lasts about 520.8 microseconds.',
    note: 'For 0x85, data arrives 1,0,1,0,0,0,0,1. UART timing differs from the repeating pulse width sent to a hobby servo. Both endpoints must use compatible electrical levels and matching framing.',
    code: '0x85: idle 1 | start 0 | 1 0 1 0 0 0 0 1 | stop 1',
    tests: [['Measure one bit', ['1 / 19200 s', '52.08 µs', '8N1']], ['Measure three bytes', ['30 BITS', '1.5625 ms', 'NO GAPS ASSUMED']]],
  },
  {
    title: 'Choose the correct USB serial endpoint', icon: '🔌', topic: 'Arduino and USB',
    source: 'Cerebro host', target: 'Arduino base USB serial', links: [['usb', 'USB DATA']],
    intro: 'The base Arduino expects a 42-byte ASCII frame at 250000 baud. It translates the LACT field into the downstream SMC binary packet.',
    guide: 'Connect the host to the base USB interface. A direct SMC USB virtual command port instead expects the SMC binary protocol.',
    note: 'A USB connector does not define the application protocol. Preserve exactly seven signed four-digit fields; the historical base frame has no newline. The example keeps all tread and flipper fields zero.',
    code: baseFrame(1600),
    tests: [['Inspect base message length', ['42 ASCII BYTES', '250000 BAUD', 'LACT +1600']], ['Inspect downstream packet', [hex(smcSpeed(1600)), '19200 BAUD', 'SMC RX']]],
  },
  {
    title: 'Set a pulse on the Mini Maestro 24', icon: '🎛', topic: 'Servos',
    source: 'Mini Maestro 24 channel 0', target: 'Hobby servo signal input', links: [['signal', 'PULSE'], ['gnd', 'REFERENCE']],
    intro: 'A hobby servo compares the requested position with its own sensor. The pulse communicates the target; a separate power supply supplies motor current.',
    guide: 'Wire the pulse and reference. A 1500-microsecond teaching target becomes 6000 quarter-microseconds in the Maestro command.',
    note: '1500 µs is a conventional example, not a calibrated center angle for ROB. Channel power, permitted pulse limits, direction, and linkage clearance must be set for the attached servo.',
    code: 'target = 1500 * 4\n[0x84, 0, target & 127, (target >> 7) & 127]',
    tests: [['Encode the example target', [hex(maestroTarget(0, 1500)), '6000 QUARTER-µs', 'CHANNEL 0']], ['Distinguish pulse from power', ['1.5 ms HIGH', '20 ms EXAMPLE PERIOD', 'POWER SEPARATE']]],
  },
  {
    title: 'Move a stepper’s magnetic field', icon: '🧲', topic: 'Stepper phases',
    source: 'Current-regulating stepper driver', target: 'Bipolar stepper coils', links: [['ap', 'A+'], ['am', 'A−'], ['bp', 'B+'], ['bm', 'B−']],
    intro: 'Two controlled coil currents create a magnetic field that advances in steps. The driver regulates phase current even while the shaft is holding.',
    guide: 'Connect the two identified coil pairs to their driver outputs. Never identify or reconnect the coils while the driver is energized.',
    note: 'One illustrative two-phase-on cycle is (+I,+I), (−I,+I), (−I,−I), (+I,−I). Microstepping divides the electrical cycle; gearing and missed steps still determine actual torso motion.',
    code: 'A,B: ++ → −+ → −− → +−\nsteps ≠ measured angle without a reference',
    tests: [['Advance one electrical cycle', ['FOUR STATES', 'FIELD ROTATES', 'DIRECTION ORDERED']], ['Reduce phase current', ['LESS HEAT', 'LESS HOLD TORQUE', 'SUPPORT LOAD FIRST']]],
  },
  {
    title: 'Command the purchased Tic 36v4', icon: '⚙', topic: 'Torso controller',
    source: 'Cerebro + ticcmd', target: 'Pololu Tic 36v4 native USB', links: [['usb', 'USB CONTROL']],
    intro: 'The January 2022 receipt identifies Pololu product 3140: Tic 36v4, rated for an 8–50 V operating supply. ROB’s preserved host uses ticcmd over native USB.',
    guide: 'Connect the native USB control path. The historical host bounds each position increment to at most 600 microsteps, but that is not a degrees-per-command calibration.',
    note: 'The product supports up to about 4 A per phase without extra cooling under the vendor’s conditions. The installed phase-current limit, step mode, gearing, and homing remain configuration evidence to collect. Native USB is distinct from the optional Tic serial interface.',
    code: 'ticcmd --status --full\nserial alternative for target 600: ' + hex(ticPosition(600)),
    tests: [['Identify the controller', ['TIC 36v4 · #3140', '8–50 V', 'PURCHASE VERIFIED']], ['Inspect target units', ['600 MICROSTEPS', 'NOT 600 DEGREES', 'HOME REQUIRED']]],
  },
  {
    title: 'Trace each AMBER arm’s CAN bus', icon: '⇄', topic: 'CAN',
    source: 'Ubuntu arm bridge + transceiver', target: 'One AMBER arm CAN segment', links: [['high', 'CAN H'], ['low', 'CAN L']],
    intro: 'CAN uses a differential pair shared by nodes. Each physical segment has termination at its two ends; a USB-to-CAN adapter connects it to the bridge computer.',
    guide: 'Join CAN H to CAN H and CAN L to CAN L. The preserved launch setup names separate left and right interfaces, can10 and can11, and selects SLCAN s8 (1 Mbit/s).',
    note: 'This is a logical map, not a connector pinout. Include the manufacturer-required reference/shield arrangement. Use 120 Ω at each segment end; do not add 120 Ω to every node. The available wrapper does not document the joint CAN arbitration IDs or payloads.',
    code: 'left arm: can10    right arm: can11\neach segment: 120 Ω — nodes — 120 Ω',
    tests: [['Check termination locations', ['TWO ENDS', 'ABOUT 60 Ω PARALLEL', 'UNPOWERED CHECK']], ['Separate payload evidence', ['CAN LINK KNOWN', 'JOINT IDs UNKNOWN', 'NO INVENTED FRAMES']]],
  },
  {
    title: 'Decode an AMBER Ethernet status request', icon: '🌐', topic: 'Ethernet + UDP',
    source: 'AMBER V2 Python client', target: 'Ubuntu AMBER bridge', links: [['udp', 'UDP OVER ETHERNET']],
    intro: 'Ethernet carries IP packets; UDP carries the AMBER application bytes. The preserved command-1 request is two little-endian uint16 values followed by a uint32 counter.',
    guide: 'Connect the conceptual network path. Encode command 1, total request length 8, and request counter 42. Default bridge ports are 26001 for the left arm and 26002 for the right.',
    note: 'A status reply is 124 bytes in this wrapper: the eight-byte header plus 29 float32 values. Validate sender, command, length, counter, finite values, and freshness. UDP can lose, duplicate, or reorder packets; a status query grants no motion authority.',
    code: 'struct.pack("<HHI", 1, 8, 42)\n' + hex(amberStatusRequest(42)),
    tests: [['Encode request counter 42', [hex(amberStatusRequest(42)), '8 BYTES', 'STATUS ONLY']], ['Reject a stale reply', ['WRONG COUNTER', 'DISCARD', 'WAIT WITH DEADLINE']]],
  },
];

export function createRobMotorMissions(edge) {
  return lessons.map((lesson, index) => {
    const keys = lesson.tests.map((_, step) => `motorLesson${index}Step${step}`);
    const positions = ['top', 'middle', 'bottom', 'bottom'];
    const ports = (side) => lesson.links.map(([id, label], i) => ({ id, label, className: `lab-port--signal port-${side}-${positions[i]}` }));
    // Four-coil terminals use all four corners to stay individually selectable.
    const portsFor = (side) => lesson.links.length === 4 ? ports(side).map((p, i) => ({ ...p, className: `lab-port--signal port-${i < 2 ? 'left' : 'right'}-${i % 2 ? 'bottom' : 'top'}` })) : ports(side);
    return {
      icon: lesson.icon, tier: 'Motor workshop · ' + lesson.topic, difficulty: index < 4 ? 'Maker' : 'Engineer',
      kicker: `Build ${91 + index} · ${lesson.topic}`, title: lesson.title, intro: lesson.intro, guide: lesson.guide,
      success: 'You traced the interface and checked both examples. Explore changing values in the companion Motor Workshop.',
      hints: ['Match the labels on both components.', lesson.guide, 'Run each example after completing the connections.'],
      components: [
        { id: 'source', type: 'systembox', badge: 'SENDER / DRIVER', label: lesson.source, x: 25, y: 50, ports: portsFor('right'), tone: 'cyan' },
        { id: 'target', type: 'systembox', badge: 'RECEIVER / LOAD', label: lesson.target, x: 75, y: 50, ports: portsFor('left'), tone: 'purple' },
      ],
      required: lesson.links.map(([id]) => edge(`source.${id}`, `target.${id}`)),
      supply: 5, resistance: 10000, action: `robot-motor-lesson-${index}`, completeKeys: keys,
      objectives: [['Complete the labelled conceptual connections', (s) => Boolean(s.exact)], ...lesson.tests.map(([label], step) => [label, (s) => Boolean(s[keys[step]])])],
      noteTitle: 'Evidence and units', note: lesson.note,
      robot: { mode: 'interface', labels: ['EXAMPLE', 'INTERPRETATION', 'CHECK'], code: lesson.code, controls: lesson.tests.map(([label, readout], step) => ({ id: `motor-${index}-${step}`, label, set: { [keys[step]]: true }, readout })) },
    };
  });
}

export function createRobMotorElectronFlows(edge) {
  return createRobMotorMissions(edge).map((mission) => ({ wires: mission.required, inside: [] }));
}
