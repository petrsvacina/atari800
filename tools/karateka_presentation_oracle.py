#!/usr/bin/env python3
"""Offline original impact, hawk layers and gate-corpse pixel fixtures."""
import argparse,gzip,hashlib,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from karateka_extract_sprites import call
from karateka_bitmap_oracle import background
from py65.devices.mpu6502 import MPU
p=argparse.ArgumentParser(description=__doc__)
for s in (1,2,3):p.add_argument('--scene'+str(s),type=Path,required=True)
a=p.parse_args();ram={s:load(getattr(a,'scene'+str(s))) for s in (1,2,3)};rng=random.Random(0x74c0);cases=[]
def sha(m):return hashlib.sha256(bytes(m[0x3010:0x47f8])).hexdigest()
def init(scene):
 m=list(ram[scene]);seed=rng.randrange(2**32);shift=rng.randrange(8);m[0x3010:0x47f8]=background(seed);m[7]=32;m[0x50]=shift;return m,seed,shift
for i in range(600):
 m,seed,shift=init(1);flash=rng.randrange(3);ending=rng.choice((0,0,254));results=[rng.randrange(5),rng.randrange(5)];fighters=[];hawk=[rng.randrange(0,42),rng.randrange(108,150)]
 m[0x97]=flash;m[0x9a]=ending;m[0x91],m[0x93]=hawk;m[0xf1]=0
 for j in (0,1):
  f=[rng.randrange(34),6,rng.randrange(0,42),0,0,0,0,0,0,0,rng.choice((0,1,255)),255,1 if j else 255,0,0,0];fighters.append(f);m[0x20:0x30]=f
  # A small wrapper selects the result in X before invoking the original.
  m[0x1500:0x1507]=[0xa2,results[j],0x20,0xc0,0x74,0x60,0];call(m,0x1500)
 cases.append({'kind':'impact','seed':seed,'shift':shift,'flash':flash,'ending':ending,'results':results,'fighters':fighters,'hawk':hawk,'flashAfter':m[0x97],'sound':m[0xf1],'sha256':sha(m)})
for scene,routine in ((2,0xbd55),(3,0xa9fc)):
 for i in range(300):
  m,seed,shift=init(scene);state={0x90:0,0x91:rng.choice((0,1,12,34,40,250)),0x93:rng.choice((108,123,136)),0x94:rng.choice((2,4,252)),0x95:rng.randrange(6 if scene==2 else 15),0x55:rng.randrange(2),0x62:rng.randrange(4,35)}
  for key,val in state.items():m[key]=val
  call(m,routine);cases.append({'kind':'hawk','scene':scene,'seed':seed,'shift':shift,'state':state,'frame':m[0x95],'sha256':sha(m)})
for i in range(100):
 m,seed,shift=init(2);y=rng.randrange(116,154);phase=(shift+ram[2][0x609d+19])&7
 # $BC63 inherits the phase from the previously drawn hero's arms. Determine
 # that phase by drawing the original dead hero to a separate scratch buffer.
 m[0x20:0x30]=[19,19,33,0,0,39,39,0,0,0,0,255,1,0,0,0];m[0x36]=0;m[0x3e]=0;m[0x4d]=0;m[0x44]=0;m[0xf]=0
 call(m,0x6815);phase=m[0x10];m[0x3010:0x47f8]=background(seed);m[0xa7]=y;call(m,0xbc63)
 cases.append({'kind':'crushed','seed':seed,'shift':shift,'y':y,'phase':phase,'sha256':sha(m)})
(ROOT/'research/karateka/presentation-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original presentation fixtures')
