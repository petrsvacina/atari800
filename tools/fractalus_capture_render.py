#!/usr/bin/env python3
"""Whole original populated terrain passes, with exact instruction-cycle counts.

No VBI is injected. Counts include the caller's JSR cost, but exclude ANTIC DMA
steals and interrupts, so they are not asserted to equal original wall time.
"""
import argparse
import base64
import gzip
import hashlib
import json
import random
import re
from pathlib import Path
from fractalus_original import ROOT, SHA256, MAIN_SHA256, processor

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--reference', type=Path, default=Path('/private/tmp/fractalus-disk-research/flight-init.bin'))
args = parser.parse_args()
base = args.reference.read_bytes()
assert len(base) == 65536 and hashlib.sha256(base[0x3CDE:0x3CDE+31500]).hexdigest() == MAIN_SHA256


def layout(file, symbol):
    text = file.read_text().split(f'export const {symbol}', 1)[1].split('{', 1)[1].split('};', 1)[0]
    return {name: (int(address, 16), int(width)) for name, address, width in
            re.findall(r'(\w+):\s*\[(0x[\da-f]+),\s*([123])\]', text)}


fields = {}
for file, symbol in [('flight.mjs', 'FLIGHT_FIELDS'), ('flight-services.mjs', 'SERVICE_FIELDS'),
                     ('systems.mjs', 'SYSTEM_FIELDS'), ('rescue.mjs', 'RESCUE_FIELDS'), ('combat.mjs', 'COMBAT_FIELDS')]:
    fields.update(layout(ROOT/'rescue-on-fractalus'/file, symbol))


class Memory(list):
    def __init__(self, data, seed):
        super().__init__(data); self.seed = seed; self.trace = []; self.cpu = None
    def __getitem__(self, address):
        if address == 0xD20A:
            value = self.seed
            value ^= value << 13 & 0xFFFFFFFF; value ^= value >> 17; value ^= value << 5 & 0xFFFFFFFF
            self.seed = value & 0xFFFFFFFF
            result = self.seed >> 24; self.trace.append([self.cpu.pc-1, result]); return result
        return super().__getitem__(address)


def read(mem):
    state = {name: int.from_bytes(mem[address:address+width], 'little') for name, (address, width) in fields.items()}
    state['eventRing'] = mem[0x719:0x739]; state['terrainScreenSpans'] = mem[0x28B6:0x28D6]
    return state


def bitmap(mem, half):
    return base64.b64encode(bytes(mem[0x1010 + row*96 + half + column] for row in range(48) for column in range(48))).decode()


def metadata(mem):
    return {'reflect': mem[0x290F], 'groundVisible': mem[0x28FB], 'anyVisible': mem[0x28FC],
            'target': dict(zip(['cost', 'distance', 'dx', 'dy', 'kind', 'reflect'],
                               [mem[a] for a in [0x2915, 0x2914, 0x2912, 0x2913, 0x2910, 0x2911]])),
            'span': dict(zip(['maximum', 'range', 'side', 'depth', 'cell', 'x', 'y'],
                             [mem[a] for a in [0x28EA, 0x79, 0x28E7, 0x28E8, 0x28E6, 0x3F, 0x40]])),
            'shot': dict(zip(['depth', 'x', 'y'], [mem[a] for a in [0x28ED, 0x28EB, 0x28EC]]))}


ENTRY_POINTS = {'project': 0xA11F, 'object': 0xA63B, 'tower': 0xA822, 'ship': 0xA90A,
                'scaled': 0xAB9A, 'objectPixel': 0xA6D3, 'segments': 0xB172,
                'midpoints': 0xB2CC, 'leaves': 0xB33D}


def timed_call(cpu, address, counts, limit=2000000):
    mem = cpu.memory; cpu.sp = 0xFD; mem[0x1FE:0x200] = [0xFC, 0x3B]; cpu.pc = address
    start = cpu.processorCycles; tail_start = None; meta = None
    for _ in range(limit):
        pc = cpu.pc
        if pc == 0x3BFD: break
        for name, entry in ENTRY_POINTS.items():
            if pc == entry: counts[name] += 1
        if pc == 0xA433:
            tail_start = cpu.processorCycles; meta = metadata(mem)
        cpu.step()
    else: raise RuntimeError(f'Render did not return: ${cpu.pc:04X}')
    cycles = cpu.processorCycles - start + 6
    return cycles, cpu.processorCycles - tail_start if tail_start is not None else 0, meta


rng = random.Random(0x52454E44)
views = [dict(heading=heading, x=0x1317, z=0xA71, altitude=altitude, pitch=0, roll=0)
         for heading in [0, 512, 1024, 2048, 4096, 6144, 8192, 10240, 12288, 14336]
         for altitude in [0x1000, 0x3000, 0x4F00]]
views.extend(dict(heading=rng.randrange(16384), x=rng.randrange(65536), z=rng.randrange(65536),
                  altitude=rng.randrange(0x5000), pitch=rng.randrange(-3072, 3072)&65535,
                  roll=rng.randrange(-1280, 1280)&65535) for _ in range(42))
cases = []
for number, camera in enumerate(views):
    for half in [0, 48]:
        mem = Memory(base, seed=0x13579BDF + number*7919 + half); cpu = mem.cpu = processor(mem); cpu.p = 0x20
        for name, address in [('heading', 0x2885), ('x', 0x2887), ('z', 0x2889), ('altitude', 0x33), ('pitch', 0x28), ('roll', 0x23)]:
            mem[address:address+2] = list(camera[name].to_bytes(2, 'little'))
        mem[4] = number % 4 != 0; mem[0x3E] = 0; mem[0x36] = 0
        mem[0x6A] = 255; mem[0x63] = 255; mem[0x3D] = 0
        mem[0x41] = number % 3; mem[0x2843] = number % 2
        mem[0x6D] = [4, 15, 32][number % 3]
        mem[0x621] = 20; mem[0x622] = 1 if number % 3 == 2 else 7
        if number >= 30:
            # A populated transition stress map retains the supplied terrain;
            # these are original marker values, never replacement rules.
            for cell in range(256): mem[0xA00 + cell] = [0, 1, 100, 128, 200, 248, 249, 250, 251, 252, 253, 254, 255][(cell*7 + number) % 13]
        if half:
            mem[0x28EA] = 64; mem[0x79] = 31
        before = read(mem); horizon = mem[0x2159:0x21A9]
        projected_x=[mem[0x2400+i]+256*mem[0x242d+i] for i in range(45)]
        projected_y=[mem[0x245a+i]+256*mem[0x2487+i] for i in range(45)]
        terrain = mem[0x900:0xA00]; occupants = mem[0xA00:0xB00]
        before_field = bitmap(mem, half)
        counts = dict.fromkeys(ENTRY_POINTS, 0); stages = {}
        stages['geometry'], _, _ = timed_call(cpu, 0x9E54, counts)
        cpu.x = half + 3; stages['clear'], _, _ = timed_call(cpu, 0xAD5F, counts)
        cpu.x = half; stages['draw'], stages['effects'], context = timed_call(cpu, 0xA31E, counts)
        exit_index = cpu.x
        cpu.x = half + 3; stages['fill'], _, _ = timed_call(cpu, 0xAE53, counts)
        stages['total'] = stages['geometry'] + stages['clear'] + stages['draw'] + stages['fill']
        cases.append({'camera': camera, 'half': half, 'before': before, 'beforeField': before_field,'projectedX':projected_x,'projectedY':projected_y,
                      'terrain': terrain, 'objects': occupants, 'horizonCells': horizon,
                      'after': read(mem), 'afterObjects': mem[0xA00:0xB00],
                      'afterField': bitmap(mem, half), 'skyline': mem[0x260E:0x270E],
                      'metadata': context, 'random': mem.trace[:], 'exitIndex': exit_index,
                      'cpuCycles': stages, 'originalWork': counts,
                      'clock': {'before': [before['clock'], base[0x62D], base[0x643]],
                                'after': [mem[0x14], mem[0x62D], mem[0x643]]}})
    if number % 12 == 0: print(f'Captured {number+1}/{len(views)} views, both halves', flush=True)
result = {'sourceSha256': SHA256, 'referenceSha256': hashlib.sha256(base).hexdigest(), 'fields': fields, 'cases': cases,
          'limits': ['No VBI or ANTIC DMA steals during these isolated coupled passes',
                     'Cycle counts include original JSR/RTS, not wall-time cadence or VBI interruptions',
                     'Cases30 onward use original marker-value stress combinations, not claimed reachable whole-game states'],
          'metrics': {'passes': len(cases), 'randomReads': sum(len(c['random']) for c in cases),
                      'cpuCycles': sum(c['cpuCycles']['total'] for c in cases)}}
target = ROOT/'tools/fixtures/fractalus-render.json.gz'
target.write_bytes(gzip.compress(json.dumps(result, separators=(',', ':')).encode(), mtime=0))
print(json.dumps(result['metrics'], indent=2)); print(target, target.stat().st_size)
