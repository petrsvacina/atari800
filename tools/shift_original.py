"""Development-only 6502 oracle for the supplied Shift XEX; never shipped to the web."""
from pathlib import Path
import hashlib
import sys
import struct

ROOT = Path(__file__).resolve().parents[1]
SHA = '1e0f317e36ca10190dd8f4d328bb85a3c968f4dbae0ced1d91bd52f540fdb9e8'
FIELDS = {
    'level': 0x0d, 'frame': 0x0e, 'animationClock': 0x0f, 'idleDelay': 0x10,
    'shiftDelay': 0x11, 'switchDelay': 0x12, 'key': 0x13, 'jump': 0x14,
    'jumpClock': 0x15, 'seconds': 0x18, 'timerClock': 0x27,
    'spriteFrame': 0x1c, 'spikeFrame': 0x1d, 'gate': 0x1f, 'pose': 0x20,
    'falling': 0x21, 'supportCheck': 0x22, 'solid': 0x23, 'white': 0x24,
    'spriteSet': 0x25, 'x': 0x31, 'y': 0x32, 'xHigh': 0x33,
    'keyboardDelay': 0x36,
}


def image():
    data = (ROOT / 'shift.xex').read_bytes()
    if hashlib.sha256(data).hexdigest() != SHA:
        raise ValueError('Addresses apply only to the supplied Shift XEX.')
    memory = bytearray(65536)
    offset = 0
    while offset < len(data):
        start, = struct.unpack_from('<H', data, offset); offset += 2
        if start == 65535:
            continue
        end, = struct.unpack_from('<H', data, offset); offset += 2
        memory[start:end + 1] = data[offset:offset + end - start + 1]
        offset += end - start + 1
    return memory


def processor(memory):
    try:
        from py65.devices.mpu6502 import MPU
    except ImportError:
        # Existing offline development dependency; py65 is never a runtime asset.
        for candidate in ('/private/tmp/shift-oracle-deps', '/private/tmp/karateka-python', '/private/tmp/boulder-py65'):
            if Path(candidate, 'py65/devices/mpu6502.py').is_file():
                sys.path.insert(0, candidate)
                break
        from py65.devices.mpu6502 import MPU
    return MPU(memory=memory)


class Original:
    def __init__(self, level=0):
        self.memory = image()
        self.memory[0x400:0xe00] = self.memory[0x8e00:0x9800]
        self.cpu = processor(self.memory)
        self.call(0x42be)
        self.memory[0x28] = 0  # Original effects mode; music captured separately.
        self.memory[0x0d] = level
        self.memory[0x19:0x1b] = bytes((0x12, 0x34))
        self.call(0x408b)
        self.memory[0xd300] = 255
        self.memory[0xd010:0xd012] = bytes((1, 1))
        self.memory[0xd20e] = 255
        self.memory[0xd01f] = 7
        self.memory[0x26] = 50
        self.memory[0x2b] = 0xfd
        self.cpu.sp = 0xfd
        self.cpu.pc = 0x3e1c
        self.cpu.step()  # Enter the first original frame boundary at $3F8D.

    def step(self):
        c = self.cpu
        if c.pc == 0x3f8d:
            # Replace the raster polling, retaining the ORIGINAL frame counter,
            # music call and level-13 BCD timer instructions at $3F97..$3FFE.
            c.pc = 0x3f97
        elif c.pc == 0x4b15:
            # Busy-wait only. Preserve its final A / status; elapsed sound time
            # is captured on the real Atari800 separately.
            c.a = 0; c.p = (c.p & ~128) | 3
            c.pc = (c.stPopWord() + 1) & 65535
        else:
            c.step()

    def call(self, address):
        c = self.cpu; c.sp = 0xfd
        self.memory[0x1fe:0x200] = bytes((0xfe, 0x0f))
        c.pc = address
        for _ in range(1000000):
            if c.pc == 0x0fff:
                return
            self.step()
        raise RuntimeError(f'Original routine did not return: {c.pc:04X}')

    def frame(self, controls=15):
        m = self.memory
        m[0xd300] = 0xf0 | (controls & 15)
        m[0xd010] = int(not (controls & 16))
        self.step()
        for _ in range(1000000):
            if self.cpu.pc == 0x3f8d:
                return
            self.step()
        raise RuntimeError(f'Original frame did not yield: {self.cpu.pc:04X}')

    def state(self):
        m = self.memory
        return {**{k: m[a] for k, a in FIELDS.items()},
                'map': list(m[0x2000:0x23e8]),
                'platforms': [list(m[a:a+8]) for a in (0x37, 0x3f, 0x47, 0x4f)],
                'sprite': list(m[0x8030:0x8040]),
                'keyGlyph': list(m[0x2720:0x2728]),
                'rotatedKeyGlyph': list(m[0x2b20:0x2b28]),
                'spikes': list(m[0x2798:0x27b8]),
                'rotatedSpikes': list(m[0x2b98:0x2bb8]),
                'keyFlags': [m[0x7f94], m[0x8014]],
                'spriteColor': m[0xd012]}
