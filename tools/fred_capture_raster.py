#!/usr/bin/env python3
"""Render original CPU states in Atari800 and read actual GTIA hit registers."""
import argparse,base64,gzip,json
from pathlib import Path
from fred_original import SOURCE,Original
from neverstory_capture import Capture

def capture(args):
    args.output.mkdir(parents=True,exist_ok=True);fixtures=[]
    m=Capture(args.emulator,SOURCE)
    try:
        scenes=[(0,32,7),(0,96,7),(0,64,6),(4,96,7),(9,128,6)]
        for level,frames,stick in scenes+[(0,0,15)]*4:
            special=len(fixtures)-len(scenes) if not frames else None
            name=f'{level}-{frames}-{stick}' if special is None else ['enemy-overlap','stone-pot','ground-priority','half-tile-animation'][special]
            ref=Original(args.reference/'game.bin',level)
            for _ in range(frames):ref.frame(stick,False,85)
            if special is not None:
                mem=ref.memory;mem[0xb300:0xb500]=bytes(512);mem[0xae]=32;mem[0xa9]=80;mem[0xaa]=132 if special==2 else 80
                if special==0:mem[0xb300+3*64+9]=145
                if special==1:
                    mem[0xb300+2*64+10]=6;mem[0xb7]=90;mem[0xb8]=60;ref.cpu.a=63;ref.call(0x17aa)
                if special==2:mem[0xb300+7*64:0xb500]=bytes([35]*64)
                if special==3:
                    mem[0xb300+3*64+9]=146;mem[0x2e8d]=1;mem[0x2e7d]=3
                ref.call(0x2317);ref.call(0x291a);mem[0x2e67]=mem[0x2e66]
                ref.call(0x2874);ref.call(0x1b4f)
                mem[0x22f]=0x3d # The normal frame enables ANTIC after these calls.
            m.prompt(f'loadstate {args.reference}/frame.a8s');m.prompt('bpc ffff');m.prompt('bline 999')
            for lo,hi in [(0x80,0x300),(0xf00,0xc000)]:
                file=args.output/f'{name}-{lo:x}.bin';file.write_bytes(ref.memory.data[lo:hi]);m.prompt(f'read {file} {lo:04x}')
            m.prompt('c 0200 fb 2c');scroll=ref.memory.data[0xd404]
            m.prompt(f'c 0c00 a9 {scroll:02x} 8d 04 d4 4c 05 0c');m.prompt('setpc 0c00');m.frame();m.frame()
            screen=args.output/f'{name}.screen';m.prompt(f'dumpscreen {screen}')
            # Read I/O through actual LDA instructions, rather than the RAM
            # hidden behind GTIA's different read/write register meanings.
            code=[]
            for i in range(4):code += [0xad,4+i,0xd0,0x8d,i,0x0b]
            code += [0x4c,0x38,0x0c];m.prompt('c 0c20 '+' '.join(f'{v:02x}' for v in code))
            m.prompt('setpc 0c20');m.prompt('bline 999');m.prompt('bpc 0c38');m.prompt('cont')
            hits=args.output/f'{name}.hits';m.prompt(f'write 0b00 0b03 {hits}');h=hits.read_bytes();raw=screen.read_bytes()
            pixels=b''.join(raw[y*384+32:y*384+352] for y in range(240))
            fixtures.append({'name':name,'level':level,'frames':frames,'stick':stick,
              'pixels':base64.b64encode(pixels).decode(),'collisions':{'hero':h[0]|h[1],'projectile':h[2]|h[3]}})
            if special is not None:fixtures[-1].update(state=ref.state(),paintProjectile=special==1)
            print('Captured',name,flush=True)
        raw=(args.reference/'transition.screen').read_bytes();pixels=b''.join(raw[y*384+32:y*384+352] for y in range(240))
        fixtures.append({'name':'LEVEL 2 after 22 original VBI shifts','level':0,'frames':1,'stick':15,'stage':22,'pixels':base64.b64encode(pixels).decode()})
        args.fixture.write_bytes(gzip.compress(json.dumps(fixtures,separators=(',',':')).encode(),mtime=0))
    finally:m.close()

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('emulator','reference','output','fixture'):p.add_argument('--'+name,type=Path,required=True)
    capture(p.parse_args())
