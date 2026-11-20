#!/usr/bin/env python3
"""Capture native font-copy fixtures from the exact supplied Robbo XEX RAM.

Offline py65 reference only: exports resulting pixels and semantic state,
never executable bytes. RAM must have been captured from Atari800 after the
two XEX loading stages, for example at title entry PC $AC28.
"""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SHA = '75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb'
try:
    from py65.devices.mpu6502 import MPU
except ImportError:
    sys.path.insert(0, '/private/tmp/robbo-deps')
    from py65.devices.mpu6502 import MPU


def capture(ram_file, output):
    assert hashlib.sha256((ROOT / 'Robbo.xex').read_bytes()).hexdigest() == SHA
    base = ram_file.read_bytes()
    assert len(base) == 65536
    syms = json.loads((ROOT / 'research/robbo/symbols.json').read_text())['symbols']
    assert base[syms['chnmon']:syms['chnmon'] + 3] == bytes.fromhex('20cf32')
    assert base[syms['entcv']:syms['entcv'] + 2] == bytes.fromhex('a59d')
    cases = []
    for level in range(0, 56, 4):
        for counter in (0, 2):
            for phase in (0, 1):
                for lm in (14, 13, 11, 7):
                    for moving, fac in ((0, 0), (1, 0), (1, 1)):
                        memory = bytearray(base)
                        memory[syms['cnum']] = level
                        memory[syms['lm']] = lm
                        memory[syms['cntr']] = counter
                        memory[syms['chnmon'] - 1] = phase
                        memory[syms['ruch']] = moving
                        memory[syms['fac']] = fac
                        cpu = MPU(memory=memory)
                        cpu.pc = syms['entcv']
                        # Execute the actual wall-copy prefix, stopping before
                        # ENTCV changes map or begins the entrance animation.
                        for _ in range(1000):
                            if cpu.pc == syms['entcv'] + 0x1c:
                                break
                            cpu.step()
                        else:
                            raise RuntimeError('ENTCV wall prefix did not settle')
                        cpu.pc = syms['chnmon']
                        cpu.sp = 0xfd
                        memory[0x1fe:0x200] = bytes((0xfe, 0xff))
                        for _ in range(10000):
                            if cpu.pc == 0xffff:
                                break
                            if cpu.pc == syms['halt']:
                                cpu.pc = (cpu.stPopWord() + 1) & 65535
                            else:
                                cpu.step()
                        else:
                            raise RuntimeError('CHNMON did not return')
                        font = memory[syms['font']:syms['font'] + 1024]
                        cases.append({
                            'state': {'level': level, 'counter': counter,
                                      'noga': phase, 'lm': lm,
                                      'moving': moving, 'fac': fac},
                            'nogaAfter': memory[syms['chnmon'] - 1],
                            'font': base64.b64encode(font).decode('ascii'),
                        })
    planets = []
    for level in range(56):
        memory = bytearray(base)
        address = syms['cavs'] + level * 512
        memory[syms['cave']:syms['cave'] + 512] = base[address:address + 512]
        metadata = base[address + 496:address + 512]
        memory[syms['cnum']] = level
        memory[syms['lm']] = 13
        memory[syms['cntr']] = 0
        memory[syms['chnmon'] - 1] = 0
        memory[syms['ruch']] = 0
        memory[syms['fac']] = 0
        memory[syms['tele']] = 1
        memory[syms['lste']] = 255
        memory[0x2c4:0x2c9] = metadata[2:7]
        memory[0x2c3] = metadata[7]
        cpu = MPU(memory=memory)
        cpu.pc = syms['entcv']
        cpu.sp = 0xfd
        memory[0x1fe:0x200] = bytes((0xfe, 0xff))
        for _ in range(1000000):
            if cpu.pc == 0xffff:
                break
            if cpu.pc in (syms['halt'], syms['sound_']):
                cpu.pc = (cpu.stPopWord() + 1) & 65535
            else:
                cpu.step()
        else:
            raise RuntimeError(f'ENTCV planet {level + 1} did not return: ${cpu.pc:04X}')
        # Decode the original PUT_ output from SCRN, independently of its
        # CAVE and LOOK storage. This is ANTIC4's documented two-bit path.
        pixels = bytearray(256 * 496)
        for y in range(496):
            for x in range(256):
                character = memory[syms['scrn'] + (y >> 3) * 32 + (x >> 3)]
                bits = memory[syms['font'] + (character & 127) * 8 + (y & 7)]
                value = (bits >> (6 - ((x & 7) >> 1) * 2)) & 3
                color = metadata[7] if not value else metadata[2 + (3 if character & 128 else 2)] if value == 3 else metadata[1 + value]
                pixels[y * 256 + x] = color & 254
        planets.append({
            'state': {'level': level, 'counter': memory[syms['cntr']],
                      'fontRobotPhase': 0, 'lm': memory[syms['lm']],
                      'colors': list(metadata[2:7]), 'border': metadata[7],
                      'map': base64.b64encode(memory[syms['cave']:syms['cave'] + 512]).decode('ascii')},
            'pixels': base64.b64encode(pixels).decode('ascii'),
        })
    payload = {
        'sourceSha256': SHA,
        'ramSha256': hashlib.sha256(base).hexdigest(),
        'reference': 'Actual supplied XEX ENTCV wall-copy prefix and CHNMON; only HALT VBL wait bypassed',
        'cases': cases,
        'planets': planets,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(gzip.compress(json.dumps(payload, separators=(',', ':')).encode(), mtime=0))
    print(f'Exported {len(cases)} native font cases and {len(planets)} fully drawn planets to {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ram', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'tools/fixtures/robbo-raster.json.gz')
    args = parser.parse_args()
    capture(args.ram, args.output)
