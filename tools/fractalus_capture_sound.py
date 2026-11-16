#!/usr/bin/env python3
"""Capture original effect envelopes, priority mixer and POKEY register writes.

Only data and oracle results are exported. The CPU is an offline development
reference; the web sound driver is independently implemented native JavaScript.
"""
import gzip
import json

from fractalus_original import ROOT, SOURCE, SHA256, image, processor, call, files

COLUMNS = ['distortion', 'volume', 'frequency', 'volumeDelta', 'volumeTarget',
           'volumeStep', 'volumePhase', 'frequencyDelta', 'frequencyTarget',
           'frequencyStep', 'frequencyPhase', 'follow', 'channel']
SPECIAL = ['mode', 'index', 'timer', 'volume', 'pitchA', 'pitchB', 'volumeTimer']


class SoundMemory(list):
    def __init__(self, data, seed=0x13579BDF):
        super().__init__(data)
        self.cpu = None
        self.writes = []
        self.random = []
        self.seed = seed

    def __getitem__(self, address):
        if address == 0xD20A:
            x = self.seed
            x ^= (x << 13) & 0xFFFFFFFF
            x ^= x >> 17
            x ^= (x << 5) & 0xFFFFFFFF
            self.seed = x & 0xFFFFFFFF
            value = self.seed >> 24
            self.random.append([self.cpu.pc - 1, value])
            return value
        return super().__getitem__(address)

    def __setitem__(self, address, value):
        if isinstance(address, int) and 0xD200 <= address <= 0xD208:
            self.writes.append([address - 0xD200, value])
        super().__setitem__(address, value)


def snapshot(mem):
    return {
        'parameters': mem[0x65D:0x714], 'head': mem[0x73], 'tail': mem[0x74],
        'topPriority': mem[0x714], 'topIndex': mem[0x715],
        'scanPriority': mem[0x716], 'nextIndex': mem[0x717], 'expired': mem[0x718],
        'ring': mem[0x719:0x739], 'registers': mem[0xD200:0xD209],
        'special': dict(zip(SPECIAL, mem[0x634:0x63B])),
    }


def make_case(base, name, frames, actions=None, special=None):
    mem = SoundMemory(base)
    cpu = mem.cpu = processor(mem)
    mem[0x65D:0x739] = [0] * (0x739 - 0x65D)
    mem[0x634:0x63B] = [0] * 7
    mem[0xD200:0xD210] = [0] * 16
    call(cpu, 0x5433)
    initial = snapshot(mem)
    reset_writes = mem.writes[:]
    if special:
        for field, value in special.items(): mem[0x634 + SPECIAL.index(field)] = value
    result = []
    for frame in range(frames):
        ops = (actions or {}).get(frame, [])
        for op in ops:
            if 'event' in op:
                cpu.x = op['event']; call(cpu, 0x5815)
            elif 'load' in op:
                cpu.x = op['load']; call(cpu, 0x581C)
            elif 'touch' in op:
                cpu.y = op['touch']; call(cpu, 0x55FC)
            elif 'voice' in op:
                for field, value in op['fields'].items(): mem[0x65D + COLUMNS.index(field) * 14 + op['voice']] = value
            elif 'register' in op:
                mem[0xD200 + op['register']] = op['value']
        mem.writes = []; mem.random = []
        call(cpu, 0x548D, limit=1000000)
        result.append({'operations': ops, 'state': snapshot(mem), 'writes': mem.writes[:], 'random': mem.random[:]})
    return {'name': name, 'initial': initial, 'resetWrites': reset_writes, 'special': special, 'frames': result}


def extract_music(base):
    theme = {
        'stream': list(base[0x71DB:0x7238]), 'durations': list(base[0x71D2:0x71DB]),
        'chords': [[base[address + i] for address in [0x71AB, 0x719E, 0x7191, 0x71B8, 0x71C5]] for i in range(13)],
    }
    songs, starts = [], []
    for song in range(2):
        header = base[0x731E + song * 6:0x7324 + song * 6]
        start = pointer = header[0] | header[1] << 8
        stream = []
        while True:
            command = base[pointer]; stream.append(command); pointer += 1
            if not command: break
            if command < 192: stream.append(base[pointer]); pointer += 1
        songs.append(dict(zip(['loud', 'soft', 'attack', 'release'], header[2:])) | {'stream': stream})
        starts.append(start)
    jingles = {'songs': songs, 'presets': [list(reversed(base[0x7375 + 4*i:0x7379 + 4*i])) for i in range(19)],
               'distortion': [base[0x73C1 + 2*i] for i in range(4)]}
    return theme, jingles, starts


def theme_case(base, counter):
    mem = SoundMemory(base); cpu = mem.cpu = processor(mem)
    mem[0xD200:0xD210] = [0] * 16
    mem[0x062D] = counter; mem[0x073B] = 0
    call(cpu, 0x70E7)
    initial = {'counter': counter, 'duration': mem[0x073A], 'emphasis': mem[0x073B], 'cursor': mem[0x073C],
               'registers': mem[0xD200:0xD209], 'writes': mem.writes[:]}
    frames, loops = [], 0
    assert bytes(base[0x5335:0x5338]) == bytes.fromhex('ee2d06')
    for _ in range(3400):
        mem.writes = []
        previous = mem[0x073C]
        # Execute the original counter increment and exact VBI gate, stopping
        # before its independent jingle/effects branch.
        cpu.pc = 0x5335; cpu.step()
        cpu.pc = 0x534D
        for _ in range(10000):
            if cpu.pc == 0x5359: break
            cpu.step()
        else: raise RuntimeError('Theme VBI gate did not return')
        if previous != 255 and mem[0x073C] < previous: loops += 1
        frames.append({'counter': mem[0x062D], 'duration': mem[0x073A], 'emphasis': mem[0x073B],
                       'cursor': mem[0x073C], 'registers': mem[0xD200:0xD209], 'writes': mem.writes[:]})
    return {'initial': initial, 'frames': frames, 'loops': loops}


def jingle_case(base, song, start):
    mem = SoundMemory(base); cpu = mem.cpu = processor(mem)
    mem[0x0648:0x065D] = [0] * (0x065D - 0x0648)
    mem[0xD200:0xD210] = [0] * 16
    cpu.y = song * 6 + 5
    call(cpu, 0x7238)
    def state():
        return {'levels': [mem[0x648 + 2*i] for i in range(4)], 'deltas': [mem[0x649 + 2*i] for i in range(4)],
                'frequencies': [mem[0x650 + 2*i] for i in range(4)], 'attackRemaining': mem[0x651],
                'duration': mem[0x653], 'active': bool(mem[0x655]), 'cursor': (mem[0x657] | mem[0x658] << 8) - start,
                'registers': mem[0xD200:0xD209], 'writes': mem.writes[:]}
    initial = state(); frames = []
    for _ in range(4000):
        mem.writes = []; call(cpu, 0x7253)
        frames.append(state())
        if not mem[0x655]: break
    else: raise RuntimeError('Jingle did not terminate')
    return {'song': song, 'initial': initial, 'frames': frames}


def station_data(base):
    mem = bytearray(base)
    disk = SOURCE.read_bytes()
    # The loader advances over the 125-byte sector payloads. Its utility block
    # starts 24 bytes into sector706, immediately after the preceding data.
    utility = b''.join(disk[16 + (n-1)*128:16 + (n-1)*128 + 125] for n in [706, 707])[24:]
    mem[0x3C00:0x3C00 + len(utility)] = utility
    assert bytes(mem[0x3C3D:0x3C47]) == bytes.fromhex('a000b1bbc9c0b008a201')
    mem[0xBB:0xBF] = bytes.fromhex('f41b3e28')
    call(processor(mem), 0x3C3D)
    assert mem[0xBD] | mem[0xBE] << 8 == 0x2922
    return {'fade': list(mem[0x1BE5:0x1BF4]), 'volume': list(mem[0x283E:0x2922])}


def station_case(base, data, drift, decay):
    mem = SoundMemory(base); cpu = mem.cpu = processor(mem)
    mem[0x283E:0x2922] = data['volume']
    # Only a graphics tailcall: $1E01 and its callees write no POKEY registers
    # and do not modify the audio clock or missile-fade accumulator cells.
    mem[0x1E01] = 0x60
    mem[0x13:0x15] = [0, 0]; mem[0x8C] = decay; mem[0x8D:0x90] = drift
    mem[0xD200:0xD210] = [0] * 16
    for register in [1, 3, 5, 7]: mem[0xD200 + register] = 0
    mem[0xD208] = 1
    call(cpu, 0x1B50)
    def state():
        return {'counter': mem[0x13] << 8 | mem[0x14], 'decayIndex': mem[0x8C], 'drift': mem[0x8D:0x90],
                'registers': mem[0xD200:0xD209], 'writes': mem.writes[:]}
    initial = state(); frames = []
    for _ in range(2200):
        mem.writes = []
        # Original station VBI increments RTCLOK low then high on overflow.
        cpu.pc = 0x1B41
        while cpu.pc != 0x1B47: cpu.step()
        call(cpu, 0x1B5B)
        if mem[0x13] >= 5: mem[0x13] = 2
        frames.append(state())
    return {'initial': initial, 'frames': frames}


def logo_data():
    stage = files()['FILE03']
    assert stage[0x1EF:0x1F1] == bytes.fromhex('e614')
    return {'counter': stage[0x254], 'delay': stage[0x255], 'envelope': stage[0x256],
            'frequencies': [stage[0x257 + 2*i] for i in range(4)],
            'deltas': [stage[0x258 + 2*i] for i in range(4)]}


def logo_case(registers):
    mem = SoundMemory([0] * 65536); cpu = mem.cpu = processor(mem)
    stage = files()['FILE03']; mem[0x5000:0x5000 + len(stage)] = stage
    mem[0xD200:0xD209] = registers
    # Execute the loader's actual AUDCTL clear and state-table setup.
    cpu.pc = 0x5000
    while cpu.pc != 0x5008: cpu.step()
    cpu.pc = 0x5088
    while cpu.pc != 0x5092: cpu.step()
    def state():
        return {'counter': mem[0x90], 'delay': mem[0x91], 'envelope': mem[0x92],
                'frequencies': [mem[0x93 + 2*i] for i in range(4)],
                'registers': mem[0xD200:0xD209], 'writes': mem.writes[:]}
    initial = state(); frames = []
    for _ in range(300):
        mem.writes = []; cpu.pc = 0x51EF
        for _ in range(1000):
            if cpu.pc == 0xE462: break
            cpu.step()
        else: raise RuntimeError('Logo VBI did not reach OS tail')
        frames.append(state())
    return {'initial': initial, 'inputRegisters': registers, 'frames': frames}


def capture():
    base = image()
    table_names = ['slot', 'control', 'frequency', 'volumeStep', 'volumeDelta',
                   'volumeTarget', 'volumePhase', 'frequencyStep', 'frequencyDelta',
                   'frequencyTarget', 'frequencyPhase', 'follow']
    table_addresses = [0x56D4, 0x56F5, 0x5716, 0x5737, 0x5758, 0x5779,
                       0x579A, 0x57BB, 0x57DC, 0x57E4, 0x57EC, 0x57F4]
    events = []
    for index in range(33):
        event = {name: base[address + index] for name, address in zip(table_names, table_addresses)}
        if not event['frequencyStep']:
            for name in ['frequencyDelta', 'frequencyTarget', 'frequencyPhase']: event[name] = 0
        events.append(event)
    theme, jingles, song_starts = extract_music(base)
    assets = {'sourceSha256': SHA256, 'clockHz': 1773447, 'gates': list(base[0x5406:0x5433]),
              'sweep': list(base[0x55DC:0x55FC]), 'events': events}
    station = station_data(base)
    assets.update(theme=theme, jingles=jingles, station=station, logo=logo_data())
    (ROOT / 'rescue-on-fractalus/assets/sound.json').write_text(json.dumps(assets, separators=(',', ':')) + '\n')

    cases = []
    for event in range(1, 34):
        cases.append(make_case(base, f'event {event:02X}', 256, {0: [{'event': event}]}))
        if event % 8 == 0: print(f'Captured {event}/33 isolated original effects', flush=True)
    overlap = {frame: [{'event': 1 + ((frame * 13) % 33)}] for frame in range(0, 360, 7)}
    cases.append(make_case(base, 'overlapping effects and priority preemption', 360, overlap))
    burst = {0: [{'event': event} for event in [6, 5, 8, 14, 20, 27, 28, 33]],
             64: [{'event': 1}, {'event': 20}], 100: [{'event': 0}],
             120: [{'event': 29}, {'event': 30}, {'event': 18}]}
    cases.append(make_case(base, 'chains and competing voice slots', 360, burst))
    cases.append(make_case(base, 'full event ring original overwrite', 16,
                           {0: [{'event': (event % 33) + 1} for event in range(32)]}))
    engine = {0: [{'load': 31}, {'load': 32}, {'load': 14}]}
    for frame in range(0, 240, 2):
        frequency = (255 - frame) & 255
        engine.setdefault(frame, []).extend([
            {'voice': 12, 'fields': {'volume': 4, 'frequency': max(12, frequency)}},
            {'voice': 13, 'fields': {'volume': frequency, 'frequency': frequency}},
            {'voice': 14, 'fields': {'volume': frequency, 'frequency': (frequency - 4) & 255}},
            {'touch': 13}, {'touch': 14}, {'touch': 12},
        ])
    cases.append(make_case(base, 'flight engine gauges with effect preemption', 240, engine))
    cases.append(make_case(base, 'Jaggi initial sweep into random-noise tail', 240, {0: [{'register': 8, 'value': 0}]},
                           special={'mode': 1, 'index': 32, 'volume': 0, 'pitchA': 191, 'pitchB': 211, 'volumeTimer': 0}))
    cases.append(make_case(base, 'random-noise special effect with concurrent envelopes', 160,
                           {0: [{'event': 20}], 40: [{'event': 6}]}, special={'mode': 2, 'timer': 0}))
    themes = [theme_case(base, counter) for counter in [0, 1, 254, 255]]
    songs = [jingle_case(base, song, start) for song, start in enumerate(song_starts)]
    stations = [station_case(base, station, drift, decay) for drift, decay in
                [([0, 0, 0], 0), ([253, 252, 254], 6), ([127, 57, 128], 255)]]
    logos = [logo_case(registers) for registers in [[0] * 9, [42, 163, 87, 74, 109, 132, 231, 15, 96]]]
    result = {'sourceSha256': SHA256, 'cases': cases, 'themes': themes, 'jingles': songs, 'stations': stations, 'logos': logos,
              'limits': ['Injected RANDOM streams, no original POKEY clock phase',
                         'Creature direct-tone sequencing belongs to the rescue controller',
                         'Station PMG-only tailcall isolated from POKEY trace'],
              'metrics': {'cases': len(cases), 'frames': sum(len(c['frames']) for c in cases),
                          'registerWrites': sum(len(f['writes']) for c in cases for f in c['frames']),
                          'randomReads': sum(len(f['random']) for c in cases for f in c['frames']),
                          'themeVbis': sum(len(c['frames']) for c in themes),
                          'jingleVbis': sum(len(c['frames']) for c in songs),
                          'stationVbis': sum(len(c['frames']) for c in stations),
                          'logoVbis': sum(len(c['frames']) for c in logos)}}
    target = ROOT / 'tools/fixtures/fractalus-sound.json.gz'
    target.write_bytes(gzip.compress(json.dumps(result, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps(result['metrics'], indent=2), flush=True)
    print(f'Wrote {target} ({target.stat().st_size} bytes)', flush=True)


if __name__ == '__main__':
    capture()
