#!/usr/bin/env python3
"""Extract original P2/P3 graphic tables, executing the original mirror initializer offline.

The web exports only sparse image/table data and native typed-state routines.
"""
import argparse,base64,json
from pathlib import Path
from fractalus_original import ROOT,SHA256,image,processor,call
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--reference',type=Path,default=Path('/private/tmp/fractalus-disk-research'));args=p.parse_args()
b=image();call(processor(b),0x74d7)
shapes=[];pointers=[]
for i in range(74):
 address=int.from_bytes(b[0x4d3e+i*2:0x4d40+i*2],'little');pointers.append(address)
 end=next(k for k in range(128)if b[(address+k)&65535]==0)
 shapes.append(list(b[address:address+end+1]))
reference=(args.reference/'flight-init.bin').read_bytes()
for address,shape in zip(pointers,shapes):assert reference[address:address+len(shape)]==bytes(shape),(hex(address),'original mirroredshape mismatch')
enc=lambda data:base64.b64encode(bytes(data)).decode()
data={'sourceSha256':SHA256,'initialization':'Original $74D7 executes offline to generate32 mirrored shapes; all74 pointer-selected bitmaps match real Atari800 initialized flight RAM.',
 'p3Shapes':shapes,'p3ShapePointers':pointers,'p3Sizes':list(b[0x4566:0x4569]),'p3Extents':list(b[0x4569:0x456c]),'p3MasksNear':list(b[0x456c:0x457a]),'p3MasksFar':list(b[0x457a:0x4581]),'p3RowOffsets':list(b[0x4d11:0x4d3e]),'scopeShapes':[list(b[0x44c7+i*5:0x44cc+i*5])for i in range(3)],
 'p2Offsets':list(b[0x8db5:0x8dd0]),'p2Shapes':list(b[0x8dd0:0x8e2b]),'p2NormalFrames':list(b[0x8e2b:0x8e33]),'p2ExplosionFrames':list(b[0x8e32:0x8e3e]),'p2ExplosionOffsets':list(b[0x8e3e:0x8e4a]),'p2ExplosionStarts':list(b[0x8e4a:0x8e53]),'p2ExplosionLimits':list(b[0x8e52:0x8e5b]),
 'initialP2':enc(reference[0xe00:0xf00]),'initialP3':enc(reference[0xf00:0x1000]),'initialMissiles':enc(reference[0xb00:0xc00]),'initialSpans':list(reference[0x28b6:0x28d6])}
dest=ROOT/'rescue-on-fractalus/assets/sprites.json';dest.write_text(json.dumps(data,separators=(',',':'))+'\n');print('Extracted',len(shapes),'original P3bitmaps and original P2animation tables; no program image.')
