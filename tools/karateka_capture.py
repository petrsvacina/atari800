#!/usr/bin/env python3
"""Capture supplied Karateka ATR banks for offline native-port development.

Uses Atari800's monitor, always on a temporary private copy of the source.
DUMPSCREEN requires the development Atari800 monitor extension used by this repo.
The scanline breakpoint must alternate: CONT on the same scanline breaks again
on the next instruction, NOT on the next video frame.
Direct scene captures extract banks; they do not prove a normal campaign handover.
"""
import argparse,os,pty,shutil,tempfile
from pathlib import Path
import subprocess
from karate_extract_backgrounds import Monitor
from karateka_extract import ROOT,SOURCE_SHA256
import hashlib
class Capture(Monitor):
 def __init__(self,emulator,image,audio=False,palette=None):
  self.master,slave=pty.openpty()
  self.process=subprocess.Popen([str(emulator),'-no-autosave-config',*(['-sound','-audio16','-dsprate','44100'] if audio else ['-nosound']),*(['-paletten',str(palette)] if palette else []),'-no-video-accel','-windowed','-horiz-area','320','-vert-area','240','-horiz-shift','0','-vert-shift','0','-nobasic','-xe','-ntsc','-turbo','-refresh','1','-monitor',str(image)],stdin=slave,stdout=slave,stderr=slave,start_new_session=True,env={**os.environ,'SDL_VIDEODRIVER':'dummy','SDL_AUDIODRIVER':'dummy'})
  os.close(slave);self.prompt()
 def load_state(self,path):
  path=Path(path)
  if not path.is_file():raise FileNotFoundError(path)
  result=self.prompt(f'loadstate {path}')
  if 'Failed' in result or 'I/O failed' in result:raise RuntimeError(result)
 def run_to(self,address):
  self.prompt('bline 999');self.prompt(f'bpc {address:04x}')
  result=self.prompt('cont')
  if f'PC={address:04X}' not in result:raise RuntimeError(f'Wrong capture stop: {result}')
  return result
def capture(args):
 source=ROOT/'Karateka.atr'
 if hashlib.sha256(source.read_bytes()).hexdigest()!=SOURCE_SHA256:raise ValueError('Unsupported Karateka ATR')
 args.output.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(prefix='karateka-source-') as temp:
  image=Path(temp)/'source.atr';shutil.copyfile(source,image);m=Capture(args.emulator,image)
  try:
   # $3000 is the encrypted boot loader, not the game. Let the disk finish
   # loading/decrypting and break in the observed title wait routine.
   m.prompt('bpc b83e');m.prompt('cont');m.prompt('bpc ffff');m.prompt('bline 0');m.prompt('cont');m.prompt('bline 248');m.prompt('cont')
   title=args.output/'title.a8s';m.prompt(f'savestate {title}')
   m.prompt(f'write 0000 ffff {args.output / "title.bin"}')
   for scene in args.scenes:
    m.load_state(title);m.prompt('bline 999');m.prompt('c df 01');m.prompt('bpc 2e00');m.prompt('cont');m.prompt(f'c d0 {scene:02x}');m.prompt('bpc 2e76');m.prompt('cont')
    m.prompt(f'write 0000 ffff {args.output / f"scene-{scene}.bin"}');m.prompt(f'savestate {args.output / f"scene-{scene}.a8s"}');m.prompt('bpc ffff')
    for _ in range(args.frames):
     m.prompt('bline 0');m.prompt('cont');m.prompt('bline 248');m.prompt('cont')
    m.prompt(f'write 0000 ffff {args.output / f"scene-{scene}-active.bin"}');m.prompt(f'DUMPSCREEN {args.output / f"scene-{scene}.screen"}');m.prompt(f'savestate {args.output / f"scene-{scene}-active.a8s"}');print('Captured scene',scene,flush=True)
  finally:m.close()
 if hashlib.sha256(source.read_bytes()).hexdigest()!=SOURCE_SHA256:raise ValueError('Source changed during capture')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--emulator',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--scenes',type=int,nargs='+',default=[1,2,3,4]);p.add_argument('--frames',type=int,default=400);capture(p.parse_args())
