#!/usr/bin/env python3
"""Rebuild semantic Karateka fixtures with an offline original 6502 reference.

Requires py65; use only loaded RAM extracted from the supplied hashed disk.
Fixtures contain input/output values, never original code or emulator state.
"""
import argparse,gzip,json,random
from pathlib import Path
from karateka_extract import ROOT,load,oracle as motion_oracle

def rebuild(memory,destination):
 from py65.devices.mpu6502 import MPU
 destination.mkdir(parents=True,exist_ok=True)
 import tempfile
 with tempfile.TemporaryDirectory(prefix='karateka-motion-') as tmp:
  folder=Path(tmp);motion_oracle(memory,folder);(destination/'motion-oracle.json.gz').write_bytes(gzip.compress((folder/'motion-oracle.json').read_bytes(),mtime=0))
 def call(mem,address,attack=0):
  cpu=MPU(memory=mem);cpu.pc=address;cpu.y=attack;cpu.sp=0xfd;mem[0x1fe]=0xfe;mem[0x1ff]=0xff
  for _ in range(12000):
   if cpu.pc==0xffff:return cpu
   cpu.step()
  raise ValueError(f'Original routine did not return: {cpu.pc:04x}')
 rng=random.Random(0x6b00);cases=[]
 for _ in range(12000):
  mem=list(memory)
  f=[rng.randrange(38),rng.randrange(38),rng.randrange(5,46),0,rng.randrange(7),rng.randrange(74),rng.randrange(54),rng.choice((0,1,255)),rng.choice((0,1)),0,0,255,255,0,0,rng.choice((0,255))]
  h=f.copy();h[0]=rng.randrange(38);h[2]=rng.randrange(5,36);h[15]=rng.choice((0,255));h[5]=rng.randrange(74)
  state={0x30:rng.choice((0,1)),0x33:rng.randrange(4,18),0x44:rng.randrange(2),0x45:0,0x46:0,0x47:0,0x48:rng.randrange(256),0x4b:rng.randrange(2),0x4c:rng.randrange(2),0x4d:rng.randrange(6),0x50:rng.randrange(2),0x52:rng.choice((0,11,27,48,255)),0x5d:rng.randrange(2),0x5e:1,0xd0:rng.randrange(1,5),0xd7:rng.randrange(256),0xd8:rng.randrange(256),0xd9:rng.randrange(256)}
  mem[0x20:0x30]=f;mem[0x60:0x70]=h
  for a,v in state.items():mem[a]=v
  call(mem,0x6b00);cases.append({'f':f,'hero':h,'g':state,'expected':[mem[0x20:0x30],{a:mem[a] for a in (0x45,0x46,0x47,0x48)}]})
 (destination/'combat-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original guard decisions')
 # A separate seed prevents the contact fixture depending on the AI test count.
 rng=random.Random(0x6b00);cases=[]
 for pose in range(42):
  for attack in (0,1,2,3,4,5,6,7,8,255):
   for distance in range(3,15):
    for side in (0,1):
     mem=list(memory);heroPose=rng.randrange(34);heroMode=rng.choice((0,255));heroX=16;mem[0x60]=heroPose;mem[0x62]=heroX;mem[0x6f]=heroMode;mem[0x32]=memory[0x70c6+pose];mem[0x33]=distance;mem[0x5e]=1;mem[0xa3]=side
     cpu=call(mem,0x7366,attack);cases.append({'pose':pose,'attack':attack,'distance':distance,'heroPose':heroPose,'heroMode':heroMode,'heroX':heroX,'side':side,'expected':[cpu.a,mem[0x62]]})
 (destination/'contact-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original contact classifications')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');a=p.parse_args();rebuild(load(a.memory),a.output)
