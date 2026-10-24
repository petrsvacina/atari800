#!/usr/bin/env python3
"""Extract Archon's original sprites, glyphs and terrain directly from its XEX.

The loader's $3000→$1000 relocation was independently verified in Atari800.
The browser receives only extracted graphics, never a CPU or hardware emulator.
"""
import argparse
import hashlib
import json
from pathlib import Path

from extract_assets import png

ROOT = Path(__file__).resolve().parents[1]
SHA256 = '44be88e99b08731719966cba0b65d1932c48d50c44111749050f8a9a8d7135df'
NAMES = ['unicorn', 'wizard', 'archer', 'golem', 'valkyrie', 'djinni', 'phoenix', 'knight',
         'basilisk', 'sorceress', 'manticore', 'troll', 'shapeshifter', 'dragon', 'banshee', 'goblin',
         'air', 'fire', 'earth', 'water']


def relocated(source):
    blob = source.read_bytes()
    if hashlib.sha256(blob).hexdigest() != SHA256:
        raise ValueError('This extractor is verified only for the supplied Archon.xex.')
    memory = bytearray(65536)
    offset = 0
    while offset < len(blob):
        if blob[offset:offset + 2] == b'\xff\xff':
            offset += 2
            continue
        start = int.from_bytes(blob[offset:offset + 2], 'little')
        end = int.from_bytes(blob[offset + 2:offset + 4], 'little')
        offset += 4
        count = end - start + 1
        if count <= 0 or offset + count > len(blob):
            raise ValueError('Invalid Atari executable segment.')
        memory[start:end + 1] = blob[offset:offset + count]
        offset += count
    if memory[0x9C00:0x9C0D] != bytes.fromhex('a0 6c a2 00 bd 00 30 9d 00 10 e8 d0 f7'):
        raise ValueError('Unexpected original relocation routine.')
    memory[0x1000:0x7C00] = memory[0x3000:0x9C00]
    return memory


def word(memory, address):
    return int.from_bytes(memory[address:address + 2], 'little')


def export(source):
    memory = relocated(source)
    units = []
    for identifier, key in enumerate(NAMES):
        start = word(memory, 0x56C0 + identifier * 2)
        end = word(memory, 0x56C2 + identifier * 2) if identifier < 19 else 0x32EC
        frames = [list(memory[address:address + 16]) for address in range(start, end, 16)]
        expected = 10 if identifier == 12 else 15
        if len(frames) != expected or not 0x207C <= start < end <= 0x32EC:
            raise ValueError(f'Unexpected original sprite range for {key}.')
        projectile = word(memory, 0x56E8 + identifier * 2)
        raw = list(memory[projectile:projectile + 32])
        units.append({'id': identifier, 'key': key, 'sourceAddress': f'{start:04X}',
                      'frames': frames, 'boardFrame': 0, 'defaultMirror': bool(identifier & 8),
                      'projectile': {'width': 16, 'height': 8, 'sourceAddress': f'{projectile:04X}',
                                     'raw': raw, 'frames': [raw[i:i + 8] for i in range(0, 32, 8)]}})
    obstacles = []
    for identifier in (1, 2, 3):
        rows = list(memory[0x1C00 + identifier * 8:0x1C08 + identifier * 8])
        pixels = [(rows[y] >> (6 - (x // 2) * 2)) & 3 for y in range(8) for x in range(8)]
        obstacles.append({'id': identifier, 'width': 8, 'height': 8, 'rows': rows, 'pixels': pixels})
    data = {'sourceSha256': SHA256, 'spriteWidth': 16, 'spriteHeight': 16, 'pixelWidth': 2,
            'units': units, 'terrain': list(memory[0x202B:0x207C]),
            'terrainValues': {'dark': 0, 'light': 64, 'variable': 192},
            'frameGroups': {'walk': {'right': [0, 1, 2, 3], 'left': [0, 1, 2, 3],
                                     'down': [4, 5, 4, 6], 'up': [7, 8, 7, 9]},
                            'attack': {'right': 12, 'left': 12, 'up': 10, 'down': 14},
                            'mirrorDirections': ['left'],
                            'originalByteOffsetTable': list(memory[0x5CDC:0x5CED])},
            'obstacles': obstacles,
            'font': {'sourceAddress': '1C00', 'firstChar': 32, 'width': 8, 'height': 8,
                     'rows': [list(memory[0x1C00 + i * 8:0x1C08 + i * 8]) for i in range(64)]},
            'areaEffects': {'phoenix': {'rows': list(memory[0x1EC0:0x1EE0]),
                                        'stages': [
                                            {'width': 16, 'height': 16, 'offsetX': 0, 'offsetY': 0},
                                            {'width': 32, 'height': 32, 'offsetX': -8, 'offsetY': -8},
                                            {'width': 64, 'height': 32, 'offsetX': -24, 'offsetY': -8},
                                            {'width': 32, 'height': 32, 'offsetX': -8, 'offsetY': -8},
                                            {'width': 16, 'height': 16, 'offsetX': 0, 'offsetY': 0}]},
                            'banshee': {'rows': list(memory[0x1FC0:0x1FE0]),
                                        'width': 64, 'height': 32, 'offsetX': -24, 'offsetY': -8}},
            'originalBoardGeometry': {'cellWidth': 16, 'cellHeight': 16, 'iconLeft': 88,
                                      'iconTopBeamLine': 49, 'columns': 9, 'rows': 9}}
    output = ROOT / 'archon/assets'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'sprites.js').write_text('// Original Archon XEX graphics; see research/archon/ASSETS.md.\n'
                                      'globalThis.ARCHON_ASSETS = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    research = ROOT / 'research/archon'
    research.mkdir(parents=True, exist_ok=True)
    (research / 'original-graphics.json').write_text(json.dumps(data, separators=(',', ':')) + '\n')
    # Contact sheet preserves each original 8-bit row, doubled horizontally.
    width, height = 15 * 24, 20 * 24
    background = bytes([0, 23, 0, 255])
    pixels = bytearray(background * width * height)
    for unit in units:
        color = bytes([161, 195, 66, 255] if unit['id'] < 8 or unit['id'] >= 16 else [1, 59, 123, 255])
        for frame_id, rows in enumerate(unit['frames']):
            for y, packed in enumerate(rows):
                for x in range(8):
                    if packed >> (7 - x) & 1:
                        for repeat in range(2):
                            dx, dy = frame_id * 24 + x * 2 + repeat, unit['id'] * 24 + y
                            offset = (dy * width + dx) * 4
                            pixels[offset:offset + 4] = color
    png(research / 'unit-frames.png', width, height, pixels)
    hashes = {'sourceSha256': SHA256,
              'relocation': {'sourceStart': '3000', 'destinationStart': '1000', 'bytes': 0x6C00},
              'unitPointerTable': '56C0', 'projectilePointerTable': '56E8',
              'terrainAddress': '202B-207B', 'fontAddress': '1C00-1DFF',
              'unitBitmapSha256': hashlib.sha256(memory[0x207C:0x32EC]).hexdigest(),
              'spriteDataSha256': hashlib.sha256((output / 'sprites.js').read_bytes()).hexdigest()}
    (research / 'asset-provenance.json').write_text(json.dumps(hashes, indent=2) + '\n')
    print(f'Extracted {len(units)} units, {sum(len(u["frames"]) for u in units)} original 16×16 frames, '
          '20 projectile records, 81 terrain cells, 3 obstacle glyphs and 64 font glyphs.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'Archon.xex')
    args = parser.parse_args()
    export(args.source)
