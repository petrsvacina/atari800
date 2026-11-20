#!/usr/bin/env python3
"""Extract native Robbo title fonts/text and oracle its two display writers."""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
from robbo_capture_sound import ROOT, SHA256, Memory, processor, call


def b64(data):
    return base64.b64encode(bytes(data)).decode('ascii')


def typist_case(base, name, frames, clock=0, timer=255, cursor=0, offset=0, dirty=False):
    memory = Memory(base); cpu = processor(memory)
    screen = [(index * 19 + 7) & 255 for index in range(288)] if dirty else [0] * 288
    memory[0x1080:0x11A0] = screen
    memory[0xD200:0xD209] = [0] * 9
    memory[0xAA] = cursor
    address = 0xAE18 + offset
    memory[0x84:0x86] = [address & 255, address >> 8]
    memory[0x21C:0x21E] = [timer & 255, timer >> 8]
    result = []; ends = 0
    for frame in range(frames):
        timer_value = memory[0x21C] | memory[0x21D] << 8
        if timer_value:
            timer_value -= 1
            memory[0x21C:0x21E] = [timer_value & 255, timer_value >> 8]
        memory[0x14] = (clock + frame + 1) & 255
        memory.writes = []
        # Count the original FF command through its actual branch address.
        cpu.pc = 0xA8C9
        for _ in range(10000):
            if cpu.pc == 0xA948:
                break
            if cpu.pc == 0xA904:
                ends += 1
            cpu.step()
        else:
            raise RuntimeError('Original title writer did not reach NOPR')
        writes = memory.writes[:]
        kind = None
        if len(writes) == 3:
            kind = 'line' if writes[1] == [0, 2] else 'character'
        elif len(writes) == 5:
            kind = 'newline'
        result.append({'clock': memory[0x14], 'timer': memory[0x21C] | memory[0x21D] << 8,
                       'cursor': memory[0xAA], 'offset': (memory[0x84] | memory[0x85] << 8) - 0xAE18,
                       'screen': memory[0x1080:0x11A0], 'registers': memory[0xD200:0xD209],
                       'writes': writes, 'soundKind': kind, 'endCount': ends,
                       'demoRequested': memory[0x21D] == 1})
    return {'name': name, 'initial': {'clock': clock, 'timer': timer, 'cursor': cursor, 'offset': offset,
                                     'screen': screen}, 'frames': result}


class LogoMemory(Memory):
    def __init__(self, base, seed=0x31415926):
        super().__init__(base); self.seed = seed; self.random = []
    def __getitem__(self, address):
        if address == 0xD20A:
            value = self.seed
            value ^= (value << 13) & 0xFFFFFFFF; value ^= value >> 17
            value ^= (value << 5) & 0xFFFFFFFF
            self.seed = value & 0xFFFFFFFF
            result = self.seed >> 24
            self.random.append(result)
            return result
        return super().__getitem__(address)


def logo_case(base, colors, seed, direction):
    memory = LogoMemory(base, seed); cpu = processor(memory)
    memory[0x1000:0x1080] = [0] * 128
    memory[0xAC88:0xAC8A] = base[0xAC8A:0xAC8C]
    memory[0x2C3:0x2C9] = colors
    memory[0xAC57] = direction
    frames = []
    for frame in range(512):
        memory[0x14] = frame & 255; memory.random = []
        call(cpu, 0xABD8)
        frames.append({'clock': memory[0x14], 'screen': memory[0x1000:0x1080],
                       'mask': memory[0xAC88] << 8 | memory[0xAC89],
                       'direction': memory[0xAC57], 'colors': memory[0x2C3:0x2C9],
                       'random': memory.random[:]})
    return {'seed': seed, 'direction': direction, 'frames': frames}


def capture(ram):
    if hashlib.sha256((ROOT / 'Robbo.xex').read_bytes()).hexdigest() != SHA256:
        raise ValueError('Unexpected authority XEX revision')
    base = ram.read_bytes()
    if len(base) != 65536 or base[0xA800:0xA803] != bytes.fromhex('4c80a8'):
        raise ValueError('Expected decompressed native Robbo RAM')
    start, end = 0xAE18, base.index(255, 0xAE18) + 1
    colors = list(base[0xACB2:0xACB8])
    assets = {'sourceSha256': SHA256, 'clockHz': 1773447, 'vbiHz': 1773447 / (312 * 114),
              'font': b64(base[0x2000:0x2400]), 'credits': b64(base[0xAD55:0xAE15]),
              'instructions': b64(base[start:end]), 'instructionPrefix': list(base[start - 3:start]),
              'separator': list(base[0xAD45:0xAD55]),
              'displayList': list(base[0xACD4:0xAD0C]), 'colors': colors,
              'logoTiles': list(base[0xAC83:0xAC88]), 'logoGlyphs': b64(base[0x23E8:0x2400]),
              'maskSeed': list(base[0xAC8A:0xAC8C]),
              'layout': {'width': 256, 'canvasWidth': 320, 'left': 32,
                         'logoRows': [{'y': 21 + row * 5, 'height': 4} for row in range(8)],
                         'creditRows': [67, 79, 98, 106, 118, 126],
                         'typistRows': [147 + row * 8 for row in range(8)],
                         'separatorRows': [145, 212]},
              'colorChanges': [{'vcount': 36, 'writes': [[0xD017, 14], [0xD018, 0]]},
                               {'vcount': 48, 'writes': [[0xD017, 4]]},
                               {'vcount': 74, 'writes': [[0xD017, 6]]}]}
    destination = ROOT / 'robbo/assets/title.json'
    destination.write_text(json.dumps(assets, separators=(',', ':')) + '\n')
    cases = [typist_case(base, 'complete instruction stream and end pause', 6500),
             typist_case(base, 'wrap and cursor overflow', 192, clock=249, timer=0, cursor=31, dirty=True),
             typist_case(base, 'explicit newline with inverse glyphs', 128, timer=0, offset=13)]
    logos = [logo_case(base, colors, 0x31415926, 0), logo_case(base, colors, 0x17181920, 255)]
    fixture = {'sourceSha256': SHA256, 'ramSha256': hashlib.sha256(base).hexdigest(),
               'cases': cases, 'logos': logos,
               'metrics': {'typistVbis': sum(len(case['frames']) for case in cases),
                           'logoVbis': sum(len(case['frames']) for case in logos),
                           'pokeyWrites': sum(len(frame['writes']) for case in cases for frame in case['frames'])}}
    path = ROOT / 'tools/fixtures/robbo-title.json.gz'
    with gzip.GzipFile(filename=str(path), mode='wb', mtime=0) as output:
        output.write(json.dumps(fixture, separators=(',', ':')).encode())
    report = {'sourceSha256': SHA256, 'ramSource': str(ram), 'ramSha256': fixture['ramSha256'],
              'runtimeAsset': str(destination.relative_to(ROOT)),
              'runtimeAssetSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
              'ranges': {'font': ['$2000', '$23FF'], 'credits': ['$AD55', '$AE14'],
                         'instructions': [f'${start:04X}', f'${end - 1:04X}'], 'logoGlyphs': ['$23E8', '$23FF']},
              'metrics': fixture['metrics'],
              'timing': {'initialTimer': 255, 'characterTimer': '2 + (glyph & 3) VBIs',
                         'newlineTimer': 15, 'cursor': 'RTCLOK low byte bit 3',
                         'endTimer': 1039, 'demo': 'Original starts demonstration when timer high byte reaches 1.'},
              'layout': {'screenAddress': '$1000', 'visibleTypist': ['$1080', '$117F'],
                         'blankScrollSource': ['$1180', '$119F'], 'columns': 32, 'visibleRows': 8,
                         'scroll': 'Copy 256 bytes from $10A0..$119F to $1080..$117F; one line each 15 VBIs.'},
              'limits': ['Logo/typist writers verified. Full title ANTIC raster, OS countdown integration and automatic demo launch belong to the main wrapper.']}
    (ROOT / 'research/robbo/title.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(fixture['metrics']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ram', type=Path, default=Path('/private/tmp/robbo-research/native-unpacked.bin'))
    capture(parser.parse_args().ram)
