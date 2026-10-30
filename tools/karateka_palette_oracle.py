#!/usr/bin/env python3
"""Original cliff palette-selector fixtures, before the pixel repaint starts."""
import argparse,gzip,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from karateka_extract_sprites import call
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);a=p.parse_args();original=load(a.memory);rng=random.Random(0xb098);cases=[]
for _ in range(1000):
 m=list(original);m[0xb10a]=0x60;shift=rng.randrange(8);offset=rng.randrange(27,50);z={7:rng.choice((32,64)),0x44:rng.randrange(2),0x50:shift,0x52:offset,0xae:rng.choice((shift,rng.randrange(8))),0xe1:rng.choice((offset,rng.randrange(27,50))),0x62:rng.randrange(8,35),0x72:rng.randrange(8,45),0x54:rng.randrange(3),0xb096:rng.choice((0,255)),0xb097:rng.choice((0,255)),0xf0d:rng.randrange(2)}
 for address,value in z.items():m[address]=value
 call(m,0xb090);cases.append({'state':z,'expected':[m[0xf0d],m[0xb096],m[0xb097]]})
(ROOT/'research/karateka/palette-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original cliff palette selections')
