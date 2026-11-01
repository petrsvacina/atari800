#!/usr/bin/env python3
"""Extract Shift's original data and development-only frame oracle."""
import base64
import gzip
import json
from shift_original import ROOT, SHA, image, Original, FIELDS


def extract():
    m = image()
    levels = []
    for index in range(37):
        address = m[0x7e80+index] | m[0x7ea6+index] << 8
        y, x, lo, hi = m[address:address+4]
        position = address + 4
        platforms = []
        while m[position]:
            direction, mask, pl, ph = m[position:position+4]
            platforms.append([direction, mask, pl | (ph+32) << 8])
            position += 4
        position += 1
        cells = []
        while m[position:position+2] != b'\xff\xff':
            tile, count = m[position:position+2]
            cells.extend([tile] * count); position += 2
        assert len(cells) == 1000, (index, len(cells))
        levels.append({'spawn': [x+48, y+32], 'codeAt': lo | (hi+32) << 8,
                       'platforms': platforms, 'map': cells,
                       'code': f'{m[0x5000+index]^170:02X}{m[0x5001+index]^85:02X}'})
    sprites = []
    for i, count in enumerate((6, 6, 4, 4, 6, 6, 1, 1, 9)):
        start = m[0x8040+i] | m[0x8049+i] << 8
        sprites.append(list(m[start:start+16*count]))
    palette = (ROOT/'research/neverending-story/default.act').read_bytes()
    colors = [list(palette[i:i+3]) for i in range(0,768,3)]
    colors[0] = [0,0,0]; colors[15] = colors[14] = [238,238,238]
    payload = {'sourceSha256': SHA, 'levels': levels, 'palette':colors,
               'random':list(m[0x5000:0x5100]),'bcd':list(m[0x7ecc:0x7f30]),
               'fonts': [list(m[0x2400:0x2800]), list(m[0x2800:0x2c00])],
               'titleFont': list(m[0x3800:0x3c00]),
               'panels': [list(m[a:a+1000]) for a in (0x4400, 0x3000, 0x3400)],
               'flags': list(m[0x7f30:0x8030]), 'sprites': sprites,
               'spikes': [list(m[a:a+32]) for a in (0x26b0, 0x2ab0)],
               'endingSubjectAt': [0x364e-0x3400, 0x3708-0x3400],
               'subjectText': list(m[0x5120:m.index(0, 0x5120)]),
               'shiftText': list(m[0x5133:m.index(0, 0x5133)])}
    # Title source is $2C00, not the code at $4400.
    payload['panels'][0] = list(m[0x2c00:0x2fe8])
    dest = ROOT / 'shift/assets'; dest.mkdir(parents=True, exist_ok=True)
    (dest/'data.js').write_text('// Extracted data only; no CPU code. See research/shift/README.md.\n'
                              'globalThis.SHIFT_DATA='+json.dumps(payload, separators=(',', ':'))+';\n')
    research = ROOT / 'research/shift'; research.mkdir(parents=True, exist_ok=True)
    fixtures = {'sourceSha256': SHA, 'cases': []}
    for level in range(37):
        original = Original(level)
        steps = [{'input': 15, 'state': original.state()}]
        for tick in range(320):
            controls = (7, 7, 15, 14, 11, 11, 31, 15)[(tick//20 + level) % 8]
            original.frame(controls)
            steps.append({'input': controls, 'state': original.state()})
        fixtures['cases'].append({'level': level, 'steps': steps})
        print('Captured Shift original level', level+1, flush=True)
    for level in range(37):
        for flip in (False, True):
            original = Original(level)
            if flip:
                original.call(0x4533)
                if original.memory[0x24]: continue
            found = {}
            for index, tile in enumerate(original.memory[0x2000:0x23e8]):
                kind = original.memory[0x7f30+tile] & 240
                if kind in (64, 128, 144, 160, 176, 192, 224, 240):
                    found.setdefault(kind, index)
            for kind, index in found.items():
                original = Original(level)
                if flip: original.call(0x4533)
                original.cpu.sp=0xfd;original.cpu.pc=0x3e1c;original.cpu.step()
                x = (index % 40)*8 + 48 - 14
                setup = {'x': x & 255, 'xHigh': x >> 8, 'y': (index//40)*8+32}
                for key, value in setup.items(): original.memory[FIELDS[key]] = value
                original.memory[0x1e] = setup['xHigh']
                steps = [{'input':15, 'state': original.state()}]
                for tick in range(180):
                    controls = 7 if tick < 4 else 15
                    original.frame(controls)
                    steps.append({'input':controls, 'state':original.state()})
                fixtures['cases'].append({'level':level,'preShift':flip,'setup':setup,'kind':kind,'steps':steps})
            print('Captured original Shift contacts', level+1, 'rotated' if flip else 'normal', sorted(found), flush=True)
    original=Original(12);steps=[{'input':15,'state':original.state()}]
    for _ in range(3100):
        original.frame(15);steps.append({'input':15,'state':original.state()})
    fixtures['cases'].append({'level':12,'timerExpiry':True,'steps':steps})
    for level in (0,12,35):
        original=Original(level);setup={'y':240,'falling':1}
        for key,value in setup.items():original.memory[FIELDS[key]]=value
        steps=[{'input':15,'state':original.state()}]
        for _ in range(600):
            original.frame(15);steps.append({'input':15,'state':original.state()})
        fixtures['cases'].append({'level':level,'setup':setup,'offscreen':True,'steps':steps})
    (research/'oracle.json.gz').write_bytes(gzip.compress(json.dumps(fixtures, separators=(',', ':')).encode(), mtime=0))
    (research/'source.json').write_text(json.dumps({'file':'shift.xex','sha256':SHA,'bytes':len((ROOT/'shift.xex').read_bytes()),
        'levels':36,'secretLevels':1,'run':'$3C00','rules':'$3C00-$4F60',
        'levelPointers':'$7E80/$7EA6','flags':'$7F30-$802F','sprites':'$8052-$8301',
        'music':'$0403 init / $0406 tick, copied from $8E00; CMC module $8400',
        'referenceOnly':'py65 and Atari800 run offline; web uses native JavaScript.'},indent=2)+'\n')


if __name__ == '__main__':
    extract()
