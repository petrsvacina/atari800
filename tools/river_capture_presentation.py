#!/usr/bin/env python3
"""Original DLI palette transitions and fuel marker, from a real Atari raster.
Development Atari800 build needs the DUMPSCREEN monitor command; no emulator
or executable game is published with the native web port.
"""
import argparse,base64,collections,gzip,hashlib,json,os,pty,subprocess,tempfile
from pathlib import Path
from karate_extract_backgrounds import Monitor
ROOT=Path(__file__).resolve().parents[1]
class RasterMonitor(Monitor):
 def __init__(self,executable):
  self.master,slave=pty.openpty();self.process=subprocess.Popen([str(executable),'-no-autosave-config','-nosound','-no-video-accel','-nobasic','-xe','-ntsc','-turbo','-refresh','1','-monitor','-run',str(ROOT/'River Raid.xex')],stdin=slave,stdout=slave,stderr=slave,start_new_session=True,env={**os.environ,'SDL_VIDEODRIVER':'dummy','SDL_AUDIODRIVER':'dummy'});os.close(slave);self.prompt()
def capture(executable):
 assert hashlib.sha256((ROOT/'River Raid.xex').read_bytes()).hexdigest()=='a6c3a5f0f8a70632a8402bf54025bba18ec517e12107873c814c8328712a7c3b'
 m=RasterMonitor(executable)
 with tempfile.TemporaryDirectory(prefix='river-presentation-',dir='/private/tmp') as folder:
  folder=Path(folder);dump=folder/'ram.bin';screen=folder/'screen.bin'
  def ram():m.prompt(f'write 0000 bfff {dump}');return dump.read_bytes()
  def pixels():
   m.prompt(f'DUMPSCREEN {screen}');data=screen.read_bytes();assert len(data)==384*240;return data
  def frames():
   for _ in range(3):m.prompt('f 001a 0022 ff');m.prompt('cont')
  try:
   m.prompt('bpc a19e');m.prompt('cont');m.prompt('c 09 00');m.prompt('sety 00');m.prompt('setpc a680');m.prompt('cont')
   for _ in range(150):
    m.prompt('cont');b=ram()
    if b[0x76]==47:break
   else:raise ValueError('Original ready state not reached')
   fuel=[]
   for value in [65535,32768,16384,2048,0]+[v for v in range(0,65536,2048) if v not in (32768,16384,2048,0)]:
    m.prompt(f'c 005b {value>>8:02x} {value&255:02x}');frames();b=ram();assert b[0x5b]*256+b[0x5c]==value
    data=pixels();fuel.append({'fuel':value,'pixels':base64.b64encode(b''.join(data[y*384+32:y*384+352] for y in range(180,212))).decode(),'gtia':m.prompt('gtia')})
   # The missile-DMA bits 2/3 are the original fuel pointer. Capture the
   # stationary gauge without them, retaining the real E, 1/2, F and frame.
   m.prompt('c 005b ff ff');b=ram()
   for address in range(0xb00,0xc00):
    if b[address]&12:m.prompt(f'c {address:04x} {b[address]&243:02x}')
   frames();data=pixels();fuel_base=base64.b64encode(b''.join(data[y*384+32:y*384+352] for y in range(180,212))).decode()
   # Uniform PF0 in all original LMS rows makes the DLI palette directly
   # observable without interpreting the source colour-selection algorithm.
   pointer=0x3f03;address=0
   for _ in range(160):
    op=b[pointer];pointer+=1
    if op&64:address=int.from_bytes(b[pointer:pointer+2],'little');pointer+=2
    m.prompt(f'f {address:04x} {address+47:04x} 55');address+=48
   m.prompt('f 0500 050a 00');m.prompt('f 0042 004c 00');m.prompt('c 004d 0a');m.prompt('c 004e 0a');m.prompt('c 0515 0e');m.prompt('c 0520 80');m.prompt('c 052b 01')
   scenes=[]
   for generated_flag in [128,132]:
    for bridge_flag in [128,132]:
     for y in [68,80,91,92,93,100,130,180,230,252]:
      for frame in [0,14]:
       m.prompt(f'c 0023 {generated_flag:02x}');m.prompt(f'c 004c {bridge_flag:02x}');m.prompt(f'c 000b {(bridge_flag&4)|0xd2:02x}');m.prompt(f'c 0016 {y:02x}');m.prompt(f'c 050a {frame:02x}');frames();b=ram();data=pixels()
       colors=[collections.Counter(data[row*384+32:row*384+352]).most_common(1)[0][0] for row in range(20,180)]
       scenes.append({'genFlags':b[0x23],'bridgeFlags':b[0x4c],'rawY':b[0x16],'frame':b[0x50a],'nearest':b[0x4e],'land':colors})
  finally:m.close()
 result={'sourceSha256':hashlib.sha256((ROOT/'River Raid.rom').read_bytes()).hexdigest(),'fuel':fuel,'fuelBase':fuel_base,'screenPhysicalOriginY':8,'scenes':scenes}
 (ROOT/'tools/fixtures/river-presentation-oracle.json.gz').write_bytes(gzip.compress(json.dumps(result,separators=(',',':')).encode(),mtime=0));print('Captured',len(scenes),'original DLI scenes and',len(fuel),'fuel rasters',flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--emulator',type=Path,default=Path('/private/tmp/river-atari-dev/atari800-7.2.1/src/atari800'));capture(p.parse_args().emulator)
