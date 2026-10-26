#!/usr/bin/env python3
"""Development oracle: real ready screen and gunner missile, no runtime CPU."""
import base64,hashlib,json
from pathlib import Path
from goonies_extract_physics import XexMonitor
ROOT=Path(__file__).resolve().parents[1]
def capture():
 source=ROOT/'River Raid.xex';sha=hashlib.sha256(source.read_bytes()).hexdigest()
 assert sha=='a6c3a5f0f8a70632a8402bf54025bba18ec517e12107873c814c8328712a7c3b'
 m=XexMonitor(source)
 try:
  # A19E is once per actual frame; A197 is a scanline busy-wait.
  m.prompt('bpc a19e');m.prompt('cont');m.prompt('c 09 00');m.prompt('sety 00');m.prompt('setpc a680');m.prompt('cont')
  for _ in range(150):
   m.prompt('cont');m.prompt('write 0000 bfff /private/tmp/river-scene-oracle.bin');b=Path('/private/tmp/river-scene-oracle.bin').read_bytes()
   if b[0x76]==47:break
  else:raise ValueError('Original did not reach the human ready state.')
  pointer=0x3f03;address=0;rows=[]
  while len(rows)<160:
   op=b[pointer];pointer+=1
   if op&64:address=int.from_bytes(b[pointer:pointer+2],'little');pointer+=2
   rows.append(base64.b64encode(b[address+4:address+44]).decode());address+=48
  scene={'rows':rows,'planeRawX':b[0x57],'planePMG':list(b[0xeaa:0xeb8]),'fieldPhysicalTop':28,'planePhysicalTop':170,'actors':[{'slot':i,'rawY':b[0xc+i],'frame':b[0x500+i],'type':b[0x50b+i],'rawX':b[0x516+i]} for i in range(b[0x4d],11)]}
  m.prompt('c d40e 00');m.prompt('c a607 60');m.prompt('c 0600 20 b7 a5 4c 00 07');m.prompt('bpc 0700')
  cases=[]
  for flags,playing in [(0,True),(8,True),(0,False)]:
   m.prompt('c 51 00');m.prompt('c 0500 0a');m.prompt('c 000c 78');m.prompt('c 0516 64');m.prompt(f'c 42 {flags:02x}');m.prompt('c c0 00 00 00');m.prompt(f'c 76 {0 if playing else 48:02x}');m.prompt('c 29 00')
   frames=[]
   for tick in range(48):
    m.prompt(f'c 22 {0 if tick==20 else 255:02x}')
    if tick==30:m.prompt('c 0500 02')
    m.prompt('setpc 0600');m.prompt('cont');m.prompt('write 00c0 00c2 /private/tmp/river-gunner-oracle.bin');r=Path('/private/tmp/river-gunner-oracle.bin').read_bytes()
    frames.append({'dx':r[0] if r[0]<128 else r[0]-256,'rawX':r[1],'rawY':r[2]})
   cases.append({'flags':flags,'playing':playing,'frames':frames})
 finally:m.close()
 (ROOT/'tools/fixtures/river-scene-oracle.json').write_text(json.dumps({'sourceSha256':sha,'scene':scene,'gunners':cases},separators=(',',':'))+'\n')
 print('Captured original ready raster and 144 gunner updates.')
if __name__=='__main__':capture()
