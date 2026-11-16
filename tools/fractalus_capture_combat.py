#!/usr/bin/env python3
"""Capture original foreground targeting, map aging, saucer spawns and bolts.

The supplied ATR routines execute only in this development oracle. Fixtures
contain named state, bitmaps and ordered RANDOM reads, never browser CPU code.
"""
import base64
import gzip
import json
import random
import re
from fractalus_original import ROOT, SHA256, image, processor, call


def layout(file, symbol):
    text = file.read_text().split(f'export const {symbol}', 1)[1].split('{', 1)[1].split('};', 1)[0]
    return {name: (int(address, 16), int(width)) for name, address, width in
            re.findall(r'(\w+):\s*\[(0x[\da-f]+),\s*([123])\]', text)}


fields = {}
for file, symbol in [('flight.mjs', 'FLIGHT_FIELDS'), ('flight-services.mjs', 'SERVICE_FIELDS'),
                     ('systems.mjs', 'SYSTEM_FIELDS'), ('rescue.mjs', 'RESCUE_FIELDS'), ('combat.mjs', 'COMBAT_FIELDS')]:
    fields.update(layout(ROOT/'rescue-on-fractalus'/file, symbol))
base = image()
rng = random.Random(0x434F4D42)


class Memory(list):
    def __init__(self, values, seed=1):
        super().__init__(values); self.seed = seed; self.cpu = None; self.trace = []
    def __getitem__(self, at):
        if at == 0xD20A:
            x = self.seed
            x ^= x << 13 & 0xFFFFFFFF; x ^= x >> 17; x ^= x << 5 & 0xFFFFFFFF
            self.seed = x & 0xFFFFFFFF
            value = self.seed >> 24
            self.trace.append([self.cpu.pc - 1, value]); return value
        return super().__getitem__(at)


def read(mem):
    state = {name: int.from_bytes(mem[address:address+width], 'little') for name, (address, width) in fields.items()}
    state['eventRing'] = mem[0x719:0x739]
    state['terrainScreenSpans'] = mem[0x28B6:0x28D6]
    return state


def write(mem, state):
    for name, (address, width) in fields.items(): mem[address:address+width] = list(state[name].to_bytes(width, 'little'))
    mem[0x719:0x739] = state['eventRing']
    mem[0x28B6:0x28D6] = state['terrainScreenSpans']


def state():
    result = {name: rng.randrange(256**width) for name, (_, width) in fields.items()}
    result.update(eventHead=rng.randrange(36), level=rng.randrange(1, 100),
                  eventRing=[rng.randrange(256) for _ in range(32)], terrainScreenSpans=[rng.randrange(256) for _ in range(32)])
    return result


def setup(initial, half=0, seed=1):
    mem = Memory(base, seed); cpu = mem.cpu = processor(mem); cpu.p = 0x20
    call(cpu, 0x7813)
    mem[0xC1] = 96; mem[0xC3:0xC5] = [0x10, 0x10]; call(cpu, 0x7460); call(cpu, 0x7483)
    for column in range(32, 216): mem[0xBD00 + column] = half + ((column - 32) >> 2)
    for row in range(48):
        for column in range(96): mem[0x1010 + row*96 + column] = byte(row*11 + column*19 + seed)
    write(mem, initial)
    return mem, cpu


def byte(value): return value & 255
def field(mem, half):
    return base64.b64encode(bytes(mem[0x1010 + row*96 + half + column] for row in range(48) for column in range(48))).decode()


fire = []
for number in range(280):
    initial = state(); half = 48 if number & 1 else 0
    initial.update(impactTimer=[0, 1, 2, 127, 128, 255][number % 6],
                   fireQueued=[0, 1, 7, 14][number % 4], objectDither=[0, 1, 255][number % 3],
                   landingPhase=number % 3, lockonState=7 if number % 3 == 1 else number % 8,
                   delayedRoll=rng.choice([0, 256, 512, 0xFE00, 0xFF00, 0xFFAC]),
                   targetRange=rng.choice([0, 7, 31, 63, 127, 255]),
                   fireTargetX=rng.choice([0, 43, 44, 65, 103, 128, 195, 211, 212, 255]),
                   fireTargetY=rng.choice([0, 103, 107, 108, 128, 150, 151, 200, 255]),
                   pitch=rng.choice([0xF400, 0xF501, 0xF600, 0xFE00, 0, 0x0400, 0x7FFF]),
                   roll=rng.choice([0xFB00, 0xFA00, 0xFC01, 0x0400, 0x0500, 0x0600, 0]))
    # Exercise fire, reset and waiting branches independently of their modulo
    # combinations above, including sustained frames of the same active bolt.
    if number >= 120: initial.update(impactTimer=1, fireQueued=1 + number % 14)
    mem, cpu = setup(initial, half, seed=0x12340001 + number*7919)
    cpu.x = entry_index = number & 255
    before = read(mem); before_field = field(mem, half)
    call(cpu, 0xA99C, limit=2000000)
    fire.append({'before': before, 'half': half, 'field': before_field, 'entryIndex': entry_index,
                 'after': read(mem), 'afterField': field(mem, half), 'random': mem.trace[:], 'exitIndex': cpu.x})


def put_context(mem, c):
    for name, address in [('half', 0xA7), ('reflect', 0x290F), ('groundVisible', 0x28FB), ('anyVisible', 0x28FC)]: mem[address] = c[name]
    for key, names, addresses in [
        ('target', ['cost', 'distance', 'dx', 'dy', 'kind', 'reflect'], [0x2915, 0x2914, 0x2912, 0x2913, 0x2910, 0x2911]),
        ('span', ['maximum', 'range', 'side', 'depth', 'cell', 'x', 'y'], [0x28EA, 0x79, 0x28E7, 0x28E8, 0x28E6, 0x3F, 0x40]),
        ('shot', ['depth', 'x', 'y'], [0x28ED, 0x28EB, 0x28EC])]:
        for name, address in zip(names, addresses): mem[address] = c[key][name]


tail = []
for number in range(384):
    initial = state(); half = 48 if number & 1 else 0
    initial.update(scene=number % 3, landingPhase=number % 4,
                   objectSlot=rng.choice([0, 1, 127, 128, 255]), objectIndex=rng.choice([0, 127, 128, 255]),
                   saucerReload=[0, 20, 68][number % 3], saucerCountdown=[0, 1, 2][number % 3],
                   gamePhase=number % 4, mapHitMarker=number % 2, level=1 + number % 99,
                   objectFrame=number % 3, controlMode=number % 3,
                   rangeRecovery=rng.choice([0, 1, 2, 4, 15]), targetRange=rng.choice([0, 31, 32, 63, 127, 255]),
                   roll=rng.randrange(0x10000), delayedRoll=rng.randrange(0x10000),
                   lockonState=rng.choice([0, 1, 7, 127, 128, 129, 255]),
                   lockCandidateCount=rng.choice([0, 1, 2, 254, 255]),
                   pilotDistancePrevious=rng.choice([0, 1, 9, 128, 255]))
    if number >= 128:
        initial.update(landingPhase=0, objectSlot=255, saucerReload=20, saucerCountdown=1,
                       gamePhase=number % 3, objectFrame=0, controlMode=2)
    context = {'half': half, 'reflect': number % 2, 'groundVisible': number % 3 == 1, 'anyVisible': number % 3 != 0,
               'target': {'cost': rng.randrange(256), 'distance': rng.randrange(256),
                          'dx': rng.choice([0, 5, 11, 12, 128, 244, 245, 251, 255]),
                          'dy': rng.choice([0, 5, 11, 12, 128, 244, 245, 251, 255]), 'kind': number % 2 * 128, 'reflect': number % 2},
               'span': {'maximum': rng.randrange(256), 'range': rng.choice([0, 1, 7, 31, 35, 127, 128, 255]),
                        'side': rng.randrange(256), 'depth': rng.randrange(256), 'cell': rng.randrange(256),
                        'x': rng.randrange(256), 'y': rng.randrange(256)},
               'shot': {'depth': number % 16, 'x': rng.randrange(256), 'y': rng.randrange(256)}}
    spans = [rng.randrange(256) for _ in range(32)]
    if number < 128: spans = [byte(6 + (row - 16) * signed_roll) for row in range(32)] if (signed_roll := number % 16 - 8) else [6]*32
    visible = [rng.randrange(256) for _ in range(45)]
    objects = [rng.choice([0, 0, 1, 1, 128, 201, 248, 249, 250, 251, 252, 253, 254, 255]) for _ in range(256)]
    skyline = [rng.choice([103, 107, 112, 128, 140, 149, 150, 255]) for _ in range(256)]
    if number % 4 == 0: skyline = [107] * 256
    elif number % 4 == 1: skyline = [255] * 256
    mem, cpu = setup(initial, half, seed=0xA0000101 + number*3571)
    put_context(mem, context)
    mem[0xB3] = half + 92
    mem[0xA00:0xB00] = objects; mem[0x2276:0x22A3] = visible
    mem[0x270E:0x272E] = spans; mem[0x260E:0x270E] = skyline
    # $A36D publishes the camera pitch before projection; the post-graphics
    # entry below consumes that saved value rather than republishing a new one.
    mem[0x2907:0x2909] = list(initial['pitch'].to_bytes(2, 'little'))
    before = read(mem)
    call(cpu, 0xA433, limit=2000000)
    tail.append({'before': before, 'context': context, 'spans': spans, 'visible': visible, 'objects': objects, 'skyline': skyline,
                 'after': read(mem), 'afterObjects': mem[0xA00:0xB00], 'random': mem.trace[:], 'exitIndex': cpu.x})


dispatch = []
for event in [0, 1, 127, 128, 255]:
    for alien in [0, 1, 128, 255]:
        mem = Memory(base); cpu = mem.cpu = processor(mem)
        mem[0x63D] = event; mem[0x633] = alien
        # Observe actual dispatch entry, without executing the independent
        # cinematic/inside-alien lifecycles owned by their native controllers.
        mem[0x4F3F] = mem[0x7AB8] = 0x60
        entries = []; cpu.sp = 0xFD; mem[0x1FE:0x200] = [0xFC, 0x3B]; cpu.pc = 0x3FCD
        for _ in range(1000):
            if cpu.pc == 0x3BFD: break
            if cpu.pc in [0x4F3F, 0x7AB8]: entries.append(cpu.pc)
            cpu.step()
        else: raise RuntimeError('Enemy dispatcher did not return')
        dispatch.append({'event': event, 'alien': alien, 'entries': entries})

result = {'sourceSha256': SHA256, 'fields': fields, 'fire': fire, 'tail': tail, 'dispatch': dispatch,
          'limits': ['A433 tail starts after projection/object/ridge rasterization; its metadata is explicit input',
                     'Byte RANDOM streams are replayed independently of POKEY clock phase',
                     'Cinematic and inside-alien dispatcher callees isolated; owned by their native controllers'],
          'metrics': {'fireCases': len(fire), 'tailCases': len(tail), 'dispatchCases': len(dispatch),
                      'randomReads': sum(len(c['random']) for c in fire + tail),
                      'bitmapBytes': len(fire)*2304}}
target = ROOT/'tools/fixtures/fractalus-combat.json.gz'
target.write_bytes(gzip.compress(json.dumps(result, separators=(',', ':')).encode(), mtime=0))
print(json.dumps(result['metrics'], indent=2)); print(target, target.stat().st_size)
