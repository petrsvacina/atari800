#!/usr/bin/env python3
"""Capture the real $A455-$A4B6 flight update for native regression tests."""
import json,sys
from pathlib import Path
from goonies_extract_physics import XexMonitor
ROOT=Path(__file__).resolve().parents[1]
def capture():
 m=XexMonitor(ROOT/'River Raid.xex');records=[]
 try:
  m.prompt('bpc a197');m.prompt('cont');m.prompt('c d40e 00');m.prompt('c 2b 00');m.prompt('c 57 7c 00 80');previous=15
  for i in range(480):
   controls=[15,11,7,14,13,10,6,9,5,15][(i//24)%10]
   m.prompt(f'c 19 {controls:02x}');m.prompt(f'c b9 {(previous<<4)&255:02x}');m.prompt('bpc a4b6');m.prompt('setpc a455');m.prompt('cont');m.prompt('write 0000 00bf /private/tmp/river-flight.bin');b=Path('/private/tmp/river-flight.bin').read_bytes();previous=controls
   records.append({'controls':controls,'state':{'rawX':b[0x57],'fraction':b[0x58],'speed':b[0x59],'accel':b[0x2b],'pose':b[0x5e],'controls':controls}})
 finally:m.close()
 (ROOT/'tools/fixtures/river-flight-oracle.json').write_text(json.dumps(records,separators=(',',':'))+'\n');print('Captured',len(records),'original flight updates.')
if __name__=='__main__':capture()
