#!/usr/bin/env python3
"""Capture complete original VBI routines: counters, glyphs and scrolling."""
import base64,json
from boulder_original import Original,state,ROOT,SHA,save_fixture,load_fixture

def capture():
    o=Original();cases=[]
    try:
        for cave in [1,6,7,13,17]:
            b=o.prepare(o.cave(cave,0),cave*37)
            b[0x5d0:0x5d7]=bytes.fromhex('78 20 b0 1b 4c e0 05')
            # Source player's motion, original magic wall, life flash and cave
            # reveal are exercised as separate VBI states, without core injection.
            b[0x788]=15;b[0x799]=64;b[0x859]=0
            if cave==6:b[0x78a]=1
            if cave==7:b[0x833]=128;b[0x7ae]=6
            o.load(b);steps=[]
            for frame in range(360):
                if frame==100:o.load(bytes([7]),0x788)
                if frame==180:o.load(bytes([11]),0x788);o.load(bytes([1]),0x79d)
                if frame==260:o.load(bytes([15]),0x788)
                o.run(0x5d0,0x5e0);ram=o.read(0,0x47ff)
                steps.append({'state':state(ram),'font':base64.b64encode(ram[0x4400:0x4800]).decode(),'randomReads':ram[0x5f5],
                              'raster':list(ram[0x845:0x84d])+list(ram[0x85a:0x85f]),'background':ram[0x2c8]})
            cases.append({'cave':cave,'seed':cave*37,'steps':steps})
            print('Captured original VBI',cave,flush=True)
    finally:o.close()
    save_fixture('boulder-vbi',{'sourceSha256':SHA,'cases':cases})
if __name__=='__main__':capture()
