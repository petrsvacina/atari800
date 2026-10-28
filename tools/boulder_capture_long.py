#!/usr/bin/env python3
"""Sparse long VBI, original title score and session control-flow oracles."""
import base64,hashlib,json
from boulder_original import Original,state,ROOT,SHA,FIELDS,ARRAYS,save_fixture,load_fixture
from boulder_capture_cases import Ram,MPU,execute

def capture():
 o=Original()
 try:base=bytearray(o.cave(1,0))
 finally:o.close()
 base.extend(bytes(65536-len(base)));cases=[]
 for name,changes in [('timer',{'secondsFrame':59,'preSpawn':0,'time':[0,1,1]}),('magic',{'magicState':1,'magicSeconds':19,'magicFrames':58}),('frozen',{'magicState':1,'magicSeconds':19,'magicFrames':58,'freeze':1}),('scroll',{'playerX':38,'playerY':21,'preSpawn':0,'spawnSeconds':0})]:
  b=bytearray(base);b[0x788]=15;b[0x799]=64;b[0x859]=0
  for k,v in changes.items():
   if k in FIELDS:b[FIELDS[k]]=v
   else:a,n=ARRAYS[k];b[a:a+n]=bytes(v)
  m=Ram(b);m[0x5d0:0x5d7]=bytes.fromhex('7820b01b4ce005');steps=[]
  for frame in range(1500):
   if name=='frozen' and frame==300:m[0x7a4]=0
   if name=='scroll' and frame==700:m[0x79e]=0;m[0x79f]=2
   c=MPU(memory=m,pc=0x5d0);c.sp=255
   while c.pc!=0x5e0:c.step()
   if frame<5 or frame%29==0 or frame in [59,60,299,300,301,599,600,699,700,701,1199,1200,1499]:
    raw=bytes(m);steps.append({'frame':frame,'state':state(raw),'fontSha256':hashlib.sha256(raw[0x4400:0x4800]).hexdigest(),'raster':list(raw[0x845:0x84d])+list(raw[0x85a:0x85f]),'randomReads':m.random_reads})
  cases.append({'name':name,'changes':changes,'steps':steps});print('Long VBI',name,flush=True)
 music=[];m=Ram(base);m[0x872]=0;m[0x873]=160;m[0x874]=0;m[0x7ab]=0;m[0xd208]=120;m[0xd201]=m[0xd205]=0;m[0x5d0:0x5d7]=bytes.fromhex('7820a0234ce005')
 for step in range(1100):
  c=MPU(memory=m,pc=0x5d0);c.sp=255
  while c.pc!=0x5e0:c.step()
  music.append({'registers':list(m[0xd200:0xd209]),'cursor':m[0x872],'envelope':m[0x873],'loops':m[0x874]})
 death=[]
 for two in [0,1]:
  for player in [0,1]:
   for lives0 in [0,1,2,9]:
    for lives1 in [0,1,2,9]:
     b=bytearray(base);b[0x7a6]=player;b[0x7a7]=two
     banks=[[lives0,5,1,0,1,2,3,4,5]+[0]*6,[lives1,9,2,1,2,3,4,5,6]+[0]*6]
     b[0x7c5:0x7d4]=bytes(banks[0]);b[0x7d4:0x7e3]=bytes(banks[1]);b[0x7b6:0x7c5]=bytes(banks[player])
     out,_,_=execute(b,0x26cd);death.append({'two':two,'player':player,'banks':banks,'state':state(out),'resultBanks':[list(out[0x7c5:0x7d4]),list(out[0x7d4:0x7e3])]})
 advance=[]
 for cave in range(1,21):
  for level in range(5):
   b=bytearray(base);b[0x7b7]=cave;b[0x7b8]=level;out,_,_=execute(b,0x27b8);advance.append([cave,level,out[0x7b7],out[0x7b8]])
 save_fixture('boulder-long',{'sourceSha256':SHA,'vbi':cases,'music':music,'death':death,'advance':advance})
 print('Captured long timers, 1100 music ticks, 128 death banks and 100 cave transitions',flush=True)
if __name__=='__main__':capture()
