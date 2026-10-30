#!/usr/bin/env python3
"""Compare final-bank battle/recognition/reunion logic before its draw pass.

The terminal text loop itself is a presentation capture, excluded here.
"""
import argparse,gzip,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from karateka_extract_sprites import call
from karateka_stage3_oracle import FIELDS as BASE
FIELDS=sorted(set(BASE+[0x39,0x3b,0x58,0xa0,0xb706]))
def export(memory,destination):
 rng=random.Random(0xb7fa);pool=json.loads(gzip.decompress((ROOT/'research/karateka/stage1-oracle.json.gz').read_bytes()));cases=[]
 for i in range(5000):
  m=list(memory);m[0xb9e1]=m[0x7600]=m[0x7603]=m[0xc40]=m[0x2400]=0x60;fighters=[rng.choice(pool[:4000])['fighters'][j][:] for j in range(2)];fighters[0][2]=rng.randrange(5,34);fighters[1][2]=rng.randrange(16,41);m[0x60:0x70],m[0x70:0x80]=fighters
  for addr in FIELDS:m[addr]=0
  for addr,value in {7:rng.choice((32,64)),0x30:2,0x39:rng.randrange(23,37),0x3b:rng.randrange(20),0x3e:rng.choice((6,7)),0x44:rng.choice((4,5,6)),0x46:rng.choice((0,128,255)),0x47:rng.choice((0,128,255)),0x48:rng.randrange(256),0x4d:rng.choice((0,1,2)),0x50:0,0x51:17,0x52:224,0x53:0,0x58:rng.randrange(2),0x5b:rng.randrange(30),0x5c:rng.randrange(30),0x5d:1,0x5e:1,0x82:rng.randrange(2),0x84:rng.choice((0,5)),0x89:7,0x90:5,0x91:80,0x92:16,0x94:80,0x9a:rng.choice((0,0,2,254,255)),0xa0:rng.choice((0,5)),0xa4:2,0xa5:2,0xb0:8,0xb1:20,0xb6:rng.randrange(1,9),0xb7:rng.randrange(1,21),0xb8:30,0xb9:30,0xc4:255,0xc5:5,0xd0:4,0xd7:255,0xd8:255,0xd9:255,0xdd:rng.choice((0,6,7,21,22,23,33,46,47,62,63)),0xdf:rng.choice((0,255)),0xed:5,0xb706:rng.choice((0,255))}.items():m[addr]=value
  if i>=3500:m[0x5e]=m[0xb7]=0;m[0x70:0x80]=[19,19,25,0,0,36,36,0,0,0,0,255,255,0,0,0];fighters[1]=m[0x70:0x80]
  state={str(addr):m[addr] for addr in FIELDS};state['7']=m[7];call(m,0xb7fa);cases.append({'fighters':fighters,'state':state,'expected':[m[0x60:0x70],m[0x70:0x80],{str(addr):m[addr] for addr in FIELDS}]})
 destination.mkdir(parents=True,exist_ok=True);(destination/'stage4-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original final-bank gameplay steps')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');a=p.parse_args();export(load(a.memory),a.output)
