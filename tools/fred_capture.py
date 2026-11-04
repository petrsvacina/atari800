#!/usr/bin/env python3
"""Capture original Fred RAM/raster fixtures, strictly as offline references."""
import argparse
from pathlib import Path
from fred_original import ROOT,SOURCE,image
from neverstory_capture import Capture
from extract_assets import png

def capture(args):
    image();args.output.mkdir(parents=True,exist_ok=True)
    m=Capture(args.emulator,SOURCE)
    def save(name):
        m.prompt(f'write 0000 ffff {args.output}/{name}.bin');m.prompt(f'savestate {args.output}/{name}.a8s')
    def raster(name):
        m.prompt('bpc ffff');m.prompt('c 0c00 4c 00 0c');m.prompt('setpc 0c00');m.frame();m.prompt(f'dumpscreen {args.output}/{name}.screen')
        pal=(ROOT/'research/neverending-story/default.act').read_bytes();raw=(args.output/f'{name}.screen').read_bytes()
        png(args.output/f'{name}.png',384,240,b''.join(pal[i*3:i*3+3]+b'\xff' for i in raw))
    try:
        m.prompt('bpc bf00');m.prompt('cont');save('loader')
        m.prompt('setpc 3000');m.prompt('bpc 32aa');m.prompt('cont')
        # Only the development keyboard-wait is bypassed. Restore immediately
        # after original initialization; none of this code ships to the web.
        m.prompt('c 32aa 38 60');m.prompt('bpc 2744');m.prompt('cont');m.prompt('c 32aa a5 14');save('game')
        m.prompt('bpc 2758');m.prompt('cont');m.prompt('cont');save('frame');raster('frame')
        for name,pc,stop in [('menu',0x3000,0x310f),('transition',0x14fc,0x1560),('ending',0x3054,0x3196)]:
            m.prompt(f'loadstate {args.output}/frame.a8s');m.prompt('bline 999');m.prompt('c 35cf 00')
            m.prompt(f'setpc {pc:04x}');m.prompt(f'bpc {stop:04x}');m.prompt('cont');save(name);raster(name)
        print('Captured original initialization, first frame, menu, level transition and ending.')
    finally:m.close()

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--emulator',type=Path,required=True);p.add_argument('--output',type=Path,required=True);capture(p.parse_args())
