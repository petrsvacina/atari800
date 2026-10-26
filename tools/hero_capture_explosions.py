#!/usr/bin/env python3
"""Original detonation geometry and scoring, including borrow edge cases."""
import base64,json,random,zlib
from pathlib import Path
from goonies_extract_physics import XexMonitor
from hero_extract import ROOT,SHA
from hero_capture_game import snapshot
def capture():
    m=XexMonitor(ROOT/'H.E.R.O..xex');rng=random.Random(26);cases=[];dump=Path('/private/tmp/hero-detonation.bin')
    try:
        m.prompt('bpc 8177');m.prompt('cont');m.prompt('c d40e 00');m.prompt('bpc 8d58')
        for n in range(384):
            slot=n%3;wall=rng.choice([0,9,10,17,33,61,64,80,128,148,152,153]);bomb=rng.randrange(1,147)
            m.prompt('f 001b 0090 00');m.prompt('c 38 06 04');m.prompt(f'c 21 {rng.randrange(48,204):02x}');m.prompt(f'c 25 {0x31 if slot==2 else 0x5b:02x}');m.prompt(f'c 26 {wall:02x}');m.prompt(f'c {0x27+slot:02x} 0c');m.prompt(f'c {0x2b+slot:02x} {rng.randrange(1,147):02x}');m.prompt(f'c {0x2e+slot:02x} {bomb:02x}');m.prompt(f'c {0x5f+slot:02x} 22');m.prompt('c 31 40')
            m.prompt(f'write 0000 bfff {dump}');initial=snapshot(dump.read_bytes());m.prompt('setpc 8cb0');m.prompt('cont');m.prompt(f'write 0000 bfff {dump}')
            cases.append({'initial':initial,'state':snapshot(dump.read_bytes())})
    finally:m.close()
    (ROOT/'tools/fixtures/hero-explosions.json').write_text(json.dumps({'sourceSha256':SHA,'encoding':'zlib+base64 JSON','cases':base64.b64encode(zlib.compress(json.dumps(cases,separators=(',',':')).encode(),9)).decode()},separators=(',',':'))+'\n');print('Captured',len(cases),'original detonations.')
if __name__=='__main__':capture()
