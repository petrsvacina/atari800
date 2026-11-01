#!/usr/bin/env python3
"""Development-only Atari800 reference captures; source disks remain untouched."""
import argparse
import base64
import json
import os
from pathlib import Path
import pty
import shutil
import subprocess
import tempfile
import wave

from karate_extract_backgrounds import Monitor
from neverstory_extract import ROOT, SOURCES, extract


class Capture(Monitor):
    def __init__(self, executable, image, audio=False):
        self.master, slave = pty.openpty()
        self.process = subprocess.Popen(
            [str(executable), '-no-autosave-config', *([] if audio else ['-nosound']),
             '-no-video-accel', '-nobasic', '-xe', '-pal', '-turbo', '-refresh', '1', '-monitor', str(image)],
            stdin=slave, stdout=slave, stderr=slave, start_new_session=True,
            env={**os.environ, 'SDL_VIDEODRIVER': 'dummy', 'SDL_AUDIODRIVER': 'dummy'})
        os.close(slave)
        self.prompt()

    def frame(self):
        for line in (0, 248):
            self.prompt(f'bline {line}'); self.prompt('cont')


def capture(args):
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='neverstory-capture-') as folder:
        tmp = Path(folder)
        for lang, (source, _) in SOURCES.items():
            disk = tmp / source; shutil.copyfile(ROOT / source, disk)
            reference = extract(lang)  # Includes source SHA256 validation.
            m = Capture(args.emulator, disk)
            try:
                m.prompt('bpc 8fe9'); m.prompt('cont'); m.prompt('bpc ffff')
                # Development keyboard stub only: advance the title/load prompt.
                m.prompt('c 8dcd a9 20 60'); m.prompt('bpc 64a1'); m.prompt('cont'); m.prompt('bpc ffff')
                m.prompt(f'write 0000 ffff {args.output}/{lang}-game.bin')
                state = args.output / f'{lang}-game.a8s'; m.prompt(f'savestate {state}')
                m.prompt('c 1000 4c 00 10'); m.prompt('setpc 1000'); m.frame()
                m.prompt(f'DUMPSCREEN {args.output}/{lang}-game.screen')
                for slot in range(6): m.prompt(f'c {0x8430 + slot * 6:04x} 00')
                for chapter, part in enumerate(reference['chapters']):
                    graphics = tmp / 'graphics.bin'; graphics.write_bytes(base64.b64decode(part['graphics']))
                    m.prompt(f'read {graphics} 2000')
                    images = sorted(set(reference['roomImages'][part['base']:part['base'] + len(part['rooms'])]))
                    for image in images:
                        m.prompt('bline 999'); m.prompt('c 1000 20 74 63 4c 03 10'); m.prompt('setpc 1000')
                        m.prompt(f'c 842c {image:02x}'); m.prompt('bpc 1003'); m.prompt('cont'); m.prompt('bpc ffff')
                        m.frame(); m.prompt(f'DUMPSCREEN {args.output}/{lang}-picture-{chapter}-{image}.screen')
                print('Captured original', lang, flush=True)
            finally: m.close()
            if args.music and lang == 'en':
                m = Capture(args.emulator, disk, audio=True)
                try:
                    m.prompt(f'loadstate {state}'); m.prompt('bpc ffff'); m.prompt('bline 999')
                    m.prompt('c 1000 20 11 98 4c 03 10'); m.prompt('setpc 1000'); m.prompt('bpc 9f1b'); m.prompt('cont'); m.prompt('bpc ffff')
                    # Exactly 3584 PAL frames; $FA/$FB are an offline counter.
                    m.prompt('c 1000 a9 00 85 fa a9 0d 85 fb ad 0b d4 c9 7c b0 f9 ad 0b d4 c9 7c 90 f9 c6 fa d0 ee c6 fb 10 ea 4c 21 10')
                    m.prompt('setpc 1000'); m.prompt('bpc 1021')
                    m.prompt(f'record {args.output}/music-full.wav'); m.prompt('cont'); m.prompt('stoprecord')
                finally: m.close()


def audio(args):
    import hashlib
    wav = args.output / 'music-full.wav'; mp3 = args.output / 'music-full.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '128k', str(mp3)], check=True)
    with wave.open(str(wav), 'rb') as f: duration = f.getnframes() / f.getframerate()
    asset = {'encoding': 'mp3', 'loopStart': duration / 2, 'loopEnd': duration, 'data': base64.b64encode(mp3.read_bytes()).decode()}
    (ROOT / 'neverending-story/assets/audio.js').write_text(
        '// Original POKEY music rendered offline. See research/neverending-story/README.md.\n'
        + 'globalThis.NEVERENDING_AUDIO=' + json.dumps(asset, separators=(',', ':')) + ';\n')
    manifest = {'source': SOURCES['en'][0], 'sourceSha256': SOURCES['en'][1],
                'player': '$9811 init, $9800 per PAL VBI', 'render': 'Atari800 POKEY, original CPU offline only',
                'frames': 3584, 'statePeriod': {'first': 1792, 'repeat': 3584, 'frames': 1792},
                'loopStart': duration / 2, 'loopEnd': duration,
                'wavSha256': hashlib.sha256(wav.read_bytes()).hexdigest(), 'mp3Sha256': hashlib.sha256(mp3.read_bytes()).hexdigest()}
    (ROOT / 'research/neverending-story/audio.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emulator', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--music', action='store_true', help='Requires Atari800 RECORD/STOPRECORD development support')
    args = parser.parse_args(); args.output = args.output.resolve()
    capture(args)
    if args.music: audio(args)
