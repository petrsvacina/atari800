#!/usr/bin/env python3
"""Capture real POKEY registers/counters from the original River Raid routine."""
import gzip,hashlib,json,re,tempfile
from pathlib import Path
from goonies_extract_physics import XexMonitor
ROOT=Path(__file__).resolve().parents[1]
def capture():
 m=XexMonitor(ROOT/'River Raid.xex');cases=[]
 with tempfile.TemporaryDirectory(prefix='river-sound-',dir='/private/tmp') as tmp:
  tmp=Path(tmp);dump=tmp/'counters.bin'
  try:
   m.prompt('bpc a19e');m.prompt('cont');m.prompt('c d40e 00');m.prompt('c b3db 60');m.prompt('c 0600 20 a5 b2 4c 00 07');m.prompt('bpc 0700')
   scenarios=[('life-under-shots',{0x7e:64},85,[0,4,10,20,40,63,65]),('impact',{0x7a:1,0x7b:31},40,[]),('fuel',{0x7a:2,0x7b:35},44,[]),('enemy',{0x7c:23},28,[]),('bridge-tank',{0x7c:55},60,[]),('gunner-over-enemy',{0x7c:23,0x7f:9},28,[])]
   for name,initial,count,shots in scenarios:
    m.prompt('f 0000 00ff 00');m.prompt('c d20f 03');m.prompt('c d208 00');m.prompt('c 0059 80');m.prompt('c 0019 0f');m.prompt('c 005b ff');m.prompt('c 052c 00')
    for address,value in initial.items():m.prompt(f'c {address:04x} {value:02x}')
    steps=[]
    for frame in range(count):
     if frame in shots:m.prompt('c 007d 0f')
     m.prompt('setpc 0600');m.prompt('cont');text=m.prompt('pokey');freq=[int(v,16) for v in re.findall(r'AUDF[1-4]=\s*([0-9A-F]{2})',text)];control=[int(v,16) for v in re.findall(r'AUDC[1-4]=\s*([0-9A-F]{2})',text)];assert len(freq)==len(control)==4,text
     m.prompt(f'write 007a 007f {dump}');steps.append({'registers':[v for pair in zip(freq,control) for v in pair],'counters':list(dump.read_bytes())})
    cases.append({'name':name,'initial':{str(a):v for a,v in initial.items()},'shots':shots,'steps':steps})
  finally:m.close()
 result={'sourceSha256':hashlib.sha256((ROOT/'River Raid.rom').read_bytes()).hexdigest(),'routine':'B2A5-B3D8','cases':cases}
 (ROOT/'tools/fixtures/river-sound-oracle.json.gz').write_bytes(gzip.compress(json.dumps(result,separators=(',',':')).encode(),mtime=0));print('Captured',sum(len(c['steps']) for c in cases),'original sound updates',flush=True)
if __name__=='__main__':capture()
