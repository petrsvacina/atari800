#!/usr/bin/env python3
"""Measure original VBI crossings while rebuilding rooms, offline only.

The browser receives four small clock deltas per room/entrance/phase,
not instruction timings, opcodes, a CPU or a program-counter interpreter.
"""
import json
from pathlib import Path
from goonies_extract_physics import XexMonitor
from hero_extract import ROOT,SHA
def capture():
    m=XexMonitor(ROOT/'H.E.R.O..xex');dump=Path('/private/tmp/hero-timing-byte.bin');result={}
    try:
        m.prompt('bpc 8177');m.prompt('cont');m.prompt('c 81fc a9 06 ea');m.prompt('cont');m.prompt('c 81fc a9 07 ea');m.prompt('c 818c a9 07 ea');m.prompt('c 8177 a2 ff ea');m.prompt('cont');m.prompt('cont')
        for p in [0x97d6,0x97e7,0x97f8,0x9809,0x981a,0x982b,0x8987,0x8e84]:m.prompt(f'c {p:04x} a9 00 ea')
        for p in [0x8182,0x88ca,0x8e53]:m.prompt(f'c {p:04x} a9 01 ea')
        m.prompt('write 0000 bfff /private/tmp/hero-timing-base.bin');base=Path('/private/tmp/hero-timing-base.bin').read_bytes();m.prompt('savestate /private/tmp/hero-timing-base.a8s')
        for level in range(20):
            last=base[0xad28+level]
            for room in range(last+1):
                variants=['side']+(['down']if room and room<=10 else [])+(['up']if room<last else [])+(['intro','empty']if not room else [])
                for kind in variants:
                    timings=[]
                    for phase in range(4):
                        b=bytearray(base[:256]);b[0x1b:0x91]=bytes(0x91-0x1b);b[0x21:0x3a]=base[0xae10:0xae29];b[0x7e]=level;b[4]=phase;b[0x3b]=0;b[0x23]=255;b[0x8a]=255;b[0x31]=81;b[0x35]=255;b[0x33]=0;b[0x27:0x2a]=bytes([50]*3);b[0x59:0x5c]=bytes([148]*3)
                        stick=15
                        if kind in ['intro','empty']:previous=0;b[0x25]=0;b[0x33]=149 if kind=='intro' else 255;b[0x31]=0;b[0x35]=0;b[0x27:0x2a]=base[0xae16:0xae19]
                        elif kind=='down':previous=room-1;b[0x25]=145;b[0x21]=128;b[0x6a]=0
                        elif kind=='up':previous=room+1;b[0x25]=21;b[0x21]=128;b[0x6a]=63;stick=14
                        else:
                            previous=room-1 if room else 1;forward=bool(room);flag=base[0xa700+base[0xad00+level]+previous]&1;left=flag if forward else 1-flag;stick=11 if left else 7;b[0x36]=8 if left else 0;b[0x21]=48 if left else 203;b[0x25]=49;b[0x6a]=31
                        i=base[0xad00+level]+previous;flags=base[0xac00+i];b[0x26]=(flags&0xfc)|1 if flags&0xfc else 0;b[0x22]=previous;b[0x24]=previous;b[0x90]=stick
                        state=Path('/private/tmp/hero-timing-input.bin');state.write_bytes(b)
                        m.prompt('loadstate /private/tmp/hero-timing-base.a8s');m.prompt(f'read {state} 0000 0100');m.prompt(f'c 8177 a2 {stick|240:02x} ea');m.prompt('setpc 8177')
                        deltas=[]
                        for pc in [0x857a,0x8828,0x88bc,0x8177]:
                            m.prompt(f'bpc {pc:04x}');m.prompt('cont');m.prompt(f'write 0004 0004 {dump}');deltas.append((dump.read_bytes()[0]-phase)&255)
                        m.prompt('write 0022 0022 /private/tmp/hero-timing-room.bin')
                        if Path('/private/tmp/hero-timing-room.bin').read_bytes()[0]!=room:
                            m.prompt('write 0000 bfff /private/tmp/hero-timing-failed.bin');raise AssertionError((level,room,kind,phase,deltas))
                        timings.append(deltas)
                    result[f'{level}:{room}:{kind}']=timings
            print('Measured original room timing: mission',level+1,flush=True)
    finally:m.close()
    target=ROOT/'hero/assets/timing.js';target.write_text('// Original VBI crossing profiles, measured offline. No CPU code.\nglobalThis.HERO_TIMING='+json.dumps({'sourceSha256':SHA,'rooms':result},separators=(',',':'))+';\n');print('Exported',len(result)*4,'original room timing profiles.')
if __name__=='__main__':capture()
