#!/usr/bin/env python3
"""Offline original XEX oracle for every motor speed/control combination.

AUDCTL/SKCTL are read after the game's own initialization, not forced by the
capture. The original sound routine runs on the development Atari800 only.
"""
import hashlib,json,re
from pathlib import Path
from goonies_extract_physics import XexMonitor
ROOT=Path(__file__).resolve().parents[1]
def capture():
 m=XexMonitor(ROOT/'River Raid.xex');cases=[]
 try:
  m.prompt('bpc a19e');m.prompt('cont');initial=m.prompt('pokey')
  audctl=int(re.search(r'AUDCTL=\s*([0-9A-F]{2})',initial)[1],16)
  skctl=int(re.search(r'SKCTL=\s*([0-9A-F]{2})',initial)[1],16)
  assert audctl==0 and skctl==3,initial
  m.prompt('c d40e 00');m.prompt('c b3db 60');m.prompt('c 0600 20 a5 b2 4c 00 07');m.prompt('bpc 0700')
  m.prompt('f 0000 00ff 00');m.prompt('c 005b ff');m.prompt('c 052c 00')
  for speed in range(64,256):
   for controls in [12,13,14,15]:
    m.prompt(f'c 0059 {speed:02x}');m.prompt(f'c 0019 {controls:02x}');m.prompt('setpc 0600');m.prompt('cont');text=m.prompt('pokey')
    values=[int(re.search(rf'{name}=\s*([0-9A-F]{{2}})',text)[1],16) for name in ['AUDF1','AUDC1']]
    cases.append({'speed':speed,'controls':controls,'registers':values})
 finally:m.close()
 result={'sourceSha256':hashlib.sha256((ROOT/'River Raid.rom').read_bytes()).hexdigest(),'routine':'B32C-B34F','audctl':audctl,'skctl':skctl,'cases':cases}
 (ROOT/'tools/fixtures/river-motor-oracle.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
 print('Captured',len(cases),'original motor register states, AUDCTL',audctl,'SKCTL',skctl,flush=True)
if __name__=='__main__':capture()
