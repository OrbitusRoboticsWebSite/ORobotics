// Pure packet builders. This module does not open a port or contact a robot.
function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${name}: ${min}…${max}`);
  return value;
}

export const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');

export function smcSpeed(speed) {
  integer(speed, -3200, 3200, 'SMC speed');
  const magnitude = Math.abs(speed);
  return Uint8Array.of(speed < 0 ? 0x86 : 0x85, magnitude & 0x1f, magnitude >> 5);
}

export function bldcPwm(command) {
  integer(command, -255, 255, 'BLDC command');
  return 255 - Math.abs(command);
}

export function maestroTarget(channel, microseconds) {
  integer(channel, 0, 23, 'Maestro channel');
  // A teaching range, not a calibrated mechanical limit for ROB.
  integer(microseconds, 1000, 2000, 'Example pulse width');
  const target = microseconds * 4;
  return Uint8Array.of(0x84, channel, target & 0x7f, (target >> 7) & 0x7f);
}

export function ticPosition(position) {
  integer(position, -2147483648, 2147483647, 'Tic position');
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, position, true);
  const highBits = bytes.reduce((packed, byte, i) => packed | ((byte >> 7) << i), 0);
  return Uint8Array.of(0xe0, highBits, ...bytes.map((byte) => byte & 0x7f));
}

export function baseFrame(lactSpeed) {
  integer(lactSpeed, -3200, 3200, 'LACT speed');
  return `~+0000,+0000,+0000,+0000,+0000,+0000,${lactSpeed < 0 ? '-' : '+'}${String(Math.abs(lactSpeed)).padStart(4, '0')}`;
}

export function amberStatusRequest(counter) {
  integer(counter, 0, 4294967295, 'Request counter');
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 1, true);
  view.setUint16(2, 8, true);
  view.setUint32(4, counter, true);
  return bytes;
}

export function uartBits(byte) {
  integer(byte, 0, 255, 'UART byte');
  return [0, ...Array.from({ length: 8 }, (_, bit) => (byte >> bit) & 1), 1];
}
