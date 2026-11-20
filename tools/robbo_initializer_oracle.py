#!/usr/bin/env python3
"""Capture pure Robbo PIPA initialization from the supplied XEX, offline only.

HALT, SETV and sound calls are isolated; CHNMON/font copies and PUT execute.
These cases check level initialization, not VBI timing or column wipe cadence.
"""
import argparse,gzip,hashlib,json,sys
from pathlib import Path
try:
 from py65.devices.mpu6502 import MPU
except ImportError:
 sys.path.insert(0,'/private/tmp/robbo-deps')
 from py65.devices.mpu6502 import MPU
ROOT=Path(__file__).resolve().parents[1]
SHA='75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb'
FIELDS={'x':0x92,'y':0x93,'scanX':0x94,'scanY':0x95,'fx':0x96,'fy':0x97,'lm':0x98,'scrolling':0x99,'scrollCounter':0x9a,'tele':0x9b,'fac':0x9c,'level':0x9d,'keys':0x9e,'lives':0x9f,'screws':0xa0,'lastLifeLevel':0xa1,'ammo':0xa2,'demo':0xa3,'moving':0xa8,'counter':0x266c,'robotPhase':0x275e,'shotCooldown':0x2941}

def case(base,level):
 mem=list(base);cpu=MPU(memory=mem);cpu.pc=0x2400;cpu.sp=0xfd
 mem[0x9d:0xa4]=[level,0,8,0,0,0,0];mem[0x21c:0x220]=[0]*4;mem[0x278:0x27a]=[15,15];mem[0x284:0x286]=[1,1]
 halts=0;sounds=[];vectors=[]
 for n in range(300000):
  if cpu.pc==0x2505:break
  if cpu.pc in (0x32cf,0xb800,0xe45c):
   if cpu.pc==0x32cf:halts+=1
   elif cpu.pc==0xb800:sounds.append(cpu.a)
   else:vectors.append([cpu.a,cpu.x,cpu.y])
   cpu.pc=(cpu.stPopWord()+1)&65535
  else:cpu.step()
 else:raise RuntimeError(f'PIPA level {level} did not reach PCLO: ${cpu.pc:04X}')
 state={k:mem[a] for k,a in FIELDS.items()}
 state.update(score=mem[0xa4:0xa7],colors=mem[0x2c4:0x2c9],border=mem[0x2c3],cameraAddress=mem[0x36e7]+256*mem[0x36e8],targetAddress=mem[0x86]+256*mem[0x87])
 return {'level':level,'state':state,'map':mem[0x700:0x900],'font':mem[0x1c00:0x2000],'screen':mem[0x1000:0x1800],'haltCalls':halts,'sounds':sounds,'setVectors':vectors,'instructions':n}

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--ram',type=Path,required=True);parser.add_argument('--output',type=Path,default=ROOT/'tools/fixtures/robbo-initializer.json.gz');args=parser.parse_args()
 assert hashlib.sha256((ROOT/'Robbo.xex').read_bytes()).hexdigest()==SHA
 base=args.ram.read_bytes();assert len(base)==65536 and base[0x2400:0x2405]==bytes.fromhex('a9008d2f02')
 cases=[case(base,level) for level in range(56)]
 payload={'sourceSha256':SHA,'reference':'Pure original PIPA through first PCLO; HALT, SOUND and SETV stubbed, not a timing oracle','entry':0x2400,'stop':0x2505,'cases':cases}
 args.output.write_bytes(gzip.compress(json.dumps(payload,separators=(',',':')).encode(),mtime=0));print('Captured',len(cases),'original PIPA initializers; halt counts',sorted(set(c['haltCalls'] for c in cases)),'lastLifeLevel',sorted(set(c['state']['lastLifeLevel'] for c in cases)),'counter',sorted(set(c['state']['counter'] for c in cases)))
if __name__=='__main__':main()
