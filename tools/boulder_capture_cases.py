#!/usr/bin/env python3
"""Development-only exhaustive branch cases, executed by the original 6502.
Requires py65==1.2.0 in the development environment, never in the web game.
Atari800 captures remain the independent full-program oracle.
"""
import base64, json, sys
from pathlib import Path
from boulder_original import ROOT, SHA, FIELDS, ARRAYS, state, stream, Original,save_fixture,load_fixture
try:
 from py65.devices.mpu6502 import MPU
except ImportError:
 sys.path.insert(0, '/private/tmp/boulder-py65')
 from py65.devices.mpu6502 import MPU

class Ram(list):
 def __init__(self, source, seed=37):
  super().__init__(source); self.random=stream(seed); self.random_reads=0
 def __getitem__(self, address):
  if address==0xd20a:
   result=self.random[self.random_reads&255]; self.random_reads+=1; return result
  return super().__getitem__(address)

def execute(source, address=0x1d8f, seed=37):
 m=Ram(source,seed); m[0x5d0:0x5d7]=bytes([0x78,0x20,address&255,address>>8,0x4c,0xe0,0x05])
 cpu=MPU(memory=m, pc=0x5d0); cpu.sp=255
 while cpu.pc!=0x5e0:
  if cpu.processorCycles>3000000: raise RuntimeError(hex(cpu.pc))
  cpu.step()
 return bytes(m),m.random_reads,cpu.processorCycles

def capture():
 o=Original()
 try: base=bytearray(o.cave(1,0))
 finally:o.close()
 base.extend(bytes(65536-len(base))); cases=[]
 def case(name, cells, changes=None, stick=15, fire=False):
  b=bytearray(base);b[0x4c50:0x4fc0]=bytes([7]*880)
  for y in range(1,21):b[0x4c50+y*40+1:0x4c50+y*40+39]=bytes(38)
  for (x,y),code in cells.items(): b[0x4c50+y*40+x]=code
  b[0x792]=b[0x793]=0;b[0x788]=15;b[0x799]=64;b[0x278]=stick;b[0x284]=0 if fire else 1;b[0xd01f]=7
  for k,v in (changes or {}).items():
   if k in FIELDS:b[FIELDS[k]]=v
   else:
    a,n=ARRAYS[k];b[a:a+n]=bytes(v)
  initial=state(b);initial_cells=bytes(b[0x4c50:0x4fc0]);out,reads,cycles=execute(b)
  cases.append({'name':name,'initial':initial,'cells':base64.b64encode(initial_cells).decode(),'input':{'stick':stick,'fire':fire},
                'state':state(out),'result':base64.b64encode(out[0x4c50:0x4fc0]).decode(),'randomReads':reads,'cycles':cycles})
 # A current object is at (20,10); a marker Rockford keeps missing/count logic real.
 for code in [16,18,20,22]:
  for below in range(64):
   for roll in range(16):
    for magic in ([0,1,2,3] if below==3 else [0]):
     cells={(20,10):code,(20,11):below,(19,10):0 if roll&1 else 7,(19,11):0 if roll&2 else 7,(21,10):0 if roll&4 else 7,(21,11):0 if roll&8 else 7,(2,2):56}
     case(f'gravity-{code}-{below}-{roll}-{magic}',cells,{'magicState':magic})
 for code in [8,9,10,11,48,49,50,51]:
  for mask in range(16):
   for danger in [0,56,57,58]:
    offsets=[(-1,0),(0,-1),(1,0),(0,1)];cells={(20,10):code,(2,2):56}
    for i,(dx,dy) in enumerate(offsets):cells[20+dx,10+dy]=7 if mask>>i&1 else 0
    if danger:cells[20+offsets[mask%4][0],10+offsets[mask%4][1]]=danger
    case(f'enemy-{code}-{mask}-{danger}',cells)
 for previous in [0,1,199,200,201,255]:
  for growing in [0,1]:
   for open_ in [0,1]:
    for target in [0,1,2,7,56,58]:
     cells={(20,10):58,(19,10):target,(21,10):target,(20,9):target,(20,11):target,(2,2):56}
     case(f'amoeba-{previous}-{growing}-{open_}-{target}',cells,{'amoebaPrevious':previous,'amoebaCount':previous,'amoebaGrowing':growing,'amoebaOpen':open_,'amoebaWasOpen':open_,'amoebaMask':3})
 for code in [8,9,10,11,48,49,50,51]:
  for mask in range(16):
   cells={(20,10):code,(2,2):56}
   for i,(dx,dy) in enumerate([(-1,0),(0,-1),(1,0),(0,1)]):cells[20+dx,10+dy]=58 if mask>>i&1 else 7
   case(f'enemy-contact-{code}-{mask}',cells)
 for chance_mask in [0,1,2,3,127,15]:
  for free in range(5):
   for target in [0,1,2]:
    cells={(20,10):58,(2,2):56}
    for i,(dx,dy) in enumerate([(0,-1),(-1,0),(1,0),(0,1)]):cells[20+dx,10+dy]=target if i<free else 7
    case(f'amoeba-direction-{chance_mask}-{free}-{target}',cells,{'amoebaMask':chance_mask})
 for stick in [15,14,13,11,7,6,5,9,10]:
  for fire in [False,True]:
   for target in [0,1,2,3,4,5,7,8,16,17,18,20,21,22,48,56,58]:
    cells={(20,10):56}
    for xy in [(19,10),(21,10),(20,9),(20,11)]:cells[xy]=target
    case(f'move-{stick}-{int(fire)}-{target}',cells,{'playerX':20,'playerY':12},stick,fire)
 for score in [0,390,399,400,490,499,500,990,999,1000,1390,1490,1990,999990]:
  for value in [1,10,15,20,99,255]:
   for lives in [3,8,9]:
    for diamonds in [0,9,11,98,99]:
     case(f'score-{score}-{value}-{lives}-{diamonds}',{(20,10):56,(21,10):20},
          {'score':list(map(int,f'{score:06}')),'value':list(map(int,f'{value:03}')),'lives':lives,'diamonds':list(map(int,f'{diamonds:02}')),'needed':[1,2]},7)
 for code in [4,5,27,28,29,30,31,32,33,34,35,36,37,38,39,40]:
  for spawn in [0,1,2]:
   for enough in [0,1]:
    for flash in [0,1,254,255]:case(f'phase-{code}-{spawn}-{enough}-{flash}',{(20,10):code,(2,2):56},{'spawnSeconds':spawn,'enough':enough,'boxFlash':flash})
 save_fixture('boulder-cases',{'sourceSha256':SHA,'cases':cases})
 print('Captured',len(cases),'targeted original cases',flush=True)
if __name__=='__main__':capture()
