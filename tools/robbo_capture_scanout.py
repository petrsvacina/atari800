#!/usr/bin/env python3
"""Capture one frozen native Atari800 PAL scanout and its exact RGB palette.

The original VBI/DLI remain active; an offline idle loop only freezes the
main game logic. Exported fixtures contain map/character pixels, not CPU code.
Requires the development Atari800 DUMPSCREEN and DUMPPALETTE monitor commands.
"""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import re
import tempfile

from neverstory_capture import Capture

ROOT = Path(__file__).resolve().parents[1]
SHA = '75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb'
b64 = lambda data: base64.b64encode(data).decode('ascii')
sha = lambda data: hashlib.sha256(data).hexdigest()


def capture(emulator, state_file, output):
    assert sha((ROOT / 'Robbo.xex').read_bytes()) == SHA
    with tempfile.TemporaryDirectory(prefix='robbo-scanout-') as folder:
        folder = Path(folder)
        monitor = Capture(emulator, ROOT / 'Robbo.xex')
        try:
            monitor.prompt(f'loadstate {state_file.resolve()}')
            monitor.prompt('bpc ffff')
            monitor.prompt('c 0400 4c 00 04')
            monitor.prompt('setpc 0400')
            monitor.frame()
            monitor.frame()
            monitor.prompt(f'DUMPSCREEN {folder}/game.screen')
            monitor.prompt(f'DUMPPALETTE {folder}/game.act')
            monitor.prompt(f'write 0000 ffff {folder}/game.bin')
            antic = monitor.prompt('antic')
            gtia = monitor.prompt('gtia')
        finally:
            monitor.close()
        memory = (folder / 'game.bin').read_bytes()
        screen = (folder / 'game.screen').read_bytes()
        palette = (folder / 'game.act').read_bytes()
    assert len(memory) == 65536 and len(screen) == 384 * 240 and len(palette) == 768
    vscroll = int(re.search(r'VSCROL=\s*([0-9A-F]{2})', antic).group(1), 16)
    camera = int.from_bytes(memory[0x36e7:0x36e9], 'little')
    state = {
        'level': memory[0x9d], 'counter': memory[0x266c],
        'noga': memory[0x275e], 'lm': memory[0x98],
        'map': b64(memory[0x700:0x900]),
        'font': b64(memory[0x1c00:0x2000]),
        'infoFont': b64(memory[0x2000:0x2400]),
        'hudCharacters': list(memory[0x3707:0x3757]),
        'colors': list(memory[0x2c4:0x2c9]), 'border': memory[0x2c3],
        'cameraY': (camera - 0x1000) / 32 * 8 + vscroll,
    }
    cropped = b''.join(screen[y * 384 + 32:y * 384 + 352] for y in range(240))
    payload = {'sourceSha256': SHA, 'width': 320, 'height': 240,
               'nativeScreenSize': [384, 240], 'nativeCrop': [32, 0, 320, 240],
               'state': state, 'pixels': b64(cropped)}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(gzip.compress(json.dumps(payload, separators=(',', ':')).encode(), mtime=0))
    palette_file = ROOT / 'research/robbo/default.act'
    palette_file.write_bytes(palette)
    config = {}
    config_file = Path.home() / '.atari800.cfg'
    if config_file.is_file():
        for line in config_file.read_text().splitlines():
            if line.startswith(('COLOURS_PAL_', 'ARTIFACT_PAL=')):
                key, value = line.split('=', 1)
                config[key] = value
    report = {
        'authorityXexSha256': SHA, 'emulator': 'Atari800 7.2.1, development monitor build',
        'emulatorSha256': sha(emulator.read_bytes()), 'stateSha256': sha(state_file.read_bytes()),
        'capture': 'Main idle at $0400; original VBI/DLI; two full 0/248 scanline frames; DUMPSCREEN and DUMPPALETTE',
        'mode': 'PAL, XE, BASIC disabled, refresh=1', 'paletteConfig': config,
        'paletteSha256': sha(palette), 'nativeScreenSha256': sha(screen),
        'fixtureSha256': sha(output.read_bytes()),
        'nativeSize': [384, 240], 'crop': [32, 0, 320, 240],
        'playfield': [32, 21, 256, 161], 'hud': [0, 194, 320, 16],
        'cameraAddress': camera, 'hardwareVscroll': vscroll,
        'antic': antic.strip(), 'gtia': gtia.strip(),
    }
    (ROOT / 'research/robbo/scanout.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Captured 320x240 native PAL scanout to {output}; RGB palette to {palette_file}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emulator', type=Path, required=True)
    parser.add_argument('--state', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'tools/fixtures/robbo-scanout.json.gz')
    args = parser.parse_args()
    capture(args.emulator, args.state, args.output)
