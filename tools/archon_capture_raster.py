#!/usr/bin/env python3
"""Capture complete original arena VBI/raster loops, with real GTIA collisions."""
import base64,json
from archon_capture_mechanics import Original,FIELDS
from archon_extract_assets import ROOT,SHA256,relocated

def capture(tv="ntsc",stable=False):
 o=Original(tv);source=relocated(ROOT/'Archon.xex');cases=[]
 try:
  for number,pair in enumerate([(0,8),(2,15),(3,11),(6,14),(7,15),(5,13),(16,9),(17,11),(18,14),(19,10),(4,8),(1,13)]):
   b=o.prepare(37+number);b[0x6bcf:0x6bd2]=bytes.fromhex('4c 62 e4');b[0xb0]=0;b[0x604]=0
   ids=[36+pair[0]-16 if pair[0]>=16 else 4,27]
   for k,v in enumerate(b[0x10f8:0x1149]):
    if v in ids:b[0x10f8+k]=128
   for i,t in enumerate(pair):
    b[0x5698+ids[i]]=t;b[0x1179+ids[i]]=source[0x564c+t]
   b[0x10f8+4*9+2]=ids[0];b[0x10f8+4*9+4]=ids[1]
   b[0xd6]=ids[0];b[0x641]=ids[1];b[0xcf]=4;b[0xd1]=4;b[0xce]=4;b[0xd0]=2
   b[0x8f0:0x8f4]=bytes([15,15,1,1]);o.load(b);o.m.prompt('c 0b10 58 4c 30 51');o.m.prompt('c d40e c0');o.run(0x0b10,0x54c8)
   o.m.prompt('bpc 69fb');o.m.prompt('cont');ram=o.read(0,0x17ff)
   if stable:
    o.m.prompt('c d40e 00');o.m.prompt('c 6bcf 60 ea ea');o.m.prompt('c 0820 78 20 0f 6a 4c e0 08');o.m.prompt('c 0b00 4c 00 0b')
    o.m.prompt('c 0634 00')
   o.m.prompt('c 5d9c 4c 9c 5d') # Hold the main thread; the original VBI is unchanged.
   initial=[[ram[a+i] for _,a in FIELDS] for i in range(2)]
   record={'types':pair,'sourceIds':ids,'cells':list(ram[0xd00:0xdf0]),'initial':initial,
           'clock':0 if stable else ram[0x14]+ram[0x13]*256,'sourceColor':list(ram[0x2c0:0x2c9]),'inputs':[]}
   packed=bytearray()
   for step in range(320):
    approach=64 if pair[0] in (6,7) else 48
    if stable and step<approach:inputs=[(1,0,False),(-1,-1 if step<16 else 0,False)]
    elif stable and step<205:inputs=[(1,0,True),(-1,0,True)]
    elif step<68:inputs=[(1,0,False),(-1,-1,False)]
    elif step<145:inputs=[(1,1,True),(-1,-1,True)]
    elif step<205:inputs=[(0,-1,False),(0,1,False)]
    elif step<270:inputs=[(0,1,True),(0,-1,True)]
    else:inputs=[(-1,-1,False),(1,1,False)]
    sticks=[];triggers=[]
    for x,y,fire in inputs:
     stick=15
     if x>0:stick&=7
     if x<0:stick&=11
     if y<0:stick&=14
     if y>0:stick&=13
     sticks.append(stick);triggers.append(0 if fire else 1)
    o.load(bytes(sticks+triggers),0x8f0)
    if stable:
     o.load(bytes([(step+1)>>8,(step+1)&255]),0x13)
     o.run(0x820,0x6a24)
     colors=o.read(0x2c4,0x2c8);o.m.prompt('c d016 '+' '.join(f'{v:02x}' for v in colors));o.m.prompt('c d01e 00')
     o.m.prompt('setpc 0b00');o.m.prompt('bpc ffff');o.m.prompt('bline 0');o.m.prompt('cont');o.m.prompt('bline 247');o.m.prompt('cont');o.m.prompt('bline 999')
     o.run(0x6a24,0x8e0)
    else:o.m.prompt('cont')
    ram=o.read(0,0x8ff)
    packed.extend(ram[a+i] for i in range(2) for _,a in FIELDS)
    packed.extend([ram[0x633],ram[0x60c],ram[0x2c4]&15,ram[0x2c5]&15,ram[0x2c6]&15])
    record['inputs'].append(inputs)
    if ram[0x60c]&128:break
   record['expected']=base64.b64encode(packed).decode();cases.append(record)
   if stable:
    target=ROOT/'tools/fixtures/archon-collisions.json';temporary=target.with_suffix('.tmp')
    temporary.write_text(json.dumps({'sourceSha256':SHA256,'tv':tv,'contract':'complete isolated VBI with full stable GTIA scanout','fields':[f for f,_ in FIELDS],'cases':cases},separators=(',',':'))+'\n');temporary.replace(target)
   print('Captured original raster duel',pair,'frames',len(record['inputs']),flush=True)
 finally:o.close()
 (ROOT/('tools/fixtures/archon-collisions.json' if stable else 'tools/fixtures/archon-raster'+('-pal' if tv=='pal' else '')+'.json')).write_text(json.dumps({'sourceSha256':SHA256,'tv':tv,'contract':'complete isolated VBI with full stable GTIA scanout' if stable else 'continuous original raster','fields':[f for f,_ in FIELDS],'cases':cases},separators=(',',':'))+'\n')
if __name__=='__main__':
 import sys
 capture('pal' if '--pal' in sys.argv else 'ntsc','--stable' in sys.argv)
