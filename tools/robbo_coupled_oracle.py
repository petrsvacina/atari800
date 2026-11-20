#!/usr/bin/env python3
"""Coupled original Robbo CHNGCV + MFAC fixtures; development CPU only.

Only HALT, CHNMON and SOUND are isolated. Hardware RANDOM and input registers
are deterministic. All actual player/object routines execute in scan order.
"""
import argparse,gzip,hashlib,json,random,sys
from pathlib import Path
try:
 from py65.devices.mpu6502 import MPU
except ImportError:
 sys.path.insert(0,'/private/tmp/robbo-deps')
 from py65.devices.mpu6502 import MPU
ROOT=Path(__file__).resolve().parents[1]
SHA256='75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb'
FIELDS={'x':0x92,'y':0x93,'scanX':0x94,'scanY':0x95,'fx':0x96,'fy':0x97,'lm':0x98,'scrolling':0x99,'scrollCounter':0x9a,'tele':0x9b,'fac':0x9c,'level':0x9d,'keys':0x9e,'lives':0x9f,'screws':0xa0,'lastLifeLevel':0xa1,'ammo':0xa2,'demo':0xa3,'moving':0xa8,'counter':0x266c,'shotTimer':0x2941,'noga':0x275e}
class Bus:
 def __init__(self,base,rnd):self.data=bytearray(base);self.rnd=rnd;self.reads=0
 def __getitem__(self,key):
  if key==0xd20a:
   n=self.reads;self.reads+=1;return self.rnd[n%len(self.rnd)]
  return self.data[key]
 def __setitem__(self,key,value):
  if key==0xd20a:return
  self.data[key]=value

def original(base,case):
 bus=Bus(base,case['random']);m=bus.data;cpu=MPU(memory=bus)
 for k,a in FIELDS.items():m[a]=case['state'][k]
 m[0x700:0x900]=bytes(case['map']);m[0xa4:0xa7]=bytes(case['score'])
 m[0x86:0x88]=case['targetAddress'].to_bytes(2,'little')
 m[0xd20f]=255;m[0xd209]=255;m[0xd01f]=7
 m[0x278:0x27a]=bytes([case['input']['stick'],15]);m[0x284:0x286]=bytes([int(not case['input']['fire']),1])
 m[0x21c]=0;m[0xd40b]=93
 cpu.pc=0x266d;cpu.sp=0xfd;m[0x1fe:0x200]=bytes([0xfe,0xff]);sounds=[];halts=0;player_calls=0
 for n in range(1000000):
  if cpu.pc==0xffff:break
  if cpu.pc==0x28b6:player_calls+=1
  if cpu.pc in (0xb800,0x32cf,0x275f):
   if cpu.pc==0xb800:sounds.append(cpu.a)
   if cpu.pc==0x32cf:halts+=1
   cpu.pc=(cpu.stPopWord()+1)&65535
  else:cpu.step()
 else:raise RuntimeError(f'{case["name"]}: CHNGCV did not return at ${cpu.pc:04X}')
 return {'state':{k:m[a] for k,a in FIELDS.items()},'map':list(m[0x700:0x900]),'score':list(m[0xa4:0xa7]),'targetAddress':m[0x86]+256*m[0x87],'sounds':sounds,'randomReads':bus.reads}, {'playerCalls':player_calls,'haltCalls':halts,'instructions':n}

def generate(base):
 rng=random.Random(0x434f55504c4544)
 init=json.loads(gzip.decompress((ROOT/'tools/fixtures/robbo-initializer.json.gz').read_bytes()))
 assert init['sourceSha256']==SHA256
 cases=[]
 directions=[(0,-1,14),(0,1,13),(-1,0,11),(1,0,7)]
 def make(level,variant,extra=False):
  entry=init['cases'][level];m=entry['map'].copy();spawn=m.index(27)
  m[spawn]=32
  spaces=[i for i in range(16,480) if m[i]==32 and 0<i%16<15]
  candidates=[]
  if variant in (3,4,5):
   wanted=({33,36,43,61,124,18} if variant==3 else set(range(48,58)) if variant==4 else {6,13,14,35,63,64,38,65,66,67,68,69,70,71,72,73,74,75,76,77,78})
   for at in spaces:
    x,y=at%16,at//16
    for dx,dy,stick in directions:
     if m[(y+dy)*16+x+dx] in wanted:candidates.append((at,stick))
  if candidates:at,stick=rng.choice(candidates)
  else:at=spawn if variant<2 else rng.choice(spaces);stick=rng.choice([15,14,13,11,7,10,9,6,5,0])
  m[at]=42;x,y=at%16,at//16
  s={k:0 for k in FIELDS};s.update(x=x,y=y,scanX=x,scanY=y,fx=x,fy=y,lm=rng.choice([14,13,11,7]),scrolling=rng.choice([0,0,0,0x42,0x82]),scrollCounter=rng.choice([0,2,6,14]),tele=1 if variant==0 else 0,fac=rng.randrange(2),level=level,keys=rng.choice([0,1,0x09,0x10]),lives=rng.choice([1,8,0x10,0x99]),screws=0 if extra else entry['state']['screws'],lastLifeLevel=rng.choice([99,level]),ammo=0 if variant==0 else rng.choice([0,1,0x09,0x10,0x99]),demo=int(variant==6),moving=rng.randrange(2),counter=rng.randrange(256),shotTimer=0 if variant in (0,1) else rng.randrange(7),noga=rng.randrange(256))
  if variant==0:stick=15
  fire=variant==1 or (variant not in (0,3,4,5) and rng.randrange(4)==0)
  c={'name':f'planet-{level+1:02d}-variant-{variant}'+('-open-exit' if extra else ''),'state':s,'map':m,'score':[rng.choice([0,0x12,0x99]),rng.choice([0,0x34,0x99]),rng.choice([0,0x56,0x99])],'targetAddress':0x1000+y*64+x*2,'input':{'stick':stick,'fire':fire},'random':[rng.randrange(256) for _ in range(1024)]}
  c['expected'],c['metrics']=original(base,c);cases.append(c)
 for level in range(56):
  for variant in range(7):make(level,variant)
 for level in [0,3,7,15,23,31,47,55]:make(level,5,extra=True)
 return cases

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--ram',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'tools/fixtures/robbo-coupled.json.gz');a=p.parse_args()
 assert hashlib.sha256((ROOT/'Robbo.xex').read_bytes()).hexdigest()==SHA256
 base=a.ram.read_bytes();assert len(base)==65536 and base[0x266d:0x2672]==bytes.fromhex('ad1c02d0fb')
 cases=generate(base);metrics={'scans':len(cases),'planets':len(set(c['state']['level'] for c in cases)),'playerCalls':sum(c['metrics']['playerCalls'] for c in cases),'randomReads':sum(c['expected']['randomReads'] for c in cases),'soundCalls':sum(len(c['expected']['sounds']) for c in cases)}
 a.output.write_bytes(gzip.compress(json.dumps({'sourceSha256':SHA256,'reference':'Coupled actual CHNGCV + MFAC; only HALT/CHNMON/SOUND isolated','fields':FIELDS,'metrics':metrics,'cases':cases},separators=(',',':')).encode(),mtime=0));print(json.dumps(metrics))
if __name__=='__main__':main()
