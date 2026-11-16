#!/usr/bin/env python3
"""Extract original rescue graphics and independent original-routine references."""
import argparse,gzip,hashlib,json,random,re
from pathlib import Path
from fractalus_original import ROOT,SHA256,image,processor,call

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--assets-only',action='store_true')
args=parser.parse_args()
base=image()
# Relocated wait helpers and generated render tables exist after original boot.
snapshot=Path('/private/tmp/fractalus-disk-research/flight-after40.bin').read_bytes()
assert len(snapshot)==65536
for address,length in [(0x7854,0x16a),(0x7ec7,0x13da)]:
    assert base[address:address+length]==snapshot[address:address+length]

def field_shapes(low,high,cursor,limit):
    result=[]
    for i in range(9):
        pointer=base[low+i]+256*base[high+i]
        result.append({'cursor':base[cursor+i],'limit':base[limit+i],
                       'bytes':list(base[pointer:pointer+base[limit+i]]) if i else []})
    return result

# $7588/$3C3D decompress the original fixed cockpit, ending $365A.
at=0x6e6e;cockpit=bytearray()
while True:
 value=base[at];at+=1
 if value<192:cockpit.append(value)
 elif value==192:break
 else:cockpit.extend(bytes([base[at]])*(value&63));at+=1
assert at==0x6fbf and len(cockpit)==814
lower_shape=cockpit[0x35cd-0x332d:]
assert len(lower_shape)==142 and lower_shape==snapshot[0x35cd:0x365b]
# Each zero 2-bit cell preserves the corresponding background bits.
alien_mask=[sum(3<<shift for shift in range(0,8,2) if not ((v>>shift)&3)) for v in range(256)]
assert bytes(alien_mask)==snapshot[0xbe00:0xbf00]

assets={
 'sourceSha256':SHA256,
 'pilot':{'shapes':[list(base[p:p+54]) for p in [0x7def,0x7e25,0x7e5b,0x7e91]],
          'columnBase':list(base[0x7d9d:0x7da5]),'rowOffset':list(base[0x7da9:0x7dbb]),
          'columnOffset':list(base[0x7dbb:0x7dd3]),'fieldSelect':list(base[0x7dd3:0x7deb]),
          'pen':list(base[0x7da5:0x7da9]),'pixelMask':list(base[0x4f3b:0x4f3f]),
          'inverseMask':list(base[0x7deb:0x7def])},
 'energyColors':list(base[0x4dea:0x4df2]),
 'alien':{'sideShapes':field_shapes(0x81a1,0x81a9,0x81b1,0x81b9),
          'middleShapes':field_shapes(0x81c1,0x81c9,0x81d1,0x81d9),
          'sideLinks':list(base[0x81e2:0x81e8]),'sideSequence':list(base[0x81e8:0x8201]),
          'middleLinks':list(base[0x8201:0x820a]),'middleSequence':list(base[0x820a:0x8237]),
          'lowerShape':list(lower_shape),
          'mask':alien_mask,'deathTone':list(base[0x828a:0x82a0])}
}
asset_path=ROOT/'rescue-on-fractalus/assets/rescue.json'
asset_path.write_text(json.dumps(assets,separators=(',',':'))+'\n')
print('Original rescue data:',asset_path,asset_path.stat().st_size)
if args.assets_only:raise SystemExit

def layout(file,symbol):
 text=file.read_text().split(f'export const {symbol}=',1)[-1] if f'export const {symbol}=' in file.read_text() else file.read_text().split(f'export const {symbol} =',1)[1]
 text=text.split('{',1)[1].split('};',1)[0]
 return {name:(int(address,16),int(width)) for name,address,width in re.findall(r'(\w+):\s*\[(0x[\da-f]+),\s*([123])\]',text)}
fields={}
for file,symbol in [('flight.mjs','FLIGHT_FIELDS'),('flight-services.mjs','SERVICE_FIELDS'),('systems.mjs','SYSTEM_FIELDS'),('rescue.mjs','RESCUE_FIELDS')]:
 fields.update(layout(ROOT/'rescue-on-fractalus'/file,symbol))
# Only canonical scalar names. Changes to root metadata cannot change captured aliases.
for alias in ['lockState','lockComplete']:fields.pop(alias,None)
class Memory(bytearray):
 def __init__(self,data,randoms):
  super().__init__(data);self.randoms=randoms;self.index=0;self.writes=[]
 def __getitem__(self,at):
  if at==0xd20a:
   value=self.randoms[self.index%len(self.randoms)];self.index+=1;return value
  return super().__getitem__(at)
 def __setitem__(self,at,value):
  if isinstance(at,int) and 0xd200<=at<=0xd208:self.writes.append([at-0xd200,value])
  super().__setitem__(at,value)

def read(m):
 s={k:int.from_bytes(m[a:a+n],'little') for k,(a,n) in fields.items()}
 s['eventRing']=list(m[0x719:0x739]);s['energyCells']=list(m[0xd98:0xdd8])
 s['messageCells']=list(m[0x32b7:0x32c5])
 return s

def write(m,s):
 for k,(a,n) in fields.items():m[a:a+n]=s[k].to_bytes(n,'little')
 m[0x719:0x739]=bytes(s['eventRing']);m[0xd98:0xdd8]=bytes(s['energyCells'])
 m[0x32b7:0x32c5]=bytes(s['messageCells'])

def field(m,half):return [m[0x1010+r*96+half*48+c] for r in range(48) for c in range(48)]
def write_field(m,half,values):
 for row in range(48):m[0x1010+row*96+half*48:0x1010+row*96+half*48+48]=bytes(values[row*48:row*48+48])

def run(m,address,stop=None,x=0,limit=200000):
 c=processor(m);c.p=0x20;c.x=x;c.sp=0xfd;m[0x1fe:0x200]=bytes([0xfc,0x3b]);c.pc=address
 for _ in range(limit):
  if c.pc==(stop or 0x3bfd):return c
  c.step()
 raise RuntimeError(f'Original ${address:04X} did not reach stop, PC=${c.pc:04X}')

rng=random.Random(0x52455343)
randoms=[rng.randrange(256) for _ in range(512)]

def memory():
 m=Memory(snapshot,randoms);m.index=m.start=rng.randrange(len(randoms));return m
def new_state(m):
 s=read(m)
 for k,(a,n) in fields.items():s[k]=rng.randrange(256**n)
 s.update(eventHead=rng.randrange(32),pilotColumnLimit=44,pilotFrame=rng.randrange(8),
   rescueCell=rng.randrange(256),rescueAvailable=rng.choice([0,255]),landingPhase=rng.randrange(1,6),
   systemsOff=rng.choice([0,1]),colorB=rng.choice([12,104]),sfxBusy=0,alienSustain=rng.randrange(1,10),
   alienLinkA=rng.randrange(6),alienLinkB=rng.randrange(6),alienPositionA=rng.randrange(24),
   alienPositionB=rng.randrange(24),alienPositionC=rng.randrange(44),
   alienPick=rng.randrange(1,9),alienPreviousPick=rng.randrange(1,9))
 return s

cases={k:[] for k in ['begin','approach','pilot','alienSequence','alienDraw','attack']}
for i in range(512):
 m=memory();s=new_state(m);s['pilotDistance']=rng.choice([0,1,2,6,7,8,127,128,255]);write(m,s)
 m[0xa00+s['rescueCell']]=rng.choice([1,128,200,201]);x=rng.randrange(256)
 before=read(m);run(m,0x7854,0x78d6,x=x)
 cases['begin'].append({'before':before,'marker':m[0xa00+s['rescueCell']],'x':x,'after':read(m),'randomReads':m.index-m.start,'randomOffset':m.start})
 m=memory();s=new_state(m);s.update(pilotScale=rng.choice([256,272,384,512,1024]),pilotY=rng.choice([90,107,108,130,151]))
 write(m,s);before=read(m);run(m,0x793d,0x79a2)
 cases['approach'].append({'before':before,'after':read(m),'randomReads':m.index-m.start,'randomOffset':m.start})
 m=memory();s=new_state(m);write(m,s);before=read(m);run(m,0x7ab8)
 cases['attack'].append({'before':before,'after':read(m),'randomReads':m.index-m.start,'randomOffset':m.start})
for i in range(160):
 m=memory();s=new_state(m)
 s.update(pilotScale=rng.choice([256,272,384,512,768,1024,2304]),plotX=rng.randrange(30,225),plotY=rng.randrange(102,160))
 s['pilotColumnBase']=assets['pilot']['columnBase'][s['pilotFrame']]
 write(m,s);shape=0x7def+(s['pilotFrame']&3)*54;m[0xc3:0xc5]=shape.to_bytes(2,'little')
 source=[rng.randrange(256) for _ in range(2304)];destination=[rng.randrange(256) for _ in range(2304)]
 write_field(m,0,source);write_field(m,1,destination)
 before=read(m);run(m,0x7c9a)
 cases['pilot'].append({'before':before,'after':read(m),'source':source,'destination':destination,'fieldAfter':field(m,1)})
for i in range(256):
 m=memory();s=new_state(m)
 write(m,s);before=read(m);run(m,0x7f85,0x8069)
 cases['alienSequence'].append({'before':before,'after':read(m),'randomReads':m.index-m.start,'randomOffset':m.start})
 s=read(m);s['alienTop']=i%41;s['alienColumn']=rng.randrange(12,20);write(m,s)
 source=[rng.randrange(256) for _ in range(2304)];destination=[rng.randrange(256) for _ in range(2304)]
 write_field(m,0,source);write_field(m,1,destination)
 before=read(m);run(m,0x8069,0x809b)
 cases['alienDraw'].append({'before':before,'after':read(m),'source':source,'destination':destination,'fieldAfter':field(m,1)})

payload={'sourceSha256':SHA256,'randoms':randoms,'fields':fields,'cases':cases,
 'scope':'Original routines with actual graphics and attack. No VBI during synchronous sections. Controller scheduling references are separate.'}
output=ROOT/'tools/fixtures/fractalus-rescue.json.gz'
with gzip.open(output,'wt',encoding='utf8') as f:json.dump(payload,f,separators=(',',':'))
print('Original rescue cases:',{k:len(v) for k,v in cases.items()},output,output.stat().st_size)

# Foreground scheduling oracle: drawing runs synchronously and no VBI handler is
# injected. Only the original clock waits are advanced; timing below therefore
# proves explicit waits, not the Atari CPU time spent drawing a pose.
def scheduled(name,changes,marker,finish_phase):
 m=memory();m.index=m.start=0;s=read(m)
 s.update(clock=0,landingPhase=2,systemsOff=1,airlock=1,pilotDistance=1,pilotX=128,pilotY=130,
  pilotScale=512,pilotFractionX=0,pilotFractionY=0,pilotColumnLimit=44,rescueCell=33,
  rescueAvailable=0,figureIsAlien=0,alienInside=0,alienAttackGate=0,gamePhase=0,doorWait=0,
  alienThreshold=128,alienBase=5,rescueVoiceBusy=0,remainingBcd=5,rescued=0,overQuota=0,
  energy=120,eventHead=0,respawnCounter=2,missionTimer=0,rescueThreshold=3,quotaFlag=0)
 s.update(changes);write(m,s);m[0xa00+s['rescueCell']]=marker
 source=field(m,0);destination=field(m,1);objects=list(m[0xa00:0xb00]);terrain=list(m[0x900:0xa00]);visible=list(m[0x2276:0x22a3])
 before=read(m);c=processor(m);c.p=0x20;c.x=0;c.sp=0xfd;m[0x1fe:0x200]=bytes([0xfc,0x3b]);c.pc=0x7854
 waited=0;waits=[];finished=False;cycles=0
 for _ in range(5000000):
  if c.pc==0x3bfd:break
  if c.pc==0x78d6 and m[0x3d]==finish_phase and not finished:
   m[0x3e]=0;finished=True
  if c.pc==0x7c08 and m[0x14]<=3:
   delta=4-m[0x14];waited+=delta;waits.append(['above3',delta]);m[0x14]=4
  if c.pc==0x3cb8 and m[0x14]!=m[0x4c]:
   delta=(m[0x4c]-m[0x14])&255;waited+=delta;waits.append(['clock',m[0x4c]]);m[0x14]=m[0x4c]
  if c.pc==0x79ae and m[0x14]!=0:
   delta=256-m[0x14];waited+=delta;waits.append(['door',delta]);m[0x14]=0
  if c.pc==0x7a19 and m[0x14]!=0:
   delta=256-m[0x14];waited+=delta;waits.append(['knock',delta]);m[0x14]=0
  c.step();cycles+=1
 else:raise RuntimeError(f'Scheduled {name} stuck PC{c.pc:04X}')
 if not finished:raise RuntimeError(f'Scheduled {name} did not finish phase')
 return {'name':name,'before':before,'source':source,'destination':destination,'marker':marker,
  'objects':objects,'terrain':terrain,'visible':visible,'finishPhase':finish_phase,'after':read(m),
  'fieldAfter':field(m,1),'objectsAfter':list(m[0xa00:0xb00]),'randomReads':m.index,'frames':waited,'waits':waits}

payload['scheduled']=[scheduled('human',{},200,5),scheduled('ace',{'energy':190},201,5),
 scheduled('overQuota',{'remainingBcd':0x99,'overQuota':1,'quotaFlag':1},200,5),
 scheduled('insideAlien',{},128,5),scheduled('lateHuman',{'airlock':0,'pilotY':90},200,2)]
with gzip.open(output,'wt',encoding='utf8') as f:json.dump(payload,f,separators=(',',':'))
print('Scheduled foreground:',[(c['name'],c['frames'],c['randomReads']) for c in payload['scheduled']])

def scheduled_alien(name,abort_at=None):
 m=memory();m.index=m.start=0;s=read(m)
 s.update(clock=0,landingPhase=3,systemsOff=1,airlock=0,pilotDistance=1,rescueCell=33,
  rescueAvailable=0,alienInside=0,alienAttackGate=0,gamePhase=0,alienThreshold=128,alienBase=5,
  eventHead=0,alienSustain=0,sfxBusy=0,soundSpecialVolume=0,soundSpecialVolumeTimer=0)
 write(m,s);m[0xa00+s['rescueCell']]=128
 source=field(m,0);destination=field(m,1);objects=list(m[0xa00:0xb00]);terrain=list(m[0x900:0xa00]);visible=list(m[0x2276:0x22a3]);before=read(m)
 c=processor(m);c.p=0x20;c.x=0;c.sp=0xfd;m[0x1fe:0x200]=bytes([0xfc,0x3b]);c.pc=0x7854
 waited=0;dead=False
 def advance(count):
  nonlocal waited
  for _ in range(count):
   waited+=1;m[0x14]=(m[0x14]+1)&255
   if abort_at is not None and waited>=abort_at:m[0x3e]=0
 for _ in range(5000000):
  if c.pc==0x3bfd:break
  if c.pc==0x826f:dead=True;break
  if c.pc==0x7f51 and m[0x14]<=4:advance(5-m[0x14])
  if c.pc==0x3cb8 and m[0x14]!=m[0x4c]:advance((m[0x4c]-m[0x14])&255)
  c.step()
 else:raise RuntimeError(f'Scheduled {name} stuck PC{c.pc:04X}')
 return {'name':name,'before':before,'source':source,'destination':destination,'objects':objects,
  'terrain':terrain,'visible':visible,'after':read(m),'fieldAfter':field(m,1),'objectsAfter':list(m[0xa00:0xb00]),
  'randomReads':m.index,'frames':waited,'writes':m.writes,'dead':dead,'abortAt':abort_at}

payload['outside']=[scheduled_alien('jaggiFatal'),scheduled_alien('jaggiEscape5',5),scheduled_alien('jaggiEscape35',35)]
with gzip.open(output,'wt',encoding='utf8') as f:json.dump(payload,f,separators=(',',':'))
print('Closed-airlock Jaggi:',[(c['name'],c['frames'],c['randomReads']) for c in payload['outside']])
