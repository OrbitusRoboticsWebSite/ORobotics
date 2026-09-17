#!/usr/bin/env python3
"""Packet laboratory: running this file prints bytes and never opens hardware."""
import math
import socket
import struct


def integer(value, lower, upper):
    if type(value) is not int or not lower <= value <= upper:
        raise ValueError(f"expected integer in [{lower}, {upper}]")
    return value


def smc_speed(speed):
    integer(speed, -3200, 3200)
    magnitude = abs(speed)
    opcode = 0x86 if speed < 0 else 0x85
    return bytes((opcode, magnitude & 0x1F, magnitude >> 5))


def maestro_target(channel, pulse_us):
    integer(channel, 0, 23)
    integer(pulse_us, 1000, 2000)  # Laboratory envelope, not ROB calibration.
    target = pulse_us * 4
    return bytes((0x84, channel, target & 0x7F, (target >> 7) & 0x7F))


def tic_position(position):
    integer(position, -(2**31), 2**31 - 1)
    raw = struct.pack('<i', position)
    high_bits = sum(((byte >> 7) & 1) << i for i, byte in enumerate(raw))
    return bytes((0xE0, high_bits, *(byte & 0x7F for byte in raw)))


def base_frame(left=0, right=0, flipper=0, lact=0):
    for value in (left, right, flipper):
        integer(value, -255, 255)
    integer(lact, -3200, 3200)
    values = (0, left, 0, right, 0, flipper, lact)
    return ('~' + ','.join(f'{v:+05d}' for v in values)).encode('ascii')


def bldc_pwm(demand):
    integer(demand, -255, 255)
    return 255 - abs(demand)


def amber_status_request(counter):
    integer(counter, 0, 2**32 - 1)
    return struct.pack('<HHI', 1, 8, counter)


def decode_amber_status(data, counter):
    if len(data) != 124:
        raise ValueError('V2 status response must be exactly 124 bytes')
    command, length, echoed, *values = struct.unpack('<HHI29f', data)
    if (command, length, echoed) != (1, 124, counter):
        raise ValueError('response header or counter mismatch')
    if not all(math.isfinite(v) for v in values):
        raise ValueError('non-finite status value')
    return {'joints': values[:7], 'joint_slots': values[:8],
            'joint_speed_slots': values[8:16], 'cartesian': values[16:22],
            'cartesian_speed': values[22:28], 'arm_angle': values[28]}


def query_amber_status(host, port, counter):
    """Explicit read-only network operation; never called by the packet lab."""
    peer = (socket.gethostbyname(host), integer(port, 1, 65535))
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as channel:
        channel.settimeout(1.0)
        channel.sendto(amber_status_request(counter), peer)
        data, sender = channel.recvfrom(2048)
        if sender != peer:
            raise ValueError('unexpected status sender')
        return decode_amber_status(data, counter)


def write_packet(port, packet):
    """For a caller-owned serial port; rejects incomplete writes."""
    if port.write(packet) != len(packet):
        raise IOError('short serial write')
    port.flush()


if __name__ == '__main__':
    for label, packet in [('SMC +1600', smc_speed(1600)),
                          ('SMC -1600', smc_speed(-1600)),
                          ('SMC zero', smc_speed(0)),
                          ('Maestro ch0 1500us', maestro_target(0, 1500)),
                          ('Tic position -1', tic_position(-1)),
                          ('AMBER status', amber_status_request(1))]:
        print(f'{label}: {packet.hex(" ").upper()}')
    frame = base_frame(lact=1600)
    print(f'Base ({len(frame)} bytes): {frame.decode()}')
    print(f'BLDC demand 64 -> analogWrite value {bldc_pwm(64)}')
