#!/usr/bin/env python3
"""Capture original title scanouts and export their unchanged title/logo pixels.

Offline Atari800 only. Preserve the original WLIN colour-timing loop while
freezing just the logo and typewriter data writers for the two-frame capture.
"""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
import tempfile

from extract_assets import png
from neverstory_capture import Capture

ROOT = Path(__file__).resolve().parents[1]
SHA = '75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb'
sha = lambda data: hashlib.sha256(data).hexdigest()
b64 = lambda data: base64.b64encode(data).decode('ascii')


def images(payload):
    palette = (ROOT / 'research/robbo/default.act').read_bytes()
    assert sha(palette) == payload['paletteSha256']
    pixels = base64.b64decode(payload['cases'][-1]['pixels'])
    target = ROOT / 'robbo/assets'
    png(target / 'title.png', 320, 240,
        b''.join(palette[v * 3:v * 3 + 3] + b'\xff' for v in pixels))
    # Crop the exact original glyph pixels, preserving the transparent gaps
    # between its moving brick-like strokes. No glyph is redrawn or retouched.
    points = [(x, y) for y in range(21, 60) for x in range(32, 288) if pixels[y * 320 + x]]
    left = min(x for x, y in points); right = max(x for x, y in points) + 1
    top = min(y for x, y in points); bottom = max(y for x, y in points) + 1
    crop = [pixels[y * 320 + x] for y in range(top, bottom) for x in range(left, right)]
    png(target / 'logo.png', right - left, bottom - top,
        b''.join(palette[v * 3:v * 3 + 3] + bytes((255 if v else 0,)) for v in crop))
    return [left, top, right - left, bottom - top]


def capture(emulator, state_file, output, passes=1200):
    assert sha((ROOT / 'Robbo.xex').read_bytes()) == SHA
    cases = []
    with tempfile.TemporaryDirectory(prefix='robbo-title-raster-') as folder:
        folder = Path(folder)
        monitor = Capture(emulator, ROOT / 'Robbo.xex')
        try:
            for count in (0, passes):
                monitor.prompt(f'loadstate {state_file.resolve()}')
                monitor.prompt('bline 999')
                monitor.prompt('bpc a8ac')
                monitor.prompt('cont')
                for _ in range(count):
                    monitor.prompt('cont')
                monitor.prompt('c abd8 60')
                monitor.prompt('c a8c9 4c 48 a9')
                monitor.prompt('c a96c 4c 85 a9')
                monitor.prompt('bpc ffff')
                monitor.frame()
                monitor.frame()
                monitor.prompt(f'DUMPSCREEN {folder}/title.screen')
                monitor.prompt(f'DUMPPALETTE {folder}/title.act')
                monitor.prompt(f'write 0000 ffff {folder}/title.bin')
                memory = (folder / 'title.bin').read_bytes()
                native = (folder / 'title.screen').read_bytes()
                palette = (folder / 'title.act').read_bytes()
                assert palette == (ROOT / 'research/robbo/default.act').read_bytes()
                pixels = b''.join(native[y * 384 + 32:y * 384 + 352] for y in range(240))
                cases.append({
                    'passes': count, 'nativeScreenSha256': sha(native),
                    'logo': {'screen': list(memory[0x1000:0x1080]),
                             'colors': list(memory[0x2c3:0x2c9])},
                    'typist': {'screen': list(memory[0x1080:0x11a0]),
                               'font': list(memory[0x2000:0x2400])},
                    'pixels': b64(pixels),
                })
                print(f'Captured original title after {count} main-loop passes', flush=True)
        finally:
            monitor.close()
    payload = {'sourceSha256': SHA, 'paletteSha256': sha(palette),
               'titleDataSha256': sha((ROOT / 'robbo/assets/title.json').read_bytes()),
               'width': 320, 'height': 240, 'cases': cases}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(gzip.compress(json.dumps(payload, separators=(',', ':')).encode(), mtime=0))
    crop = images(payload)
    report = {'sourceSha256': SHA, 'emulatorSha256': sha(emulator.read_bytes()),
              'sourceStateSha256': sha(state_file.read_bytes()),
              'paletteSha256': payload['paletteSha256'],
              'fixtureSha256': sha(output.read_bytes()),
              'capture': 'Title TPLP $A8AC; freeze BIGR and typist writes, retain WLIN timed palette writes and original OS VBI; two full frames',
              'mainLoopPasses': [case['passes'] for case in cases],
              'logoCrop': crop, 'nativeSize': [384, 240], 'crop': [32, 0, 320, 240],
              'titlePngSha256': sha((ROOT / 'robbo/assets/title.png').read_bytes()),
              'logoPngSha256': sha((ROOT / 'robbo/assets/logo.png').read_bytes())}
    (ROOT / 'research/robbo/title-raster.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Exported original title.png/logo.png and {len(cases)} native scanout fixtures')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emulator', type=Path, required=True)
    parser.add_argument('--state', type=Path, required=True)
    parser.add_argument('--passes', type=int, default=1200)
    parser.add_argument('--output', type=Path, default=ROOT / 'tools/fixtures/robbo-title-raster.json.gz')
    args = parser.parse_args()
    capture(args.emulator, args.state, args.output, args.passes)
