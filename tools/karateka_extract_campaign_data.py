#!/usr/bin/env python3
"""Export named per-bank AI probability data, never executable program bytes."""
import argparse,json
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256,load
p=argparse.ArgumentParser(description=__doc__)
for i in range(1,5):p.add_argument(f'--scene{i}',required=True,type=Path)
a=p.parse_args();out={'sourceSha256':SOURCE_SHA256,'scenes':{}}
for i in range(1,5):
 m=load(getattr(a,f'scene{i}'));d={'aiThresholds':list(m[0xbfe1:0xc000])}
 if i==1:base=(0xbbd9,0xbbdf,0xbbe5);indices=range(6)
 elif i==2:base=(0xbca3,0xbca8,0xbcad);indices=range(1,6)
 elif i==3:base=(0xb4c4,0xb4c8,0xb4cc);indices=range(3,7)
 else:base=None
 if base:
  for name,start in zip(('kick','punch','wait'),base):d[name]={j:m[start+j] for j in indices}
 out['scenes'][i]=d
(ROOT/'karateka/assets/campaign.js').write_text('// Original named campaign AI data only.\nglobalThis.KARATEKA_CAMPAIGN='+json.dumps(out,separators=(',',':'))+';\n');print('Exported four original AI banks')
