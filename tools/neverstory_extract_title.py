#!/usr/bin/env python3
"""Capture the real loading picture, then export a static PNG for the web intro."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

from extract_assets import png
from neverstory_capture import Capture
from neverstory_extract import ROOT, SOURCES


def extract(args):
    palette = json.loads((ROOT / 'research/neverending-story/title-palette.json').read_text())
    colors = {int(index): bytes(rgb) + b'\xff' for index, rgb in palette['colors'].items()}
    sources, common = {}, None
    with tempfile.TemporaryDirectory(prefix='neverstory-loading-') as directory:
        temp = Path(directory)
        for language, (filename, expected) in SOURCES.items():
            source = ROOT / filename
            assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
            disk = temp / filename; shutil.copyfile(source, disk)
            monitor = Capture(args.emulator, disk)
            try:
                # $2000 has drawn the title and $0252/$0253 select its display list.
                # Stop before the next disk load replaces it with the game screen.
                monitor.prompt('bpc 8f40'); monitor.prompt('cont'); monitor.prompt('bpc ffff')
                monitor.prompt('c 9f00 4c 00 9f'); monitor.prompt('setpc 9f00')
                monitor.frame(); screen = temp / 'title.screen'
                monitor.prompt(f'DUMPSCREEN {screen}')
            finally: monitor.close()
            raw = screen.read_bytes(); assert len(raw) == 384 * 240
            # Keep the original blue top/bottom border as in the supplied reference.
            indices = b''.join(raw[y * 384 + 32:y * 384 + 352] for y in range(240))
            assert set(indices) == set(colors), 'Unexpected original loading-picture colors'
            if common is None: common = indices
            assert common == indices, 'Original ENG/CZE loading pictures differ'
            sources[language] = {'source': filename, 'sourceSha256': expected,
                                 'frameSha256': hashlib.sha256(raw).hexdigest(),
                                 'indicesSha256': hashlib.sha256(indices).hexdigest()}
    target = ROOT / 'neverending-story/assets/loading.png'
    png(target, 320, 240, b''.join(colors[index] for index in common))
    provenance = {'sources': sources, 'capture': 'Original $2000 loading-art routine, stopped at $8F40; real VBI/DLI scanout',
                  'crop': {'x': 32, 'y': 0, 'width': 320, 'height': 240},
                  'palette': palette, 'output': 'assets/loading.png',
                  'pngSha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    (ROOT / 'research/neverending-story/loading-art.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print('Exported the identical ENG/CZE original loading picture:', target)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emulator', type=Path, required=True)
    extract(parser.parse_args())
