#!/usr/bin/env python3
"""Capture the original Robbo ending offline through a private Atari800 monitor.

Requires development DUMPCINEMA (384x240 palette indices + nine POKEY bytes),
DUMPPALETTE, and DUMPRANDOM (read values since last dump) commands. The supplied
XEX is never changed; the monitor's temporary RAM input selects final-level exit.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
from neverstory_capture import Capture
from robbo_capture_sound import ROOT, SHA256


def capture(args):
    if hashlib.sha256((ROOT / 'Robbo.xex').read_bytes()).hexdigest() != SHA256:
        raise ValueError('Unexpected authority XEX')
    folder = args.output.resolve(); folder.mkdir(parents=True, exist_ok=True)
    frames_dir = folder / 'frames'; frames_dir.mkdir(exist_ok=True)
    monitor = Capture(args.emulator, ROOT / 'Robbo.xex')
    records = []; phase = 'intro'; hold_count = 0; hold_entry = None
    def pc(output):
        found = re.findall(r'PC=([0-9A-Fa-f]{4})', output)
        return int(found[-1], 16) if found else None
    def dump(index, output, partial=False):
        prefix = frames_dir / f'{index:04d}'
        monitor.prompt(f'dumpcinema {prefix}.cinema')
        monitor.prompt(f'dumprandom {prefix}.random')
        monitor.prompt(f'write 0012 0014 {prefix}.clock')
        if phase == 'hold': monitor.prompt(f'write 1000 12ff {prefix}.screen')
        raw = (prefix.with_suffix('.cinema')).read_bytes()
        if len(raw) != 384 * 240 + 9:
            raise ValueError('DUMPCINEMA must include complete palette raster and POKEY writer registers')
        clock = int.from_bytes(prefix.with_suffix('.clock').read_bytes(), 'big')
        records.append({'frame': index, 'phase': phase, 'pc': pc(output), 'clock': clock,
                        'registers': list(raw[-9:]), 'randomReads': len(prefix.with_suffix('.random').read_bytes()),
                        'partialFrame': partial, 'rawSha256': hashlib.sha256(raw).hexdigest()})
    try:
        monitor.prompt(f'loadstate {args.title_state}')
        monitor.prompt('bline 999'); monitor.prompt('bpc 2505')
        monitor.prompt('c 9d 37'); monitor.prompt('c 9f 08'); monitor.prompt('c a3 00')
        monitor.prompt('setpc 2400'); monitor.prompt('cont')
        monitor.prompt('bpc a803'); monitor.prompt('setpc 2563'); monitor.prompt('cont')
        monitor.prompt(f'savestate {folder}/start.a8s'); monitor.prompt(f'write 0 ffff {folder}/start.bin')
        monitor.prompt(f'dumppalette {folder}/palette.act'); monitor.prompt(f'dumprandom {folder}/prelude.random')
        monitor.prompt('bpc aabc')
        while len(records) < 2000:
            for line in [0, 248]:
                monitor.prompt(f'bline {line}'); output = monitor.prompt('cont')
                if pc(output) == 0xAABC:
                    phase = 'hold'; hold_entry = len(records)
                    monitor.prompt(f'savestate {folder}/hold.a8s')
                    monitor.prompt(f'write 0 ffff {folder}/hold.bin')
                    monitor.prompt('bpc ffff'); output = monitor.prompt('cont')
            dump(len(records), output)
            if phase == 'hold':
                hold_count += 1
                if hold_count >= args.hold_frames:
                    break
            if len(records) % 200 == 0:
                print(f'Captured {len(records)} original frames ({phase})', flush=True)
        if phase != 'hold':
            raise RuntimeError('Original fixed introduction did not reach its input hold')
        monitor.prompt('bline 999'); monitor.prompt('bpc aabc'); monitor.prompt('cont')
        monitor.prompt('c 284 00'); monitor.prompt('bpc aae4'); monitor.prompt('cont')
        monitor.prompt(f'savestate {folder}/dismiss.a8s'); monitor.prompt(f'write 0 ffff {folder}/dismiss.bin')
        monitor.prompt(f'dumprandom {folder}/hold-tail.random')
        phase = 'closing'; monitor.prompt('bpc a800')
        closing_start = len(records)
        for _ in range(150):
            finished = False
            for line in [0, 248]:
                monitor.prompt(f'bline {line}'); output = monitor.prompt('cont')
                if pc(output) == 0xA800:
                    finished = True; break
            dump(len(records), output, partial=finished)
            if finished:
                monitor.prompt(f'savestate {folder}/return.a8s'); monitor.prompt(f'write 0 ffff {folder}/return.bin')
                break
        else:
            raise RuntimeError('Original closing wipe did not return to TITLE')
    finally:
        monitor.close()
    manifest = {'sourceSha256': SHA256, 'capture': 'Original 6502/ANTIC/POKEY offline in Atari800',
                'emulatorSha256': hashlib.sha256(args.emulator.read_bytes()).hexdigest(),
                'titleStateSha256': hashlib.sha256(args.title_state.read_bytes()).hexdigest(),
                'entry': '$A803 -> $A9B3', 'hold': '$AABC..$AAE2', 'dismiss': '$AAE4', 'return': '$AB12 -> $A800',
                'entryMethod': 'Run original level 55 setup $2400->$2505, then original completion wipe $2563->$A803.',
                'width': 384, 'height': 240, 'crop': {'left': 32, 'width': 320},
                'holdStartFrame': hold_entry, 'holdFrames': hold_count,
                'closingStartFrame': closing_start, 'closingFrames': len(records) - closing_start,
                'frames': records}
    (folder / 'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
    print(json.dumps({key: value for key, value in manifest.items() if key != 'frames'}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emulator', type=Path, default=Path('/private/tmp/robbo-research/ending-emulator/src/atari800'))
    parser.add_argument('--title-state', type=Path, default=Path('/private/tmp/robbo-research/native-title-entry.a8s'))
    parser.add_argument('--output', type=Path, default=Path('/private/tmp/robbo-research/ending'))
    parser.add_argument('--hold-frames', type=int, default=512)
    capture(parser.parse_args())
