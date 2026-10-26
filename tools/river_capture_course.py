#!/usr/bin/env python3
"""Development-only execution of the supplied course generator; saves numeric records."""
from pathlib import Path
import sys,hashlib,argparse,json
sys.path.insert(0,str(Path(__file__).resolve().parent))
from goonies_extract_physics import XexMonitor
source=Path(__file__).resolve().parents[1]/'River Raid.xex'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='a6c3a5f0f8a70632a8402bf54025bba18ec517e12107873c814c8328712a7c3b'
p=argparse.ArgumentParser();p.add_argument('--tank-candidates',action='store_true');args=p.parse_args()
m=XexMonitor(source)
try:
 m.prompt('bpc a197');m.prompt('cont');m.prompt('write 0000 bfff /private/tmp/river-menu.bin');m.prompt('c d40e 00');m.prompt('c aa e3 d4 f7');m.prompt('c 52 20')
 # Call original generator once per loop. Its exit at A701 now returns.
 m.prompt('c a701 60');m.prompt('c 4000 00')
 code=bytearray();labels={};fix=[]
 def emit(*b):code.extend(b)
 def label(s):labels[s]=len(code)
 def branch(op,s):emit(op,0);fix.append((len(code)-1,s))
 emit(0xa9,0,0x85,0xd0,0xa9,0x40,0x85,0xd1,0xa9,0x80,0x85,0xd2)
 label('row')
 # Enumerate every possible tank birth independently of whether a previous
 # tank is still on screen. Runtime applies the original single-tank gate.
 if args.tank_candidates:emit(0xa9,0,0x85,0x38,0x85,0x3a)
 emit(0x20,0x11,0xa7,0xa0,0)
 emit(0xad,4,0x3f,0x85,0xd3,0xad,5,0x3f,0x85,0xd4)
 label('copy');emit(0xb1,0xd3,0x91,0xd0,0xc8,0xc0,48);branch(0x90,'copy')
 emit(0xa2,0x30);label('state');emit(0xb5,0,0x91,0xd0,0xe8,0xc8,0xe0,0x70);branch(0x90,'state')
 emit(0xa2,0);label('actors');emit(0xb5,0x0c,0x91,0xd0,0xc8,0xbd,0,5,0x91,0xd0,0xc8,0xbd,0x16,5,0x91,0xd0,0xc8,0xbd,0x21,5,0x91,0xd0,0xc8,0xe8,0xe0,11);branch(0x90,'actors')
 emit(0xa5,0x23,0x91,0xd0,0xc8,0xa5,0x2f,0x91,0xd0,0xc8,0xa5,0x2d,0x91,0xd0)
 emit(0x18,0xa5,0xd0,0x69,192,0x85,0xd0);branch(0x90,'page');emit(0xe6,0xd1);label('page');emit(0xc6,0xd2);branch(0xd0,'row')
 emit(0x4c,0,6)
 for i,s in fix:code[i]=(labels[s]-i-1)&255
 p=Path('/private/tmp/river-capture-loop.bin')
 # final JMP is to $0700, a separate stop instruction.
 code[-2:]=bytes([0,7]);p.write_bytes(code);m.prompt(f'read {p} 600');m.prompt('bpc 0700')
 rows=[]
 for batch in range(2096):
  m.prompt('setpc 0600');m.prompt('cont');m.prompt('write 4000 9fff /private/tmp/river-capture-records.bin')
  b=Path('/private/tmp/river-capture-records.bin').read_bytes();rows.extend([b[i:i+192] for i in range(0,len(b),192)])
  if batch%128==0:print('row',len(rows),'bridge',rows[-1][96],flush=True)
 if args.tank_candidates:
  candidates=[]
  baseline=Path('/private/tmp/river-records.bin').read_bytes()
  for i,r in enumerate(rows):
   assert r[:48]==baseline[i*192:i*192+48],f'river differs at {i}'
   if r[56]:candidates.append({'row':i,'frame':r[56],'rawX':r[57],'rawY':r[58],'dx':r[62],'fractionDX':r[63],'follow':r[65]})
  target=Path(__file__).resolve().parents[1]/'research/river-raid/tank-candidates.json'
  target.write_text(json.dumps(candidates,separators=(',',':'))+'\n')
  print('Tank candidates',len(candidates),flush=True)
 else:
  Path('/private/tmp/river-records.bin').write_bytes(b''.join(rows));m.prompt('write 0000 bfff /private/tmp/river-generation.bin')
 print('captured',len(rows),'rows','bridges',sorted({r[48+0x60-0x30] for r in rows}),'first',rows[0][:48].hex())
finally:m.close()
