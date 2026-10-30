#!/usr/bin/env python3
"""Original keyboard command selection and input latch side effects."""
import argparse,gzip,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from karateka_extract_sprites import call
def export(memory,destination):
 rng=random.Random(0x6e78);cases=[];fields=[0x45,0x46,0x47,0x50,0x62,0xdd,0xdf,0xf2]
 for _ in range(12000):
  m=list(memory);f=[rng.randrange(42),rng.randrange(38),rng.randrange(4,38),0,rng.randrange(7),rng.randrange(4,74),rng.randrange(4,54),rng.choice((0,1,255)),rng.randrange(2),rng.choice((0,1,255)),rng.choice((0,1,255)),255,1,0,0,rng.choice((0,255))];m[0x20:0x30]=f
  for a,v in {0x45:0,0x46:rng.choice((0,128,255)),0x47:rng.choice((0,128,255)),0x50:rng.randrange(8),0x62:f[2],0xdd:rng.choice((0,6,7,21,22,23,33,46,47,62,63)),0xdf:rng.choice((0,255)),0xf2:0}.items():m[a]=v
  state={str(a):m[a] for a in fields};call(m,0x6e78);cases.append({'fighter':f,'state':state,'expected':[m[0x20:0x30],{str(a):m[a] for a in fields}]})
 destination.mkdir(parents=True,exist_ok=True);(destination/'input-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original keyboard command states')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');a=p.parse_args();export(load(a.memory),a.output)
