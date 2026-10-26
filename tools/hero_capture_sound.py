#!/usr/bin/env python3
"""Original VBI sound-control oracle, with hardware writes shadowed in RAM."""
import json,random
from pathlib import Path
from goonies_extract_physics import XexMonitor
from hero_extract import ROOT,SHA
def capture():
    m=XexMonitor(ROOT/'H.E.R.O..xex');rng=random.Random(1984);cases=[];dump=Path('/private/tmp/hero-sound.bin')
    try:
        m.prompt('bpc 8177');m.prompt('cont');m.prompt('c d40e 00');m.prompt('c 1d 00')
        for p,code in [(0x8e6d,'8e 03 03'),(0x8e70,'8c 02 03'),(0x8ec2,'8e 00 03'),(0x8ec5,'8c 01 03'),(0x8ec8,'60')]:m.prompt(f'c {p:04x} {code}')
        m.prompt('c 0600 20 04 8e 4c 00 07');m.prompt('bpc 0700')
        for i in range(640):
            inp={'clock':i&255,'death':rng.choice([0,0,0,149,150,151,255,200]),'rescue':rng.choice([0,0,0,255]),'power':rng.randrange(82),'expired':rng.choice([0,255]),'motion':rng.choice([0,64,128]),'ghostContact':rng.choice([0,0,128]),'flyFrame':rng.randrange(3),'beamX':rng.choice([0,100,224,255]),'fuses':[0,rng.choice([0,0,1,12,31,32,64]),rng.choice([0,0,8,32,64])], 'fire':bool(i&1),'randomByte':rng.randrange(256)}
            for key,address in [('clock',4),('death',0x33),('rescue',0x73),('power',0x31),('expired',0x35),('motion',0x32),('ghostContact',0x8d),('flyFrame',0x68),('beamX',0x74)]:m.prompt(f'c {address:02x} {inp[key]:02x}')
            m.prompt('c 5f '+' '.join(f'{n:02x}' for n in inp['fuses']))
            m.prompt(f'c 8e53 a9 {0 if inp["fire"] else 1:02x} ea');m.prompt(f'c 8e84 a9 {inp["randomByte"]:02x} ea')
            m.prompt('setpc 0600');m.prompt('cont');m.prompt(f'write 0300 0303 {dump}')
            cases.append({'input':inp,'registers':list(dump.read_bytes())})
    finally:m.close()
    (ROOT/'tools/fixtures/hero-sound.json').write_text(json.dumps({'sourceSha256':SHA,'cases':cases},separators=(',',':'))+'\n');print('Captured',len(cases),'original audio control states.')
if __name__=='__main__':capture()
