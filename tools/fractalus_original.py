"""Offline authority for the supplied Rescue on Fractalus 4.1 disk.

No processor, machine code or disk image is shipped in the browser runtime.
"""
from pathlib import Path
import hashlib
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'rescue-on-fractalus.atr'
SHA256 = 'e8ff23567b219f614a307a309e42929957facb9b9ff838cc8ff91789eace44ab'
MAIN_SHA256 = '57553c97cc93f1fb65075b64ee3310fb33c9af33422a1e8494038761fce3f4f4'


def files():
    """The custom loader advances by 125 bytes, ignoring DOS byte-count fields."""
    image = SOURCE.read_bytes()
    if hashlib.sha256(image).hexdigest() != SHA256:
        raise ValueError('Unsupported source ATR revision')
    if image[:2] != b'\x96\x02' or len(image) != 16 + 720 * 128:
        raise ValueError('Expected the supplied 720-sector SD ATR')
    def sector(number):
        if not 1 <= number <= 720:
            raise ValueError(f'Invalid sector {number}')
        return image[16 + (number - 1) * 128:16 + number * 128]
    found = {}
    for number in range(361, 369):
        directory = sector(number)
        for offset in range(0, 128, 16):
            entry = directory[offset:offset + 16]
            if not entry[0] & 0x40 or entry[0] & 0x80:
                continue
            if entry[5:13].strip() not in {b'FILE00', b'FILE01', b'FILE02', b'FILE03', b'FILE04'}:
                continue
            name = entry[5:13].decode('ascii').strip()
            suffix = entry[13:16].decode('ascii').strip()
            if suffix:
                name += '.' + suffix
            if name not in {'FILE00', 'FILE01', 'FILE02', 'FILE03', 'FILE04'}:
                continue
            current = int.from_bytes(entry[3:5], 'little')
            payload, seen = bytearray(), set()
            while current:
                if current in seen:
                    raise ValueError('Cyclic sector chain')
                seen.add(current)
                data = sector(current)
                payload.extend(data[:125])
                current = ((data[125] & 3) << 8) | data[126]
            if len(seen) != int.from_bytes(entry[1:3], 'little'):
                raise ValueError(f'Unexpected chain length for {name}')
            found[name] = bytes(payload)
    if hashlib.sha256(found['FILE01']).hexdigest() != MAIN_SHA256:
        raise ValueError('Unexpected main program stream')
    return found


def image():
    data = files()
    ram = bytearray(65536)
    for name, address in [('FILE00', 0x05FD), ('FILE01', 0x3CDE), ('FILE02', 0x0400)]:
        ram[address:address + len(data[name])] = data[name]
    return ram


def processor(memory):
    try:
        from py65.devices.mpu6502 import MPU
    except ImportError:
        for directory in ['/private/tmp/fractalus-oracle-deps', '/private/tmp/shift-oracle-deps']:
            if Path(directory, 'py65/devices/mpu6502.py').exists():
                sys.path.insert(0, directory)
                break
        from py65.devices.mpu6502 import MPU
    return MPU(memory=memory)


def call(cpu, address, limit=100000):
    """Invoke an isolated original routine. Atari hardware/OS is not synthesized."""
    cpu.sp = 0xFD
    cpu.memory[0x01FE:0x0200] = bytes([0xFC, 0x3B])
    cpu.pc = address
    for _ in range(limit):
        if cpu.pc == 0x3BFD:
            return
        cpu.step()
    raise RuntimeError(f'Original routine did not return (${cpu.pc:04X})')
