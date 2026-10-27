#!/usr/bin/env python3
"""Capture the original $6177 spell target validator, including empty points."""
import json
from archon_capture_mechanics import Original
from archon_extract_assets import ROOT, SHA256

MODES = [('teleport', 0, 0x86), ('teleport', 1, 0x81),
         ('heal', 0, 0x82), ('exchange', 0, 0x80),
         ('exchange', 1, 0x80), ('summonElemental', 0, 0x83),
         ('revive', 1, 0x84), ('imprison', 0, 0x85)]


def capture():
    original = Original()
    cases = []
    try:
        for side in ['light', 'dark']:
            for layout in ['opening', 'sparse']:
                base = original.prepare(37)
                base[0x604] = 0 if side == 'light' else 255
                if layout == 'sparse':
                    base[0x10f8:0x1149] = bytes([128] * 81)
                    for identifier, x, y in [(8, 3, 4), (27, 5, 4),
                                             (1, 2, 3), (3, 3, 3),
                                             (19, 6, 5), (21, 5, 5)]:
                        base[0x10f8 + y * 9 + x] = identifier
                base[0x665:0x667] = bytes([3, 21])
                selected = 1 if side == 'light' else 19
                location = list(base[0x10f8:0x1149]).index(selected)
                mage = 8 if side == 'light' else 27
                mage_location = list(base[0x10f8:0x1149]).index(mage)
                for spell, stage, flag in MODES:
                    data = bytearray(base)
                    origin = mage_location if spell == 'revive' else location
                    data[0xce], data[0xd0] = divmod(origin, 9)
                    data[0x64f] = flag
                    data[0x63e] = (0x8f if spell == 'revive' else 0xcf) if stage else 0
                    original.load(data)
                    for y in range(9):
                        code = bytearray([0x78])  # SEI; offline wrapper only.
                        for x in range(9):
                            for value, address in [(y, 0xcf), (x, 0xd1),
                                                   (selected if stage else 255, 0xd6)]:
                                code += bytes([0xa9, value, 0x85, address])
                            code += bytes.fromhex('20 77 61 ad 3f 06')
                            code += bytes([0x8d, (y * 9 + x) & 255, 0x0c])
                        code += bytes.fromhex('4c fe 0b')
                        original.load(code, 0xa00)
                        original.run(0xa00, 0xbfe)
                    valid = [bool(v & 128) for v in original.read(0xc00, 0xc50)]
                    cases.append({'side': side, 'spell': spell, 'stage': stage,
                                  'board': list(base[0x10f8:0x1149]),
                                  'prisoners': [3, 21], 'selected': selected,
                                  'valid': valid})
                print('Captured original spell targets', side, layout, flush=True)
    finally:
        original.close()
    (ROOT / 'tools/fixtures/archon-spells.json').write_text(json.dumps(
        {'sourceSha256': SHA256, 'cases': cases}, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    capture()
