#!/usr/bin/env python3
"""Translate the supplied BASIC/compiled BASIC into adventure events offline.

The output has game predicates, assignments and narrative branches only. No CPU,
instruction decoder, BASIC interpreter or Atari memory is shipped to the browser.
Token numbers follow the original Turbo BASIC XL file interface; see the source
format tables at https://github.com/dmsc/tbxl-parser/tree/master/peg .
"""
import bisect
import json
import struct
from neverstory2_extract import files

STATEMENTS = ('REM DATA INPUT COLOR LIST ENTER LET IF FOR NEXT GOTO GO_TO GOSUB TRAP BYE CONT COM CLOSE CLR DEG DIM END NEW OPEN LOAD SAVE STATUS NOTE POINT XIO ON POKE PRINT RAD READ RESTORE RETURN RUN STOP POP ? GET PUT GRAPHICS PLOT POSITION DOS DRAWTO SETCOLOR LOCATE SOUND LPRINT CSAVE CLOAD LET_INV ERROR DPOKE MOVE -MOVE *F REPEAT UNTIL WHILE WEND ELSE ENDIF BPUT BGET FILLTO DO LOOP EXIT DIR LOCK UNLOCK RENAME DELETE PAUSE TIME$= PROC EXEC ENDPROC FCOLOR *L -- RENUM DEL DUMP TRACE TEXT BLOAD BRUN GO# # *B PAINT CLS DSOUND CIRCLE %PUT %GET').split()
OPERATORS = {0x12:',',0x14:':',0x15:';',0x16:'',0x19:'TO',0x1b:'THEN',0x1c:'#',
             0x1d:'<=',0x1e:'!=',0x1f:'>=',0x20:'<',0x21:'>',0x22:'==',0x23:'**',
             0x24:'*',0x25:'+',0x26:'-',0x27:'/',0x28:'NOT',0x29:'OR',0x2a:'AND',
             0x2b:'(',0x2c:')',0x2d:'=',0x2e:'=',0x30:'!=',0x34:'==',0x35:'+',0x36:'-',
             0x37:'(',0x38:'(',0x39:'(',0x3a:'(',0x3b:'(',0x3c:',',
             0x3e:'CHR$',0x3f:'USR',0x46:'PEEK',0x50:'INT',0x55:'DPEEK',
             0x66:'%0',0x67:'%1',0x68:'%2',0x69:'%3'}


def bcd(data):
    if not data[0]: return 0
    digits = [int(f'{b:02x}') for b in data[1:]]
    n = sum(d * 100 ** (4 - i) for i, d in enumerate(digits)) * 100 ** ((data[0] & 127) - 68)
    return -n if data[0] & 128 else n


def basic(data):
    ptr = struct.unpack('<7H', data[:14]); offset = lambda a: a - 256 + 14
    names = []; name = ''
    for c in data[14:offset(ptr[2])]:
        if not c: break
        name += chr(c & 127)
        if c & 128: names.append(name); name = ''
    result = []; pos = offset(ptr[4])
    while pos < offset(ptr[5]):
        line, length = struct.unpack('<HB', data[pos:pos + 3]); start = 3
        while start < length:
            end, code = data[pos + start:pos + start + 2]; a = pos + start + 2; tokens = []
            while a < pos + end:
                c = data[a]; a += 1
                if code in (0, 1):
                    tokens = [('s', data[a - 1:pos + end].decode('latin1').rstrip('\x9b'))]; break
                if c >= 128: tokens.append(('v', names[c - 128]))
                elif c in (13, 14): tokens.append(('c', bcd(data[a:a + 6]))); a += 6
                elif c == 15:
                    n = data[a]; a += 1; tokens.append(('s', data[a:a + n].decode('latin1'))); a += n
                elif c == 0: tokens.append(('v', names[data[a] + 128])); a += 1
                else: tokens.append(OPERATORS[c])
            result.append((line, STATEMENTS[code], tokens)); start = end
        pos += length
    return names, result


def expression(tokens):
    tokens = list(tokens); p = 0
    precedence = {'OR':1, 'AND':2, '==':3, '!=':3, '>':3, '<':3, '>=':3, '<=':3, '+':4, '-':4, '*':5, '/':5}
    def parse(level=0):
        nonlocal p
        t = tokens[p]; p += 1
        if isinstance(t, tuple): node = list(t)
        elif t == '(':
            node = parse(); assert tokens[p] == ')'; p += 1
        elif t == '-': node = ['-', ['c',0], parse(6)]
        else: raise ValueError(('expression', t, tokens))
        while p < len(tokens) and isinstance(tokens[p], str) and precedence.get(tokens[p], 0) > level:
            op = tokens[p]; p += 1; node = [op, node, parse(precedence[op])]
        return node
    result = parse(); assert p == len(tokens), tokens
    return result


def compact(operations, start, room_entries, input_rooms):
    """Replace development addresses/line positions by ordinary narrative indices."""
    keys = sorted(operations)
    def index(key):
        pos = bisect.bisect_left(keys, key)
        assert pos < len(keys), key
        return pos
    out = []
    for key in keys:
        op = operations[key].copy()
        if op[0] in ('jump','call'): op[1] = index(op[1])
        elif op[0] == 'if': op[2] = index(op[2]); op[3] = index(op[3])
        elif op[0] == 'input': op.append(input_rooms[key])
        out.append(op)
    return {'start':index(start), 'ops':out, 'rooms':{str(n):index(k) for n,k in room_entries.items()}}


def english(part):
    _, program = basic(files('en')[f'GAMES{part or ""}.BAS'])
    operations = {}; rooms = {}; input_rooms = {}; current_room = 0
    first = {line:i for i,(line,_,_) in reversed(list(enumerate(program)))}
    for i,(line,kind,t) in enumerate(program):
        if line < 204: continue
        end = next((j for j in range(i+1,len(program)) if program[j][0] != line),len(program))
        args = [x for x in t if x not in (':','')]
        if kind == 'REM':
            if args and 'MISTNOST ' in args[0][1]:
                current_room = int(args[0][1].split('MISTNOST ')[1].split()[0]); rooms[current_room] = i
                operations[i] = ['room',current_room]
            continue
        if kind in ('LET_INV','LET'):
            if args[0][1] in ('BACKUP','SAVMSC','RAMTOP','ADRDL','I','A','U','SIZE','Y'): continue
            operations[i] = ['set',args[0][1],expression(args[2:])]
        elif kind == 'IF':
            if 'PEEK' in args:
                operations[i] = ['pause']  # Original RETURN polling loop.
            else:
                split = args.index('THEN')
                assert split == len(args)-1, args
                operations[i] = ['if',expression(args[:split]),i+1,end]
        elif kind in ('?','PRINT'):
            if not args: operations[i] = ['text','\n']
            elif args[0] == 'CHR$': operations[i] = ['clear']
            else:
                assert args[0][0] == 's', args
                operations[i] = ['text',args[0][1] + ('' if args[-1] == ';' else '\n')]
        elif kind == 'INPUT':
            assert args == [('v','P$')]
            operations[i] = ['input']; input_rooms[i] = current_room
        elif kind == 'GOTO': operations[i] = ['jump',first[int(args[0][1])]]
        elif kind == 'GOSUB': operations[i] = ['call',first[int(args[0][1])]]
        elif kind == 'RETURN': operations[i] = ['return']
        elif kind == 'OPEN':
            if args[-1][0] == 's' and args[-1][1].endswith('.MIC'):
                operations[i] = ['image',args[-1][1].split(':')[-1]]
        elif kind == 'POKE' and args[0] == ('c',708): operations[i] = ['color',int(args[2][1])]
        elif kind == 'RUN':
            name = args[0][1].split(':')[-1]
            operations[i] = ['run',{'GAMES.BAS':0,'GAMES1.BAS':1,'GAMES2.BAS':2}[name]]
        elif kind == 'CLS': operations[i] = ['clear']
        elif kind == 'POSITION': operations[i] = ['position',int(args[0][1]),int(args[2][1])]
        elif kind not in ('POKE','TRAP','SOUND','BGET','CLOSE','CLR','GRAPHICS','SETCOLOR'):
            raise ValueError((line,kind,args))
    # The introduction has no DIM/initializers and starts with room 1.
    start = first[204] if part else first[210]
    return compact(operations,start,rooms,input_rooms)


CS_VARS = {
    1:{10:'P$',14:'BOB',15:'VET',16:'KAM',17:'KRY',18:'ULO',19:'ZRC',20:'SKA',21:'OTV',22:'RCKBT',23:'HJKL',25:'NAP'},
    2:{7:'P$',16:'RCKBT',19:'VAP',20:'KLI',21:'KLA',22:'POCH',23:'AUR',24:'VIKO',25:'PAKA',26:'TLAC',27:'KROV',29:'DVERE',31:'TRU',32:'ZNOVA'},
}


def czech(part):
    data = files('cs')[f'GAMES{part or ""}.CTB']
    memory = bytearray(65536); memory[0x226f:0x226f+len(data)-8] = data[8:]
    end = int.from_bytes(data[2:4],'little'); word = lambda a: int.from_bytes(memory[a:a+2],'little')
    literal = lambda a: memory[a+1:a+1+memory[a]].decode('latin1')
    varmap = CS_VARS.get(part,{})
    operations = {}; source_ops = {}; inputs = []; open_images = []; traps = []
    a = 0x2659 if part else 0x26a0
    if not part:
        # The introductory narrative has no game predicates: copy its original
        # PRINT calls through the first RETURN polling loop, as literal events.
        a = 0x26df
        operations.update({0x26db:['clear'],0x26dc:['position',0,10],
                           0x26dd:['image','INGAME.MIC'],0x26de:['color',0]})
        while a < end:
            if memory[a:a+7] == bytes([0xa9,memory[a+1],0xa0,memory[a+3],0x20,0xab,0xec]):
                operations[a] = ['text',literal(memory[a+1]+256*memory[a+3])]
                a += 7; continue
            if memory[a:a+3] in (bytes.fromhex('20ebed'),bytes.fromhex('20efed')):
                operations[a] = ['text','\n']; a += 3; continue
            if memory[a:a+3] == bytes.fromhex('adfc02'):
                operations[a] = ['pause']; operations[a+1] = ['run',1]; break
            a += 1
        return compact(operations,0x26db,{},{}), {}
    start = a; A = Y = X = 0; fr = ['c',0]; left = None; stack = []
    sizes = {0xa9:2,0xa0:2,0xa2:2,0xa5:2,0xad:3,0x85:2,0x84:2,0x8d:3,0x20:3,0x4c:3,0xd0:2,0xf0:2,0x9b:1}
    ignored = {0xeee8,0xeeea,0xeac1,0xfadf,0xedbf,0xef4b,0xed4c,0xeda2,0xed2e,0xf20b,0xedce,0xec83,0x2157,0xff6b,0xeb4a,0xfa0f,0xebb5,0xcac1}
    while a < end:
        code = memory[a]; n = sizes[code]; emit = None
        if code == 0xad and word(a+1) == 764:
            tail = bytes(memory[a:a+32]); marker = bytes([0x4c,a&255,a>>8]); k = tail.find(marker)
            assert k >= 0,hex(a)
            operations[a] = ['pause']; a += k+3; stack.clear(); continue
        if code == 0xa9: A = memory[a+1]
        elif code == 0xa0: Y = memory[a+1]
        elif code == 0xa2: X = memory[a+1]
        elif code == 0x8d and word(a+1) == 708: emit = ['color',A]
        elif code == 0x4c: emit = ['jump',word(a+1)]
        elif code in (0xd0,0xf0):
            offset = memory[a+1]; target = a+2+(offset if offset<128 else offset-256)
            emit = ['if',fr,target if code==0xd0 else a+2,a+2 if code==0xd0 else target]
        elif code == 0x20:
            fn = word(a+1); address = A + 256*Y
            if fn == 0xeb77: fr = ['v',varmap.get(X,f'_V{X}')]
            elif fn == 0xead2: stack.append(fr)
            elif fn == 0xeaf5: left = stack.pop()
            elif fn == 0xec98: fr = ['s',literal(address)]
            elif fn in (0xf273,0xf27d,0xf287,0xf29d): fr = [{0xf273:'!=',0xf27d:'<',0xf287:'>',0xf29d:'=='}[fn],fr,['c',bcd(memory[address:address+6])]]
            elif fn in (0xf2fc,0xf2aa,0xf2b5): fr = [{0xf2fc:'==',0xf2aa:'AND',0xf2b5:'OR'}[fn],left,fr]
            elif fn == 0xebd9:
                if X in varmap: emit = ['set',varmap[X],['c',bcd(memory[address:address+6])]]
                stack.clear()
            elif fn == 0xec03:
                if X in varmap: emit = ['set',varmap[X],['c',int(f'{A:02x}')]]
                stack.clear()
            elif fn == 0xf196:
                assert varmap[X]=='P$'; emit = ['input']; inputs.append(a); stack.clear()
            elif fn == 0xecab: emit = ['text',literal(address)]
            elif fn in (0xedef,0xedeb): emit = ['text','\n']
            elif fn == 0xedf4:
                assert A==125; emit=['clear']
            elif fn == 0xee4a:
                if fr[0]=='s' and fr[1].endswith('.MIC'):
                    emit=['image',fr[1].split(':')[-1]]; open_images.append(a)
                stack.clear()
            elif fn == 0xfac1:
                assert memory[a+3]==0x4c
                emit=['call',word(a+4)]; n=6
            elif fn == 0xfaa9: emit=['return']
            elif fn == 0xf98b:
                assert fr[0]=='s'; emit=['run',{'D:GAMES.CTB':0,'D:GAMES2.CTB':2}[fr[1]]]
            elif fn == 0xe9ed: emit=['end']
            elif fn in ignored:
                if fn == 0xfadf: traps.append(a)
                stack.clear()
            else: raise ValueError(('untranslated helper',part,hex(a),hex(fn)))
        if emit: operations[a]=emit; source_ops[a]=emit
        a += n
    # One INPUT loop per room. The original description preceding it is used
    # for a language-only redraw under a copy of the unchanged game state.
    assert len(inputs)==12, inputs
    room_entries = {}; input_rooms = {}
    for room,key in enumerate(inputs,1):
        previous = inputs[room-2] if room>1 else start
        prior_image = max((p for p in open_images if previous < p < key),default=None)
        # Rooms without a newly loaded bitmap begin with trap setup, then the
        # blank PRINT immediately preceding their description.
        candidates = [p for p,op in operations.items() if previous<p<key and op[0]=='text' and op[1]=='\n']
        if prior_image is not None:
            entry=prior_image
        else:
            # Death branches can sit between the previous input loop and this
            # room. Its own TRAP setup follows those branches and precedes the
            # description; it is a safer boundary than the last backward jump.
            entry=max(p for p in traps if previous<p<key)
            entry=min(p for p in candidates if p>=entry)
        room_entries[room]=entry; input_rooms[key]=room
    result=compact(operations,start,room_entries,input_rooms)
    return result, {'variables':varmap,'inputAddresses':inputs,'roomAddresses':room_entries,'operations':source_ops}


if __name__ == '__main__':
    from pathlib import Path
    folder=Path('/private/tmp/neverstory2-source')
    for part in (0,1,2):
        en=english(part); cs,mapping=czech(part)
        (folder/f'en-{part}-program.json').write_text(json.dumps(en,ensure_ascii=False,indent=2))
        (folder/f'cs-{part}-program.json').write_text(json.dumps(cs,ensure_ascii=False,indent=2))
        (folder/f'cs-{part}-mapping.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2))
        print(part,'en',len(en['ops']),'cs',len(cs['ops']))
