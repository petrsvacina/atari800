#!/usr/bin/env python3
"""Original inflated character maps after native source drawing and updates."""
import base64,json
from boulder_original import Original,ROOT,SHA,save_fixture,load_fixture
from boulder_capture_cases import execute

def capture():
 o=Original();cases=[]
 try:
  for cave in range(1,21):
   b=bytearray(o.cave(cave,0));b.extend(bytes(65536-len(b)));b[0x792]=b[0x793]=0;b[0xd01f]=7;b[0x278]=15;b[0x284]=1
   b,_,_=execute(b,0x1957);steps=[]
   for stick in [15,7,13,11,14,7]:
    ram=bytearray(b);ram[0x278]=stick;b,_,_=execute(ram)
    quads=[]
    for y in range(22):
     for x in range(40):
      at=0x5003+y*160+x*2;quads.extend(b[at+d] for d in [0,1,80,81])
    steps.append({'stick':stick,'quads':base64.b64encode(bytes(quads)).decode()})
   cases.append({'cave':cave,'steps':steps})
 finally:o.close()
 save_fixture('boulder-graphics',{'sourceSha256':SHA,'cases':cases});print('Captured 120 original complete character maps',flush=True)
if __name__=='__main__':capture()
