#!/usr/bin/env python3
"""Capture hardware RANDOM with real scanline/cycle positions in Atari800."""
import json,re
from boulder_original import Original,ROOT,SHA,save_fixture,load_fixture

def capture():
 o=Original();points=[];wrap=0;prior=-1
 try:
  o.m.prompt('c d40e 00');o.m.prompt('c d400 00');o.m.prompt('c d20f 03');o.m.prompt('c d208 00');o.load(bytes.fromhex('ad0ad24c0005'),0x500)
  for _ in range(128):
   o.run(0x500,0x503);s=o.m.prompt('show');m=re.search(r'\n\s*(\d+)\s+(\d+) A=([0-9A-F]{2})',s);assert m,s
   position=int(m[1])*114+int(m[2]);wrap+=29868 if position<prior else 0;prior=position;points.append([wrap+position,int(m[3],16)])
 finally:o.close()
 save_fixture('boulder-random',{'sourceSha256':SHA,'points':points});print('Captured 128 hardware RANDOM reads',flush=True)
if __name__=='__main__':capture()
