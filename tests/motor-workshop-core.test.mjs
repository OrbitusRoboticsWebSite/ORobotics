import assert from 'node:assert/strict';
import test from 'node:test';
import { amberStatusRequest, baseFrame, bldcPwm, hex, maestroTarget, smcSpeed, ticPosition, uartBits } from '../assets/js/motor-workshop-core.mjs';

test('SMC compact packets round-trip every valid signed speed', () => {
  for (let speed = -3200; speed <= 3200; speed++) {
    const [direction, low, high] = smcSpeed(speed);
    assert.equal((low + (high << 5)) * (direction === 0x86 ? -1 : 1), speed);
    assert.ok(low < 32 && high < 128);
  }
  assert.equal(hex(smcSpeed(1600)), '85 00 32');
  assert.equal(hex(smcSpeed(-3200)), '86 00 64');
  for (const invalid of [3201, -3201, NaN, 1.5, '1600']) assert.throws(() => smcSpeed(invalid));
});

test('Maestro pulse units and BLDC active-low endpoints remain distinct', () => {
  assert.equal(hex(maestroTarget(0, 1500)), '84 00 70 2E');
  assert.equal(bldcPwm(0), 255);
  assert.equal(bldcPwm(-255), 0);
  assert.equal(bldcPwm(64), 191);
  assert.throws(() => maestroTarget(24, 1500));
  assert.throws(() => maestroTarget(0, 999));
});

test('Tic serial signed 32-bit values preserve all eight bits in each byte', () => {
  for (const value of [-2147483648, -1, 0, 127, 128, 600, 2147483647]) {
    const packet = ticPosition(value);
    const bytes = Uint8Array.from(packet.slice(2), (byte, i) => byte | (((packet[1] >> i) & 1) << 7));
    assert.equal(new DataView(bytes.buffer).getInt32(0, true), value);
    assert.equal(packet[0], 0xe0);
  }
  assert.equal(hex(ticPosition(600)), 'E0 00 58 02 00 00');
  assert.throws(() => ticPosition(2147483648));
});

test('Base ASCII, AMBER UDP, and UART framing match the preserved protocol', () => {
  assert.equal(baseFrame(1600), '~+0000,+0000,+0000,+0000,+0000,+0000,+1600');
  assert.equal(new TextEncoder().encode(baseFrame(-3200)).length, 42);
  assert.equal(hex(amberStatusRequest(42)), '01 00 08 00 2A 00 00 00');
  assert.deepEqual(uartBits(0x85), [0, 1, 0, 1, 0, 0, 0, 0, 1, 1]);
  assert.throws(() => amberStatusRequest(-1));
});
