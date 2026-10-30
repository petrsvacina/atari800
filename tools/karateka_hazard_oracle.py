#!/usr/bin/env python3
"""Offline gate/hawk original-routine fixtures; never used by the web runtime."""
import argparse,gzip,json,random
from pathlib import Path
from karateka_extract import ROOT,load

def export(scene2,scene3,destination):
 from py65.devices.mpu6502 import MPU
 def execute(mem,start,stop=None):
  c=MPU(memory=mem);c.pc=start;c.sp=0xfd;mem[0x1fe]=0xfe;mem[0x1ff]=0xff
  for _ in range(30000):
   if c.pc==(stop if stop is not None else 0xffff):return
   c.step()
  raise ValueError(f'Original did not return: {c.pc:04x}')
 def write(name,cases):
  (destination/(name+'-oracle.json.gz')).write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print(name,len(cases),flush=True)
 destination.mkdir(parents=True,exist_ok=True);rng=random.Random(0xb948);cases=[]
 for _ in range(10000):
  m=list(scene2);f=[rng.choice((1,6,7,14,19,22,31)),6,rng.randrange(5,40),0,0,rng.randrange(74),rng.randrange(54),1,1,0,0,255,1,0,0,0];m[0x60:0x70]=f
  g={0x20:rng.randrange(38),0xa7:rng.randrange(116,161),0xa8:rng.choice((0,1,2,10,255)),0xa9:rng.choice((0,3,4,5,6)),0xaa:rng.randrange(4),0x5d:rng.randrange(2),0x5e:rng.randrange(2),0xb6:rng.randrange(1,15),0x5b:0,0xb8:30,0x43:0,0x45:0,0x46:0,0x47:0,0x50:rng.randrange(2),0x7611:0}
  for a,v in g.items():m[a]=v
  execute(m,0xb948,0xba09)
  cases.append({'f':f,'g':g,'expected':[m[0x60:0x70],{a:m[a] for a in g}]})
 write('gate',cases);rng=random.Random(0xa806);cases=[]
 for _ in range(16000):
  m=list(scene3);f=[rng.randrange(38),6,rng.randrange(3,40),0,0,0,0,0,0,0,rng.choice((0,1,255)),255,1,0,0,0];m[0x60:0x70]=f
  g={0x90:rng.choice((0,0,0,1,5)),0x91:rng.randrange(2,48),0x92:rng.randrange(9,17),0x93:rng.choice((108,121,130)),0x94:rng.choice((254,4)),0x95:rng.randrange(15),0x96:rng.randrange(2),0x97:0,0x98:1,0xa4:rng.randrange(3),0xa5:2,0x5d:rng.randrange(2),0x5e:rng.randrange(2),0xb7:rng.randrange(1,15),0x5c:0,0xba:0,0x4e:0,0x43:0,0x40:0,0x83:0,0x89:0}
  for a,v in g.items():m[a]=v
  execute(m,0xa806)
  cases.append({'f':f,'g':g,'expected':{a:m[a] for a in g}})
 write('hawk',cases)
 # The hawk already appears in the palace bank, with different retreat speed
 # and hit behaviour. Do not substitute the later bird's routine.
 cases=[]
 for _ in range(10000):
  m=list(scene2);f=[rng.randrange(38),6,rng.randrange(3,40),0,0,0,0,0,0,0,rng.choice((0,1,255)),255,1,0,0,0];m[0x60:0x70]=f
  g={0x90:rng.choice((0,0,0,1,5)),0x91:rng.randrange(2,48),0x92:rng.randrange(9,17),0x93:rng.choice((108,121,130)),0x94:rng.choice((254,2)),0x95:rng.randrange(6),0x96:rng.randrange(2),0x97:0,0xa4:rng.randrange(3),0xa5:2,0x5d:rng.randrange(2),0x48:rng.randrange(256),0xba:0,0x4e:0,0x43:0,0x40:0,0x54:0,0x89:0}
  for addr,value in g.items():m[addr]=value
  execute(m,0xb580);cases.append({'f':f,'g':g,'expected':{addr:m[addr] for addr in g}})
 write('palace-hawk',cases)

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--scene2',type=Path,required=True);p.add_argument('--scene3',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');a=p.parse_args();export(load(a.scene2),load(a.scene3),a.output)
