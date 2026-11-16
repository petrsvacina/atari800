#!/usr/bin/env python3
"""Capture the supplied disk's isolated $8E5B flight integrator, offline only.

Object, target-blip and cockpit-bar callees are explicitly isolated with RTS.
Their invocation order is captured; no substitute behavior is invented. Original
arithmetic, event-ring operations and engine/HUD scalar updates execute intact.
"""
import argparse
import gzip
import json
import random
import re
from pathlib import Path
from fractalus_original import ROOT, SHA256, image, processor, call

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT/'tools/fixtures/fractalus-flight.json.gz')
args = parser.parse_args()
source = (ROOT/'rescue-on-fractalus/flight.mjs').read_text()
layout = {name: (int(address, 16), int(width)) for name, address, width in re.findall(
    r'(\w+): \[(0x[\da-f]+), ([12])\]', source.split('export const FLIGHT_FIELDS = {', 1)[1].split('};', 1)[0])}
hooks = {'targetBlip': 0x9713, 'throttleBar': 0x4447, 'advanceAxes': 0x9473,
         'loadObjectVelocity': 0x94bf, 'stepObject': 0x9552, 'targetBox': 0x93bd,
         'jitterColumn': 0xa613, 'integrateObject': 0x930e}
by_address = {address: name for name, address in hooks.items()}
base = image()
for address in hooks.values():
    base[address] = 0x60
rng = random.Random(0x46524C54)


def read(memory):
    state = {name: int.from_bytes(memory[address:address+width], 'little') for name, (address, width) in layout.items()}
    state['history'] = [list(memory[0x2893+row*7:0x289a+row*7]) for row in range(5)]
    state['eventRing'] = list(memory[0x719:0x739])
    return state


def write(memory, state):
    for name, (address, width) in layout.items():
        memory[address:address+width] = state[name].to_bytes(width, 'little')
    for row in range(5):
        memory[0x2893+row*7:0x289a+row*7] = bytes(state['history'][row])
    memory[0x719:0x739] = bytes(state['eventRing'])


def initial(**override):
    state = {name: 0 for name in layout}
    state.update(controlMode=2, mode=255, dial=50, speed=0x4d00, depth=0x4f00,
                 groundProximity=255, energy=120, timer=1, objectSlot=255, objectDither=255,
                 heading=512, level=4, eventHead=31)
    state['history'] = [[0]*7 for _ in range(5)]
    state['eventRing'] = [0]*32
    state.update(override)
    return state


def execute(state, input):
    memory = bytearray(base)
    write(memory, state)
    memory[0xd300] = input['port']
    memory[0xd20a] = input['random']
    cpu = processor(memory)
    cpu.pc = 0x8e5b
    cpu.p = 0x20
    cpu.sp = 0xfd
    memory[0x1fe:0x200] = bytes([0xfc, 0x3b])
    trace = []
    for count in range(100000):
        if cpu.pc == 0x3bfd:
            return read(memory), trace
        if cpu.pc in by_address:
            name = by_address[cpu.pc]
            trace.append([name, cpu.a] if name == 'throttleBar' else [name])
        cpu.step()
    raise RuntimeError(f'Original flight step did not return: ${cpu.pc:04X}')


cases = []
for number in range(4096):
    state = initial()
    for name in ['roll', 'pitch', 'rollShadow', 'speed', 'heading', 'worldX', 'worldZ', 'depth',
                 'delayedRoll', 'objectVelocityX', 'objectVelocityY']:
        state[name] = rng.randrange(65536)
    for name in ['rollRate', 'pitchRate', 'countdown', 'delayedPitch', 'delayedCanopyRoll',
                 'delayedCanopyPitch', 'objectPanXLo', 'objectPanXHi', 'objectPanYLo', 'objectPanYHi',
                 'objectScreenXLo', 'objectScreenXHi', 'objectScreenYLo', 'objectScreenYHi', 'timer',
                 'engineLatch', 'engineLatch2', 'status', 'clock']:
        state[name] = rng.randrange(256)
    state.update(scene=rng.choice([0, 0, 1]), mode=rng.choice([0, 2, 255, 6]),
                 landingPhase=rng.choice([0, 0, 1, 2, 3, 4, 5]),
                 systemsOff=rng.choice([0, 0, 0, 1, 128]),
                 landingInhibit=rng.choice([0, 1]), controlMode=rng.choice([1, 2, 2, 3]),
                 dial=rng.choice([0, 1, 6, 16, 32, 50, 128, 240, 255]),
                 groundProximity=rng.choice([0, 1, 240, 255]), energy=rng.choice([0, 0, 1, 120]),
                 objectFrame=rng.choice([0, 0, 1, 2, 128, 255]),
                 objectSlot=rng.choice([0, 1, 41, 61, 91, 127, 128, 255]),
                 objectDither=rng.choice([0, 1, 128]), level=rng.choice([1, 4, 30, 31, 60, 61, 99]),
                 historyIndex=rng.randrange(7), eventHead=rng.randrange(36), jitterPhase=rng.choice([0, 1]))
    state['history'] = [[rng.randrange(256) for _ in range(7)] for _ in range(5)]
    input = {'port': 240 | number % 16, 'random': rng.randrange(256)}
    after, trace = execute(state, input)
    cases.append({'before': state, 'input': input, 'after': after, 'hooks': trace})
sequences = []
for name, start, controls in [
    ('neutral', initial(), [255]),
    ('bank-and-climb', initial(speed=0x2000, depth=0x3000), [251, 249, 255, 247, 246, 255]),
    ('bank-limits', initial(speed=0x1000, dial=16), [251, 247]),
    ('depth-caps', initial(pitch=0x0bff, depth=0x4fff), [253, 254]),
]:
    state = start
    frames = []
    for tick in range(480):
        input = {'port': controls[(tick//40) % len(controls)], 'random': rng.randrange(256)}
        after, trace = execute(state, input)
        frames.append({'input': input, 'after': after, 'hooks': trace})
        state = after
    sequences.append({'name': name, 'before': start, 'frames': frames})
thrust = []
for level in range(1, 100):
    rates = []
    for notch in range(9):
        memory = bytearray(base)
        memory[0x6d] = level
        cpu = processor(memory)
        cpu.p = 0x20
        call(cpu, 0x75f5)
        cpu.a = notch
        call(cpu, 0x4430)
        assert memory[0x6f] == notch
        rates.append(memory[0x22])
    thrust.append({'level': level, 'rates': rates})
data = {'sourceSha256': SHA256, 'entry': '8E5B', 'end': '930D', 'layout': layout,
        'isolatedCallees': {name: f'{address:04X}' for name, address in hooks.items()},
        'scaleEndpoint': image()[0x4ef9], 'cases': cases, 'sequences': sequences, 'thrust': thrust}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(gzip.compress(json.dumps(data, separators=(',', ':')).encode(), mtime=0))
print(f'Captured {len(cases)} isolated original flight states and {sum(len(s["frames"]) for s in sequences)} consecutive steps.')
