#!/usr/bin/env python3
"""Capture cinematic-only original indexed rasters and POKEY states offline.

Requires the private Atari800 development monitor DUMPCINEMA command. Original
instructions execute only in this extraction process, never in the web game.
"""
import argparse,hashlib,json,re,sys
from pathlib import Path
from fractalus_original import ROOT,SHA256,processor,call
from neverstory_capture import Capture

p=argparse.ArgumentParser();p.add_argument('--reference',type=Path,default=Path('/private/tmp/fractalus-disk-research'))
p.add_argument('--output',type=Path,default=Path('/private/tmp/fractalus-intro-capture'))
p.add_argument('--scene',choices=['logo','station','launch'],required=True);p.add_argument('--level',type=int,default=4);p.add_argument('--frames',type=int,default=1600)
p.add_argument('--caption',choices=['original','blank','tens-mask','units-mask']+[f'digit{i}' for i in range(10)],default='original');args=p.parse_args()
assert hashlib.sha256((ROOT/'rescue-on-fractalus.atr').read_bytes()).hexdigest()==SHA256
exe=args.reference/'atari-dev/atari800-7.2.1/src/atari800'
out=args.output/(args.scene if args.scene!='launch' else f'launch-{args.level:02d}'+('' if args.caption=='original' else '-'+args.caption));out.mkdir(parents=True,exist_ok=True)
m=Capture(exe,args.reference/'rescue-on-fractalus.atr');records=[]
try:
    if args.scene=='logo':
        # Run the unmodified loader from a fresh boot through the logo entry.
        m.prompt('bpc 5000');m.prompt('cont');m.prompt('bpc 5110')
    else:
        state='title-loaded-private.a8s' if args.scene=='station' else 'game-standby-private.a8s'
        m.prompt(f'loadstate {args.reference/state}');m.prompt('bline 999');m.prompt('bpc ffff')
    if args.scene=='station':
        # The ship assets are already resident. Suppress the asynchronous loader
        # poll, retaining one complete original animation cycle for web playback.
        # Re-polling beyond normal loader completion would trigger its error path.
        m.prompt('c 1a33 ea ea ea');m.prompt('bpc 1a05');m.prompt('cont');m.prompt('bpc 1df5')
    elif args.scene=='launch':
        if args.caption!='original':
            # Rebuild the exact original door field, changing bitmap data only.
            # The emulated CPU/timers and actual mission level remain untouched.
            ram=bytearray((args.reference/'game-standby.bin').read_bytes());cpu=processor(ram)
            old=ram[0x2000:0x2f74];ram[0xb7]=0x88;call(cpu,0x3c83);call(cpu,0x672d);call(cpu,0x67c3)
            assert ram[0x2000:0x2f74]==old,'Original door reconstruction mismatch'
            ram[0xb7]=0x88;call(cpu,0x3c83);call(cpu,0x672d)
            if args.caption.startswith('digit'):
                ram[0x6d]=int(args.caption[-1])*11;call(cpu,0x67c3)
            elif args.caption.endswith('mask'):
                ram[0x94]=ram[0x95]
                for row in range(49,57):
                    ram[0x92]=row;call(cpu,0x66c6)
                    for column in range(39 if args.caption=='tens-mask' else 47,47 if args.caption=='tens-mask' else 55):
                        cpu.a=column;call(cpu,0x66d5)
            field=out/'door-field-private.bin';field.write_bytes(ram[0x2000:0x2f74]);m.prompt(f'read {field} 2000')
        m.prompt(f'c 6d {args.level:02x}');m.prompt('c 5a78 a9 06 ea');m.prompt('bpc 3eba')
    for number in range(args.frames):
        stopped=False;event=''
        for line in [0,248]:
            m.prompt(f'bline {line}');event=m.prompt('cont')
            if ('PC='+{'logo':'5110','launch':'3EBA','station':'1DF5'}[args.scene]) in event:stopped=True;break
        target=out/f'{number:04d}.bin';m.prompt(f'DUMPCINEMA {target}')
        raw=target.read_bytes();assert len(raw)==384*240+15,(target,len(raw))
        records.append({'frame':number,'clock':raw[-6],'vbi':f'{raw[-4]:02X}{raw[-5]:02X}',
                        'scroll':list(raw[-3:]),'pc':re.findall(r'PC=([0-9A-F]{4})',event)[-1:],
                        'sha256':hashlib.sha256(raw).hexdigest()})
        if number%100==0:print(args.scene,args.level,number,records[-1]['vbi'],records[-1]['scroll'],flush=True)
        if stopped and args.scene=='launch':
            m.prompt('c 5a78 ad 1f d0');m.prompt(f'write 0000 ffff {out}/flight-entry-private.bin');break
        if stopped:break
    m.prompt(f'DUMPPALETTE {out}/palette.rgb')
    (out/'manifest.json').write_text(json.dumps({'sourceSha256':SHA256,'scene':args.scene,'level':args.level,'caption':args.caption,'standard':'PAL','records':records,'complete':stopped,'reachedFlight':stopped and args.scene=='launch'},indent=2)+'\n')
    print('Captured',len(records),'frames; reached scene boundary:',stopped,flush=True)
finally:m.close()
