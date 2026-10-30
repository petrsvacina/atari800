#!/usr/bin/env python3
"""Export original common hit/health routine states, with all named side effects."""
import argparse,gzip,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from karateka_extract_sprites import call
FIELDS=[0x40,0x41,0x42,0x43,0x45,0x46,0x47,0x4b,0x4c,0x4d,0x4e,0x50,0x52,0x5a,0x5b,0x5c,0x5d,0x5e,0xb0,0xb1,0xb6,0xb7,0xb8,0xb9,0xba]
def export(memory,destination):
 rng=random.Random(0x7207);cases=[]
 for i in range(12000):
  f=lambda:[rng.randrange(42),rng.randrange(38),rng.randrange(2,45),0,rng.randrange(7),rng.randrange(4,74),rng.randrange(4,54),rng.choice((0,1,255)),rng.choice((0,1)),rng.choice((0,1,255)),rng.choice((0,1,255)),255,rng.choice((1,255)),0,0,rng.choice((0,255))]
  m=list(memory);hero=f();enemy=f();m[0x60:0x70]=hero;m[0x70:0x80]=enemy
  for a in FIELDS:m[a]=0
  for a,v in {0x40:rng.choice((0,1,2,3,4,136,255)),0x41:rng.choice((0,1,2,3,4,255)),0x42:rng.randrange(2),0x43:rng.randrange(2),0x4d:rng.randrange(6),0x4b:rng.randrange(2),0x4c:rng.randrange(2),0x50:rng.randrange(8),0x52:rng.randrange(256),0x5a:rng.randrange(2),0x5d:1,0x5e:1,0xb0:14,0xb1:14,0xb6:rng.randrange(1,15),0xb7:rng.randrange(1,15),0xb8:30,0xb9:30}.items():m[a]=v
  state={str(a):m[a] for a in FIELDS};call(m,0x701e);cases.append({'hero':hero,'enemy':enemy,'state':state,'expected':[m[0x60:0x70],m[0x70:0x80],{str(a):m[a] for a in FIELDS}]})
 destination.mkdir(parents=True,exist_ok=True);(destination/'battle-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original hit integrations')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');a=p.parse_args();export(load(a.memory),a.output)
