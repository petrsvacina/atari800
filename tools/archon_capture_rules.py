#!/usr/bin/env python3
"""Capture original initialization, complete turns, healing and prisoner release."""
import json
from archon_capture_mechanics import Original
from archon_extract_assets import ROOT,SHA256

def capture():
 o=Original();cases=[]
 try:
  for side in ['light','dark']:
   b=o.prepare(37);b[0xb0]=0;b[0x601]=0 if side=='light' else 255;b[0x602]=0;b[0x62e]=0
   b[0x8f0:0x8f4]=bytes([15,15,1,1]);o.load(b);o.m.prompt('c 0b10 58 4c 5f 36');o.m.prompt('c d40e c0');o.run(0xb10,0x3e06)
   initial=o.read(0,0x12ff);steps=[]
   for a,v in [(0x1179+8,3),(0x1179+6,2),(0x1179+27,4),(0x665,6),(0x666,29)]:o.m.prompt(f'c {a:04x} {v:02x}')
   for _ in range(22):
    o.run(0x3c64,0x3e06);ram=o.read(0,0x12ff)
    steps.append({'luma':ram[0x2c7]&15,'direction':-1 if ram[0x608]&128 else 1,'side':'dark' if ram[0x604]&128 else 'light',
                  'health':list(ram[0x1179:0x119d]),'prisoners':list(ram[0x665:0x667])})
   cases.append({'firstSide':side,'initial':{'luma':initial[0x2c7]&15,'direction':-1 if initial[0x608]&128 else 1,'side':'dark' if initial[0x604]&128 else 'light'},'steps':steps})
   print('Captured complete original turns, first side',side,flush=True)
 finally:o.close()
 (ROOT/'tools/fixtures/archon-rules.json').write_text(json.dumps({'sourceSha256':SHA256,'cases':cases},separators=(',',':'))+'\n')
if __name__=='__main__':capture()
