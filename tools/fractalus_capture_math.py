#!/usr/bin/env python3
"""Independently execute original arithmetic; no upstream C oracle is used."""
import base64,gzip,hashlib,json,random
from pathlib import Path
from fractalus_original import ROOT,SHA256,image,processor,call

base=image();memory=bytearray(base);cpu=processor(memory)
products=bytearray()
for m in range(256):
 for n in range(256):
  memory[0x6b]=m;memory[0x28d6]=n;cpu.p=0x20
  call(cpu,0x9821);products.append(cpu.a)
 if m%64==0:print('Original rounded products',m*256,flush=True)
headings=bytearray()
for heading in range(16384):
 memory[0x2885]=heading&255;memory[0x2886]=heading>>8;cpu.p=0x20
 call(cpu,0x9ba0);headings.extend(memory[0x2809:0x280d])
print('Original headings',len(headings)//4,flush=True)
rng=random.Random(0x46524143);signed=[]
inputs=[(f,v) for f in range(256) for v in [-32768,-32767,-8193,-257,-256,-1,0,1,255,256,32767]]
inputs.extend((rng.randrange(256),rng.randrange(-32768,32768)) for _ in range(2048))
for factor,value in inputs:
 memory[0xaa]=value&255;memory[0xab]=(value>>8)&255;cpu.a=factor;cpu.p=0x20|(factor&1)
 call(cpu,0x9c97)
 product=int.from_bytes(memory[0xa8:0xaa],'little',signed=True)
 signed.append([factor,value,product])
data={'sourceSha256':SHA256,'products':base64.b64encode(products).decode(),'headings':base64.b64encode(headings).decode(),'signed':signed}
target=ROOT/'tools/fixtures/fractalus-math.json.gz'
target.write_bytes(gzip.compress(json.dumps(data,separators=(',',':')).encode(),mtime=0))
assets={'sourceSha256':SHA256,'high':list(base[0x4eb9:0x4ef9]),'low':list(base[0x4efa:0x4f3a]),'sign':list(base[0x9b98:0x9b9c]),'reflect':list(base[0x9b9c:0x9ba0])}
(ROOT/'rescue-on-fractalus/assets/trigonometry.json').write_text(json.dumps(assets,indent=2)+'\n')
print('Captured',len(products),'rounded products,',len(headings)//4,'headings,',len(signed),'signed products.',flush=True)
