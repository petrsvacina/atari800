#!/usr/bin/env python3
"""Replay source AI spell dispatch, including targets the human UI rejects."""
import json
from archon_capture_mechanics import Original
from archon_extract_assets import ROOT, SHA256


def capture():
    refs = json.loads((ROOT / 'tools/fixtures/archon-board.json').read_text())['cases']
    original = Original()
    cases = []
    try:
        for ref in refs:
            action = ref['action']
            if action.get('spell') not in (0, 4):
                continue
            data = original.prepare(ref['seed'])
            flag = 255 if ref['side'] == 'dark' else 85
            data[0xb0] = data[0x604] = flag
            data[0x601] = flag if ref['firstSide'] == ref['side'] else flag ^ 255
            data[0x608] = 0 if ref['direction'] > 0 else 255
            data[0x2c7] = 0xb0 + ref['luma']
            data[0x6a9] = ref['state']['injury']
            data[0x6aa] = ref['state']['maximumHP']
            data[0x10f8:0x1149] = bytes([128] * 81)
            data[0x1179:0x119d] = bytes(36)
            for unit in ref['units']:
                data[0x10f8 + unit['y'] * 9 + unit['x']] = unit['originalIndex']
                data[0x1179 + unit['originalIndex']] = unit['health']
            for side in range(2):
                data[0x665 + side] = next((i for i in ref['prisoners'] if (i >= 18) == bool(side)), 255)
                for key in range(7):
                    data[0x1260 + side * 7 + key] = 254 if key in ref['usedSpells'][side] else 253
            original.load(data)
            original.load(bytes.fromhex('78 20 6b 3f 4c e0 08'), 0x840)
            original.run(0x840)
            # Stop at the natural arena/next-turn branch, before modifying either.
            original.m.prompt('c 5130 4c 20 0b')
            original.m.prompt('c 3c64 4c 30 0b')
            original.m.prompt('c 0b20 a9 01 8d ee 08 4c e0 08')
            original.m.prompt('c 0b30 a9 00 8d ee 08 4c e0 08')
            original.m.prompt('c 0840 58 20 34 4c 4c 3c 3f')
            original.m.prompt('c d40e c0')
            original.run(0x840)
            ram = original.read(0, 0x12ff)
            cases.append({'seed': ref['seed'], 'fight': bool(ram[0x8ee]),
                          'attacker': ram[0xd6], 'defender': ram[0x641],
                          'x': ram[0xd1], 'y': ram[0xcf],
                          'spent': list(ram[0x1260:0x126e])})
            original.m.prompt('c d40e 00')
            print('Captured source AI spell', ref['seed'], action['spell'], flush=True)
    finally:
        original.close()
    (ROOT / 'tools/fixtures/archon-ai-spells.json').write_text(json.dumps(
        {'sourceSha256': SHA256, 'cases': cases}, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    capture()
