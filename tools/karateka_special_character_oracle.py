#!/usr/bin/env python3
"""Check the extracted graphic operators at shifted/clipped actor positions."""
import argparse,gzip,hashlib,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from karateka_extract_sprites import call
from karateka_bitmap_oracle import background
def export(memory,destination):
 rng=random.Random(0xbc50);cases=[]
 for _ in range(1200):
  m=list(memory);seed=rng.randrange(0x100000000);m[0x3010:0x47f8]=background(seed);f=[rng.randrange(34),rng.randrange(27),rng.choice([0,1,3,10,20,33,38,40,42,250,255]),0,0,0,0,0,0,0,0,0,255,0,0,0];m[0x20:0x30]=f;shift=rng.randrange(8);kind=rng.choice((1,2))
  for a,v in {7:32,0x50:shift,0x36:0,0x3e:7,0x4d:kind,0x44:6,0xf:0,0x62:11}.items():m[a]=v
  call(m,0x6815);cases.append({'fighter':f,'shift':shift,'kind':kind,'seed':seed,'drawX':m[0x23],'sha256':hashlib.sha256(bytes(m[0x3010:0x47f8])).hexdigest()})
 destination.mkdir(parents=True,exist_ok=True);(destination/'special-character-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original special-character compositions')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');a=p.parse_args();export(load(a.memory),a.output)
