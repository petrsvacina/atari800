#!/usr/bin/env python3
"""Original guard entrance/tracking shots, sampled at each present boundary.

Runs the supplied disk routines as coroutines offline. Pixel routines, audio
and keyboard handling are stubbed, while actor animation, camera arithmetic,
parity exit conditions and coordinate restoration execute unchanged. Records
which actors the original asks to draw; no CPU bytes enter the fixtures.
"""
import argparse,gzip,json,random
from pathlib import Path
from py65.devices.mpu6502 import MPU
from karateka_extract import ROOT,load
from karateka_extract_sprites import call
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--scene1',required=True,type=Path);p.add_argument('--scene2',required=True,type=Path)
a=p.parse_args();rng=random.Random(0xb4bb);cases=[]
for scene in (1,2):
 original=load(getattr(a,'scene'+str(scene)))
 for kind in ('entrance','approach'):
  for i in range(60):
   m=list(original);shift=rng.randrange(8);offset=rng.choice((0,11,27,28,35,48,85,250));cloud=rng.randrange(256);side=rng.randrange(2) if scene==1 else 0;style=rng.randrange(1,6);bird=rng.randrange(2);delay=rng.randrange(5,15)
   hero=[6,6,rng.randrange(10,20),rng.randrange(40),0,54,59,0,0,0,0,255,1,0,rng.randrange(256),0]
   enemy=[35,30,rng.randrange(46,80),rng.randrange(40),0,67,46,1,1,1,0,255,255,0,rng.randrange(256),255]
   m[0x20:0x30]=enemy;m[0x62]=hero[2];m[0x50]=shift
   for _ in range(rng.randrange(10)):call(m,0x6400)
   enemy=m[0x20:0x30];enemy[2]=rng.randrange(46,80);m[0x60:0x70],m[0x70:0x80]=hero,enemy
   z={7:64,0x30:1,0x33:(enemy[2]-hero[2])&255,0x36:0,0x3e:style,0x44:rng.randrange(2) if scene==1 else 0,0x48:rng.randrange(256),0x4b:side,0x4c:side,0x50:shift,0x51:cloud,0x52:offset,0x57:bird,0x85:delay,0x89:0,0x8b:15,0x97:0}
   for addr,value in z.items():m[addr]=value
   graphic=[0x6780,0x678c,0x6786,0x6783,0xb093,0xad12,0xad0c,0xad03,0xbc00,0xbc03,0xb000,0xb003,0xb100,0xb103,0xb106,0xb280,0xb286,0xb283,0x0b00,0x0b06,0x7600,0x7603]
   for addr in graphic:m[addr]=0x60
   routine={(1,'entrance'):0xb400,(1,'approach'):0xb403,(2,'entrance'):0xad80,(2,'approach'):0xad83}[scene,kind]
   c=MPU(memory=m);c.pc=routine;c.sp=0xfd;m[0x1fe]=0xfe;m[0x1ff]=0xff;frames=[];actors=[]
   for _ in range(1000000):
    if c.pc==0xffff:break
    if c.pc==0x6783:actors.append(m[0x20:0x30])
    if c.pc==0x7600:
     frames.append({'hero':m[0x60:0x70],'enemy':m[0x70:0x80],'camera':[m[0x50],m[0x51],m[0x52]],'side':m[0x4c],'actors':actors});actors=[];m[7]^=96
    c.step()
   else:raise RuntimeError(f'{scene}/{kind}: stopped at {c.pc:04x}')
   cases.append({'scene':scene,'kind':kind,'hero':hero,'enemy':enemy,'state':z,'frames':frames,'after':{'hero':m[0x60:0x70],'enemy':m[0x70:0x80],'camera':[m[0x50],m[0x51],m[0x52]],'side':m[0x4c],'delay':m[0x85]}})
(ROOT/'research/karateka/arrival-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0))
print('Exported',len(cases),'original arrival sequences;',sum(len(c['frames']) for c in cases),'presented frames')
