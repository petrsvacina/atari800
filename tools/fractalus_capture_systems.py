#!/usr/bin/env python3
"""Original command/message/indicator oracle, using executed ATR instructions."""
import argparse,base64,gzip,hashlib,json,random,re
from pathlib import Path
from fractalus_original import ROOT,SHA256,MAIN_SHA256,processor,call
p=argparse.ArgumentParser();p.add_argument('--reference',type=Path,default=Path('/private/tmp/fractalus-disk-research/flight-init.bin'));args=p.parse_args()
base=args.reference.read_bytes();assert len(base)==65536
assert hashlib.sha256(base[0x3cde:0x3cde+31500]).hexdigest()==MAIN_SHA256
fields={}
for file,symbol in [('flight.mjs','FLIGHT_FIELDS'),('flight-services.mjs','SERVICE_FIELDS'),('systems.mjs','SYSTEM_FIELDS')]:
 text=(ROOT/'rescue-on-fractalus'/file).read_text();text=re.search(r'export const '+symbol+r'\s*=\s*\{(.*?)\};',text,re.S)[1]
 fields.update({k:(int(a,16),int(w)) for k,a,w in re.findall(r'(\w+)\s*:\s*\[\s*(0x[0-9a-f]+)\s*,\s*([123])\s*\]',text)})
def read(m):
 d={k:int.from_bytes(m[a:a+w],'little') for k,(a,w) in fields.items()}
 d.update(history=[list(m[0x2893+j*7:0x289a+j*7]) for j in range(5)],eventRing=list(m[0x719:0x739]),horizonCells=list(m[0x2159:0x2159+80]),thrustCells=[m[a] for a in [0x3392,0x33c2,0x33c3,0x33f3,0x3423,0x3424,0x3454,0x3484,0x3485,0x34b5,0x34e5,0x34e6]],paletteParams=list(m[0xcf:0xdf]),savedPalette=list(m[0x7e9:0x7f9]),messageCells=list(m[0x32b7:0x32c5]),lockCells=list(m[0x3492:0x3498]))
 return d
class Tracked(bytearray):
 def __init__(self,value):super().__init__(value);self.textWrites=[]
 def __setitem__(self,k,v):
  if isinstance(k,int) and 0x32b7<=k<0x32c5:self.textWrites.append(k-0x32b7)
  super().__setitem__(k,v)
messages=[]
for message in range(64):
 m=Tracked(base);cpu=processor(m);cpu.y=message|128;cpu.p=0x20;call(cpu,0x47b8)
 messages.append(list(m[0x32b7:0x32b7+max(m.textWrites,default=-1)+1]))
assets={'sourceSha256':SHA256,'messages':messages,'atmosphere':[list(base[a:a+42]) for a in [0x7f9,0x823,0x84d,0x877]],'nightPalette':list(base[0x364b:0x365b])}
(ROOT/'rescue-on-fractalus/assets/systems.json').write_text(json.dumps(assets,indent=2)+'\n')
rng=random.Random(0x53595354);commands=[]
for i in range(512):
 m=bytearray(base);cpu=processor(m);cpu.p=0x20
 overrides={'scene':rng.choice([0,0,0,1]),'eventOwner':rng.choice([0,0,1]),'pendingEvent':rng.choice([0,0,128]),'sfxBusy':rng.choice([0,0,1]),'mode':rng.choice([0,2,255]),'landingPhase':rng.randrange(6),'systemsOff':rng.choice([0,1]),'airlock':rng.choice([0,1,128]),'alienInside':rng.choice([0,1]),'landingTarget':rng.choice([0,1]),'pilotPrevious':rng.choice([0,1]),'doorWait':rng.choice([0,1]),'rescueAvailable':rng.choice([0,128]),'energy':rng.choice([0,100,220]),'clearance':rng.choice([0,50,100,220]),'thrustNotch':rng.randrange(9),'level':4,'savedControlMode':2}
 for key,v in overrides.items():a,w=fields[key];m[a:a+w]=v.to_bytes(w,'little')
 before=read(m);key=[0,63,21,62,7,6,128,28,255][i%9];cpu.x=key;cpu.sp=0xf5 if key==28 and before['eventOwner'] and not before['scene'] else 0xfd;m[0x1fe:0x200]=bytes([0xfc,0x3b]);cpu.pc=0x4644
 for _ in range(200000):
  if cpu.pc in [0x3bfd,0x52bb]:break
  cpu.step()
 else:raise RuntimeError(f'Command did not return key{key} PC{cpu.pc:04X}')
 commands.append({'before':before,'key':key,'after':read(m)})
locks=[]
for i in range(512):
 m=bytearray(base);cpu=processor(m);cpu.p=0x20
 for key,v in {'eventOwner':rng.choice([0,0,1]),'lockonState':rng.choice([0,1,2,3,4,5,6,7,128,129,130,131,132,133,134,135]),'lockTimer':rng.choice([0,1,2,127,128,255]),'lockActive':rng.randrange(2),'lockPhase':rng.randrange(4),'lockReload':rng.randrange(4,21),'eventHead':rng.randrange(32)}.items():a,w=fields[key];m[a:a+w]=v.to_bytes(w,'little')
 randomByte=rng.randrange(256);m[0xd20a]=randomByte;before=read(m);call(cpu,0x4225);locks.append({'before':before,'random':randomByte,'after':read(m)})
(ROOT/'tools/fixtures/fractalus-systems.json.gz').write_bytes(gzip.compress(json.dumps({'sourceSha256':SHA256,'commands':commands,'locks':locks},separators=(',',':')).encode(),mtime=0))
print('Captured64 originalmessages,',len(commands),'fullcommands,',len(locks),'indicatorstates(noisolatedcallees).')
