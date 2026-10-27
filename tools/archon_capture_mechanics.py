#!/usr/bin/env python3
"""Run original Archon state routines offline; export input/state fixtures only."""
import base64, hashlib, json, random, sys, tempfile, os, pty, subprocess
from pathlib import Path
from archon_extract_assets import ROOT, SHA256, relocated, word
from goonies_extract_physics import XexMonitor

FIELDS = [('hx',0x67f),('by',0x683),('dir',0x624),('walkPhase',0x628),('walkClock',0x62f),
          ('slowClock',0x64a),('terrainToggle',0x65e),('cooldown',0x662),('hp',0x646),
          ('previousDirection',0x69b),('aiHorizontal',0xdf),('aiVertical',0xdb),('aiDelay',0x6a3),
          ('aiReaction',0x6a5),('aiRange',0x693),('aiRetreat',0x695),('aiDodgeX',0x699),('aiDodgeY',0x697),
          ('weapon.active',0x644),('weapon.hx',0x681),('weapon.by',0x685),('weapon.dx',0xe1),('weapon.dy',0xdd),
          ('weapon.dir',0x626),('weapon.phase',0x62a),('weapon.phaseClock',0x631),('weapon.contact',0x637),
          ('weapon.terrainToggle',0x660)]

def stream(seed):
    values=[]
    for _ in range(256):
        seed=(seed*1664525+1013904223)&0xffffffff;values.append(seed>>24)
    return values

class ArchonMonitor(XexMonitor):
    def __init__(self, source, tv):
        self.master, slave = pty.openpty()
        self.process = subprocess.Popen(
            ['/opt/homebrew/bin/atari800','-no-autosave-config','-nosound','-no-video-accel',
             '-nobasic','-xe','-'+tv,'-turbo','-monitor','-run',str(source)],
            stdin=slave,stdout=slave,stderr=slave,start_new_session=True,
            env={**os.environ,'SDL_VIDEODRIVER':'dummy','SDL_AUDIODRIVER':'dummy'})
        os.close(slave);self.prompt()

class Original:
    def __init__(self, tv='ntsc'):
        self.folder=tempfile.TemporaryDirectory(prefix='archon-original-',dir='/private/tmp')
        self.dir=Path(self.folder.name);self.m=ArchonMonitor(ROOT/'Archon.xex',tv)
        self.m.prompt('bpc 32ec');self.m.prompt('cont')
        self.m.prompt('setpc 3326');self.m.prompt('bpc 36c0');self.m.prompt('cont')
        self.m.prompt('c 0602 00');self.m.prompt('bpc 3e06');self.m.prompt('cont')
        self.base=self.read(0,0xbfff);self.m.prompt('c d40e 00')
    def close(self):self.m.close();self.folder.cleanup()
    def read(self,start,end):
        p=self.dir/'output.bin';self.m.prompt(f'write {start:04x} {end:04x} {p}');return p.read_bytes()
    def load(self,b,start=0):
        p=self.dir/'input.bin';p.write_bytes(b);self.m.prompt(f'read {p} {start:04x} {len(b):04x}')
    def prepare(self,seed):
        b=bytearray(self.base)
        # Preserve Y and the load's flags; a deterministic byte source replaces
        # POKEY RANDOM only in the offline oracle. There is no CPU code in fixtures.
        stub=bytes.fromhex('8c f4 08 ac f5 08 ee f5 08 b9 00 09 08 ac f4 08 28 60')
        b[0x800:0x800+len(stub)]=stub;b[0x8f5]=0;b[0x900:0xa00]=bytes(stream(seed))
        for address in range(0x32ec,0x75e7-2):
            if b[address:address+3]==bytes.fromhex('ad 0a d2'):b[address:address+3]=bytes.fromhex('20 00 08')
        for address in range(0x6a0f,0x75e7-2):
            if b[address:address+3]==bytes.fromhex('bd 78 02'):b[address:address+3]=bytes.fromhex('bd f0 08')
            if b[address:address+3]==bytes.fromhex('bd 84 02'):b[address:address+3]=bytes.fromhex('bd f2 08')
        b[0x6bcf:0x6bd2]=bytes.fromhex('60 ea ea')
        b[0x820:0x829]=bytes.fromhex('78 a2 00 20 e1 6a 4c e0 08')
        # Arena ANTIC-7 character rows, used by the original AI's path checks.
        b[0xbd:0xbf]=bytes([0,16]);b[0xd00:0xdf0]=bytes(240)
        for row in range(12):
            p=0x1004+row*3;b[p:p+2]=(0xd00+row*20).to_bytes(2,'little')
        return b
    def run(self,start=0x820,end=0x8e0):
        self.m.prompt(f'setpc {start:04x}');self.m.prompt(f'bpc {end:04x}');out=self.m.prompt('cont')
        if f'PC={end:04X}' not in out:raise AssertionError(out[-1000:])


def capture():
    o=Original();source=relocated(ROOT/'Archon.xex');result={'sourceSha256':SHA256,'fields':[f for f,_ in FIELDS],'generators':[],'cases':[]}
    try:
        for seed in [1,7,37,91,255,1001,0x12345678,0xffffffff]:
            b=o.prepare(seed);o.load(b);o.run(0x53a8,0x542b)
            result['generators'].append({'seed':seed,'cells':list(o.read(0xd00,0xdef)),'randomReads':o.read(0x8f5,0x8f5)[0]})
        for type_id in [i for i in range(20) if i!=12]:
            for kind in ['movement','weapons','computer','computer-obstacles','computer-contact','computer-dark']:
                seed=type_id*19+len(kind);b=o.prepare(seed);pair=[2,type_id] if kind=='computer-dark' else [type_id,15 if type_id!=15 else 2]
                cells=result['generators'][type_id%8]['cells'];b[0xd00:0xdf0]=bytes(cells)
                b[0xb0]=(255 if kind=='computer-dark' else 85) if kind.startswith('computer') else 0;b[0x667]=1 if kind=='computer-dark' else 0
                classes=[128,64,128] if kind in ['computer-obstacles','computer-contact','computer-dark'] else [0,0,0]
                b[0x65a:0x65e]=bytes(classes+[255])
                b[0x609]=0
                for i,t in enumerate(pair):
                    b[0xd2+i]=t
                    initial={'hx':[80,143][i],'by':[85,163][i],'dir':[0,128][i],
                             'slowClock':64 if t in (3,11,18) else 0,'hp':source[0x564c+t]+3,
                             'aiReaction':3,'aiRange':source[0x55e8+t],'aiRetreat':source[0x55fc+pair[1-i]],
                             'aiDodgeX':source[0x5610+pair[1-i]],'aiDodgeY':source[0x5610+pair[1-i]]+3}
                    if initial['aiRange']<16 and initial['aiRetreat']>=20:initial['aiRetreat']=20
                    for name,a in FIELDS:b[a+i]=initial.get(name,0)
                    b[0x642+i]=source[0x5624+t];b[0x648+i]=source[0x5638+t]
                    for a,table in [(0x615,0x56c0),(0x617,0x56e8)]:
                        pointer=word(source,table+2*t);b[a+i]=pointer&255;b[a+5+i]=pointer>>8
                    b[0x620+i]=15;b[0x622+i]=7
                    if t==6:
                        pointer=word(source,0x56e8+2*t);b[0x619]=pointer&255;b[0x61e]=pointer>>8
                initial=[[b[a+i] for _,a in FIELDS] for i in range(2)]
                o.load(b);output=bytearray();inputs=[]
                length=96 if kind=='movement' else 160
                for step in range(length):
                    direction=[(1,0),(1,-1),(0,-1),(-1,-1),(-1,0),(-1,1),(0,1),(1,1),(0,0)][step//8%9]
                    if kind=='weapons':direction=[(1,0),(1,-1),(0,-1),(-1,1)][type_id%4]
                    fire=kind=='weapons' and (step==0 or step>=105)
                    # Explicit collision inputs isolate original state transitions
                    # from the separate pixel/GTIA collision verification.
                    contacts=[0,0,0,0,0,0]
                    if kind=='movement':contacts[0]=[0,64,128][step//32]
                    if kind=='computer-contact':contacts[0]=[0,64,128][step//16%3]
                    if kind=='weapons' and step in (23,59,113):contacts[4]=2
                    stick=15
                    if direction[0]>0:stick&=7
                    if direction[0]<0:stick&=11
                    if direction[1]<0:stick&=14
                    if direction[1]>0:stick&=13
                    o.load(bytes([stick,15,0 if fire else 1,1]),0x8f0)
                    o.load(bytes(contacts[0:4]),0x639);o.load(bytes(contacts[4:6]),0x637)
                    o.run();ram=o.read(0,0x8ff)
                    output.extend(ram[a+i] for i in range(2) for _,a in FIELDS)
                    output.append(ram[0x8f5]);inputs.append([direction[0],direction[1],int(fire),*contacts])
                result['cases'].append({'name':f'{type_id}:{kind}','types':pair,'kind':kind,'seed':seed,'cells':type_id%8,
                                        'classes':classes,'initial':initial,'inputs':inputs,'expected':base64.b64encode(output).decode()})
            print('Captured original arena type',type_id,flush=True)
    finally:o.close()
    target=ROOT/'tools/fixtures/archon-mechanics.json';target.write_text(json.dumps(result,separators=(',',':'))+'\n')
    print('Wrote',len(result['cases']),'original routine replays to',target)

if __name__=='__main__':capture()
