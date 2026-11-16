#!/usr/bin/env python3
"""Capture original view transforms/projection from supplied ATR routines."""
import base64,gzip,json,random
from fractalus_original import ROOT,SHA256,image,processor,call
b=image()
tables={'sourceSha256':SHA256,'patterns':[list(b[p:p+45]) for p in [0xb622,0xb64f,0xb5f5,0xb5c8]],'order':list(b[0xb67c:0xb70c])}
(ROOT/'rescue-on-fractalus/assets/geometry.json').write_text(json.dumps(tables,indent=2)+'\n')
rng=random.Random(0x46524143);cases=[]
for i in range(128):
 memory=bytearray(b);cpu=processor(memory);cpu.p=0x20
 camera={'heading':rng.randrange(16384),'x':rng.randrange(65536),'z':rng.randrange(65536),'altitude':rng.randrange(0x5000),'pitch':rng.randrange(-3072,3072)&65535,'roll':rng.randrange(-1280,1280)&65535}
 for key,at in [('heading',0x2885),('x',0x2887),('z',0x2889),('altitude',0x33),('pitch',0x28),('roll',0x23)]:memory[at:at+2]=camera[key].to_bytes(2,'little')
 height=bytes(rng.randrange(128) for _ in range(256));memory[0x900:0xa00]=height
 call(cpu,0x9e54)
 def pairs(lo,hi):return [memory[lo+j]+256*memory[hi+j] for j in range(45)]
 expected={'u':pairs(0x22a4,0x22d2),'depth':pairs(0x2300,0x232e),'height':pairs(0x235b,0x2388),'mapIndex':list(memory[0x2276:0x22a3]),'mapHeight':list(memory[0x23b5:0x23e2]),'visibility':list(memory[0x24b4:0x24e1])}
 call(cpu,0xad2b);expected['spans']=list(memory[0x270e:0x272e])
 projections=[]
 for index,visibility in enumerate(expected['visibility']):
  if visibility:continue
  cpu.x=index;call(cpu,0xa11f)
  projections.append([index,memory[0x2400+index]+256*memory[0x242d+index],memory[0x245a+index]+256*memory[0x2487+index]])
 cases.append({'camera':camera,'map':base64.b64encode(height).decode(),'expected':expected,'projections':projections})
 if i%32==0:print('Captured original view',i,flush=True)
(ROOT/'tools/fixtures/fractalus-geometry.json.gz').write_bytes(gzip.compress(json.dumps({'sourceSha256':SHA256,'cases':cases},separators=(',',':')).encode(),mtime=0))
print('Captured',len(cases),'full 45-cell transforms and',sum(len(c['projections']) for c in cases),'perspective projections.',flush=True)
