#!/usr/bin/env python3
"""Capture terrain-only original raster output; objects deliberately empty here."""
import argparse,base64,gzip,hashlib,json,random
from pathlib import Path
from fractalus_original import ROOT,SHA256,MAIN_SHA256,processor,call
p=argparse.ArgumentParser();p.add_argument('--reference',type=Path,default=Path('/private/tmp/fractalus-disk-research/flight-level1-init.bin'));args=p.parse_args()
base=args.reference.read_bytes();assert len(base)==65536
assert hashlib.sha256(base[0x3cde:0x3cde+31500]).hexdigest()==MAIN_SHA256
assets={'sourceSha256':SHA256,'or':list(base[0xbf00:0xc000]),'chain':list(base[0xbe00:0xbf00]),
        'border':[base[0x1010+row*96+column] for row in range(48) for column in [0,1,2,45,46,47]],
        'band':list(b''.join(base[0x1010+row*96:0x1010+row*96+48] for row in range(44,48)))}
(ROOT/'rescue-on-fractalus/assets/raster.json').write_text(json.dumps(assets,indent=2)+'\n')
cases=[]
views=[{'heading':h,'x':0x1317,'z':0x0a71,'altitude':a,'pitch':0,'roll':0} for h in [0,512,1024,2048,4096,6144,8192,10240,12288,14336] for a in [0x1000,0x3000,0x4f00]]
rng=random.Random(0x524f46)
views.extend({'heading':rng.randrange(16384),'x':rng.randrange(65536),'z':rng.randrange(65536),'altitude':rng.randrange(0x5000),'pitch':rng.randrange(-3072,3072)&65535,'roll':rng.randrange(-1280,1280)&65535} for _ in range(64))
for i,camera in enumerate(views):
  memory=bytearray(base);cpu=processor(memory);cpu.p=0x20
  memory[0xa00:0xb00]=bytes(256);memory[0xd20a]=128
  for key,at in [('heading',0x2885),('x',0x2887),('z',0x2889),('altitude',0x33),('pitch',0x28),('roll',0x23)]:memory[at:at+2]=camera[key].to_bytes(2,'little')
  call(cpu,0x9e54);cpu.x=3;call(cpu,0xad5f);cpu.x=0;call(cpu,0xa31e,2000000);cpu.x=3;call(cpu,0xae53,2000000)
  field=b''.join(memory[0x1074+row*96:0x1074+row*96+40] for row in range(47))
  cases.append({'camera':camera,'map':base64.b64encode(base[0x900:0xa00]).decode(),'field':base64.b64encode(field).decode(),'skyline':list(memory[0x260e+44:0x260e+212])})
  if i%16==0:print('Captured original terrain view',i,flush=True)
(ROOT/'tools/fixtures/fractalus-terrain.json.gz').write_bytes(gzip.compress(json.dumps({'sourceSha256':SHA256,'scope':'terrain and fill; empty occupancy map; 160x47 2bpp view','cases':cases},separators=(',',':')).encode(),mtime=0))
print('Captured',len(cases),'original terrain views.',flush=True)
