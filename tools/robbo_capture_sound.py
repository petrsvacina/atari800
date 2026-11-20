#!/usr/bin/env python3
"""Extract Robbo's sound data and differential oracle from the supplied XEX.

The 6502 is an offline development reference, never a browser dependency.
Pass --ram a complete post-decompression 64K image of this exact XEX.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SHA256 = '75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb'
NAMES = ['explosion', 'shot', 'bump', 'teleport', 'screw', 'extra life', 'door',
         'ammunition', 'box', 'key', 'small explosion', 'enter capsule',
         'leave capsule', 'open exit', 'magnet']


def processor(memory):
    try:
        from py65.devices.mpu6502 import MPU
    except ImportError:
        sys.path.insert(0, '/private/tmp/robbo-deps')
        from py65.devices.mpu6502 import MPU
    return MPU(memory=memory)


def call(cpu, address, limit=100000):
    cpu.sp = 0xFD
    cpu.memory[0x1FE:0x200] = [0xFC, 0x03]
    cpu.pc = address
    for _ in range(limit):
        if cpu.pc == 0x03FD:
            return
        cpu.step()
    raise RuntimeError(f'Original sound routine did not return: ${cpu.pc:04X}')


class Memory(list):
    def __init__(self, data):
        super().__init__(data)
        self.writes = []

    def __setitem__(self, address, value):
        if isinstance(address, int) and (0xD200 <= address <= 0xD208 or address == 0xD20F):
            self.writes.append([address - 0xD200, value])
        super().__setitem__(address, value)


def snapshot(memory):
    return {'parameters': memory[0xF0:0x100], 'registers': memory[0xD200:0xD209]}


def sequence(base, name, frames, actions, trigger_address, vbi_address, phase=0, dirty=False):
    memory = Memory(base)
    cpu = processor(memory)
    raw_parameters = [(index * 37 + 11) & 255 for index in range(16)] if dirty else [0] * 16
    raw_registers = [(index * 17 + 7) & 255 for index in range(9)] if dirty else [0] * 9
    memory[0xF0:0x100] = raw_parameters
    memory[0xD200:0xD209] = raw_registers
    cpu.a = 255
    call(cpu, trigger_address)
    initial = snapshot(memory)
    reset_writes = memory.writes[:]
    result = []
    for frame in range(frames):
        memory.writes = []
        operations = actions.get(frame, [])
        for command in operations:
            cpu.a = command
            call(cpu, trigger_address)
        operation_writes = memory.writes[:]
        memory.writes = []
        clock = (phase + frame) & 255
        memory[0x14] = clock
        call(cpu, vbi_address)
        result.append({'clock': clock, 'commands': operations, 'operationWrites': operation_writes,
                       'state': snapshot(memory), 'writes': memory.writes[:]})
    return {'name': name, 'inputParameters': raw_parameters, 'inputRegisters': raw_registers,
            'initial': initial, 'resetWrites': reset_writes, 'frames': result}


def fragment(cpu, start, end):
    cpu.pc = start
    for _ in range(1000):
        if cpu.pc == end:
            return
        cpu.step()
    raise RuntimeError('Title sound fragment did not reach its end')


def title_cases(base):
    # Both entry points are original, contiguous instruction fragments. They
    # make no OS calls and have no hidden timer or sound-driver state.
    targets = {'mute': bytes.fromhex('a9008d01d2'),
               'character': bytes.fromhex('a9108d00d2a9828d01d2'),
               'line': bytes.fromhex('a9028d00d2a9c48d01d2')}
    addresses = {}
    for name, pattern in targets.items():
        address = bytes(base).find(pattern, 0xA800, 0xB800)
        if address < 0:
            raise ValueError(f'Original title {name} POKEY fragment not found')
        addresses[name] = [address, address + len(pattern)]
    cases = []
    for kind in [None, 'character', 'line', 'newline']:
        memory = Memory(base)
        memory[0xD200:0xD209] = [0] * 9
        cpu = processor(memory)
        fragments = ['mute']
        if kind in ['character', 'newline']:
            fragments.append('character')
        if kind in ['line', 'newline']:
            fragments.append('line')
        for name in fragments:
            fragment(cpu, *addresses[name])
        cases.append({'kind': kind, 'registers': memory[0xD200:0xD209], 'writes': memory.writes})
    return addresses, cases


def capture(ram):
    source = (ROOT / 'Robbo.xex').read_bytes()
    if hashlib.sha256(source).hexdigest() != SHA256:
        raise ValueError('Unsupported Robbo XEX revision')
    base = ram.read_bytes()
    if len(base) != 65536 or base[0xB800] != 0x4C or base[0xB803] != 0x4C:
        raise ValueError('Expected the complete, decompressed original 64K image')
    trigger_address = int.from_bytes(base[0xB801:0xB803], 'little')
    vbi_address = int.from_bytes(base[0xB804:0xB806], 'little')
    if base[trigger_address:trigger_address + 20] != bytes.fromhex('aa3030a90085fd8a0a0a0a26fd0a26fd0a26fd69'):
        raise ValueError('Unexpected original SOUND_ instructions')
    table = base[trigger_address + 20] | base[trigger_address + 26] << 8
    if base[vbi_address:vbi_address + 7] != bytes.fromhex('a5142903f00160'):
        raise ValueError('Unexpected original SOUNDV RTCLOK gate')
    effects = [{'name': name, 'steps': [[base[table + effect * 32 + step * 2],
                                       base[table + effect * 32 + step * 2 + 1]] for step in range(16)]}
               for effect, name in enumerate(NAMES)]
    assets = {'sourceSha256': SHA256, 'clockHz': 1773447, 'vbiHz': 1773447 / (312 * 114),
              'tableAddress': table, 'effects': effects, 'titleMusic': False}
    # CHNMON deliberately uses PLAY bytes as a one-bit CONSOL waveform. Export
    # only its speaker bit, never those executable bytes.
    if base[0x27B1:0x27BC] != bytes.fromhex('a250bd00248d1fd0ca10f7'):
        raise ValueError('Unexpected original CHNMON console-speaker loop')
    console = []
    class ConsoleMemory(Memory):
        def __setitem__(self, address, value):
            if address == 0xD01F:
                console.append([cpu.processorCycles, value & 8])
            super().__setitem__(address, value)
    console_memory = ConsoleMemory(base); cpu = processor(console_memory)
    fragment(cpu, 0x27B1, 0x27BC)
    first_cycle = console[0][0]
    console = [[cycle - first_cycle, value] for cycle, value in console]
    assert len(console) == 81 and all(cycle == index * 13 for index, (cycle, _) in enumerate(console))
    assets['footstep'] = {'bits': [value for _, value in console], 'cyclesPerWrite': 13,
                          'polarity': 'bit 3 clear drives the speaker; set releases it'}
    addresses, title = title_cases(base)
    cases = []
    for effect in range(15):
        for phase in range(4):
            cases.append(sequence(base, f'effect {effect:02X}, phase {phase}', 80,
                                  {0: [effect]}, trigger_address, vbi_address, phase))
    cases.append(sequence(base, 'four simultaneous voices and shared voice preemption', 384,
                          {0: [0, 1, 2, 3], 1: [4], 2: [5], 3: [6], 19: [0, 7], 23: [1, 8],
                           31: [2, 9], 35: [10], 36: [11], 39: [12], 42: [13], 43: [14],
                           64: [0, 1, 2, 3], 95: [255], 96: [5], 100: [0, 1, 2]},
                          trigger_address, vbi_address, dirty=True))
    cases.append(sequence(base, 'retrigger every VBI and byte clock wrap', 512,
                          {frame: [frame % 15] for frame in range(300)}, trigger_address, vbi_address, phase=237))
    cases.append(sequence(base, 'all negative reset command aliases', 320,
                          {frame: [0, 1, 2, 3, 128 + frame // 2] for frame in range(0, 256, 2)},
                          trigger_address, vbi_address, dirty=True))
    metrics = {'cases': len(cases), 'vbis': sum(len(case['frames']) for case in cases),
               'registerWrites': sum(len(frame['writes']) + len(frame['operationWrites'])
                                     for case in cases for frame in case['frames'])}
    fixture = {'sourceSha256': SHA256, 'ramSha256': hashlib.sha256(base).hexdigest(),
               'consoleWrites': console,
               'routines': {'trigger': trigger_address, 'vbi': vbi_address, 'tables': table,
                            'title': addresses}, 'cases': cases, 'title': title, 'metrics': metrics}
    (ROOT / 'robbo/assets/sound.json').write_text(json.dumps(assets, separators=(',', ':')) + '\n')
    with gzip.GzipFile(filename=str(ROOT / 'tools/fixtures/robbo-sound.json.gz'), mode='wb', mtime=0) as output:
        output.write(json.dumps(fixture, separators=(',', ':')).encode())
    report = {'source': 'Robbo.xex', 'sourceSha256': SHA256,
              'ramSource': str(ram), 'ramCapture': 'Atari800 headless monitor at PC=$AC28',
              'ramSha256': fixture['ramSha256'], 'writer': {
                  'start': f'${trigger_address:04X}', 'endExclusive': f'${table:04X}',
                  'sha256': hashlib.sha256(base[trigger_address:table]).hexdigest()},
              'tables': {'start': f'${table:04X}', 'endExclusive': f'${table + 480:04X}',
                         'sha256': hashlib.sha256(base[table:table + 480]).hexdigest()},
              'runtimeAsset': 'robbo/assets/sound.json',
              'runtimeAssetSha256': hashlib.sha256((ROOT / 'robbo/assets/sound.json').read_bytes()).hexdigest(),
              'footstep': {'writer': '$27B1..$27BB', 'dataDerivation': '$2450..$2400 descending, bit 3 only',
                           'writes': 81, 'cyclesPerWrite': 13,
                           'speakerBitsSha256': hashlib.sha256(bytes(assets['footstep']['bits'])).hexdigest()},
              'fixture': 'tools/fixtures/robbo-sound.json.gz', 'metrics': metrics,
              'limits': ['Register sequencing verified; analog output and initial polynomial phase are not PCM-oracle verified.']}
    report_path = ROOT / 'research/robbo/sound.json'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'routines': fixture['routines'], **metrics}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ram', type=Path, default=Path('/private/tmp/robbo-research/native-unpacked.bin'))
    capture(parser.parse_args().ram)
