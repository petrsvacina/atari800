#!/usr/bin/env python3
"""Capture International Karate scenes with the original raster/PMG registers.

Atari800 is used only during extraction. The browser receives plain PNG images.
A private ATR copy and temporary RAM/state dumps protect the supplied source.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import pty
import re
import select
import shutil
import subprocess
import tempfile
import time

from extract_assets import png

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA256 = 'b30ddd0920a00a99d8b41d97b24d72cc57150e73e9a3686e0f35cb74f3b62bec'
NAMES = ['Sydney', 'New York', 'Rio de Janeiro', 'Japonsko', 'Egypt', 'Atény', 'Hora Fudži']


class Monitor:
    def __init__(self, image):
        self.master, slave = pty.openpty()
        self.process = subprocess.Popen(
            [shutil.which('atari800') or '/opt/homebrew/bin/atari800',
             '-no-autosave-config', '-nosound', '-no-video-accel', '-nobasic',
             '-pal', '-turbo', '-monitor', str(image)],
            stdin=slave, stdout=slave, stderr=slave, start_new_session=True,
            env={**os.environ, 'SDL_VIDEODRIVER': 'dummy', 'SDL_AUDIODRIVER': 'dummy'})
        os.close(slave)
        self.prompt()

    def prompt(self, command=None):
        if command:
            os.write(self.master, (command + '\n').encode())
        output = b''
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if select.select([self.master], [], [], .1)[0]:
                output += os.read(self.master, 65536)
                if output.endswith(b'> '):
                    return output.decode(errors='replace')
            if self.process.poll() is not None:
                break
        raise RuntimeError(f'Monitor did not return: {command!r}, {output[-500:]!r}')

    def close(self):
        if self.process.poll() is None:
            os.write(self.master, b'quit\n')
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        os.close(self.master)


def capture(source, palette):
    """Boot, invoke the original next-scene loader, then capture each raster line."""
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unsupported original ATR; addresses are specific to this supplied disk.')
    with tempfile.TemporaryDirectory(prefix='international-karate-scenes-') as folder:
        folder = Path(folder)
        image = folder / 'source.atr'
        shutil.copyfile(source, image)
        monitor = Monitor(image)
        try:
            monitor.prompt('bpc 3c06')
            monitor.prompt('cont')
            monitor.prompt('bpc 2f33')
            monitor.prompt('cont')
            monitor.prompt('bpc ffff')
            state = folder / 'scene-zero.a8s'
            monitor.prompt(f'savestate {state}')
            memories = []
            # Call only while paused in the main thread, never inside a DLI.
            for scene in range(7):
                if scene:
                    monitor.prompt('r 4389')
                memory = folder / f'scene-{scene}.bin'
                monitor.prompt(f'write 0 bfff {memory}')
                data = memory.read_bytes()
                if len(data) != 49152 or data[0x5C] != scene or data[0xBF58] != scene:
                    raise ValueError(f'Original scene loader did not reach scene {scene}.')
                memories.append(data)
            scenes = []
            for scene, memory in enumerate(memories):
                monitor.prompt(f'loadstate {state}')
                monitor.prompt('bpc ffff')
                bitmap = folder / 'bitmap.bin'
                bitmap.write_bytes(memory[0xB000:0xC000])
                monitor.prompt(f'read {bitmap} b000')
                monitor.prompt(f'c 5c {scene:02x}')
                monitor.prompt('r 3451')  # Original display-list/raster setup for scene.
                # Temporarily replace a few sample-RAM bytes with an idle loop,
                # so scene logic cannot advance during background capture.
                # Original VBI/DLI handlers still run; sound is not being captured
                # here and this RAM is never exported as an audio source.
                monitor.prompt('c 9f00 4c 00 9f')
                monitor.prompt('setpc 9f00')
                registers = []
                for line in range(40, 138):
                    monitor.prompt(f'bline {line}')
                    monitor.prompt('cont')
                    output = monitor.prompt('gtia')
                    registers.append({key: int(value, 16) for key, value in
                                      re.findall(r'([A-Z]+[0-9]?)=\s*([0-9A-F]{2})', output)})
                scenes.append({'id': scene, 'name': NAMES[scene],
                               'bitmap': base64.b64encode(memory[0xB000:0xBF50]).decode(),
                               'registers': registers})
                print(f'Captured original scene {scene}: {NAMES[scene]}', flush=True)
        finally:
            monitor.close()
    return {'sourceSha256': SOURCE_SHA256, 'width': 320, 'height': 98,
            'palette': list(palette), 'scenes': scenes}


def export(data):
    dest = ROOT / 'karate/assets/backgrounds'
    dest.mkdir(parents=True, exist_ok=True)
    reference_file = ROOT / 'research/international-karate/reference-palette.json'
    reference = json.loads(reference_file.read_text()) if reference_file.exists() else None
    palette = bytes(reference['palette'] if reference else data['palette'])
    if len(palette) != 768:
        raise ValueError('Expected a 256-entry RGB palette.')
    manifest = {'sourceSha256': data['sourceSha256'], 'paletteIsApproximate': True,
                'width': 320, 'height': 98, 'scenes': []}
    if reference:
        manifest['paletteReference'] = {
            'kind': reference['source'], 'videoSha256': reference['videoSha256'],
            'frameSeconds': reference['frameSeconds'],
            'observedColors': reference['observedColors'],
            'unobservedColors': 'Approximate extrapolation; the reference video shows Sydney only.'}
    for scene in data['scenes']:
        memory = base64.b64decode(scene['bitmap'])
        pixels = bytearray()
        for y, regs in enumerate(scene['registers']):
            for x in range(320):
                value = memory[y * 40 + x // 8] >> (6 - (x % 8 // 2) * 2) & 3
                player = None
                for p in range(4):
                    size = (1, 2, 1, 4)[regs[f'SIZEP{p}'] & 3]
                    dx = x - (regs[f'HPOSP{p}'] - 48) * 2
                    if 0 <= dx < 8 * size * 2 and regs[f'GRAFP{p}'] >> (7 - dx // (size * 2)) & 1:
                        player = p
                        break
                    size = (1, 2, 1, 4)[regs['SIZEM'] >> (p * 2) & 3]
                    dx = x - (regs[f'HPOSM{p}'] - 48) * 2
                    if 0 <= dx < 2 * size * 2 and regs['GRAFM'] >> (p * 2 + 1 - dx // (size * 2)) & 1:
                        player = p
                        break
                color = regs['COLBK'] if value == 0 else regs[f'COLPF{value - 1}']
                # Original priority 04: all PF0–PF3 are in front of PMG.
                # (Priority 08, not 04, places PMG in front of PF2/PF3.) These scenes use
                # solid PMG masks to add color regions to a 4-color bitmap.
                if player is not None and ((regs['PRIOR'] & 4 and value == 0) or
                                           (regs['PRIOR'] & 8 and value not in (1, 2)) or
                                           regs['PRIOR'] & 1):
                    color = regs[f'COLPM{player}']
                pixels += palette[color * 3:color * 3 + 3] + b'\xff'
        output = dest / f"scene-{scene['id']}.png"
        png(output, 320, 98, pixels)
        manifest['scenes'].append({'id': scene['id'], 'name': scene['name'],
                                   'file': output.name,
                                   'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
    (dest / 'provenance.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
    print(f'Exported {len(manifest["scenes"])} original 320×98 scenes into {dest}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', action='store_true', help='Boot original disk and recapture all scenes')
    parser.add_argument('--palette', type=Path, default=Path('/Users/gmork/Games/Atari800/Palettes/Default.act'))
    args = parser.parse_args()
    stored = ROOT / 'research/international-karate/background-data.json'
    if args.capture:
        data = capture(ROOT / 'International Karate.atr', args.palette.read_bytes())
        stored.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n')
    else:
        data = json.loads(stored.read_text())
    export(data)
