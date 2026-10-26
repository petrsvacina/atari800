#!/usr/bin/env python3
"""Unpack the supplied H.E.R.O. XEX offline and export data, never CPU code."""
import argparse
import hashlib
import json
import tempfile
from pathlib import Path
from goonies_extract_physics import XexMonitor

ROOT = Path(__file__).resolve().parents[1]
SHA = '6f8d4e99ed480c3886a771439ce2d8207cfa0601cf1ac7db1c2325117ee83a75'

def extract():
    source = ROOT / 'H.E.R.O..xex'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == SHA
    with tempfile.TemporaryDirectory(prefix='hero-data-') as folder:
        dump = Path(folder) / 'ram.bin'
        m = XexMonitor(source)
        try:
            m.prompt('bpc 8177'); m.prompt('cont')
            m.prompt(f'write 0000 bfff {dump}')
            b = dump.read_bytes()
        finally:
            m.close()
    def data(start, count): return list(b[start:start + count])
    result = {
        'sourceSha256': SHA,
        'levelOffsets': data(0xAD00, 20),
        'lastRooms': data(0xAD28, 20),
        'creatures': [data(0xA500 + i * 256, 256) for i in range(3)],
        'floors': [data(0xA800 + i * 256, 256) for i in range(4)],
        'roomFlags': data(0xAC00, 256),
        'initial': data(0xAE10, 25),
        'heroBits': data(0xA200, 284),
        'objectBits': data(0xA000, 256),
        'actorBits': data(0xA100, 256),
        'effectBits': data(0xA400, 256),
        'effectColors': data(0xA400, 256),
        'actorColors': data(0xA400, 256),
        'heroColors': data(0xA4C5, 28),
        'oscillatorLimits': data(0xA1C0, 3),
        'heroWalk': data(0xAD81, 5),
        'heroFly': data(0xAD8B, 3),
        'creatureFrames': data(0xAD6F, 8),
        'creatureColors': data(0xAD7F, 2),
        'bombFrames': data(0xAD77, 8),
        'bombColors': data(0xAD91, 5),
        'ghostFrames': data(0xAE29, 8),
        'ghostDeath': data(0xADAD, 8),
        'wallMotion': data(0xADA5, 8),
        'verticalSpeed': data(0xAD9D, 8),
        'lavaHeight': data(0xAE44, 4),
        'powerBonusLow': data(0xADB5, 20),
        'powerBonusHigh': data(0xADC9, 20),
        'ceilingTiles': data(0xB21E, 8),
        'waterTiles': data(0xB226, 256),
        'difficultyStart': data(0x9E15, 5),
        'hudNumbers': data(0xB1C0, 20),
        'roomFont': data(0x3800, 512),
        'hudFont': data(0x3400, 512),
        'logoFont': data(0x0800, 512),
        'logoText': data(0x9090, 24),
        'logoColors': data(0x90A8, 7),
        'hudLabels': data(0xA1C3, 14),
    }
    target = ROOT / 'hero/assets/original.js'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text('// Extracted graphics and level tables. No executable Atari program.\n'
                      'globalThis.HERO_ORIGINAL=' + json.dumps(result, separators=(',', ':')) + ';\n')
    print('Exported H.E.R.O. level, bitmap and animation data:', target)

if __name__ == '__main__':
    extract()
