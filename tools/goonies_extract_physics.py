#!/usr/bin/env python3
"""Recover original Goonies collision rectangles, bounds and spawn state from XEX.

Atari800 is a development-only oracle. No executable code or ROM is exported.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import pty
import subprocess
import tempfile

from karate_extract_backgrounds import Monitor

ROOT = Path(__file__).resolve().parents[1]
SHA256 = '3178f530d27b361f4f99a0c4f5454c7d2584b9e5967cd803a1f8057ef44b799a'
ORDER = [0, 2, 1, 3, 4, 5, 6, 7]


class XexMonitor(Monitor):
    def __init__(self, source):
        self.master, slave = pty.openpty()
        self.process = subprocess.Popen(
            ['/opt/homebrew/bin/atari800', '-no-autosave-config', '-nosound',
             '-no-video-accel', '-nobasic', '-xe', '-ntsc', '-turbo', '-monitor', '-run', str(source)],
            stdin=slave, stdout=slave, stderr=slave, start_new_session=True,
            env={**os.environ, 'SDL_VIDEODRIVER': 'dummy', 'SDL_AUDIODRIVER': 'dummy'})
        os.close(slave)
        self.prompt()


def word(data, address):
    return int.from_bytes(data[address:address + 2], 'little')


def capture(source):
    if hashlib.sha256(source.read_bytes()).hexdigest() != SHA256:
        raise ValueError('Unsupported XEX revision.')
    with tempfile.TemporaryDirectory(prefix='goonies-physics-') as folder:
        dump = Path(folder) / 'ram.bin'
        m = XexMonitor(source)
        try:
            m.prompt('bpc 0786'); m.prompt('cont')
            scenes = []
            for room in ORDER:
                m.prompt('c 112d 00')  # Human game, not the title demonstration sequencer.
                m.prompt(f'c 112e {room:02x}'); m.prompt('c 1130 ff')
                m.prompt('bpc 0786'); m.prompt('setpc 074a'); m.prompt('cont')
                m.prompt(f'write 0000 bfff {dump}')
                b = dump.read_bytes()
                if b[0x112E] != room or b[0x1130] != room:
                    raise ValueError(f'Requested room {room}, reached {b[0x112E]}/{b[0x1130]}.')
                (Path('/private/tmp') / f'goonies-xex-room-{room}.bin').write_bytes(b)
                pointers = [word(b, p) for p in [0xD0, 0xD2, 0xD4, 0xD6, 0xD8]]
                rectangles = [dict(zip(['type', 'x1', 'y1', 'x2', 'y2'], [b[p + i] for p in pointers])) for i in range(b[0xCF])]
                actors = [{key: b[address + i] for key, address in
                            [('type', 0x1F00), ('vx', 0x1F0B), ('vy', 0x1F16), ('x', 0x1F21), ('y', 0x1F2C),
                             ('frame', 0x1F37), ('climb', 0x1F42), ('direction', 0x1F4D), ('moving', 0x1F58), ('baseFrame', 0x1F6E)]} for i in range(11)]
                players = actors[:2]
                frames = {}
                room_frames = {0: [], 1: [], 2: [], 3: [30], 4: range(31, 43),
                               5: range(43, 48), 6: [48], 7: range(49, 58)}
                logical_frames = sorted(set(range(30)) | set(room_frames[room]))
                for logical in logical_frames:
                    variants = []
                    for phase in range(4):
                        address = word(b, 0x6C2F + logical * 8 + phase * 2)
                        stride, height = b[address:address + 2]
                        if not 1 <= stride <= 8 or not 1 <= height <= 96 or address + 2 + stride * height > 0xC000:
                            variants = []; break
                        variants.append({'width': stride * 8, 'height': height,
                                         'packed': base64.b64encode(b[address + 2:address + 2 + stride * height]).decode()})
                    if len(variants) == 4:
                        frames[str(logical)] = variants
                scenes.append({'sourceRoomId': room, 'rectangles': rectangles, 'players': players,
                               'actors': actors, 'frames': frames,
                               'scripts': {key: word(b, address + room * 2) for key, address in
                                           [('initialize', 0x10DA), ('beforeActors', 0x10EE), ('afterActors', 0x1102)]}})
                print(f'Captured room {room}: {len(rectangles)} exact rectangles.', flush=True)
            return {'sourceSha256': SHA256, 'videoHz': 60, 'framesPerUpdate': 4,
                    'bodyWidths': list(b[0xE67:0xEA3]), 'bodyHeights': list(b[0xEA3:0xEDF]), 'scenes': scenes}
        finally:
            m.close()


def export(data):
    (ROOT / 'goonies-web/assets/physics.js').write_text(
        '// Original collision and player data from supplied XEX; no CPU code.\n'
        'globalThis.GOONIES_ORIGINAL = ' + json.dumps(data, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', action='store_true')
    args = parser.parse_args()
    stored = ROOT / 'research/goonies/original-physics.json'
    if args.capture:
        data = capture(next((ROOT / 'Goonies').glob('*.xex')))
        stored.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    else:
        data = json.loads(stored.read_text())
    export(data)
