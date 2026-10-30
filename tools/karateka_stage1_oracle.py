#!/usr/bin/env python3
"""Compare scene-1's battle/camera logic before the original rendering pass.

Cases deliberately exclude blocking cinematics and guard entrances. They verify
routine ordering in this part of the loop, not a complete campaign playthrough.
"""
import argparse,gzip,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from karateka_extract_sprites import call
FIELDS=[0x30,0x3e,0x40,0x41,0x42,0x43,0x44,0x45,0x46,0x47,0x48,0x4b,0x4c,0x4d,0x4e,0x50,0x51,0x52,0x53,0x5a,0x5b,0x5c,0x5d,0x5e,0x82,0x88,0x89,0x8b,0x99,0xa1,0xa2,0xaf,0xb0,0xb1,0xb6,0xb7,0xb8,0xb9,0xba,0xdd,0xdf,0xf2]
def export(memory,destination):
 rng=random.Random(0xb801);cases=[]
 for i in range(6000):
  m=list(memory);m[0xba0c]=0x60;m[0x7603]=0x60
  # Neutral, advancing, defensive, punch and kick sequence poses, obtained by
  # stepping the original command and animation routines from a valid stance.
  fighters=[]
  for side in range(2):
   f=[6,6,12 if not side else 23,0,0,0,0,0,0,0,0,255,1 if not side else 255,0,0,0]
   for _ in range(rng.randrange(14)):
    m[0x20:0x30]=f;m[0x62]=f[2] if not side else 12;m[0x33]=10;m[0x50]=0
    m[0x29]=rng.choice((0,0,1,255));m[0x2a]=rng.choice((0,1,255))
    command=rng.choice((0,0,0,155,197,215,194))
    # Pass the command as A in a tiny offline call wrapper.
    m[0x1500:0x1506]=[0xa9,command,0x4c,0x40,0x65,0x60];call(m,0x1500);call(m,0x6400);f=m[0x20:0x30]
   f[2]=rng.randrange(8,20) if not side else rng.randrange(21,31);fighters.append(f)
  m[0x60:0x70],m[0x70:0x80]=fighters
  for a in FIELDS:m[a]=0
  for a,v in {7:rng.choice((32,64)),0x30:rng.randrange(2),0x3e:rng.randrange(6),0x44:0,0x46:rng.choice((0,128,255)),0x47:rng.choice((0,128,255)),0x48:rng.randrange(256),0x50:rng.randrange(8),0x51:rng.randrange(256),0x52:rng.randrange(27,49),0x53:rng.choice((0,2,4,252,250)),0x5b:rng.randrange(30),0x5c:rng.randrange(30),0x5d:1,0x5e:1,0x89:7,0x8b:15,0xb0:14,0xb1:14,0xb6:rng.randrange(1,15),0xb7:rng.randrange(1,15),0xb8:30,0xb9:30,0xc4:255,0xd0:1,0xdd:rng.choice((0,6,7,21,22,23,33,46,47,62,63)),0xdf:rng.choice((0,255)),0x7611:0}.items():m[a]=v
  if i>=4000:
   m[0x70:0x80]=[19,19,fighters[1][2],0,0,36,36,0,0,0,0,255,255,0,0,0];fighters[1]=m[0x70:0x80];m[0x5e]=m[0xb7]=0;m[0x30]=0;m[0x88]=rng.randrange(2)
  style=m[0x3e];m[0xd7]=memory[0xbbd9+style];m[0xd8]=memory[0xbbdf+style];m[0xd9]=memory[0xbbe5+style]
  state={str(a):m[a] for a in FIELDS};state['7']=m[7];call(m,0xb801)
  cases.append({'fighters':fighters,'state':state,'expected':[m[0x60:0x70],m[0x70:0x80],{str(a):m[a] for a in FIELDS}]})
 destination.mkdir(parents=True,exist_ok=True);(destination/'stage1-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original outdoor battle/camera steps')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');a=p.parse_args();export(load(a.memory),a.output)
