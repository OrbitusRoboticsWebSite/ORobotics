import { amberStatusRequest, baseFrame, bldcPwm, hex, maestroTarget, smcSpeed, ticPosition, uartBits } from './motor-workshop-core.mjs';

const root = document.querySelector('[data-motor-workshop]');
if (root) {
  const get = (name) => root.querySelector(`[data-${name}]`);
  const mode = get('signal-mode');
  const slider = get('signal-value');
  const configurations = {
    smc: [-3200, 3200, 1600, 'Signed speed request'], bldc: [-255, 255, 64, 'Signed motor effort'],
    servo: [1000, 2000, 1500, 'Teaching pulse width (µs)'], tic: [-10000, 10000, 600, 'Target microsteps'], amber: [0, 255, 42, 'Request counter'],
  };
  const svgNS = 'http://www.w3.org/2000/svg';
  function svgElement(tag, attrs, content = '') {
    const element = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    element.textContent = content;
    return element;
  }
  function waveform(levels, labels, description) {
    const grid = get('wave-grid'); const text = get('wave-labels');
    grid.replaceChildren(); text.replaceChildren();
    for (let x = 50; x <= 750; x += 35) grid.append(svgElement('line', { x1: x, x2: x, y1: 35, y2: 170, stroke: '#34515a', 'stroke-width': 1 }));
    for (const y of [55, 150]) grid.append(svgElement('line', { x1: 50, x2: 750, y1: y, y2: y, stroke: '#547079', 'stroke-width': 1 }));
    text.append(svgElement('text', { x: 4, y: 59 }, 'HIGH'), svgElement('text', { x: 4, y: 154 }, 'LOW'));
    const points = levels.map(([time, high]) => `${50 + time * 700},${high ? 55 : 150}`);
    get('wave-path').setAttribute('d', 'M' + points.join(' L'));
    labels.forEach(([position, value]) => text.append(svgElement('text', { x: 50 + position * 700, y: 195, 'text-anchor': 'middle' }, value)));
    get('wave-description').textContent = description;
  }
  function bitsWave(bits) {
    const points = [[0, 1]];
    bits.forEach((bit, i) => { points.push([i / bits.length, bit], [(i + 1) / bits.length, bit]); });
    return points;
  }
  function update() {
    const value = Number(slider.value); let packet, note, title, timing, rows;
    const signed = value > 0 ? `+${value}` : String(value);
    get('value-output').textContent = mode.value === 'servo' ? `${value} µs` : mode.value === 'smc' ? `${signed} / 3200` : mode.value === 'bldc' ? `${signed} / 255` : String(value);
    if (mode.value === 'smc') {
      const bytes = smcSpeed(value);
      packet = hex(bytes); note = `Binary SMC packet. The base Arduino’s upstream USB message is instead: ${baseFrame(value)} (42 ASCII bytes, no newline).`;
      title = 'UART framing of the first byte · 19200 baud, 8N1'; timing = 'Each bit is 52.08 µs. One byte is 520.8 µs; all three bytes take 1.5625 ms without gaps. Idle and stop are HIGH.';
      const bits = uartBits(bytes[0]); waveform(bitsWave(bits), bits.map((bit, i) => [(i + .5) / 10, i === 0 ? 'start' : i === 9 ? 'stop' : String(bit)]), `${title}. ${bits.join(', ')}. ${timing}`);
      rows = [['magnitude = abs(speed)', `Use ${Math.abs(value)} as the magnitude; direction is encoded separately.`], ['opcode = speed < 0 ? 0x86 : 0x85', `Choose ${hex([bytes[0]])} for ${value < 0 ? 'reverse' : 'forward or zero'}.`], ['low = magnitude & 0x1F', `Keep the low five bits: ${bytes[1]}.`], ['high = magnitude >> 5', `Shift away those five bits: ${bytes[2]}.`], ['port.write(bytes([opcode, low, high]))', 'Send three binary bytes to the configured SMC command interface. The offline download does not open a port.']];
    } else if (mode.value === 'bldc') {
      const pwm = bldcPwm(value), high = pwm / 255, effort = Math.abs(value) / 255;
      packet = `analogWrite(pwmPin, ${pwm})`; note = `${(100 * high).toFixed(1)}% HIGH, ${(100 * effort).toFixed(1)}% LOW. LOW is active for the documented Hengdrive input. Direction uses a separate output.`;
      title = 'One PWM cycle · normalized time'; timing = 'This drawing shows duty fraction only. The vendor outline does not establish the required PWM frequency or input voltage thresholds.';
      waveform([[0, high > 0 ? 1 : 0], [high, high > 0 ? 1 : 0], [high, 0], [1, 0]], [[0, '0'], [.5, '½ cycle'], [1, '1 cycle']], note + ' ' + timing);
      rows = [['command = clamp(command, -255, 255)', `The teaching command is ${signed}. Its sign selects a separate direction output.`], ['magnitude = abs(command)', `Requested effort is ${Math.abs(value)} out of 255, not a measured RPM.`], ['pwm = 255 - magnitude', `Invert the duty: the Arduino register is ${pwm}.`], ['analogWrite(pwmPin, pwm)', 'The preserved base uses D4 left, D2 right, and D6 flipper. Check the current harness before reuse.']];
    } else if (mode.value === 'servo') {
      const bytes = maestroTarget(0, value), fraction = value / 20000;
      packet = hex(bytes); note = `Mini Maestro 24 compact Set Target, channel 0. ${value} µs × 4 = ${value * 4} quarter-microseconds. This example range is not ROB’s calibrated range.`;
      title = 'Servo output pulse · illustrative 20 ms repetition period'; timing = `${value / 1000} ms HIGH within a 20 ms example period. Pulse width conveys a position target; changing the period is not the same control.`;
      waveform([[0, 1], [fraction, 1], [fraction, 0], [1, 0]], [[0, '0 ms'], [.25, '5'], [.5, '10'], [.75, '15'], [1, '20 ms']], timing);
      rows = [['target = microseconds * 4', `Convert the requested pulse into ${value * 4} quarter-microsecond units.`], ['low = target & 0x7F', `Keep seven low bits: ${bytes[2]}.`], ['high = (target >> 7) & 0x7F', `Keep seven high bits: ${bytes[3]}.`], ['packet = bytes([0x84, 0, low, high])', 'Set channel 0. Separate servo power supplies the motor; USB is the command interface.']];
    } else if (mode.value === 'tic') {
      const bytes = ticPosition(value);
      packet = hex(bytes); note = 'Optional Tic compact serial Set Target Position. ROB’s preserved host uses ticcmd over native USB instead; these are not bytes to send to an Arduino USB port.';
      title = 'Serial alternative · first byte 0xE0 shown as 8N1'; timing = 'Normalized bit cells. Serial baud is a configured setting and is not established by the purchase receipt.';
      waveform(bitsWave(uartBits(bytes[0])), uartBits(bytes[0]).map((bit, i) => [(i + .5) / 10, i === 0 ? 'start' : i === 9 ? 'stop' : String(bit)]), title + '. ' + timing);
      rows = [['raw = struct.pack("<i", position)', `Represent ${value} as a signed little-endian 32-bit microstep target.`], ['high_bits = sum((b >> 7) << i for i, b in enumerate(raw))', `Collect each data byte’s high bit into ${hex([bytes[1]])}.`], ['data = [b & 0x7F for b in raw]', `Each remaining data byte is below 128: ${hex(bytes.slice(2))}.`], ['packet = bytes([0xE0, high_bits, *data])', 'The target uses configured microsteps, not degrees. Establish a home reference and travel envelope first.']];
    } else {
      const bytes = amberStatusRequest(value);
      packet = hex(bytes); note = 'AMBER V2 command 1: status request. Eight application bytes are carried inside UDP/IP over Ethernet; no network request is sent here.';
      title = 'Application byte bit pattern · NOT an Ethernet electrical waveform'; timing = 'The first byte 01 is shown as bits, most significant first, for reading the value. Ethernet encoding is a separate physical layer.';
      waveform(bitsWave([0, 0, 0, 0, 0, 0, 0, 1]), Array.from({ length: 8 }, (_, i) => [(i + .5) / 8, `b${7 - i}`]), title + '. Byte 01 in binary is 00000001.');
      rows = [['command = 1', 'The preserved V2 wrapper uses command 1 for status.'], ['length = 8', 'Two uint16 fields plus a uint32 counter occupy eight bytes.'], [`counter = ${value}`, 'A returned counter lets the client reject the wrong response.'], ['packet = struct.pack("<HHI", command, length, counter)', 'Little-endian, standard field sizes, no native padding. The bridge defaults are UDP 26001 left and 26002 right.'], ['validate(sender, header, length, counter, finite_values)', 'The expected reply is 124 bytes in this wrapper. Add a deadline; UDP does not guarantee delivery or order.']];
    }
    get('packet').textContent = packet; get('packet-note').textContent = note;
    get('wave-title').textContent = title; get('wave-note').textContent = timing;
    get('code-lines').replaceChildren(...rows.map(([code, explanation]) => {
      const li = document.createElement('li'), snippet = document.createElement('code'), text = document.createElement('span');
      snippet.textContent = code; text.textContent = explanation; li.append(snippet, text); return li;
    }));
  }
  mode.addEventListener('change', () => {
    const [min, max, value, label] = configurations[mode.value];
    slider.min = min; slider.max = max; slider.value = value; get('value-label').textContent = label; update();
  });
  slider.addEventListener('input', update);
  get('signal-check').addEventListener('submit', (event) => {
    event.preventDefault();
    const answer = new FormData(event.currentTarget).get('prediction');
    get('check-result').textContent = !answer ? 'Choose an answer first.' : answer === 'effort' ? 'Exactly. 1600 / 3200 is half-scale effort. Rod distance needs separate measurement or position feedback.' : 'Look at the units: the SMC speed scale runs from −3200 to +3200. It does not measure millimeters.';
  });
  update();
}
