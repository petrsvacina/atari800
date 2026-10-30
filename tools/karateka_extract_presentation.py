#!/usr/bin/env python3
"""Export named original impact and per-bank hawk graphic layers."""
import argparse,json
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256,load
def art(m,p):
 h,w=m[p:p+2]
 if not h or not w or h>153 or w>40:raise ValueError(f'Invalid presentation graphic {p:04X}: {h},{w}')
 return {'width':w*4,'height':h,'data':list(m[p+2:p+2+w*h])}
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--scene1',required=True,type=Path);p.add_argument('--scene2',required=True,type=Path);p.add_argument('--scene3',required=True,type=Path);a=p.parse_args();m=load(a.scene1)
out={'sourceSha256':SOURCE_SHA256,'effects':{p:art(m,p) for p in (0x93ab,0x942a,0x9490,0x94e6)},'impactY':list(m[0x74f7:0x7500]),'hawks':{}}
for scene,path,lo,hi,dy,count in [(2,a.scene2,0xbdd6,0xbddc,0xbde2,6),(3,a.scene3,0xaa99,0xaaa8,0xaab7,15)]:
 m=load(path);d={'low':list(m[lo:lo+count]),'high':list(m[hi:hi+count]),'dy':list(m[dy:dy+6]),'art':{}}
 for pointer in {0xac8d,0xaca8}|{m[lo+i]+256*m[hi+i] for i in range(count)}:d['art'][pointer]=art(m,pointer)
 out['hawks'][scene]=d
(ROOT/'karateka/assets/presentation.js').write_text('// Original graphic layers and named impact geometry.\nglobalThis.KARATEKA_PRESENTATION='+json.dumps(out,separators=(',',':'))+';\n');print('Exported original impact and both hawk graphic sets')
