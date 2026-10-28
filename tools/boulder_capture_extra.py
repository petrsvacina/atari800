#!/usr/bin/env python3
"""Supported pushes/grabs and pre-scan control-flow branches from original code."""
import base64,json
from boulder_original import Original,ROOT,SHA,FIELDS,ARRAYS,state,save_fixture,load_fixture
from boulder_capture_cases import execute
from boulder_capture_timing import profile

def capture():
 o=Original()
 try:base=bytearray(o.cave(1,0))
 finally:o.close()
 base.extend(bytes(65536-len(base)));cases=[];timings=[]
 def case(name,cells,changes,stick=15,fire=False,seed=37):
  b=bytearray(base);b[0x4c50:0x4fc0]=bytes([7]*880)
  for y in range(1,21):b[0x4c50+y*40+1:0x4c50+y*40+39]=bytes(38)
  for (x,y),v in cells.items():b[0x4c50+y*40+x]=v
  b[0x792]=b[0x793]=0;b[0x788]=15;b[0x799]=64;b[0x278]=stick;b[0x284]=int(not fire);b[0xd01f]=7
  for k,v in changes.items():
   if k in FIELDS:b[FIELDS[k]]=v
   else:a,n=ARRAYS[k];b[a:a+n]=bytes(v)
  before=state(b);out,reads,cycles=execute(b,seed=seed)
  cases.append({'name':name,'seed':seed,'initial':before,'cells':base64.b64encode(b[0x4c50:0x4fc0]).decode(),'input':{'stick':stick,'fire':fire},'state':state(out),'result':base64.b64encode(out[0x4c50:0x4fc0]).decode(),'randomReads':reads,'cycles':cycles})
  timings.append(profile(b,seed=seed))
 for stick,dx,dy in [(11,-1,0),(7,1,0),(14,0,-1),(13,0,1),(5,1,0),(6,1,0),(9,-1,0),(10,-1,0)]:
  for fire in [False,True]:
   for target in [16,20]:
    for blocked in [False,True]:
     for seed in [1,12]:
      x,y=20+dx,10+dy;cells={(20,10):56,(x,y):target,(x,y+1):1,(20+dx*2,10+dy*2):7 if blocked else 0};cells[20,10]=56
      case(f'supported-{stick}-{int(fire)}-{target}-{int(blocked)}-{seed}',cells,{'playerX':20,'playerY':12},stick,fire,seed)
 for seed in range(1,17):case(f'amoeba-open-dirt-{seed}',{(20,10):58,(19,10):1,(21,10):1,(20,9):1,(20,11):1,(2,2):56},{'amoebaOpen':1,'amoebaWasOpen':1,'amoebaMask':3},seed=seed)
 for stick,dx,dy in [(11,-1,0),(7,1,0),(14,0,-1),(13,0,1),(5,1,0),(6,1,0),(9,-1,0),(10,-1,0)]:
  for score in [390,490,990,999990]:
   for value in [10,20,99]:
    for lives in [3,9]:
     x,y=20+dx,10+dy;cells={(20,10):56,(x,y):20,(x,y+1):1};cells[20,10]=56
     case(f'grab-score-{stick}-{score}-{value}-{lives}',cells,{'score':list(map(int,f'{score:06}')),'value':list(map(int,f'{value:03}')),'lives':lives},stick,True)
 for seed in range(1,17):case(f'amoeba-second-dirt-{seed}',{(10,10):58,(9,10):1,(11,10):1,(10,9):1,(10,11):1,(20,10):58,(19,10):1,(21,10):1,(20,9):1,(20,11):1,(2,2):56},{'amoebaMask':3},seed=seed)
 for missing in [0,14,15,16]:
  for fire in [False,True]:
   for elapsed in [0,1]:
    for moving in [False,True]:
     for open_ in [0,1]:
      for was in [0,1]:case(f'pre-{missing}-{int(fire)}-{elapsed}-{int(moving)}-{open_}-{was}',{(2,2):56},{'missing':missing,'elapsed':elapsed,'amoebaOpen':open_,'amoebaWasOpen':was},7 if moving else 15,fire)
 save_fixture('boulder-extra',{'sourceSha256':SHA,'cases':cases})
 save_fixture('boulder-timing-extra',{'sourceSha256':SHA,'cases':timings})
 print('Captured',len(cases),'additional original cases',flush=True)
if __name__=='__main__':capture()
