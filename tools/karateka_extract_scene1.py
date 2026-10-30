#!/usr/bin/env python3
"""Export scene-1 scenery bitmaps and named drawing tables from the supplied disk."""
import argparse,hashlib,json
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256,load
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'karateka/assets');a=p.parse_args();m=load(a.memory)
if m[0xad00:0xad03]!=bytes.fromhex('4c1bad'):raise ValueError('Expected scene-1 banks')
tables={'castleLow':(0xadfa,18),'castleHigh':(0xae0c,18),'castleX':(0xae1e,18),'castleY':(0xae30,18),'cliffLow':(0xb1be,5),'cliffHigh':(0xb1c3,5),'cliffX':(0xb1c8,5),'cliffY':(0xb1cd,5),'gateLow':(0xbc06,17),'gateHigh':(0xbc17,17),'gateX':(0xbc28,17),'gateY':(0xbc39,17)}
out={'sourceSha256':SOURCE_SHA256,'tables':{k:list(m[start:start+count]) for k,(start,count) in tables.items()},'art':{}}
ptrs={0xaa11,0xa948,0xa976,0xa9b8,0xa9e2,0xaa23,0xaa31}
for kind in ('castle','cliff','gate'):
 t=out['tables'];ptrs.update(lo+256*hi for lo,hi in zip(t[kind+'Low'],t[kind+'High']))
out['climb']={}
for i in range(12,24):
 ptr=m[0xb603+i]+256*m[0xb623+i];ptrs.add(ptr);out['climb'][i]={'pointer':ptr,'x':m[0xb643+i],'y':m[0xb663+i]}
out['fall']={}
for i in range(32,36):
 ptr=0x1e00+m[0xac13+i];ptrs.add(ptr);out['fall'][i]={'pointer':ptr,'x':m[0xac17+i],'y':m[0xac1b+i]}
for ptr in sorted(ptrs):
 h,w=m[ptr:ptr+2]
 if not h or not w or h>153 or w>40:raise ValueError(f'Invalid source bitmap {ptr:04x}: {h},{w}')
 out['art'][ptr]={'width':w*4,'height':h,'data':list(m[ptr+2:ptr+2+w*h])}
a.output.mkdir(parents=True,exist_ok=True);target=a.output/'scene1.js';target.write_text('// Original scene-1 scenery and drawing tables only.\nglobalThis.KARATEKA_SCENE1='+json.dumps(out,separators=(',',':'))+';\n');print('Exported',len(ptrs),'original scenery bitmaps')
