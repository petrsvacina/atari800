#!/usr/bin/env python3
"""Capture original world routines and ordered RANDOM reads, offline only.

The fixture contains maps, byte-source traces and results, never executable
Atari code. POKEY cycle phase and the surrounding mission loop are not modeled.
"""
import argparse
import base64
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path

from fractalus_original import ROOT, SHA256, MAIN_SHA256, image, processor, call


class RandomMemory(list):
    def __init__(self, ram, seed, gate=None):
        super().__init__(ram)
        self.seed = seed or 1
        self.gate = gate
        self.cpu = None
        self.trace = []

    def __getitem__(self, address):
        if address == 0xD20A:
            # This is a replayable fixture input source, not an Atari LFSR model.
            x = self.seed
            x ^= (x << 13) & 0xFFFFFFFF
            x ^= x >> 17
            x ^= (x << 5) & 0xFFFFFFFF
            self.seed = x & 0xFFFFFFFF
            value = self.seed >> 24
            # py65's absolute load reads memory while PC points at its operand.
            site = self.cpu.pc - 1
            if site == 0x70B8 and self.gate is not None:
                value = self.gate
            self.trace.append([site, value])
            if len(self.trace) > 200000:
                raise RuntimeError('Fixture byte stream did not allow world creation to terminate')
            return value
        return super().__getitem__(address)


def encoded(values):
    return base64.b64encode(bytes(values)).decode('ascii')


def snapshot(memory):
    return {
        'terrain': encoded(memory[0x0900:0x0A00]),
        'objects': encoded(memory[0x0A00:0x0B00]),
    }


def pipeline_case(base, level, seed, gate=None):
    mem = RandomMemory(base, seed, gate)
    cpu = mem.cpu = processor(mem)
    visible = [((i * 43 + seed) & 255) for i in range(45)] if seed & 1 else [0] * 45
    mem[0x2276:0x22A3] = visible
    mem[0x006D] = level
    # Derive the emplacement probability using the original level routine too.
    call(cpu, 0x75F5)
    density = mem[0x0623]
    assert not mem.trace
    # Prove that pre-existing maps are overwritten by the appropriate stages.
    terrain_before = [(i * 17 + seed) & 255 for i in range(256)]
    objects_before = [(i * 31 + seed) & 255 for i in range(256)]
    mem[0x0900:0x0A00] = terrain_before
    mem[0x0A00:0x0B00] = objects_before
    stages = []
    for address in [0x6FBF, 0x70B3, 0x7498]:
        call(cpu, address, limit=2000000)
        stages.append({**snapshot(mem), 'randomReads': len(mem.trace)})
    return {
        'level': level, 'seed': seed, 'forcedUnmarkGate': gate, 'density': density,
        'visibleCells': visible, 'terrainBefore': encoded(terrain_before),
        'objectsBefore': encoded(objects_before), 'stages': stages, 'random': mem.trace,
    }


def placement_case(base, name, terrain, objects, visible, count, value, seed):
    mem = RandomMemory(base, seed)
    cpu = mem.cpu = processor(mem)
    mem[0x0900:0x0A00] = terrain
    mem[0x0A00:0x0B00] = objects
    mem[0x2276:0x22A3] = visible
    cpu.y = count & 255
    cpu.a = value
    call(cpu, 0x4E1C, limit=2000000)
    return {
        'name': name, 'terrain': encoded(terrain), 'objectsBefore': encoded(objects),
        'visibleCells': visible, 'count': count, 'value': value,
        'objectsAfter': encoded(mem[0x0A00:0x0B00]), 'random': mem.trace,
    }


def capture():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'tools/fixtures/fractalus-world.json.gz')
    args = parser.parse_args()
    base = image()
    configs = [(level, seed, None)
               for level in [1, 2, 3, 4, 5, 8, 15, 16, 23, 31, 43, 44, 50, 64, 99, 255]
               for seed in [0x13579BDF, 0x52697664]]
    configs += [(level, seed, gate)
                for level in [2, 4, 16, 64]
                for seed in [0x01020304, 0xA341316C]
                for gate in [0, 7]]
    pipelines = []
    for index, (level, seed, gate) in enumerate(configs):
        pipelines.append(pipeline_case(base, level, seed, gate))
        if (index + 1) % 8 == 0:
            print(f'Captured {index + 1}/{len(configs)} original world pipelines', flush=True)

    empty = [0] * 256
    visible = list(range(45))
    floor = [0] * 256
    one_floor = [128] * 256
    one_floor[255] = 0
    placements = [
        placement_case(base, 'all high terrain', [128] * 256, empty, visible, 16, 200, 1),
        placement_case(base, 'all occupied', floor, [1] * 256, visible, 8, 200, 2),
        placement_case(base, 'only one eligible cell', one_floor, empty, visible, 16, 200, 3),
        placement_case(base, 'one eligible cell hidden by projection', one_floor, empty, [255] * 45, 4, 1, 4),
        placement_case(base, 'open floor with projected cells excluded', floor, empty, visible, 16, 200, 5),
        placement_case(base, 'height 47 eligible, height 48 blocked', [47 if i & 1 else 48 for i in range(256)], empty, visible, 16, 200, 6),
        placement_case(base, '256 requested placements wraps original count byte', floor, empty, visible, 256, 200, 7),
    ]
    read_count = sum(len(c['random']) for c in pipelines + placements)
    by_site = Counter(f'{site:04X}' for c in pipelines + placements for site, _ in c['random'])
    result = {
        'sourceSha256': SHA256, 'mainProgramSha256': MAIN_SHA256,
        'worldRoutineSha256': hashlib.sha256(bytes(base[0x6FBF:0x70E7]) + bytes(base[0x7498:0x74D7]) + bytes(base[0x4E1C:0x4E58])).hexdigest(),
        'authority': 'Supplied ATR routines executed by development-only py65',
        'scope': 'Fresh map carving, optional peak removal, occupant placement and level density',
        'limitations': ['Injected RANDOM byte streams; original POKEY cycle phase not reproduced',
                        'Mission transition/fresh_start gating and later object updates are outside this fixture'],
        'pipelineCases': pipelines, 'placementCases': placements,
        'metrics': {'pipelines': len(pipelines), 'placements': len(placements),
                    'orderedRandomReads': read_count, 'randomSites': dict(sorted(by_site.items()))},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(gzip.compress(json.dumps(result, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps(result['metrics'], indent=2), flush=True)
    print(f'Wrote {args.output} ({args.output.stat().st_size} bytes)', flush=True)


if __name__ == '__main__':
    capture()
