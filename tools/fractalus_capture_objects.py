#!/usr/bin/env python3
"""Extract ground-object bitmap data and execute the supplied disk's painters.

Only original image data and graphical/state results are exported. This offline
oracle does not approximate a CPU in the browser or use another port's output.
"""
import base64
import gzip
import json
from pathlib import Path

from fractalus_original import ROOT, SHA256, image, processor, call


class Memory(list):
    def __init__(self, base, chance=255):
        super().__init__(base)
        self.chance = chance
        self.cpu = None
        self.trace = []

    def __getitem__(self, address):
        if address == 0xD20A:
            self.trace.append([self.cpu.pc - 1, self.chance])
            return self.chance
        return super().__getitem__(address)


def b64(data):
    return base64.b64encode(bytes(data)).decode()


def word(mem, address, value):
    mem[address:address + 2] = [value & 255, value >> 8]


def vector(mem, lo, hi, index, value):
    mem[lo + index] = value & 255
    mem[hi + index] = (value >> 8) & 255


def read_field(mem, half):
    return b64([mem[0x1010 + row * 96 + half + col] for row in range(48) for col in range(48)])


def metadata(mem):
    return {
        'reflect': mem[0x290F], 'groundVisible': mem[0x28FB], 'anyVisible': mem[0x28FC],
        'target': dict(zip(['cost', 'distance', 'dx', 'dy', 'kind', 'reflect'],
                           [mem[a] for a in [0x2915, 0x2914, 0x2912, 0x2913, 0x2910, 0x2911]])),
        'span': dict(zip(['maximum', 'range', 'side', 'depth', 'cell', 'x', 'y'],
                         [mem[a] for a in [0x28EA, 0x79, 0x28E7, 0x28E8, 0x28E6, 0x3F, 0x40]])),
        'shot': dict(zip(['depth', 'x', 'y'], [mem[a] for a in [0x28ED, 0x28EB, 0x28EC]])),
    }


def setup(base, number, half=0, occlusion=False, context=None):
    mem = Memory(base, chance=255 if number & 1 else 0)
    cpu = mem.cpu = processor(mem)
    call(cpu, 0x7813)
    mem[0xC1] = 96
    word(mem, 0xC3, 0x1010)
    call(cpu, 0x7460)
    call(cpu, 0x7483)
    for column in range(32, 216):
        mem[0xBD00 + column] = half + ((column - 32) >> 2)
    skyline = [255] * 256
    skyline[44:212] = [103] * 168
    skyline[64:196] = [107] * 132
    if occlusion:
        for column in range(44, 212):
            skyline[column] = max(skyline[column], 112 + ((column * 7 + number) % 37))
    mem[0x260E:0x270E] = skyline
    # Both display halves are initialized; the comparison retains only the one
    # the original source was told to paint into.
    for row in range(48):
        for column in range(96):
            mem[0x1010 + row * 96 + column] = 0 if number & 1 else ((row * 11 + column * 19) & 255)
    initial = {
        'half': half, 'deathPhase': 0, 'altitudeHigh': 16, 'movingObjectMode': 255,
        'reflect': number & 1, 'groundVisible': 0, 'anyVisible': 0,
        'target': {'cost': 128, 'distance': 128, 'dx': 128, 'dy': 128, 'kind': 0, 'reflect': 0},
        'span': {'maximum': 128, 'range': 128, 'side': 128, 'depth': 128, 'cell': 0, 'x': 37, 'y': 100},
        'shot': {'depth': 0, 'x': 0, 'y': 0},
    }
    initial.update(context or {})
    for name, address in [('half', 0xA7), ('deathPhase', 0x3E), ('altitudeHigh', 0x34), ('movingObjectMode', 0x6A),
                          ('reflect', 0x290F), ('groundVisible', 0x28FB), ('anyVisible', 0x28FC)]:
        mem[address] = initial[name]
    for field, names, addresses in [
        ('target', ['cost', 'distance', 'dx', 'dy', 'kind', 'reflect'], [0x2915, 0x2914, 0x2912, 0x2913, 0x2910, 0x2911]),
        ('span', ['maximum', 'range', 'side', 'depth', 'cell', 'x', 'y'], [0x28EA, 0x79, 0x28E7, 0x28E8, 0x28E6, 0x3F, 0x40]),
        ('shot', ['depth', 'x', 'y'], [0x28ED, 0x28EB, 0x28EC])]:
        for name, address in zip(names, addresses):
            mem[address] = initial[field][name]
    return mem, cpu, {'field': read_field(mem, half), 'skyline': b64(skyline), 'context': initial}


def capture():
    base = image()
    pointers = [base[0xA7E9 + i] | base[0xA7ED + i] << 8 for i in range(4)]
    shapes = {'base': list(base[0xA6F9:0xA729]), 'ship': list(base[0xA7F1:0xA821]),
              'changed': [list(base[p:p + 48]) for p in pointers]}
    assets = {'sourceSha256': SHA256, 'width': 32, 'height': 12, 'shapes': shapes}
    asset_path = ROOT / 'rescue-on-fractalus/assets/objects.json'
    asset_path.write_text(json.dumps(assets, separators=(',', ':')) + '\n')
    forms = [('base', 0xA6F9), ('ship', 0xA7F1)] + [(f'changed{i}', p) for i, p in enumerate(pointers)]
    scaled = []
    for form, pointer in forms:
        for step in [0, 255, 256, 385, 768, 1792, 3072, 3327]:
            for reflection in [0, 1]:
                n = len(scaled)
                half = 48 if n % 3 == 0 else 0
                mem, cpu, initial = setup(base, n, half, n % 3 == 1)
                x, y = [48, 80, 128, 196, 210][n % 5], [104, 112, 135, 145, 150, 151][n % 6]
                mem[0x4F], mem[0x4E], mem[0x28DF], mem[0x58] = x, y, reflection, 255 if n & 1 else 170
                word(mem, 0x50, step)
                word(mem, 0x28DC, pointer)
                call(cpu, 0xAB9A, limit=2000000)
                scaled.append({'form': form, 'x': x, 'y': y, 'step': step, 'reflect': bool(reflection),
                               'value': 3 if n & 1 else 2, **initial, 'after': read_field(mem, half)})
    print(f'Captured {len(scaled)} original scaled-object cases', flush=True)

    dispatch = []
    variants = [
        {'depth': 32}, {'depth': 34}, {'depth': 255}, {'depth': 256},
        {'depth': 385, 'occlusion': True}, {'depth': 1279, 'x': 50},
        {'depth': 3327}, {'depth': 3328}, {'depth': 4608, 'altitudeHigh': 56},
        {'depth': 1024, 'x': 256}, {'depth': 1024, 'y': 0xFF80},
        {'depth': 513, 'x': 196, 'y': 150, 'half': 48},
        {'depth': 1024, 'deathPhase': 1},
        {'depth': 1024, 'movingObjectMode': 0, 'occlusion': True},
    ]
    for tower in [False, True]:
        for occupant in [0, 1, 2, 100, 200, 247, 248, 249, 250, 251, 252, 253, 254, 255]:
            for variation in variants:
                n = len(dispatch)
                index = n % 45
                x, y = variation.get('x', 128), variation.get('y', 140)
                half = variation.get('half', 0)
                options = {k: v for k, v in variation.items() if k in ['altitudeHigh', 'deathPhase', 'movingObjectMode']}
                if n % 5 == 0:
                    options['shot'] = {'depth': 4, 'x': 17, 'y': 99}
                mem, cpu, initial = setup(base, n, half, variation.get('occlusion', False), options)
                map_index, map_height = (index * 67 + 15) & 255, (128 if tower else 0) | (n & 1)
                relative_x = [0, 0xFF80, 0x8000, 0x7FFF, 0x0100, 0x0200, 0xFE00][n % 7]
                mem[0x2276 + index] = map_index
                mem[0x0900 + map_index] = map_height
                mem[0x0A00 + map_index] = occupant
                mem[0x23B5 + index] = map_height
                vector(mem, 0x2400, 0x242D, index, x)
                vector(mem, 0x245A, 0x2487, index, y)
                vector(mem, 0x22A4, 0x22D2, index, relative_x)
                vector(mem, 0x2300, 0x232E, index, variation['depth'])
                cpu.x = index
                call(cpu, 0xA63B, limit=2000000)
                dispatch.append({
                    'index': index, 'x': x, 'y': y, 'depth': variation['depth'], 'relativeX': relative_x,
                    'mapIndex': map_index, 'mapHeight': map_height, 'occupant': occupant,
                    **initial, 'after': read_field(mem, half), 'metadata': metadata(mem), 'random': mem.trace,
                })
    print(f'Captured {len(dispatch)} original ground-object dispatch cases', flush=True)
    result = {
        'sourceSha256': SHA256, 'scaled': scaled, 'dispatch': dispatch,
        'limits': ['Isolated original calls with injected RANDOM values, not a continuous mission',
                   'Cockpit, enemy-flight sprites, rescuer approach and Jaggi animation are separate painters'],
    }
    output = ROOT / 'tools/fixtures/fractalus-objects.json.gz'
    output.write_bytes(gzip.compress(json.dumps(result, separators=(',', ':')).encode(), mtime=0))
    print(f'Wrote {output} ({output.stat().st_size} bytes)', flush=True)


if __name__ == '__main__':
    capture()
