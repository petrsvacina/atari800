#!/usr/bin/env python3
"""Compare native pixel composition with original offline blitters.

Only bitmap graphics, deterministic background seeds and expected hashes are
retained in fixtures. Original CPU code and RAM snapshots are not exported.
"""
import argparse,base64,gzip,hashlib,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from karateka_extract_sprites import call

def background(seed):
 out=bytearray()
 for _ in range(6120):
  seed=(seed*1664525+1013904223)&0xffffffff;out.append(seed>>24)
 return out

def export(memory,destination):
 rng=random.Random(0x2803);ptrs=sorted({memory[0x6000+i]+256*memory[0x602a+i] for i in range(42)});cases=[]
 for _ in range(1200):
  addr=rng.choice(ptrs);h,w=memory[addr:addr+2]
  if not h or not w or h>100 or w>40:continue
  art=memory[addr+2:addr+2+h*w];m=list(memory);seed=rng.randrange(0x100000000);m[0x3010:0x47f8]=background(seed)
  x=rng.choice((-5,-2,-1,0,1,10,33,38,39,40,42));y=rng.randrange(35,150);shift=rng.randrange(8);mode=rng.choice((0,1,255));routine=rng.choice((0x2803,0x2806,0x2809,0x280c))
  for a,v in {3:addr&255,4:addr>>8,5:x&255,6:y,7:0x20,0x10:shift,0xf:mode}.items():m[a]=v
  call(m,routine);cases.append({'kind':'blit','art':{'width':w*4,'height':h,'data':list(art)},'x':x,'y':y,'shift':shift,'mode':mode,'routine':routine,'seed':seed,'sha256':hashlib.sha256(bytes(m[0x3010:0x47f8])).hexdigest()})
 for _ in range(1000):
  left=rng.choice((-5,-1,0,1,10,20,38));right=rng.randrange(max(1,left+1),45);top=rng.randrange(20,100);bottom=rng.randrange(max(top,35)+1,190);pattern=rng.randrange(256);alternate=rng.randrange(256);routine=rng.choice((0x2cc0,0x2cc3));seed=rng.randrange(0x100000000);m=list(memory);m[0x3010:0x47f8]=background(seed)
  for a,v in {5:left&255,6:top,7:0x20,8:bottom,9:right,2:pattern,0x12:alternate}.items():m[a]=v
  call(m,routine);cases.append({'kind':'rectangle','left':left,'right':right,'top':top,'bottom':bottom,'pattern':pattern,'alternate':alternate if routine==0x2cc3 else None,'seed':seed,'sha256':hashlib.sha256(bytes(m[0x3010:0x47f8])).hexdigest()})
 destination.mkdir(parents=True,exist_ok=True);(destination/'bitmap-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original bitmap/rectangle cases')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');a=p.parse_args();export(load(a.memory),a.output)
