"""Offline original character-composition fixtures with expected bitmap hashes."""
import argparse,json,random,gzip,hashlib
from karateka_extract import ROOT,load
from pathlib import Path
from py65.devices.mpu6502 import MPU
from karateka_bitmap_oracle import background
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');args=p.parse_args();m=load(args.memory);rng=random.Random(0x6815);cases=[]
for i in range(2600):
 f=[rng.randrange(42),rng.randrange(38),rng.choice((-3,0,3,12,16,25,35,40,43))&255,0,0,0,0,0,0,0,0,255,rng.choice((1,255)),0,0,0];style=rng.randrange(7);alternate=rng.randrange(2);shift=rng.randrange(8);seed=rng.randrange(0x100000000);mem=list(m);mem[0x20:0x30]=f;mem[0x3010:0x47f8]=background(seed)
 for a,v in {7:0x20,0x50:shift,0x36:alternate,0x3e:style,0x4d:0,0x44:0,0xf:0}.items():mem[a]=v
 c=MPU(memory=mem);c.pc=0x6815;c.sp=0xfd;mem[0x1fe]=0xfe;mem[0x1ff]=0xff
 for _ in range(100000):
  if c.pc==0xffff:break
  c.step()
 else:raise RuntimeError(hex(c.pc))
 cases.append({'fighter':f,'style':style,'alternate':alternate,'shift':shift,'seed':seed,'sha256':hashlib.sha256(bytes(mem[0x3010:0x47f8])).hexdigest(),'drawX':mem[0x23]})
args.output.mkdir(parents=True,exist_ok=True)
(args.output/'character-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print(len(cases))
