#!/usr/bin/env python3
"""Capture the original PAL demonstration's third HUD row and colour cycle.

Offline only: trigger the original title auto-demo branch, let the original
planet initializer configure the display list, then freeze the main thread.
Original CVBL/DLI continue running. Export only pixels, maps and fonts.
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
sha = lambda data: hashlib.sha256(data).hexdigest()
b64 = lambda data: base64.b64encode(data).decode('ascii')


def capture(emulator, state_file, output):
    assert sha((ROOT / 'Robbo.xex').read_bytes()) == SHA
    cases = []
    with tempfile.TemporaryDirectory(prefix='robbo-demo-raster-') as folder:
        folder = Path(folder)
        monitor = Capture(emulator, ROOT / 'Robbo.xex')
        try:
            monitor.prompt(f'loadstate {state_file.resolve()}')
            monitor.prompt('bline 999')
            monitor.prompt('bpc a948')
            monitor.prompt('cont')
            # The original NOPR branch checks CDTMV1's high byte for 1,
            # sets DEMO itself, and enters the real PIPA/PLA1 initializer.
            monitor.prompt('c 021c 00 01')
            monitor.prompt('bpc 2505')
            monitor.prompt('cont')
            monitor.prompt('c 0400 4c 00 04')
            monitor.prompt('setpc 0400')
            monitor.prompt('bpc ffff')
            for seed in (0, 24, 56):
                monitor.prompt(f'c 0014 {seed:02x}')
                monitor.frame()
                monitor.frame()
                monitor.prompt(f'DUMPSCREEN {folder}/demo.screen')
                monitor.prompt(f'write 0000 ffff {folder}/demo.bin')
                antic = monitor.prompt('antic')
                memory = (folder / 'demo.bin').read_bytes()
                native = (folder / 'demo.screen').read_bytes()
                vscroll = int(re.search(r'VSCROL=\s*([0-9A-F]{2})', antic).group(1), 16)
                assert memory[0xa3] == 1
                assert memory[0x3702:0x3704] == bytes.fromhex('8202')
                pixels = b''.join(native[y * 384 + 32:y * 384 + 352] for y in range(240))
                state = {
                    'level': memory[0x9d], 'counter': memory[0x266c],
                    'noga': memory[0x275e], 'lm': memory[0x98],
                    'map': b64(memory[0x700:0x900]), 'font': b64(memory[0x1c00:0x2000]),
                    'infoFont': b64(memory[0x2000:0x2400]),
                    'hudCharacters': list(memory[0x3707:0x3757]),
                    'colors': list(memory[0x2c4:0x2c9]), 'border': memory[0x2c3],
                    'cameraY': (int.from_bytes(memory[0x36e7:0x36e9], 'little') - 0x1000) / 32 * 8 + vscroll,
                    'demo': memory[0xa3], 'clock': memory[0x14],
                }
                cases.append({'seedClock': seed, 'state': state, 'pixels': b64(pixels)})
        finally:
            monitor.close()
    payload = {'sourceSha256': SHA, 'width': 320, 'height': 240, 'cases': cases}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(gzip.compress(json.dumps(payload, separators=(',', ':')).encode(), mtime=0))
    report = {
        'sourceSha256': SHA, 'emulatorSha256': sha(emulator.read_bytes()),
        'sourceStateSha256': sha(state_file.read_bytes()), 'fixtureSha256': sha(output.read_bytes()),
        'capture': 'Original title timer auto-demo branch to PIPA/PLA1, stop PCLO $2505; freeze main at $0400, retain CVBL/DLI',
        'demoDisplayListBytes': ['$82', '$02'], 'textRange': ['$3757', '$377E'],
        'clockValues': [case['state']['clock'] for case in cases],
        'thirdRowLuminance': [(case['state']['clock'] >> 2) & 14 for case in cases],
        'nativeSize': [384, 240], 'crop': [32, 0, 320, 240], 'demoRow': [0, 210, 320, 8],
    }
    (ROOT / 'research/robbo/demo-raster.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Captured {len(cases)} original PAL demo scanouts with clock-dependent third HUD row')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emulator', type=Path, required=True)
    parser.add_argument('--state', type=Path, required=True, help='Native title-entry Atari800 state')
    parser.add_argument('--output', type=Path, default=ROOT / 'tools/fixtures/robbo-demo-raster.json.gz')
    args = parser.parse_args()
    capture(args.emulator, args.state, args.output)
