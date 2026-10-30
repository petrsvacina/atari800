#!/usr/bin/env python3
"""Original pan arithmetic fixtures; no emulation in the web game."""
import argparse,gzip,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from karateka_extract_sprites import call
p=argparse.ArgumentParser(description=__doc__)
for n in (1,2,3):p.add_argument(f'--scene{n}',type=Path,required=True)
p.add_argument('--output',type=Path,default=ROOT/'research/karateka');args=p.parse_args();rng=random.Random(0xb305);cases=[]
for scene,routines in [(1,(0xb305,0xb377)),(2,(0xb440,0xb4b2)),(3,(0xb3c7,0xb439))]:
 original=load(getattr(args,f'scene{scene}'))
 for _ in range(6000):
  mem=list(original);state={0x50:rng.randrange(8),0x51:rng.randrange(256),0x52:rng.choice((0,11,26,27,28,48,223,224,255,rng.randrange(256))),0x53:rng.choice((244,246,248,249,250,252,254,0,2,4,6)),0x44:rng.randrange(2),0x62:rng.randrange(256),0x72:rng.randrange(256),0x91:rng.randrange(256),0x6f:rng.choice((0,255)),0x65:rng.randrange(74)}
  for a,v in state.items():mem[a]=v
  direction=rng.randrange(2);call(mem,routines[direction]);cases.append({'scene':scene,'direction':direction,'state':state,'expected':{a:mem[a] for a in state}})
args.output.mkdir(parents=True,exist_ok=True);(args.output/'camera-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'pan cases')
