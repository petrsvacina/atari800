#!/usr/bin/env python3
"""Capture original cave generation and complete isolated scan routines."""
import base64,json
from boulder_original import Original,FIELDS,ARRAYS,state,ROOT,SHA,save_fixture,load_fixture

def capture():
    original=Original();caves=[];traces=[]
    try:
        for cave in range(1,21):
            for level in range(5):
                ram=original.cave(cave,level)
                caves.append({'cave':cave,'level':level,'cells':base64.b64encode(ram[0x4c50:0x4fc0]).decode(),'state':state(ram)})
            print('Captured original cave',cave,'at all five levels',flush=True)
        for cave in range(1,21):
            seed=cave*31+37;ram=original.cave(cave,cave%5);b=original.prepare(ram,seed)
            b[0x792]=b[0x793]=0
            original.load(b);steps=[]
            for tick in range(140):
                direction=[7,13,11,14,6,9,5,10,15][tick//11%9];fire=int(tick%23>=17)
                original.load(bytes([direction]),0x278);original.load(bytes([0 if fire else 1]),0x284)
                original.run(0x5d0,0x5e0);ram=original.read(0,0x4fff)
                steps.append({'input':{'stick':direction,'fire':bool(fire)},'cells':base64.b64encode(ram[0x4c50:0x4fc0]).decode(),
                              'state':state(ram),'randomReads':ram[0x5f5]})
            traces.append({'cave':cave,'level':cave%5,'seed':seed,'steps':steps})
            print('Captured original scan replay',cave,flush=True)
    finally:original.close()
    save_fixture('boulder-original',{'sourceSha256':SHA,'fields':FIELDS,'arrays':ARRAYS,'caves':caves,'traces':traces})

if __name__=='__main__':capture()
