#!/usr/bin/env python3
"""Render the original CMC music offline, with its verified complete loop."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import wave
import sys
from neverstory_capture import Capture
from neverstory2_extract import ROOT, SOURCES


def verify_period(args):
    sys.path.insert(0,str(args.py65_path))
    from py65.devices.mpu6502 import MPU
    memory=bytearray(args.memory.read_bytes());assert len(memory)==65536
    cpu=MPU(memory=memory)
    def call(pc,a=0,x=0,y=0):
        cpu.pc=pc;cpu.a=a;cpu.x=x;cpu.y=y;cpu.sp=0xff;cpu.stPushWord(0x11ff)
        for _ in range(20000):
            if cpu.pc==0x1200:return
            cpu.step()
        raise RuntimeError('Original CMC call did not return')
    call(0xa016,0x70,0,0x98);call(0xa016,0,0,0)
    seen={}
    for frame in range(30001):
        key=hashlib.sha256(bytes(memory[0x9800:0xa70d])+bytes(memory[0xd200:0xd209])).hexdigest()
        if key in seen:
            result={'first':seen[key],'repeat':frame,'period':frame-seen[key],'stateSha256':key}
            assert (result['first'],frame,result['period'])==(5761,11521,5760)
            args.period.write_text(json.dumps(result,indent=2)+'\n');print('Verified complete original player state:',result);return
        seen[key]=frame;call(0xa26e)
    raise RuntimeError('Original CMC player did not repeat')


def capture(args):
    period=json.loads(args.period.read_text()); first=period['first']; repeat=period['repeat']
    assert (first,repeat,period['period'])==(5761,11521,5760)
    args.output.mkdir(parents=True,exist_ok=True)
    m=Capture(args.emulator,args.disk,audio=True)
    try:
        m.prompt(f'loadstate {args.state}');m.prompt('bpc ffff');m.prompt('bline 999')
        # Call the original player initializer directly, then its PAL VBI
        # routine. No CPU program or RAM dump becomes a browser asset.
        m.prompt('c 1000 a9 70 a2 00 a0 98 20 16 a0 a9 00 a2 00 a0 00 20 16 a0 4c 12 10')
        m.prompt('setpc 1000');m.prompt('bpc 1012');m.prompt('cont');m.prompt('bpc ffff')
        # Original VBI is already installed at $A76A. Count complete frames
        # using the same raster edge, without advancing story logic.
        low=repeat&255;high=repeat>>8
        code=[0xa9,low,0x85,0xfa,0xa9,high,0x85,0xfb,
              0xad,0x0b,0xd4,0xc9,0x7c,0xb0,0xf9,0xad,0x0b,0xd4,0xc9,0x7c,0x90,0xf9,
              0xa5,0xfa,0xd0,0x02,0xc6,0xfb,0xc6,0xfa,0xa5,0xfa,0x05,0xfb,0xd0,0xe4,0x4c,0x25,0x10]
        m.prompt('c 1000 '+' '.join(f'{b:02x}' for b in code));m.prompt('setpc 1000');m.prompt('bpc 1025')
        wav=args.output/'music.wav';m.prompt(f'record {wav}');m.prompt('cont');m.prompt('stoprecord')
    finally:m.close()
    mp3=args.output/'music.mp3'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-ac','1','-c:a','libmp3lame','-b:a','96k',str(mp3)],check=True)
    with wave.open(str(wav),'rb') as w:duration=w.getnframes()/w.getframerate()
    fps=1773447/(312*114)
    assert abs(duration-repeat/fps)<.15,(duration,repeat/fps)
    asset={'encoding':'mp3','loopStart':first/fps,'loopEnd':repeat/fps,'data':base64.b64encode(mp3.read_bytes()).decode()}
    (ROOT/'neverending-story-2/assets/audio.js').write_text('// Original CMC/POKEY player rendered offline.\n'
        'globalThis.NEVERENDING2_AUDIO='+json.dumps(asset,separators=(',',':'))+';\n')
    record={'sources':{lang:sha for lang,(_,sha) in SOURCES.items()},'player':'$A016 initialization, $A26E PAL VBI tick',
            'period':period,'duration':duration,'loopStart':asset['loopStart'],'loopEnd':asset['loopEnd'],
            'wavSha256':hashlib.sha256(wav.read_bytes()).hexdigest(),'mp3Sha256':hashlib.sha256(mp3.read_bytes()).hexdigest()}
    (ROOT/'research/neverending-story-2/audio.json').write_text(json.dumps(record,indent=2)+'\n')
    print('Rendered original CMC music:',duration,'seconds; complete verified loop',period,flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('emulator','disk','state','period','output','memory','py65-path'):p.add_argument('--'+name,type=Path)
    p.add_argument('--verify-only',action='store_true');args=p.parse_args()
    required=('period','memory','py65_path') if args.verify_only else ('emulator','disk','state','period','output')
    if any(getattr(args,n) is None for n in required):p.error('Missing arguments: '+', '.join(required))
    if args.verify_only:verify_period(args)
    else:capture(args)
