#!/usr/bin/env python3
"""Capture Robbo CVBL state from the supplied XEX's Atari800 RAM, offline only."""
import argparse,gzip,hashlib,json,random,sys
from pathlib import Path
try:
 from py65.devices.mpu6502 import MPU
except ImportError:
 sys.path.insert(0,'/private/tmp/robbo-deps')
 from py65.devices.mpu6502 import MPU
ROOT=Path(__file__).resolve().parents[1]
SHA='75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb'
FIELDS={'scrolling':0x99,'scrollCounter':0x9a,'level':0x9d,'keys':0x9e,'lives':0x9f,'screws':0xa0,'ammo':0xa2,'clock':0x14,'dliPhase':0x335a,'attract':0x4d,'vscroll':0xd405}

def write_word(mem,address,value):mem[address:address+2]=value.to_bytes(2,'little')
def read_word(mem,address):return int.from_bytes(mem[address:address+2],'little')

def frame(base,case):
 mem=list(base);cpu=MPU(memory=mem)
 for k,a in FIELDS.items():mem[a]=case['state'][k]
 write_word(mem,0x36e7,case['state']['cameraAddress']);write_word(mem,0x86,case['state']['targetAddress'])
 mem[0xa4:0xa7]=case['state']['score'];mem[0x2c8]=case['state']['colors'][4]
 mem[0x2300:0x2308]=case['glyph'];mem[0x3707:0x3757]=case['hud']
 cpu.pc=0x33b2;cpu.sp=0xfd;calls=0
 for n in range(2000):
  if cpu.pc==0xe462:break
  if cpu.pc==0xb803:
   calls+=1;cpu.pc=(cpu.stPopWord()+1)&65535
  else:cpu.step()
 else:raise RuntimeError(f'CVBL did not finish, PC ${cpu.pc:04X}')
 expected={k:mem[a] for k,a in FIELDS.items()}
 expected.update(cameraAddress=read_word(mem,0x36e7),targetAddress=read_word(mem,0x86),score=mem[0xa4:0xa7],colors=case['state']['colors'])
 expected['infoPhase']=(case['state']['infoPhase']+1)&7
 expected['cameraY']=(expected['cameraAddress']-0x1000)/32*8+expected['vscroll']
 expected['playerColors']=mem[0xd012:0xd016]
 return {'state':expected,'glyph':mem[0x2300:0x2308],'hud':mem[0x3707:0x3757],'soundCalls':calls}

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--ram',type=Path,required=True);parser.add_argument('--output',type=Path,default=ROOT/'tools/fixtures/robbo-vbi.json.gz');args=parser.parse_args()
 assert hashlib.sha256((ROOT/'Robbo.xex').read_bytes()).hexdigest()==SHA
 base=args.ram.read_bytes();assert len(base)==65536 and base[0x33b2:0x33b5]==bytes.fromhex('2003b8')
 rng=random.Random(0x33b2);cases=[]
 def add(name,overrides=None):
  s={k:0 for k in FIELDS};s.update(level=rng.randrange(256),keys=rng.randrange(256),lives=rng.randrange(256),screws=rng.randrange(256),ammo=rng.randrange(256),clock=rng.randrange(256),dliPhase=rng.randrange(256),attract=rng.randrange(256),vscroll=rng.randrange(8),cameraAddress=rng.randrange(0x1000,0x1541,32),targetAddress=rng.randrange(0x1000,0x17c1,32),score=[rng.randrange(256) for _ in range(3)],colors=[rng.randrange(256) for _ in range(5)],infoPhase=rng.randrange(8))
  if overrides:s.update(overrides)
  case={'name':name,'state':s,'glyph':[rng.randrange(256) for _ in range(8)],'hud':[rng.randrange(256) for _ in range(80)]}
  case['expected']=frame(base,case);cases.append(case)
 for flags in [0,0x40,0x41,0x42,0x80,0x81,0x82,0x43,0x83]:
  for counter in range(0,33):
   for camera in [0x1000,0x1020,0x10e0,0x1100,0x1460,0x1540]:
    add(f'phase-{flags:02x}-{counter}-{camera:04x}',{'scrolling':flags,'scrollCounter':counter,'cameraAddress':camera})
 for camera in [0x1000,0x1020,0x10e0,0x1100,0x1460,0x1540]:
  for delta in [-1,0,1]:
   for margin in [128,512]:
    add(f'threshold-{camera:04x}-{margin}-{delta}',{'scrolling':0,'cameraAddress':camera,'targetAddress':camera+margin+delta})
 for level in range(256):add(f'hud-level-{level}',{'level':level})
 for n in range(500):add(f'random-{n}',{'scrolling':rng.randrange(256),'scrollCounter':rng.randrange(256)})
 # Multi-frame episodes verify settling after all three 16-pixel phases.
 sequences=[]
 for name,camera,target in [('down',0x1000,0x1240),('up',0x10c0,0x10c0),('lower-edge',0x1480,0x17c0),('upper-edge',0x1000,0x1000)]:
  s={k:0 for k in FIELDS};s.update(level=55,keys=0x09,lives=0x12,screws=0x17,ammo=0x99,cameraAddress=camera,targetAddress=target,score=[0x12,0x34,0x56],colors=[0,2,4,6,8],infoPhase=0)
  start={'state':dict(s),'glyph':list(base[0x2300:0x2308]),'hud':list(base[0x3707:0x3757])};steps=[];case=start
  for clock in range(80):
   case['state']['clock']=clock;expected=frame(base,case);steps.append(expected)
   case={'state':dict(expected['state']),'glyph':expected['glyph'],'hud':expected['hud']}
  sequences.append({'name':name,'input':start,'frames':steps})
 data={'sourceSha256':SHA,'routine':0x33b2,'cases':cases,'sequences':sequences}
 args.output.write_bytes(gzip.compress(json.dumps(data,separators=(',',':')).encode(),mtime=0));print(f'Exported {len(cases)} CVBL states and {len(sequences)} x 80-frame scrolling episodes')
if __name__=='__main__':main()
