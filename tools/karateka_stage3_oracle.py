#!/usr/bin/env python3
"""Compare underground gameplay through camera/room transitions, before draw."""
import argparse,gzip,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from karateka_extract_sprites import call
from karateka_stage1_oracle import FIELDS as COMMON
FIELDS=sorted(set(COMMON+[0x84,0x90,0x91,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x9a,0xa4,0xa5,0xc5,0xed]))
def export(memory,destination):
 rng=random.Random(0xb804);pool=json.loads(gzip.decompress((ROOT/'research/karateka/stage1-oracle.json.gz').read_bytes()));cases=[]
 for i in range(7000):
  m=list(memory);m[0xba05]=m[0x7603]=m[0xc40]=m[0x2400]=0x60;fighters=[rng.choice(pool[:4000])['fighters'][j][:] for j in range(2)];fighters[0][2]=rng.randrange(5,34);fighters[1][2]=rng.randrange(21,40);m[0x60:0x70],m[0x70:0x80]=fighters
  for a in FIELDS:m[a]=0
  for a,v in {7:rng.choice((32,64)),0x30:2,0x3e:rng.randrange(3,7),0x44:rng.randrange(5),0x46:rng.choice((0,128,255)),0x47:rng.choice((0,128,255)),0x48:rng.randrange(256),0x4d:rng.choice((0,0,5)),0x50:rng.randrange(8),0x51:rng.randrange(256),0x52:rng.randrange(224,256),0x53:rng.choice((0,2,4,252,250)),0x5b:rng.randrange(30),0x5c:rng.randrange(30),0x5d:1,0x5e:1,0x82:1,0x84:rng.choice((0,5)),0x89:7,0x8b:15,0x90:rng.randrange(26),0x91:rng.randrange(5,46),0x92:16,0x93:rng.choice((108,121,130)),0x94:rng.choice((254,4)),0x95:rng.randrange(15),0x96:rng.randrange(2),0x98:1,0xa4:rng.randrange(1,3),0xa5:2,0xb0:10,0xb1:18,0xb6:rng.randrange(1,11),0xb7:rng.randrange(1,19),0xb8:30,0xb9:30,0xc4:255,0xc5:1,0xd0:3,0xdd:rng.choice((0,6,7,21,22,23,33,46,47,62,63)),0xdf:rng.choice((0,255)),0xed:rng.choice((0,5)),0x7611:0}.items():m[a]=v
  if i>=5000:m[0x5e]=m[0xb7]=0;m[0x4d]=0;m[0x70:0x80]=[19,19,25,0,0,36,36,0,0,0,0,255,255,0,0,0];fighters[1]=m[0x70:0x80]
  if m[0x4d]==5:m[0x70:0x80]=[19,19,25,0,0,36,36,0,0,0,0,255,255,0,0,0];fighters[1]=m[0x70:0x80]
  style=m[0x3e];m[0xd7]=memory[0xb4c4+style];m[0xd8]=memory[0xb4c8+style];m[0xd9]=memory[0xb4cc+style];state={str(a):m[a] for a in FIELDS};state['7']=m[7];call(m,0xb804);cases.append({'fighters':fighters,'state':state,'expected':[m[0x60:0x70],m[0x70:0x80],{str(a):m[a] for a in FIELDS}]})
 destination.mkdir(parents=True,exist_ok=True);(destination/'stage3-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original underground gameplay steps')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');a=p.parse_args();export(load(a.memory),a.output)
