#!/usr/bin/env python3
"""Offline ATR reference: International Karate bonuses and tournament advancement."""
import argparse,gzip,json,random
from pathlib import Path
from ik_extract import load
FIELDS={'enabled':0x615d,'active':0x615e,'failed':0x6155,'remaining':0x6154,'travelCount':0x6162,'phase':0x6153,'dir':0x615b,'pos':0x6159,'speed':0x615a,'kind':0x615c,'height':0x6156,'difficulty':0x615f,'player':0xd1}
def rebuild(base,target):
 from py65.devices.mpu6502 import MPU
 rng=random.Random(0x5807)
 class Bus(list):
  def __init__(self,m):super().__init__(m);self.draws=[]
  def __getitem__(self,i):
   if i==0xd20a:v=rng.randrange(256);self.draws.append(v);return v
   return super().__getitem__(i)
 def run(m,pc,stop=0xffff):
  c=MPU(memory=m);c.pc=pc;c.sp=0xfd;m[0x1fe]=0xfe;m[0x1ff]=0xff
  for _ in range(100000):
   if c.pc==stop:return
   c.step()
  raise ValueError(f'Original did not return: {c.pc:04x}')
 def state(m):return {**{k:m[a] for k,a in FIELDS.items()},'positions':m[0xab:0xaf],'colors':m[0xb3:0xbc],'planes':[m[a+168:a+240] for a in (0x400,0x500,0x600,0x700)]}
 cases=[]
 for _ in range(5000):
  m=Bus(base)
  for k,a in FIELDS.items():m[a]=rng.randrange(256)
  for k,n in [('enabled',2),('active',2),('failed',8),('difficulty',3),('player',2),('kind',3),('dir',2),('remaining',17),('travelCount',17),('height',57),('phase',3),('speed',4)]:m[FIELDS[k]]=rng.randrange(n)
  m[0x14]=rng.randrange(256)
  for a in (0x400,0x500,0x600,0x700):m[a+168:a+240]=[rng.choice((0,0,0,255,128,24)) for _ in range(72)]
  before=state(m);frame=m[0x14];run(m,0x5807);cases.append({'kind':'weapon','state':before,'frame':frame,'draws':m.draws,'expected':state(m)})
 for broken in range(11):
  for bank in (0,8):
   m=Bus(base);m[0x6120]=bank;m[0x614a]=broken;previous=[m[(bank+4+i)*256+201:(bank+4+i)*256+232] for i in range(3)];run(m,0x31e2)
   cases.append({'kind':'tiles','broken':broken,'previous':previous,'expected':[m[(bank+4+i)*256+201:(bank+4+i)*256+232] for i in range(3)]})
 for reaction in range(256):
  m=Bus(base);m[0xdf]=reaction;run(m,0x311f,0x3135);count=m[0x614b];run(m,0x3170,0x3183);v=m[0x6132]
  cases.append({'kind':'reaction','reaction':reaction,'expected':[count,((v>>4)*10+(v&15))*100]})
 for _ in range(2000):
  m=Bus(base);multi=rng.choice((False,True));stage=rng.randrange(5 if multi else 100);cycle=rng.randrange(9);level=rng.randrange(6);difficulty=rng.randrange(3)
  m[0x619d]=0;m[0x50]=1;m[0x51]=int(multi);m[0xd3]=stage//10*16+stage%10;m[0x6150]=cycle;m[0xf6]=level;m[0x615f]=difficulty
  m[0x2d8a]=0x60 # Isolate transition from separately tested fighter/graphics initialization.
  run(m,0x2c43);stageOut=(m[0xd3]>>4)*10+(m[0xd3]&15)
  cases.append({'kind':'advance','state':{'stage':stage,'cycle':cycle,'level':level,'weaponDifficulty':difficulty,'multiplayer':multi},'expected':[{'stage':stageOut,'cycle':m[0x6150],'level':m[0xf6],'weaponDifficulty':m[0x615f],'multiplayer':multi},m[0xd0]]})
 target.write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original bonus/tournament cases')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=Path('research/international-karate/bonus-oracle.json.gz'));a=p.parse_args();rebuild(load(a.memory),a.output)
