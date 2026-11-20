#!/usr/bin/env python3
"""Measure original Robbo PCLO/CHNGCV cadence in headless Atari800.

Requires a native-title-entry save state captured from the supplied XEX.
The PAL emulator is an offline reference only. All snapshots stay in --output.
"""
import argparse,hashlib,json,re
from pathlib import Path
from neverstory_capture import Capture
ROOT=Path(__file__).resolve().parents[1]
SHA256='75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb'

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--emulator',type=Path,default=Path('/opt/homebrew/bin/atari800'))
 parser.add_argument('--state',type=Path,required=True)
 parser.add_argument('--output',type=Path,required=True)
 parser.add_argument('--cycles',type=int,default=80,choices=range(60,101))
 args=parser.parse_args();root=ROOT;out=args.output.resolve();out.mkdir(parents=True,exist_ok=True);exe=args.emulator
 assert hashlib.sha256((root/'Robbo.xex').read_bytes()).hexdigest()==SHA256
 log=[];results=[]
 for level in [0,55]:
  m=Capture(exe,root/'Robbo.xex')
  try:
   for cmd in [f'loadstate {args.state}','bline 999','bpc ffff',f'c 9d {level:02x} 00 08 00 00 00 00','c a3 00','c 21c 00 00','c 278 0f 0f','c 284 01 01','setpc 2400','bpc 2505']:
    m.prompt(cmd)
   stopped=m.prompt('cont')
   def snap(stage,stopped):
    m.prompt(f'write 0000 37ff {out}/cadence-live.bin');b=(out/'cadence-live.bin').read_bytes()
    r=re.search(r'\n\s*(\d+)\s+(\d+)\s+A=',stopped)
    sample={'stage':stage,'rtc':int.from_bytes(b[0x12:0x15],'big'),'clock':b[0x14],'timer':list(b[0x21c:0x220]),'scanline':int(r[1]) if r else None,'hpos':int(r[2]) if r else None,'level':b[0x9d],'lives':b[0x9f],'fac':b[0x9c],'tele':b[0x9b],'counter':b[0x266c],'scrolling':b[0x99],'camera':int.from_bytes(b[0x36e7:0x36e9],'little')}
    log.append(stopped);return sample
   first=snap('entry',stopped)
   m.prompt(f'savestate {out}/game-entry-{level}.a8s');m.prompt(f'write 0000 ffff {out}/game-entry-{level}.bin')
   if level==0:
    m.prompt(f'savestate {out}/game-entry.a8s');m.prompt(f'write 0000 ffff {out}/game-entry.bin')
   cycles=[];start=first
   for n in range(args.cycles):
    for pc,stage in [(0x2677,'scanStart'),(0x26ee,'scanEnd'),(0x2505,'nextEntry')]:
     m.prompt(f'bpc {pc:04x}');stopped=m.prompt('cont');sample=snap(stage,stopped)
     if stage=='scanStart':scan_start=sample
     elif stage=='scanEnd':scan_end=sample
     else:next_entry=sample
    cycles.append({'cycle':n,'entry':start,'scanStart':scan_start,'scanEnd':scan_end,'nextEntry':next_entry,'waitVbis':(scan_start['rtc']-start['rtc'])&0xffffff,'scanVbis':(scan_end['rtc']-scan_start['rtc'])&0xffffff,'tailVbis':(next_entry['rtc']-scan_end['rtc'])&0xffffff,'periodVbis':(next_entry['rtc']-start['rtc'])&0xffffff,'scanPeriodVbis':0 if not cycles else (scan_start['rtc']-cycles[-1]['scanStart']['rtc'])&0xffffff})
    start=next_entry
    if n%20==19:print('level',level,'cycles',n+1,'periods',sorted(set(c['periodVbis'] for c in cycles)),'scan',sorted(set(c['scanVbis'] for c in cycles)),'lives',next_entry['lives'],flush=True)
   results.append({'level':level,'entry':first,'cycles':cycles})
   m.prompt(f'write 0000 ffff {out}/game-end-{level}.bin');m.prompt(f'savestate {out}/game-end-{level}.a8s')
   (out/'cadence.json').write_text(json.dumps({'sourceSha256':hashlib.sha256((root/'Robbo.xex').read_bytes()).hexdigest(),'emulator':str(exe),'emulatorSha256':hashlib.sha256(exe.read_bytes()).hexdigest(),'titleStateSha256':hashlib.sha256(args.state.read_bytes()).hexdigest(),'video':'PAL, SDL dummy, no sound, no input','breaks':{'pclo':0x2505,'timerWritten':0x2677,'scanEnd':0x26ee},'scenes':results},indent=2)+'\n')
  finally:m.close()
 (out/'cadence-monitor.log').write_text('\n'.join(log))
 print('Wrote cadence.json',flush=True)

if __name__=='__main__':main()
