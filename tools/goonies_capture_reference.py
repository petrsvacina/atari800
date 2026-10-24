#!/usr/bin/env python3
"""Record development-only Atari reference snapshots for native regression tests.

The hardware joystick read is replaced with a chosen input; the RNG with a fixed
byte. Original physics and room routines run unchanged. No CPU code is exported.
"""
import argparse,base64,hashlib,json,sys,tempfile
from pathlib import Path
from karate_extract_backgrounds import Monitor
from goonies_extract_physics import ROOT,ORDER,word
SOURCE_SHA='ccdea8ff8e56b9d09436de1ec64094e2130dee41f2d3d921f8c02f256f16bed7'
FIELDS={'type':0x1f00,'vx':0x1f0b,'vy':0x1f16,'x':0x1f21,'y':0x1f2c,'frame':0x1f37,'climb':0x1f42,'direction':0x1f4d,'moving':0x1f58,'baseFrame':0x1f6e}

def actors(b):return [{key:b[a+i] for key,a in FIELDS.items()} for i in range(11)]
def capture(cases):
 source=ROOT/'Goonies/Goonies.atr'
 if hashlib.sha256(source.read_bytes()).hexdigest()!=SOURCE_SHA:raise ValueError('Unsupported ATR revision')
 m=Monitor(source);result=[]
 try:
  m.prompt('bpc 0786');m.prompt('cont')
  # This ATR has its RNG at $6324; the XEX relocates that helper to $641D.
  m.prompt('c 6324 a9 40 60')
  with tempfile.TemporaryDirectory(prefix='goonies-native-reference-') as folder:
   dump=Path(folder)/'ram.bin'
   for case in cases:
    room=ORDER[case['scene']]
    m.prompt('c 112d 00');m.prompt(f'c 112e {room:02x}');m.prompt('c 1130 ff');m.prompt('bpc 0786');m.prompt('setpc 074a');m.prompt('cont')
    m.prompt(f'write 0000 bfff {dump}');initial=dump.read_bytes()
    selected=case.get('selected',0);m.prompt(f'c 113d {selected:02x}')
    m.prompt('c 1f79 00 00 00 00 00 00 00 00 00 00 00')
    if selected:m.prompt('c 1f00 02 01')
    for actor,fields in case.get('actors',{}).items():
     for key,value in fields.items():m.prompt(f'c {FIELDS[key]+int(actor):04x} {value&255:02x}')
    control=31
    for key,bit in [('up',1),('down',2),('left',4),('right',8)]:
     if case.get('input',{}).get(key):control&=255^bit
    m.prompt(f'c 1450 a9 {control:02x} 60');m.prompt('c 1134 1f')
    frames=[];hurt_at=None
    for update in range(case['updates']):
     m.prompt('bpc 085b');m.prompt('setpc 07bd');m.prompt('cont');m.prompt(f'write 0000 bfff {dump}');b=dump.read_bytes()
     if b[0x112e]!=room:raise RuntimeError(f"Unexpected original scene transition in {case['name']}")
     if case.get('stopOnHurt') and b[0x113e]:hurt_at=update+1;break
     pointers=[word(b,a) for a in [0xd0,0xd2,0xd4,0xd6,0xd8]]
     frames.append({'bitmapSha256':hashlib.sha256(b[0x2290:0x3e10]).hexdigest(),'actors':actors(b),
      'rectangles':[[b[a+i] for a in pointers] for i in range(b[0xcf])]})
     Path(f'/private/tmp/goonies-case-{len(result)}-{update}.bin').write_bytes(b)
    result.append({**case,'initialActors':actors(initial),'initialFirePhase':initial[0x17f4]&3,'frames':frames,'hurtAt':hurt_at})
    print('Captured '+case['name'],flush=True)
  return {'sourceSha256':SOURCE_SHA,'randomByte':64,'cases':result}
 finally:m.close()

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('cases',type=Path);parser.add_argument('output',type=Path);args=parser.parse_args()
 args.output.write_text(json.dumps(capture(json.loads(args.cases.read_text())),separators=(',',':'))+'\n')
