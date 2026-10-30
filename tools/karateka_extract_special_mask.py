#!/usr/bin/env python3
"""Extract the final opponent's separate original floor-mask geometry."""
import argparse,gzip,hashlib,json,random
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256,load
from karateka_extract_sprites import call
from karateka_bitmap_oracle import background
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);a=p.parse_args();m=load(a.memory)
t={name:list(m[addr:addr+34]) for name,addr in [('low',0xbf60),('high',0xbf82),('x',0xbfa4),('y',0xbfc6),('flip',0x62be)]};art={}
for pointer in {lo+256*hi for lo,hi in zip(t['low'],t['high'])}:
 h,w=m[pointer:pointer+2]
 if h==0 or w==0:continue
 if h>153 or w>40:raise ValueError(hex(pointer))
 art[pointer]={'width':w*4,'height':h,'data':list(m[pointer+2:pointer+2+h*w])}
(ROOT/'karateka/assets/special-mask.js').write_text('// Original final-opponent floor masks and geometry.\nglobalThis.KARATEKA_SPECIAL_MASK='+json.dumps({'sourceSha256':SOURCE_SHA256,'tables':t,'art':art},separators=(',',':'))+';\n')
rng=random.Random(0xbc53);cases=[]
for _ in range(500):
 mem=list(m);seed=rng.randrange(2**32);pose=rng.randrange(34);x=rng.choice((0,1,13,20,34,39,250));shift=rng.randrange(8);mem[0x3010:0x47f8]=background(seed)
 for addr,val in {7:32,0x70:pose,0x72:x,0x50:shift}.items():mem[addr]=val
 call(mem,0xbc53);cases.append({'seed':seed,'pose':pose,'x':x,'shift':shift,'sha256':hashlib.sha256(bytes(mem[0x3010:0x47f8])).hexdigest()})
(ROOT/'research/karateka/special-mask-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(art),'original floor masks and',len(cases),'original checks')
