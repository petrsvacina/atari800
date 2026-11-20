#!/usr/bin/env python3
"""Regenerate semantic object fixtures from the supplied Robbo XEX routines.

Offline development only. --ram must be the 64 KiB post-unpack image captured
by Atari800 from the exact source hash below. No CPU is shipped to the browser.
Fixed byte streams replace the hardware random register, and SOUND/HALT/CHNMON
are isolated while their semantic sound commands are retained.
"""
import sys,json,random,argparse,gzip,hashlib
from pathlib import Path
sys.path.insert(0,'/private/tmp/robbo-deps')
from py65.devices.mpu6502 import MPU
ROOT=Path(__file__).resolve().parents[1]
SHA256='75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb'
BASE=None
SYM=json.loads((ROOT/'research/robbo/symbols.json').read_text())['symbols']
FIELDS={'x':0x92,'y':0x93,'scanX':0x94,'scanY':0x95,'fx':0x96,'fy':0x97,'lm':0x98,'scrolling':0x99,'tele':0x9b,'fac':0x9c,'level':0x9d,'keys':0x9e,'lives':0x9f,'screws':0xa0,'ammo':0xa2,'moving':0xa8,'counter':0x266c}
class Bus:
 def __init__(self,case):self.data=bytearray(BASE);self.rnd=case['random'];self.reads=0
 def __getitem__(self,k):
  if k==0xd20a:
   n=self.reads;self.reads+=1;return self.rnd[n%len(self.rnd)]
  return self.data[k]
 def __setitem__(self,k,v):
  if k==0xd20a:return
  self.data[k]=v

def invoke(c,b,a):
 c.pc=a;c.sp=0xfd;b.data[0x1fe:0x200]=bytes([0xfe,0xff])
 sounds=[]
 for n in range(50000):
  if c.pc==0xffff:return sounds
  if c.pc in (SYM['sound_'],SYM['halt'],SYM['chnmon']):
   if c.pc==SYM['sound_']:sounds.append(c.a)
   c.pc=(c.stPopWord()+1)&65535
  else:c.step()
 raise ValueError(hex(c.pc))

def run(case):
 b=Bus(case);c=MPU(memory=b)
 for k,a in FIELDS.items():b[a]=case['state'][k]
 b.data[0x700:0x900]=bytes(case['map']);b.data[0xa4:0xa7]=bytes(case['score'])
 invoke(c,b,SYM['tst_'])
 a=int.from_bytes(BASE[SYM['proc']+case['id']*2:SYM['proc']+case['id']*2+2],'little')
 sounds=invoke(c,b,a) if a else []
 return {'state':{k:b[a] for k,a in FIELDS.items()},'map':list(b.data[0x700:0x900]),'score':list(b.data[0xa4:0xa7]),'randomReads':b.reads,'sounds':sounds}

def board():
 a=[160]*512
 for y in range(1,30):
  for x in range(1,15):a[y*16+x]=32
 return a

def object_cases():
 rng=random.Random(15031989);cases=[]
 active=[i for i in range(97) if int.from_bytes(BASE[SYM['proc']+i*2:SYM['proc']+i*2+2],'little') and i!=42]
 for id in active:
  for iteration in range(100):
   x,y=8,15;m=board()
   for dy in range(-3,4):
    for dx in range(-4,5):
     if dx or dy:m[(y+dy)*16+x+dx]=rng.choice([32]*9+[160,35,63,64,61,33,36,43,91,93,42,65,78,197,200,18,124,6])
   if id==17:
    m[y*16+x+1:(y+1)*16]=[rng.choice([32,15]) for _ in range(6)]+[5]
   if id in range(48,58):
    # The teleport input path leaves another digit elsewhere.
    m[(y-2)*16+x]=rng.choice(range(48,58))
   if id==40:
    m[y*16+x+1:y*16+15]=[32]*5+[rng.choice([42,170,35,160])]
   m[y*16+x]=id
   s={k:0 for k in FIELDS};s.update(x=x,y=y,scanX=x,scanY=y,fx=rng.choice([x,x-1,x+1,2,13]),fy=rng.choice([y,y-1,y+1,2,29]),lm=rng.choice([14,13,11,7]),tele=rng.choice([0,1,id]),fac=rng.randrange(2),level=rng.randrange(56),keys=1,lives=5,screws=rng.choice([0,0x15]),ammo=0x27,counter=rng.randrange(256),scrolling=rng.choice([0,0,0x42]))
   case={'id':id,'name':f'id{id}-case{iteration}','state':s,'map':m,'score':[0x12,0x34,0x56],'random':[rng.randrange(256) for _ in range(12)]}

   try:case['expected']=run(case)
   except Exception as e:
    raise RuntimeError(f'Object {id} case {iteration}') from e
   cases.append(case)
 return cases

def scan_cases():
 rng=random.Random(0x1989);cases=[]
 active=[i for i in range(123) if i not in (17,42)]
 for iteration in range(400):
  m=board()
  for y in range(1,30):
   for x in range(1,15):
    if rng.randrange(100)<15:m[y*16+x]=rng.choice(active+list(range(128,256)))
  # Random $11 markers could be generated from raw active; no end marker guarantee.
  for i,id in enumerate(m):
   if id in (17,145):m[i]=32
  s={k:0 for k in FIELDS};s.update(x=8,y=15,scanX=8,scanY=15,fx=rng.randrange(1,15),fy=rng.randrange(1,30),lm=rng.choice([14,13,11,7]),tele=rng.choice([0,1,48,49]),fac=rng.randrange(2),level=rng.randrange(56),keys=1,lives=5,screws=rng.choice([0,0x15]),ammo=0x27,counter=rng.randrange(256))
  case={'id':-1,'name':f'scan{iteration}','state':s,'map':m,'score':[0x12,0x34,0x56],'random':[rng.randrange(256) for _ in range(256)]}
  b=Bus(case);c=MPU(memory=b)
  for k,a in FIELDS.items():b[a]=s[k]
  b.data[0x700:0x900]=bytes(m);b.data[0xa4:0xa7]=bytes(case['score']);b[0xd40b]=93;b[0x21c]=0
  c.pc=SYM['chngcv'];c.sp=0xfd;b.data[0x1fe:0x200]=bytes([0xfe,0xff]);sounds=[]
  for n in range(1000000):
   if c.pc==0xffff:break
   if c.pc in (SYM['sound_'],SYM['halt'],SYM['chnmon'],SYM['mfac']):
    if c.pc==SYM['sound_']:sounds.append(c.a)
    c.pc=(c.stPopWord()+1)&65535
   else:c.step()
  else:raise ValueError(f'scan {iteration} PC {c.pc:04x}')
  case['expected']={'state':{k:b[a] for k,a in FIELDS.items()},'map':list(b.data[0x700:0x900]),'score':list(b.data[0xa4:0xa7]),'randomReads':b.reads,'sounds':sounds}
  cases.append(case)
 return cases

def main():
 global BASE
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--ram',required=True,type=Path)
 parser.add_argument('--output',type=Path,default=ROOT/'tools/fixtures/robbo-objects.json.gz')
 args=parser.parse_args()
 assert hashlib.sha256((ROOT/'Robbo.xex').read_bytes()).hexdigest()==SHA256
 BASE=args.ram.read_bytes();assert len(BASE)==65536
 assert BASE[SYM['chngcv']:SYM['chngcv']+3]==bytes.fromhex('ad1c02')
 assert BASE[SYM['tst_']:SYM['tst_']+4]==bytes.fromhex('a9008581')
 assert BASE[SYM['proc']+78:SYM['proc']+80]==bytes.fromhex('012f')
 objects=object_cases();scans=scan_cases()
 data={'sourceSha256':SHA256,'reference':'Actual supplied XEX routines from native Atari800 post-decompression RAM','objectCases':len(objects),'scanCases':len(scans),'cases':objects+scans}
 args.output.parent.mkdir(parents=True,exist_ok=True)
 args.output.write_bytes(gzip.compress(json.dumps(data,separators=(',',':')).encode(),mtime=0))
 print(f'Exported {len(objects)} original object cases and {len(scans)} complete scans to {args.output}')

if __name__=='__main__':main()
