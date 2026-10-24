#!/usr/bin/env python3
"""Record original movement outputs; Atari800 is used only as a development oracle."""
import hashlib,json,tempfile,random
from pathlib import Path
from goonies_extract_physics import XexMonitor,ROOT,ORDER,SHA256
source=next((ROOT/'Goonies').glob('*.xex'))
if hashlib.sha256(source.read_bytes()).hexdigest()!=SHA256:raise ValueError('Unsupported XEX revision')
m=XexMonitor(source)
try:
 m.prompt('bpc 0786');m.prompt('cont');runs=[]
 with tempfile.TemporaryDirectory(prefix='goonies-oracle-') as folder:
  dump=Path(folder)/'ram.bin'
  for room in ORDER:
   m.prompt('c 112d 00');m.prompt(f'c 112e {room:02x}');m.prompt('c 1130 ff');m.prompt('bpc 0786');m.prompt('setpc 074a');m.prompt('cont')
   m.prompt('c 0f00 00 00 00 00 00 00 00 00')
   m.prompt(f'write 0000 bfff {dump}');b=dump.read_bytes()
   assert b[0x112e]==room and b[0x1130]==room
   records=[];rng=random.Random(6502+room)
   for i in range(160):
    if i%8==0:buttons=rng.choice([{}, {'left':True},{'right':True},{'up':True},{'up':True,'right':True},{'up':True,'left':True},{'down':True}])
    control=31
    for key,mask in [('left',4),('right',8),('up',17),('down',2)]:
     if buttons.get(key):control&=255^mask
    # Isolate the original movement and pose chooser; room scripts are not patched or executed.
    m.prompt(f'c 0630 a9 {control:02x} 8d 63 1f a2 00 20 5a 0b 20 86 0a ea')
    m.prompt('bpc 063d');m.prompt('setpc 0630');m.prompt('cont');m.prompt(f'write 0000 bfff {dump}');a=dump.read_bytes()
    actor={key:a[address] for key,address in [('x',0x1f21),('y',0x1f2c),('vx',0x1f0b),('vy',0x1f16),('frame',0x1f37),('climb',0x1f42),('direction',0x1f4d),('moving',0x1f58),('baseFrame',0x1f6e)]}
    for key in ['vx','vy']:
     if actor[key]>127:actor[key]-=256
    records.append({'input':buttons.copy(),'actor':actor})
   runs.append({'room':room,'records':records});print('oracle',room,len(records),flush=True)
  (ROOT/'tools/fixtures/goonies-movement-oracle.json').write_text(json.dumps({'source':'supplied XEX, original $0B5A movement + $0A86 pose routines','runs':runs},separators=(',',':'))+'\n')
finally:m.close()
