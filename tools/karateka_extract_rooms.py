#!/usr/bin/env python3
"""Export original common palace-room drawing tables and corridor graphic."""
import argparse,json
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256,load
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'karateka/assets');a=p.parse_args();m=load(a.memory)
if m[0xb100:0xb103]!=bytes.fromhex('4c0cb1'):raise ValueError('Expected scene-3 banks')
tables={'roomLow':(0x7815,11),'roomHigh':(0x7820,11),'roomX':(0x782b,11),'roomY':(0x7836,11)}
out={'sourceSha256':SOURCE_SHA256,'tables':{k:list(m[start:start+count]) for k,(start,count) in tables.items()},'art':{}};t=out['tables'];ptrs={0xa000};ptrs.update(lo+256*hi for lo,hi in zip(t['roomLow'],t['roomHigh']))
for ptr in sorted(ptrs):
 h,w=m[ptr:ptr+2]
 if not h or not w or h>153 or w>40:raise ValueError(f'Invalid room bitmap {ptr:04x}: {h},{w}')
 out['art'][ptr]={'width':w*4,'height':h,'data':list(m[ptr+2:ptr+2+w*h])}
a.output.mkdir(parents=True,exist_ok=True);(a.output/'rooms.js').write_text('// Original common room artwork and named drawing tables.\nglobalThis.KARATEKA_ROOMS='+json.dumps(out,separators=(',',':'))+';\n');print('Exported',len(ptrs),'original palace-room bitmaps')
