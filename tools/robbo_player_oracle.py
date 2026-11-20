#!/usr/bin/env python3
"""Offline differential fixtures for the supplied XEX player, never a runtime CPU."""
import argparse,gzip,hashlib,json,random,sys
from pathlib import Path
sys.path.insert(0,'/private/tmp/robbo-deps')
from py65.devices.mpu6502 import MPU
from robbo_object_oracle import FIELDS,SHA256,ROOT,SYM,board
FIELDS={**FIELDS,'lastLifeLevel':0xa1,'demo':0xa3,'shotTimer':0x2941,'noga':0x275e}
class Bus:
 def __init__(self,base,rnd):self.data=bytearray(base);self.rnd=rnd;self.reads=0
 def __getitem__(self,key):
  if key==0xd20a:
   n=self.reads;self.reads+=1;return self.rnd[n%len(self.rnd)]
  return self.data[key]
 def __setitem__(self,key,value):self.data[key]=value
def original(base,case):
 b=Bus(base,case['random']);m=b.data;c=MPU(memory=b)
 for k,a in FIELDS.items():m[a]=case['state'][k]
 m[0x700:0x900]=bytes(case['map']);m[0xa4:0xa7]=bytes(case['score'])
 m[0xd20f]=255;m[0xd209]=255;m[0xd01f]=7;m[0x278:0x27a]=bytes([case['input']['stick'],15]);m[0x284:0x286]=bytes([int(not case['input']['fire']),1])
 m[0x86:0x88]=bytes([case['targetAddress']&255,case['targetAddress']>>8]);sounds=[]
 c.pc=SYM['mfac'];c.sp=0xfd;m[0x1fe:0x200]=bytes([0xfe,0xff])
 for n in range(100000):
  if c.pc==0xffff:break
  if c.pc in [SYM['sound_'],SYM['halt']]:
   if c.pc==SYM['sound_']:sounds.append(c.a)
   c.pc=(c.stPopWord()+1)&65535
  else:c.step()
 else:raise RuntimeError(f'Player did not return ${c.pc:04X}')
 return {'state':{k:m[a]for k,a in FIELDS.items()},'map':list(m[0x700:0x900]),'score':list(m[0xa4:0xa7]),'targetAddress':m[0x86]+256*m[0x87],'sounds':sounds,'randomReads':b.reads}
def main():
 p=argparse.ArgumentParser();p.add_argument('--ram',type=Path,required=True);a=p.parse_args();base=a.ram.read_bytes();assert len(base)==65536
 assert hashlib.sha256((ROOT/'Robbo.xex').read_bytes()).hexdigest()==SHA256
 rng=random.Random(0x524f42424f);cases=[]
 targets=[32,0,160,13,14,20,21,22,33,35,36,43,61,63,64,6,124,18,48,49,57,65,78,41,40,37,91,93]
 for n in range(3200):
  m=board();x,y=8,15;stick=rng.choice([15,14,13,11,7,10,9,6,5,0]);fire=rng.randrange(3)==0
  for dx,dy in [[0,-1],[0,1],[-1,0],[1,0]]:
   m[(y+dy)*16+x+dx]=rng.choice(targets);m[(y+2*dy)*16+x+2*dx]=rng.choice([32,32,160,35])
  m[y*16+x]=42
  s={k:0 for k in FIELDS};s.update(x=x,y=y,scanX=x,scanY=y,fx=x,fy=y,lm=rng.choice([14,13,11,7]),tele=rng.choice([0,1,48]),fac=1,level=rng.randrange(56),keys=rng.choice([0,1,0x09,0x10,0x99]),lives=rng.choice([0,1,8,0x99]),screws=rng.choice([0,1,0x09,0x10]),ammo=rng.choice([0,1,0x09,0x10,0x98,0x99]),counter=rng.randrange(256),lastLifeLevel=255,shotTimer=rng.randrange(7),noga=rng.randrange(256),moving=rng.randrange(2),demo=int(n%7==0))
  case={'state':s,'map':m,'score':[rng.choice([0,0x12,0x99]),rng.choice([0,0x34,0x99]),rng.choice([0,0x56,0x99])],'input':{'stick':stick,'fire':fire},'random':[rng.randrange(256)for _ in range(64)],'targetAddress':0x1000+y*64+x*2}
  case['expected']=original(base,case);cases.append(case)
 output=ROOT/'tools/fixtures/robbo-player.json.gz';output.write_bytes(gzip.compress(json.dumps({'sourceSha256':SHA256,'fields':FIELDS,'cases':cases},separators=(',',':')).encode(),mtime=0));print('Captured',len(cases),'actual XEX player cases')
if __name__=='__main__':main()
