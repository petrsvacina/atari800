#!/usr/bin/env python3
"""Offline whole bonus/result control flow; original CPU, controlled VBI/input hardware.

Graphics and disk I/O are stubbed. Animation, bonuses, scoring and branch logic
execute original routines. Synthetic P0PF cases isolate the control flow; real
pixel contacts have a separate Atari800/GTIA oracle.
"""
import argparse,gzip,json,random
from pathlib import Path
from ik_extract import load,FIELDS

def rebuild(base,target):
 from py65.devices.mpu6502 import MPU
 rng=random.Random(0x3059);cases=[];starts=base[0x558d:0x55b1]
 def number(v):return (v>>4)*10+(v&15)
 def bcd(v):return v//10*16+v%10
 def players(m):
  result=[]
  for i in range(2):
   p={key:m[a+i] for key,a in FIELDS.items()};p['facing']=-1 if m[0xe2+i] else 1
   for k in ('pose','nextPose'):p[k]-=starts[p['action']]
   result.append(p)
  return result
 class Bus(list):
  def __init__(self,m):super().__init__(m);self.draws=[]
  def __getitem__(self,i):
   if i==0xd20a:v=rng.randrange(256);self.draws.append(v);return v
   return super().__getitem__(i)
 for kind in ('tiles','dodge','result'):
  variants=range(18 if kind=='tiles' else 12 if kind=='dodge' else 40)
  for variant in variants:
   m=Bus(base);humans=([1,0],[0,1],[1,1])[variant%3];stage=4 if kind=='tiles' else 9 if kind=='dodge' else (1,3,5)[variant%3]
   if kind=='dodge' and humans==[1,1]:stage=4
   if kind=='result':humans=[1,1] if variant>=8 else [1,0]
   m[0x50:0x52]=humans;m[0xd3]=bcd(stage);m[0x6150]=4 if kind=='tiles' or (kind=='dodge' and humans==[1,1]) else 0 if kind=='dodge' else 1;m[0xf6]=1;m[0x615f]=1;m[0x619d]=0;m[0x5c]=0;m[0xd0]=4 if kind=='tiles' else 5 if kind=='dodge' else 3
   for a in range(0x6144,0x6149):m[a]=0
   m[0xf7:0xfd]=[0]*6;m[0x6199:0x619b]=[0,0];m[0x6195:0x6197]=[0,0];m[0xd9:0xdb]=[0,0];m[0xd8]=0;m[0x615d]=0;m[0x14]=0;m[0x6171]=0;m[0x6121]=16;m[0xdc]=bcd(30 if humans!=[1,1] else 60)
   c=MPU(memory=m);c.sp=0xfd;m[0x1fe]=0xfe;m[0x1ff]=0xff;c.pc=0x2d8a
   while c.pc!=0xffff:c.step()
   m[0x618f:0x6191]=[0,0];m.draws=[];initial=players(m);frames=0;go=None;sampleCount=0;enabledFrames=0
   reaction=(1,4,25,40,99,None)[variant//3] if kind=='tiles' else None
   hitAfter=(None,12,33,None)[variant//3] if kind=='dodge' else None
   if kind=='result':
    m[0xdc]=bcd((0,3,17,0)[variant%4]);m[0xd9:0xdb]=[4,0] if variant%2==0 else [0,4]
    m[0x6145:0x6149]=[0,0,0x08,0x04];m[0xf7:0xfd]=[0,0x08,0,0,0x04,0];m[0x6151]=variant%2
    m[0x6167]=(66,54,61,59,60)[variant%5];m[0xd4]=0 if m[0x6167]>60 else 1
    m[0x6195:0x6197]=[1,1];m[0x6199:0x619b]=[variant%2,1 if variant%4==1 else 0];m[0xd8]=2 if number(m[0xdc])>0 else 0
   if kind=='result' and variant>=32:
    m[0xdc]=0;m[0x6167]=60;m[0x6199:0x619b]=[1,1] if stage==5 else [0,0];m[0x6147:0x6149]=[0x08,0x08];m[0xf8]=m[0xfb]=0x08
    if variant%4==0:m[0x6147:0x6149]=[0,0];m[0x6195:0x6197]=[0,0]
   state={'humans':humans,'stage':stage,'cycle':m[0x6150],'level':1,'weaponDifficulty':1,'time':number(m[0xdc]),'points':m[0xd9:0xdb],'roundScore':[number(m[0x6145+i])*10000+number(m[0x6147+i])*100 for i in range(2)],'score':[number(m[0xf7+i*3])*10000+number(m[0xf8+i*3])*100+number(m[0xf9+i*3]) for i in range(2)],'wins':m[0x6199:0x619b],'tug':m[0x6167],'lastWinner':m[0x6151],'hitState':m[0xd8],'attackOwner':m[0xd4]}
   def small_call(pc):
    cpu=MPU(memory=m);cpu.pc=pc;cpu.sp=0x60;m[0x161]=0xfe;m[0x162]=0xff
    for _ in range(20000):
     if cpu.pc==0xffff:return
     cpu.step()
    raise ValueError(hex(cpu.pc))
   def advance(n):
    nonlocal frames,enabledFrames
    for _ in range(n):
     frames+=1;m[0x6121]=(m[0x6121]+1)&255;m[0xdf]=(m[0xdf]+1)&255;m[0x14]=(m[0x14]+1)&255
     if m[0x14]==0:m[0x6171]=(m[0x6171]+1)&255
     if m[0xd7]:m[0xd7]-=1
     if m[0xd0]==5:
      if m[0x615d]:enabledFrames+=1
      if not m[0x6155] and 48<=m[0xab]<200:m[0x6155]=4 if hitAfter and enabledFrames>=hitAfter else 0
      small_call(0x5807)
   def sync():advance(max(0,(7 if m[0xd8] else 5)-m[0x6121]));m[0x6121]=0
   def ret():c.pc=c.stPopWord()+1
   hooks={0x2ead,0x2774,0x3cbc,0x271a,0x2714,0x2e6a,0x2753,0x39ae}
   c=MPU(memory=m);c.pc=0x3059 if kind=='tiles' else 0x2f3e if kind=='dodge' else 0x2918;c.sp=0xfd;m[0x1fe]=0xfe;m[0x1ff]=0xff
   for operations in range(3000000):
    pc=c.pc
    if pc==0xffff:break
    if pc==0x2a9b:m[0xd0]=6;break
    if pc==0x3069:go=None
    if pc==0x2f4c:enabledFrames=0
    if pc in hooks:ret();continue
    if pc==0x2f31:advance(c.x or 256);ret();continue
    if pc in (0x3c06,0x2ec4):sync();ret();continue
    if pc==0x2717:
     if kind=='tiles' and c.a==15:go=frames
     ret();continue
    if pc==0x51f9:
     for i in range(2):m[0xec+i]=5 if i==m[0xd1] and go is not None and reaction is not None and frames-go>=reaction else 0
     ret();continue
    if pc==0x3a89:sampleCount+=1;ret();continue
    if pc==0x4389:m[0x5c]=(m[0x5c]+1)%7;ret();continue
    if pc in (0x30d9,0x3104):advance(1) # Busy polling until next controlled input/VBI.
    c.step()
   else:raise ValueError(f'flow did not finish: {kind} {variant} {c.pc:04x}')
   expected={'frames':frames,'score':[number(m[0xf7+i*3])*10000+number(m[0xf8+i*3])*100+number(m[0xf9+i*3]) for i in range(2)],'stage':number(m[0xd3]),'cycle':m[0x6150],'level':m[0xf6],'scene':m[0x5c],'humans':m[0x50:0x52],'wins':m[0x6199:0x619b],'mode':m[0xd0]}
   cases.append({'kind':kind,'reaction':reaction,'hitAfter':hitAfter,'initial':initial,'state':state,'draws':m.draws,'expected':expected})
  print('Exported original',kind,'control flows',flush=True)
 target.write_bytes(gzip.compress(json.dumps(cases,separators=(',',':')).encode(),mtime=0))
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=Path('research/international-karate/flow-oracle.json.gz'));a=p.parse_args();rebuild(load(a.memory),a.output)
