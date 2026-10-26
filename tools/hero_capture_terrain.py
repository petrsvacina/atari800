#!/usr/bin/env python3
"""Development-only original room-builder oracle; stores character data only."""
import hashlib,json
from pathlib import Path
from goonies_extract_physics import XexMonitor
from hero_extract import ROOT,SHA

def capture():
    source=ROOT/'H.E.R.O..xex'
    assert hashlib.sha256(source.read_bytes()).hexdigest()==SHA
    m=XexMonitor(source);cases=[];dump=Path('/private/tmp/hero-terrain.bin')
    try:
        m.prompt('bpc 8177');m.prompt('cont');m.prompt('c d40e 00')
        for address in [0x97d6,0x97e7,0x97f8,0x9809,0x981a,0x982b]:m.prompt(f'c {address:04x} a9 00 ea')
        m.prompt('write 0000 bfff /private/tmp/hero-terrain-source.bin')
        b=Path('/private/tmp/hero-terrain-source.bin').read_bytes()
        m.prompt('c 0600 20 83 95 4c 00 07');m.prompt('bpc 0700')
        configs=[]
        for level in range(20):
            for room in range(b[0xad28+level]+1):configs.append((level,room,None))
        for level,room in [(0,0),(8,9),(16,8),(19,15)]:
            for wall in [0,9,16,17,20,61,128,148,153]:
                for phase in [0,128]:configs.append((level,room,(wall,phase)))
        for level,room,variant in configs:
            i=b[0xad00+level]+room;flags=b[0xac00+i]
            wall=(flags&0xfc)|1 if flags&0xfc else 0
            phase=0
            if variant:wall,phase=variant
            present=not(room<10 and room!=b[0xad28+level] and wall in [9,153])
            upper=[0xc0 if room==0 else (255 if room>=11 else b[0xa8ff+i]),b[0xa800+i],b[0xa900+i]]
            lower=[0 if room==0 else (255 if room>=11 else b[0xaaff+i]),b[0xaa00+i],b[0xab00+i]]
            inp={'level':level,'room':room,'clock':37,'floorPresent':present,'upper':upper,'lower':lower,'wallX':wall,'wallPhase':phase,'middleMode':4 if flags&1 else 5}
            m.prompt('f 2043 214a 00')
            for address,value in [(0x7e,level),(0x22,room),(0x04,37),(0x3f,255 if present else 0),(0x26,wall),(0x37,phase),(0x4a,inp['middleMode'])]+list(zip([0x42,0x41,0x40],upper))+list(zip([0x45,0x44,0x43],lower)):
                m.prompt(f'c {address:02x} {value:02x}')
            m.prompt('setpc 0600');m.prompt('cont');m.prompt(f'write 2043 214a {dump}')
            cases.append({'input':inp,'tiles':list(dump.read_bytes())})
        target=ROOT/'tools/fixtures/hero-terrain.json';target.write_text(json.dumps({'sourceSha256':SHA,'randomByte':0,'cases':cases},separators=(',',':'))+'\n')
        print('Captured',len(cases),'original H.E.R.O. room-builder cases.')
    finally:m.close()
if __name__=='__main__':capture()
