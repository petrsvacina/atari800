#!/usr/bin/env python3
"""Capture original Atari800 scanout, including ANTIC glyphs and PMG placement."""
import argparse
import base64
import gzip
import json
import re
from pathlib import Path
import tempfile
from neverstory_capture import Capture
from shift_original import ROOT, SHA, image, Original


def capture(args):
    image()
    records=[]
    with tempfile.TemporaryDirectory(prefix='shift-graphics-',dir='/private/tmp') as folder:
        folder=Path(folder)
        m=Capture(args.emulator,ROOT/'shift.xex')
        try:
            m.prompt('bpc 3c95');m.prompt('cont');m.prompt('bpc ffff')
            m.prompt(f'savestate {folder}/initial.a8s')
            for level in range(37):
                for flip in (False,True):
                    m.prompt(f'loadstate {folder}/initial.a8s');m.prompt('bpc ffff');m.prompt('bline 999')
                    m.prompt(f'c 0d {level:02x}');m.prompt('c 19 12 34')
                    m.prompt('r 4bda')
                    m.prompt('r 408b')
                    if flip:m.prompt('r 4533')
                    m.prompt(f'write 0 ffff {folder}/state.bin')
                    memory=(folder/'state.bin').read_bytes()
                    state=object.__new__(Original);state.memory=memory
                    snapshot=state.state()
                    snapshot['spriteColor']=int(re.search(r'COLPM0=([0-9A-F]{2})',m.prompt('gtia')).group(1),16)
                    m.prompt('c 1000 4c 00 10');m.prompt('setpc 1000');m.frame()
                    m.prompt(f'DUMPSCREEN {folder}/pixels.bin')
                    raw=(folder/'pixels.bin').read_bytes()
                    assert len(raw)==384*240
                    visible=b''.join(raw[y*384+32:y*384+352] for y in range(240))
                    records.append({'level':level,'flipped':flip,'state':snapshot,
                        'fonts':[list(memory[0x2400:0x2800]),list(memory[0x2800:0x2c00])],
                        'pixels':base64.b64encode(visible).decode()})
                print('Captured real Atari800 Shift scanout',level+1,flush=True)
        finally:m.close()
    dest=ROOT/'research/shift/raster-oracle.json.gz'
    dest.write_bytes(gzip.compress(json.dumps({'sourceSha256':SHA,'frames':records},separators=(',',':')).encode(),mtime=0))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emulator',type=Path,required=True)
    capture(parser.parse_args())
