#!/usr/bin/env python3
"""Direct original ground sampling/projection references. Development only."""
import argparse
import gzip
import hashlib
import json
import random
import re
from pathlib import Path
from fractalus_original import ROOT, SHA256, image, processor, call

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT/'tools/fixtures/fractalus-flight-services.json.gz')
parser.add_argument('--decode-snapshot', type=Path)
parser.add_argument('--decode-output', type=Path)
args = parser.parse_args()
if bool(args.decode_snapshot) != bool(args.decode_output):
    parser.error('--decode-snapshot and --decode-output must be supplied together')
base = image()
rng = random.Random(0x53525643)
thrust_addresses = [0x3392,0x33c2,0x33c3,0x33f3,0x3423,0x3424,0x3454,0x3484,0x3485,0x34b5,0x34e5,0x34e6]
services = {'targetBlip': 0x9713, 'throttleBar': 0x4447, 'advanceAxes': 0x9473,
            'loadObjectVelocity': 0x94bf, 'stepObject': 0x9552, 'targetBox': 0x93bd,
            'jitterColumn': 0xa613, 'integrateObject': 0x930e}


def layout(file, symbol):
    text = file.read_text().split(f'export const {symbol} = {{', 1)[1].split('};', 1)[0]
    return {name: (int(address, 16), int(width)) for name, address, width in re.findall(r'(\w+): \[(0x[\da-f]+), ([123])\]', text)}


fields = {**layout(ROOT/'rescue-on-fractalus/flight.mjs', 'FLIGHT_FIELDS'),
          **layout(ROOT/'rescue-on-fractalus/flight-services.mjs', 'SERVICE_FIELDS')}


def read(memory):
    state = {name: int.from_bytes(memory[address:address+width], 'little') for name, (address, width) in fields.items()}
    state['history'] = [list(memory[0x2893+row*7:0x289a+row*7]) for row in range(5)]
    state['eventRing'] = list(memory[0x719:0x739])
    state['horizonCells'] = list(memory[0x2159:0x2159+80])
    state['thrustCells'] = [memory[address] for address in thrust_addresses]
    return state


def write(memory, state):
    for name, (address, width) in fields.items():
        memory[address:address+width] = state[name].to_bytes(width, 'little')
    for row in range(5):
        memory[0x2893+row*7:0x289a+row*7] = bytes(state['history'][row])
    memory[0x719:0x739] = bytes(state['eventRing'])
    memory[0x2159:0x2159+80] = bytes(state['horizonCells'])
    for address, value in zip(thrust_addresses, state['thrustCells']):
        memory[address] = value


def random_state():
    state = {name: rng.randrange(256**width) for name, (_, width) in fields.items()}
    state['history'] = [[rng.randrange(256) for _ in range(7)] for _ in range(5)]
    state['eventRing'] = [rng.randrange(256) for _ in range(32)]
    state['horizonCells'] = [rng.randrange(256) for _ in range(80)]
    state['thrustCells'] = [rng.randrange(256) for _ in range(12)]
    state.update(engineLatch=rng.choice([0, 1, 2, 4, 7, 8, 10, 15]), energy=rng.choice([0, 1, 120]),
                 landingInhibit=rng.choice([0, 1]), mode=rng.choice([0, 2, 255]),
                 horizonPhase=rng.randrange(4), horizonSide=rng.randrange(4), eventHead=rng.randrange(36),
                 scene=rng.choice([0, 1]), objectFrame=rng.choice([0, 1, 2, 16, 29, 128, 255]),
                 objectSlot=rng.choice([0, 1, 41, 61, 91, 127, 128, 255]),
                 controlMode=2, systemsOff=rng.choice([0, 0, 1]), historyIndex=rng.randrange(7),
                 dial=rng.choice([0, 16, 32, 50, 240]), level=rng.randrange(1, 100))
    return state


if args.decode_snapshot:
    memory = args.decode_snapshot.read_bytes()
    if len(memory) != 65536:
        raise ValueError('Expected a complete 65536-byte development RAM snapshot')
    data = {'sourceSha256': SHA256, 'snapshotSha256': hashlib.sha256(memory).hexdigest(),
            'state': read(memory), 'terrain': list(memory[0x900:0xa00]),
            'objects': list(memory[0xa00:0xb00]), 'visibleCells': list(memory[0x2276:0x22a3])}
    args.decode_output.parent.mkdir(parents=True, exist_ok=True)
    args.decode_output.write_text(json.dumps(data, indent=2)+'\n')
    print('Decoded named native state and world data only:', args.decode_output)
    raise SystemExit


maps = [[0]*256, [255]*256, [128+(i % 64) for i in range(256)],
        [255 if (i ^ (i >> 4)) & 1 else 0 for i in range(256)]]
for i in range(12):
    maps.append([rng.randrange(64 if i < 4 else 192 if i < 8 else 256) for _ in range(256)])
height_cases = []
for i in range(4096):
    index = i % len(maps)
    x, z = rng.randrange(65536), rng.randrange(65536)
    memory = bytearray(base)
    memory[0x900:0xa00] = bytes(maps[index])
    memory[0x27fd:0x2801] = x.to_bytes(2, 'little') + z.to_bytes(2, 'little')
    cpu = processor(memory)
    cpu.p = 0x20
    call(cpu, 0x9a36)
    height_cases.append([index, x, z, memory[0x62]])
ground_cases = []
for i in range(1024):
    state = random_state()
    map_index = i % len(maps)
    memory = bytearray(base)
    memory[0x900:0xa00] = bytes(maps[map_index])
    write(memory, state)
    cpu = processor(memory)
    cpu.p = 0x20
    call(cpu, 0x9833)
    ground_cases.append({'map': map_index, 'before': state, 'after': read(memory)})

def objects():
    return [rng.choice([0, 0, 0, 0, 1, 100, 128, 200, 201, 248, 252]) for _ in range(256)]


def original(state, data, address, argument=None, ground=False):
    memory = bytearray(base)
    memory[0x900:0xa00] = bytes(maps[data['map']])
    memory[0xa00:0xb00] = bytes(data['objects'])
    memory[0x2276:0x2276+45] = bytes(data['visibleCells'])
    memory[0xd20a] = data['random']
    memory[0xd300] = data['port']
    write(memory, state)
    cpu = processor(memory)
    cpu.p = 0x20
    if argument is not None:
        cpu.a = argument
    call(cpu, address, limit=500000)
    if ground:
        call(cpu, 0x9833, limit=500000)
    return {'after': read(memory), 'objectsAfter': list(memory[0xa00:0xb00])}


service_cases = []
for name, address in services.items():
    for i in range(192):
        state = random_state()
        state.update(objectSlot=rng.randrange(128), objectFrame=rng.randrange(2, 30), respawnCounter=rng.randrange(6))
        if name == 'targetBox' and i & 1:
            state.update(objectXHigh=0, objectYHigh=0, objectXMid=rng.randrange(52, 172), objectYMid=rng.randrange(26, 106))
        if name == 'stepObject' and i & 1:
            state.update(objectFrame=4, objectSlot=0, objectIndex=0, visibleObjectX=100, visibleObjectY=40,
                         objectScreenXHi=52, objectScreenYHi=34, objectAltitude=0x6400, objectStepAltitude=0)
        data = {'map': i % len(maps), 'objects': objects(), 'visibleCells': [rng.randrange(256) for _ in range(45)],
                'random': rng.randrange(256), 'port': 240 | i % 16}
        argument = i % 9 if name == 'throttleBar' else None
        result = original(state, data, address, argument)
        service_cases.append({'name': name, 'argument': argument, 'before': state, **data, **result})

coupled = []
for i in range(1024):
    state = random_state()
    state['respawnCounter'] = rng.randrange(6)
    data = {'map': i % len(maps), 'objects': objects(), 'visibleCells': [rng.randrange(256) for _ in range(45)],
            'random': rng.randrange(256), 'port': 240 | i % 16}
    result = original(state, data, 0x8e5b, ground=True)
    coupled.append({'before': state, **data, **result})
data = {'sourceSha256': SHA256, 'layout': fields, 'maps': maps, 'height': height_cases,
        'ground': ground_cases, 'scope': 'Full original $9A36 and $9833 subtree, no callee isolation',
        'horizonGlyphs': list(base[0x4553:0x455b]), 'services': service_cases, 'coupled': coupled,
        'serviceTables': {'objectAngles': list(base[0x93f3:0x9473]), 'hitRadius': list(base[0x96f5:0x9713])},
        'thrustAddresses': thrust_addresses}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(gzip.compress(json.dumps(data, separators=(',', ':')).encode(), mtime=0))
print('Captured', len(height_cases), 'height samples,', len(ground_cases), 'ground states,', len(service_cases), 'service states and', len(coupled), 'coupled flight/ground states; no isolated callees.')
