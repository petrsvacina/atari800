#!/usr/bin/env python3
"""Execute the supplied disk's PMG writers offline, including neighboring banks."""
import base64,gzip,hashlib,json,random
from pathlib import Path
from fractalus_original import ROOT,SHA256,MAIN_SHA256,processor,call
from fractalus_extract_bootstrap import fields,read_state
base=Path('/private/tmp/fractalus-disk-research/flight-after40.bin').read_bytes()
assert hashlib.sha256(base[0x3cde:0x3cde+31500]).hexdigest()==MAIN_SHA256
metadata=fields();rng=random.Random(0x504d47)
class Memory(list):
 def __init__(self,m):super().__init__(m);self.random=[]
 def __getitem__(self,a):
  if a==0xd20a:v=rng.randrange(256);self.random.append(v);return v
  return super().__getitem__(a)
def encode(m):return base64.b64encode(bytes(m[0xb00:0x1100])).decode()
cases=[]
for routine,count in [(0x8c58,512),(0x42a7,512),(0x4467,256),(0x44d6,256)]:
 for i in range(count):
  m=Memory(base);cpu=processor(m);cpu.p=0x20
  change={}
  if routine==0x8c58:
   change={'objectFrame':rng.choice(list(range(1,27))+[128,129,140]),'objectScreenXHi':rng.randrange(32,220),'objectScreenYHi':rng.randrange(0,90),'p2PreviousFrame':rng.randrange(1,26),'projectileStateA':0,'projectileStateB':1,'projectileStateC':12,'p2FirstRow':rng.randrange(86),'p2RowCount':rng.randrange(20),'landingInhibit':rng.randrange(2),'figureAlien':rng.randrange(2),'figureGate':rng.choice([0,128]),'p2Colour':120}
   m[0x28b6:0x28d6]=[rng.randrange(-10,11)&255 for _ in range(32)]
  elif routine==0x42a7:
   change={'objectIndex':rng.choice(list(range(32))+[128,254,255]),'p3ShapeBase':rng.randrange(9),'objectDither':rng.choice([0,255]),'visibleObjectY':rng.randrange(256),'visibleObjectX':rng.randrange(256),'p3PreviousRows':rng.randrange(24),'p3DrawRow':rng.randrange(120)}
  elif routine==0x4467:
   change={'p3ScopeCursor':rng.choice([0,1,20,42,128,145]),'targetWindowY':rng.randrange(256),'p3IndicatorHpos':rng.randrange(256),'p3PilotFlag':rng.randrange(256),'figureAlien':rng.randrange(2)}
  else:change={'scannerRow':rng.choice([0,1,28,30,128,145]),'scannerRange':rng.randrange(256),'scannerBearing':rng.randrange(256)}
  for k,v in change.items():a,w=metadata[k];m[a:a+w]=list(v.to_bytes(w,'little'))
  before=read_state(m,metadata);beforePmg=encode(m);size=m[0xd00b];m.random.clear();cpu.a=m[0x6a];cpu.x=m[0x36];call(cpu,routine,1000000)
  cases.append({'routine':routine,'before':before,'beforePmg':beforePmg,'beforeSize':size,'after':read_state(m,metadata),'afterPmg':encode(m),'afterSize':m[0xd00b],'random':m.random})
path=ROOT/'tools/fixtures/fractalus-sprites.json.gz';path.write_bytes(gzip.compress(json.dumps({'sourceSha256':SHA256,'cases':cases},separators=(',',':')).encode(),mtime=0));print('Captured',len(cases),'original PMG writers')
