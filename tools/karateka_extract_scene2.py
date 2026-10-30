#!/usr/bin/env python3
"""Export named palace scenery/portcullis graphics from the supplied ATR."""
import argparse,json
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256,load
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'karateka/assets');a=p.parse_args();m=load(a.memory)
if m[0xb100:0xb103]!=bytes.fromhex('4c56b1'):raise ValueError('Expected scene-2 banks')
tables={'gateLow':(0xb10c,11),'gateHigh':(0xb117,11),'gateX':(0xb122,11),'gateY':(0xb12d,11)}
out={'sourceSha256':SOURCE_SHA256,'tables':{k:list(m[start:start+count]) for k,(start,count) in tables.items()},'art':{}}
t=out['tables'];ptrs={0xa602,0xa546,0xa592,0xa5b8,0xa4d8,0xad29,0xad40,0xad54};ptrs.update(lo+256*hi for lo,hi in zip(t['gateLow'],t['gateHigh']))
for ptr in sorted(ptrs):
 h,w=m[ptr:ptr+2]
 if not h or not w or h>153 or w>40:raise ValueError(f'Invalid source bitmap {ptr:04x}: {h},{w}')
 out['art'][ptr]={'width':w*4,'height':h,'data':list(m[ptr+2:ptr+2+w*h])}
a.output.mkdir(parents=True,exist_ok=True);(a.output/'scene2.js').write_text('// Original palace scenery data only.\nglobalThis.KARATEKA_SCENE2='+json.dumps(out,separators=(',',':'))+';\n');print('Exported',len(ptrs),'original palace scenery bitmaps')
