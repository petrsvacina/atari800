#!/usr/bin/env python3
"""Export Robbo's maps, character pixels and display tables from verified RAM.

The 64 KiB image is a development artifact produced by unpacking the supplied
XEX. Only explicitly listed data ranges are exported; no 6502 program or RAM
image is included in the browser assets.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Robbo.xex'
SOURCE_SHA = '75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb'

# Exact locations in the supplied XEX, after its two loading stages. Archival
# R1/R2 uses different locations for all but MFNT; see assets.md.
# Every range below is data, never an entry point.
RANGES = {
    'wallFont': (0x0e00, 0x1000),
    'animationFont': (0x1800, 0x1c00),
    'fontBase': (0x1c00, 0x2000),
    'infoFont': (0x2000, 0x2400),
    'levels': (0x3800, 0xa800),
}


def b64(data):
    return base64.b64encode(bytes(data)).decode('ascii')


def find_unique(memory, sequence, name):
    found = []
    start = 0
    while (start := memory.find(sequence, start)) >= 0:
        found.append(start)
        start += 1
    if len(found) != 1:
        raise ValueError(f'{name}: expected one data signature, found {found}')
    return found[0]


def extract(memory_file, target):
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA:
        raise ValueError('Robbo.xex differs from the analyzed authority')
    memory = memory_file.read_bytes()
    if len(memory) != 65536:
        raise ValueError('Expected exactly 65536 bytes of unpacked Atari RAM')

    # Start and tail of original LOOK identify its complete 128-byte data table.
    look_addr = find_unique(memory, bytes.fromhex(
        '80 46 00 00 48 80 4e 4e 4e 4e 4e 5e 5e ca ca 9e'), 'LOOK')
    look = memory[look_addr:look_addr + 128]
    if look[-8:] != bytes.fromhex('00 00 c4 00 c4 00 00 00'):
        raise ValueError('Original LOOK table tail did not match')
    next_addr = look_addr + 128
    next_table = memory[next_addr:next_addr + 26]
    if next_table != b'bcdefg \x00jklm*opqrstu:wa\x00\x00 ':
        raise ValueError('Original NEXT animation table did not match')
    hud_addr = find_unique(memory, bytes.fromhex(
        '00 00 0b 0b 0b 0b 0b 0b 00 00 4d 4e 0b 0b 00 00'), 'INFO')

    levels = []
    for number in range(56):
        address = RANGES['levels'][0] + number * 512
        cells = memory[address:address + 496]
        meta = memory[address + 496:address + 512]
        levels.append({
            'map': b64(cells), 'metadata': list(meta),
            'colors': list(meta[2:7]), 'border': meta[7],
            'screwsBcd': meta[1], 'wallStyle': (number >> 2) & 15,
        })

    assets = {
        'sourceSha256': SOURCE_SHA,
        'palette': b64((ROOT / 'research/robbo/default.act').read_bytes()),
        **{key: b64(memory[start:end]) for key, (start, end) in RANGES.items() if key != 'levels'},
        'look': list(look), 'next': list(next_table),
        'hudTemplate': list(memory[hud_addr:hud_addr + 80]), 'levels': levels,
        'demoText': list(memory[hud_addr + 80:hud_addr + 120]),
    }
    target.mkdir(parents=True, exist_ok=True)
    output = target / 'data.js'
    output.write_text('// Original Robbo maps, pixels and display tables; no 6502 program.\n'
                      'globalThis.ROBBO_ASSETS=' + json.dumps(assets, separators=(',', ':')) + ';\n')
    report = {
        'authority': SOURCE.name, 'sourceSha256': SOURCE_SHA,
        'unpackedRamSha256': hashlib.sha256(memory).hexdigest(),
        'exportSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'paletteSha256': hashlib.sha256((ROOT / 'research/robbo/default.act').read_bytes()).hexdigest(),
        'dataRanges': {key: [f'${start:04X}', f'${end - 1:04X}'] for key, (start, end) in RANGES.items()},
        'lookAddress': f'${look_addr:04X}', 'nextAddress': f'${next_addr:04X}',
        'hudAddress': f'${hud_addr:04X}',
        'levelCount': 56, 'levelSize': [16, 31], 'levelMetadataBytes': 16,
        'levelSha256': [hashlib.sha256(memory[RANGES['levels'][0] + i * 512:RANGES['levels'][0] + (i + 1) * 512]).hexdigest() for i in range(56)],
    }
    report_path = ROOT / 'research/robbo/assets.json'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    print(f'Exported {len(levels)} original 16x31 planets, four fonts, LOOK and NEXT to {output.relative_to(ROOT)}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--memory', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'robbo/assets')
    args = parser.parse_args()
    extract(args.memory, args.output)
