#!/usr/bin/env python3
"""Original ATR fatal/mission-return scheduling references, development only."""
import gzip,hashlib,json,random,re
from pathlib import Path
from fractalus_original import ROOT,SHA256,MAIN_SHA256,image,processor,call
base=bytearray(Path('/private/tmp/fractalus-disk-research/flight-after40.bin').read_bytes())
assert len(base)==65536 and hashlib.sha256(base[0x3cde:0x3cde+31500]).hexdigest()==MAIN_SHA256
original=image()
assets={'sourceSha256':SHA256,'palette':list(original[0x4df1:0x4dfa])}
(ROOT/'rescue-on-fractalus/assets/lifecycle.json').write_text(json.dumps(assets,separators=(',',':'))+'\n')
fields={}
for file,symbol in [('flight.mjs','FLIGHT_FIELDS'),('flight-services.mjs','SERVICE_FIELDS'),('systems.mjs','SYSTEM_FIELDS'),('rescue.mjs','RESCUE_FIELDS'),('combat.mjs','COMBAT_FIELDS'),('lifecycle.mjs','LIFECYCLE_FIELDS')]:
 text=(ROOT/'rescue-on-fractalus'/file).read_text();text=re.search(r'export const '+symbol+r'\s*=\s*\{(.*?)\};',text,re.S)[1]
 fields.update({k:(int(a,16),int(w)) for k,a,w in re.findall(r'(\w+)\s*:\s*\[\s*(0x[0-9a-f]+)\s*,\s*([123])\s*\]',text)})
rng=random.Random(0x4c494645);randoms=[rng.randrange(256) for _ in range(512)]
class Memory(bytearray):
 def __init__(self,data):super().__init__(data);self.index=0;self.writes=[]
 def __getitem__(self,at):
  if at==0xd20a:v=randoms[self.index%len(randoms)];self.index+=1;return v
  return super().__getitem__(at)
 def __setitem__(self,at,value):
  if isinstance(at,int) and 0xd200<=at<=0xd208:self.writes.append([at-0xd200,value])
  super().__setitem__(at,value)

def read(m):
 s={k:int.from_bytes(m[a:a+n],'little') for k,(a,n) in fields.items()}
 s.update(eventRing=list(m[0x719:0x739]),energyCells=list(m[0xd98:0xdd8]),messageCells=list(m[0x32b7:0x32c5]),
   paletteParams=list(m[0xcf:0xdf]),scoreCells=list(m[0x32c5:0x32cb]))
 s['score']=int(''.join(f'{n:02x}' for n in m[0x600:0x604]))
 return s

def write(m,s):
 for k,(a,n) in fields.items():m[a:a+n]=s[k].to_bytes(n,'little')
 m[0x719:0x739]=bytes(s['eventRing']);m[0xd98:0xdd8]=bytes(s['energyCells'])
 m[0x32b7:0x32c5]=bytes(s['messageCells']);m[0xcf:0xdf]=bytes(s['paletteParams']);m[0x32c5:0x32cb]=bytes(s['scoreCells'])
 m[0x600:0x604]=bytes.fromhex(str(s['score']).zfill(8))

def execute(m,address,stop=0x3bfd,a=0,x=0):
 c=processor(m);c.p=0x20;c.a=a;c.x=x;c.sp=0xfd;c.pc=address;m[0x1fe:0x200]=bytes([0xfc,0x3b])
 for _ in range(400000):
  if c.pc==stop:return c
  c.step()
 raise RuntimeError(f'Original routine stuck PC{c.pc:04X}')

cases={k:[] for k in ['flash','fade','reset','launch','count','levelClear']}
for name,address in [('flash',0x4f9f),('fade',0x4fe0),('reset',0x3d38),('launch',0x6378),('count',0x75b8),('levelClear',0x7bc6)]:
 for i in range(512):
  m=Memory(base);m.index=i%len(randoms);offset=m.index;s=read(m)
  s.update(introCounter=rng.randrange(1,256),introDelay=rng.randrange(256),crashFade=rng.randrange(256),
   previousLevel=rng.choice([0,1,4,16,40,99,127,255]),level=rng.randrange(256),scene=rng.choice([0,0,1]),
   levelCount=rng.randrange(256),quotaFlag=rng.randrange(256),eventHead=rng.randrange(32),
   score=rng.randrange(100000000),rescued=rng.randrange(256),nightPhase=rng.randrange(24))
  write(m,s);before=read(m)
  execute(m,address,0x3d48 if name=='reset' else 0x63a7 if name=='launch' else 0x3bfd)
  cases[name].append({'before':before,'after':read(m),'randomOffset':offset,'randomReads':m.index-offset})

# Full foreground trajectories use the real score/message/audio calls. Only the
# independently implemented scanner/HUD presentation $3FFA is explicitly RTS.
# Clock waits and music receive real logical VBIs; rendering CPU cost is excluded.
def trajectory(name,address,overrides,mission=False):
 m=Memory(base);s=read(m)
 s.update(clock=0,eventHead=0,introCounter=0,introDelay=0,level=4,levelCount=3,highestLevel=1,previousLevel=4,
  rescued=4,quota=4,quotaFlag=0,missionDifference=255,score=12345,remainingBcd=0,overQuota=1,musicGate=1,restartPhase=0)
 s.update(overrides);write(m,s)
 if mission:m[0x3ffa]=0x60
 before=read(m);parameters=list(m[0x65d:0x714]);c=processor(m);c.p=0x20;c.a=s['rescued'];c.sp=0xfd;c.pc=address;m[0x1fe:0x200]=bytes([0xfc,0x3b]);frames=0
 flash_gate=2;waits=[]
 def interrupt(address):
  stack=bytes(m[0x100:0x200]);execute(m,address);m[0x100:0x200]=stack
 def advance(count):
  nonlocal frames,flash_gate
  for _ in range(count):
   frames+=1;m[0x14]=(m[0x14]+1)&255
   if mission:
    if m[0x655]:interrupt(0x7253)
   else:
    # Original $0643=2 means first VBI uses the flash branch, then every other.
    flash_gate-=1
    if flash_gate:
     if m[0x2891]:interrupt(0x4f9f)
    else:flash_gate=2
  # Nested isolated calls use their own sentinel stack; restore the foreground.
  m[0x1fe:0x200]=bytes([0xfc,0x3b])
 for _ in range(10000000):
  if mission and c.pc in [0x622d,0x62e7]:break
  if not mission and c.pc==0x3d48:break
  if c.pc==0x3cb8 and m[0x14]!=m[0x4c]:
   count=(m[0x4c]-m[0x14])&255;waits.append(count);advance(count)
  if c.pc==0x4f46 and m[0x2891]:advance(1)
  if c.pc==0x61c9 and m[0x655]:advance(1)
  c.step()
 else:raise RuntimeError(f'{name} stuck PC{c.pc:04X}')
 return {'name':name,'mission':mission,'address':address,'before':before,'after':read(m),
  'parameters':parameters,'parametersAfter':list(m[0x65d:0x714]),'registers':list(base[0xd200:0xd209]),
  'writes':m.writes,'frames':frames,'waits':waits,'randomReads':m.index,
  'jingle':{'levels':[base[0x648+2*i] for i in range(4)],'deltas':[base[0x649+2*i] for i in range(4)],'frequencies':[base[0x650+2*i] for i in range(4)]},
  'boundary':c.pc}

trajectories=[trajectory('jaggiSharedTail',0x826f,{}),
 trajectory('crashWithoutPriorImpact',0x4f3f,{}),trajectory('crashWithPriorImpact',0x4f3f,{'introCounter':30}),
 trajectory('returnShortfall',0x6153,{'rescued':2,'quota':4},True),
 trajectory('returnQuota',0x6153,{},True),trajectory('returnExtra',0x6153,{'rescued':7},True),
 trajectory('returnReplay',0x6153,{'quotaFlag':1},True),
 trajectory('returnHigherStage',0x6153,{'level':12,'levelCount':8,'quota':8,'rescued':10},True),
 trajectory('returnNoRescues',0x6153,{'rescued':0},True)]
payload={'sourceSha256':SHA256,'fields':fields,'randoms':randoms,'cases':cases,'trajectories':trajectories,
 'isolation':{'missionReturn':['$3FFA scanner/HUD, independently native root module']},
 'scope':'Original foreground + real logical clock waits, flash VBI half, jingle VBI; no Atari rendering-cycle timing claim.'}
output=ROOT/'tools/fixtures/fractalus-lifecycle.json.gz'
output.write_bytes(gzip.compress(json.dumps(payload,separators=(',',':')).encode(),mtime=0))
print('Lifecycle',sum(len(c) for c in cases.values()),'isolated original cases;',[(c['name'],c['frames']) for c in trajectories],output.stat().st_size)
