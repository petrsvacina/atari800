#!/usr/bin/env python3
"""Verify bank initializers, including fields retained across disk loads.

Only OS/display setup and blocking film playback are stubbed. Actual game
initializers, common actor reset routines and guard setup execute unchanged.
"""
import argparse,gzip,json,random
from pathlib import Path
from py65.devices.mpu6502 import MPU
from karateka_extract import ROOT,load
FIELDS=[0x30,0x3e,0x44,0x45,0x46,0x47,0x48,0x4b,0x4c,0x4d,0x50,0x51,0x52,0x53,0x5b,0x5c,0x5d,0x5e,0x82,0x88,0x89,0x90,0x91,0x92,0x94,0x98,0xb0,0xb1,0xb6,0xb7,0xb8,0xb9,0xc5]
p=argparse.ArgumentParser(description=__doc__)
for s in (2,3,4):p.add_argument('--scene'+str(s),type=Path,required=True)
a=p.parse_args();rng=random.Random(0xb700);cases=[]
for scene,stop in ((2,0xb80b),(3,0xb7f5),(4,0xb7f1)):
 original=load(getattr(a,'scene'+str(scene)))
 for i in range(200):
  m=list(original);fighters=[[rng.randrange(256) for _ in range(16)] for _ in range(2)];m[0x60:0x70],m[0x70:0x80]=fighters
  old={0x48:rng.randrange(256),0x5b:rng.randrange(256),0x5c:rng.randrange(256),0x52:rng.randrange(256),0x53:rng.randrange(256),0x89:rng.randrange(256)}
  for address,value in old.items():m[address]=value
  for address in [0xe00,0x2400]+([0xad8c] if scene==2 else [0xb206] if scene==3 else []):m[address]=0x60
  cpu=MPU(memory=m);cpu.pc=0xb700
  for _ in range(100000):
   if cpu.pc==stop:break
   cpu.step()
  else:raise RuntimeError(hex(cpu.pc))
  cases.append({'scene':scene,'fighters':fighters,'old':old,'expected':[m[0x60:0x70],m[0x70:0x80],{str(x):m[x] for x in FIELDS}]})
(ROOT/'research/karateka/initializer-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original bank initializers')
