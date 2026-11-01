#!/usr/bin/env python3
"""Probe the supplied Atari routines around Engywook and the Sphinxes, offline."""
import argparse
import gzip
import json
from pathlib import Path
import sys

from neverstory_extract import ROOT, extract


def probe(memory, random, entry):
    from py65.devices.mpu6502 import MPU
    memory = bytearray(memory)
    events = []
    # Output/drawing and SPACE waits are intercepted; adventure code is original.
    output = {0x6615: lambda cpu: ['common', cpu.a, True],
              0x6624: lambda cpu: ['common', cpu.a, False],
              0x6651: lambda cpu: ['chapter', memory[0x842a], cpu.a],
              0x67cd: lambda cpu: ['room', memory[0x842a], memory[0x8429]],
              0x67c0: lambda cpu: ['newline'], 0x67b2: lambda cpu: ['indent']}
    for address in [*output, 0x6374, 0x6688]: memory[address] = 0x60
    memory[0xd20a] = random
    cpu = MPU(memory=memory); cpu.pc = entry; cpu.sp = 0xfd
    memory[0x1fe] = 0xfe; memory[0x1ff] = 0x2f
    ended = False
    for _ in range(100000):
        if cpu.pc == 0x2fff: break
        if cpu.pc == 0x6309: ended = True; break
        if cpu.pc == 0x6361: cpu.a = 32; cpu.pc = 0x6368
        if cpu.pc in output: events.append(output[cpu.pc](cpu))
        cpu.step()
    else: raise RuntimeError(f'Original routine did not return: {cpu.pc:04X}')
    return {'chapter': memory[0x842a], 'room': memory[0x8429], 'image': memory[0x842c],
            'objects': list(memory[0x83a9:0x83df]), 'flags': list(memory[0x83f9:0x8429]),
            'overlays': [list(memory[0x842d + i * 6:0x8433 + i * 6]) for i in range(6)],
            'verbose': bool(memory[0x73]), 'ended': ended, 'events': events}


def generate(args):
    if args.py65_path: sys.path.insert(0, str(args.py65_path))
    rules = extract('en')  # Verify supplied disk identity before using addresses.
    base = bytearray(args.memory.read_bytes())
    if len(base) != 65536 or base[0xa800:0xa806] != bytes.fromhex('39b0a4a94ba8'):
        raise ValueError('Supply the original first-chapter game capture from neverstory_capture.py')
    word = lambda a: base[a] + base[a + 1] * 256
    cases, waits = [], []
    for room, mode in [(38, 'room'), (39, 'room'), (39, 'south-open'), (39, 'south-closed'), (39, 'south-no-auryn')]:
        for random in range(256):
            m = bytearray(base)
            m[0x83a9:0x83df] = bytes(rules['initialObjects'])
            m[0x83f9:0x8429] = bytes(48)
            for flag in [2, 4, 6, 7]: m[0x83f9 + flag] = 1
            m[0x8419] = 1; m[0x841a] = 50
            m[0x83a9] = 252 if mode != 'south-no-auryn' else 253
            m[0x8429] = room; m[0x842a] = 0; m[0x73] = 1
            m[0x5c] = 5; m[0x5d] = 250
            m[0x83fe] = int(mode == 'south-closed')
            if mode == 'room': pointer = word(word(0xa804) + room * 2)
            else: pointer = word(0x8470 + 4 * 2)
            m[0x5e] = pointer & 255; m[0x5f] = pointer >> 8
            initial = {'chapter': 0, 'room': room, 'image': m[0x842c], 'objects': list(m[0x83a9:0x83df]),
                       'flags': list(m[0x83f9:0x8429]), 'overlays': [list(m[0x842d + i * 6:0x8433 + i * 6]) for i in range(6)],
                       'verbose': True}
            cases.append({'mode': mode, 'random': random, 'state': initial, 'expected': probe(m, random, 0x7096)})
            if mode == 'room' and random in (0, 128):
                m[0x369:0x3b9] = b' ' * 80; m[0x369:0x36d] = b'wait'; m[0x36] = 4
                m[0x2f00:0x2f07] = bytes.fromhex('201a6d20686f60')
                waits.append({'random': random, 'state': initial, 'expected': probe(m, random, 0x2f00)})
    # Full DROP command followed by the original automatic routines: handover.
    m = bytearray(base)
    m[0x83a9:0x83df] = bytes(rules['initialObjects']); m[0x83f9:0x8429] = bytes(48)
    for flag in [2, 4, 6, 7]: m[0x83f9 + flag] = 1
    m[0x83a9] = 252; m[0x83b2] = 252; m[0x8429] = 37; m[0x8419] = 2; m[0x841a] = 50
    m[0x73] = 1; m[0x842a] = 0
    initial = {'chapter': 0, 'room': 37, 'image': m[0x842c], 'objects': list(m[0x83a9:0x83df]),
               'flags': list(m[0x83f9:0x8429]), 'overlays': [list(m[0x842d + i * 6:0x8433 + i * 6]) for i in range(6)], 'verbose': True}
    m[0x5d] = 59
    m[0x369:0x3b9] = b' ' * 80; m[0x369:0x375] = b'drop crystal'; m[0x36] = 12
    # One subroutine invokes the unmodified parser, then the automatic update.
    m[0x2f00:0x2f07] = bytes.fromhex('201a6d20686f60')
    handover = {'state': initial, 'expected': probe(m, 128, 0x2f00)}
    result = {'sourceSha256': rules['sha256'], 'cases': cases, 'handover': handover, 'waits': waits}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(args.output, 'wb', mtime=0) as file:
        file.write(json.dumps(result, separators=(',', ':')).encode())
    print(f'Captured {len(cases)} original Sphinx cases and the crystal handover: {args.output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--memory', type=Path, required=True)
    parser.add_argument('--py65-path', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'research/neverending-story/sphinx-oracle.json.gz')
    generate(parser.parse_args())
