#!/usr/bin/env python3
"""Capture original runtime RAM and raster fixtures, for development only."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
from neverstory_capture import Capture
from neverstory2_extract import ROOT, SOURCE_DIR, SOURCES, files


def capture(args):
    args.output.mkdir(parents=True,exist_ok=True)
    source=SOURCE_DIR/SOURCES['cs'][0];assert hashlib.sha256(source.read_bytes()).hexdigest()==SOURCES['cs'][1]
    disk=args.output/'reference.atr';shutil.copyfile(source,disk)
    m=Capture(args.emulator,disk)
    try:
        m.prompt('bpc 226f')
        for name in ('AUTORUN','TITLESCR','GAMES'):
            m.prompt('cont');dump=args.output/'boot.bin';m.prompt(f'write 0000 ffff {dump}')
            assert dump.read_bytes()[0x226f:0x22af]==files('cs')[name+'.CTB'][8:72]
        m.prompt('bpc 2721');m.prompt('cont');m.prompt('c 02fc 0c')
        m.prompt('bpc 226f');m.prompt('cont');m.prompt('bpc f196');m.prompt('cont')
        m.prompt(f'write 0000 ffff {args.output}/cs-game.bin');m.prompt(f'savestate {args.output}/cs-game.a8s')
        m.prompt('bpc ffff');m.prompt('c 1000 4c 00 10');m.prompt('setpc 1000');m.frame()
        m.prompt(f'dumpscreen {args.output}/initial.screen')
        initial=(args.output/'initial.screen').read_bytes()
        cropped=b''.join(initial[y*384+32:y*384+352] for y in range(20,220))
        fixtures=[]
        colors={'HEJKAL.MIC':220,'INGAME.MIC':0,'MIRROR.MIC':15,'LAKE.MIC':0,'ROCKBITE.MIC':10,
                'GATE.MIC':2,'CHEST.MIC':38,'DOOR.MIC':38,'FOREST.MIC':220,'THEEND.MIC':15,'KING.MIC':15}
        for language in ('cs','en'):
            source_files=files(language);font=args.output/'font.bin';font.write_bytes(source_files['NICE.FNT']);m.prompt(f'read {font} ac00')
            for name,color in colors.items():
                if name not in source_files:continue
                bitmap=args.output/'bitmap.bin';bitmap.write_bytes(source_files[name]);m.prompt(f'read {bitmap} b000')
                m.prompt(f'c 02c4 {color:02x}');m.frame();frame=args.output/'frame.screen';m.prompt(f'dumpscreen {frame}')
                raw=frame.read_bytes();pixels=b''.join(raw[y*384+32:y*384+352] for y in range(20,220))
                fixtures.append({'language':language,'image':name,'color':color,'sha256':hashlib.sha256(pixels).hexdigest()})
        record={'capture':'Atari800 PAL: real ANTIC/GTIA/DLI scanout; original image and font bytes; unchanged initial text buffer',
                'initialSource':'cs','initialSha256':hashlib.sha256(cropped).hexdigest(),
                'crop':{'x':32,'y':20,'width':320,'height':200},'cases':fixtures}
        (ROOT/'research/neverending-story-2/graphics.json').write_text(json.dumps(record,indent=2)+'\n')
        m.prompt(f'loadstate {args.output}/cs-game.a8s');m.prompt('bpc ffff');m.prompt('setpc 5a39')
        m.prompt('bpc 5a5e');m.prompt('cont');m.prompt('c 02fc 0c');m.prompt('bpc 226f');m.prompt('cont')
        m.prompt('bpc f196');m.prompt('cont');m.prompt(f'write 0000 ffff {args.output}/cs-game2.bin')
        m.prompt(f'savestate {args.output}/cs-game2.a8s')
        print('Captured both original chapter states and',len(fixtures),'raster/font/palette fixtures.',flush=True)
    finally:m.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emulator',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    capture(parser.parse_args())
