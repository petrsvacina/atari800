#!/usr/bin/env python3
"""Extract the original International Karate referee's independent 24×32 bitmap."""
import argparse
import hashlib
import json
from pathlib import Path

from extract_assets import png
from karate_extract_sfx import capture

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA256 = 'b30ddd0920a00a99d8b41d97b24d72cc57150e73e9a3686e0f35cb74f3b62bec'


def export(memory, source):
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError('This extractor is verified only for the supplied ATR.')
    if len(memory) != 0xC000:
        raise ValueError('Expected a loaded $0000–$BFFF RAM dump.')
    bitmap = memory[0x45FB:0x465B]
    if memory[0x465B:0x466A] != bytes.fromhex('a0 5f b9 fb 45 99 a0 13 99 a0 17 88 10 f4 60'):
        raise ValueError('The expected original referee font-copy routine is missing.')
    if bitmap != memory[0x13A0:0x1400] or bitmap != memory[0x17A0:0x1800]:
        raise ValueError('The loaded display-font copies do not match the original referee bitmap.')
    # Twelve 8×8 glyphs stored column first: F4,F5,F6,F7 then F8..FB, FC..FF.
    pixels = []
    for y in range(32):
        for x in range(24):
            glyph = x // 8 * 4 + y // 8
            packed = bitmap[glyph * 8 + y % 8]
            pixels.append((packed >> (6 - (x % 8 // 2) * 2)) & 3)
    palette_source = ROOT / 'karate/assets/palette.js'
    palette = json.loads(palette_source.read_text().split(' = ', 1)[1].rstrip().rstrip(';'))['fighters'][0]
    result = {'sourceSha256': SOURCE_SHA256, 'sourceAddress': '45FB-465A',
              'width': 24, 'height': 32, 'x': 288, 'y': 131,
              'originalAtariPosition': {'x': 288, 'y': 145},
              'palette': palette, 'frames': [{'id': 'neutral', 'pixels': pixels}]}
    output = ROOT / 'karate/assets/referee.js'
    output.write_text('// Original 24×32 referee glyphs, not a scaled fighter. See research/international-karate/referee/README.md.\n'
                      'globalThis.KARATE_REFEREE = ' + json.dumps(result, separators=(',', ':')) + ';\n')
    research = ROOT / 'research/international-karate/referee'
    research.mkdir(parents=True, exist_ok=True)
    (research / 'bitmap.bin').write_bytes(bitmap)
    rgba = bytearray()
    for index in pixels:
        color = palette[index].lstrip('#')
        rgba.extend(bytes.fromhex(color if len(color) == 8 else color + 'ff'))
    png(research / 'neutral.png', 24, 32, rgba)
    nonzero = [(i % 24, i // 24) for i, value in enumerate(pixels) if value]
    provenance = {key: value for key, value in result.items() if key != 'frames'}
    provenance.update({'bitmapSha256': hashlib.sha256(bitmap).hexdigest(),
                       'frameCount': 1,
                       'opaqueBounds': [min(p[0] for p in nonzero), min(p[1] for p in nonzero),
                                        max(p[0] for p in nonzero) + 1, max(p[1] for p in nonzero) + 1],
                       'otherPoses': 'No other original referee pose was found; score-call bubbles are separate text graphics.'})
    (research / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print(f'Exported original referee: 24×32, 12 glyphs, 1 verified neutral pose, x=288/y=131 in the web canvas.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--memory', type=Path, help='Reuse an existing loaded $0000–$BFFF RAM dump')
    args = parser.parse_args()
    source = ROOT / 'International Karate.atr'
    export(args.memory.read_bytes() if args.memory else capture(source), source)
