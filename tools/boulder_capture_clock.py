import sys,re,json
sys.path.insert(0,str(__import__('pathlib').Path(__file__).resolve().parent))
from boulder_original import Original,ROOT,save_fixture,load_fixture
from boulder_capture_cases import execute
m=Original();results=[]
def tick():
 b=m.read(0x12,0x14);s=m.m.prompt('show');g=re.search(r'\n\s*(\d+)\s+(\d+) A=',s);return int.from_bytes(b,'big')*29868+int(g[1])*114+int(g[2])
try:
 for level in range(5):
  b=bytearray(m.cave(1,level));b[0x876]=0;b[0x859]=0;b[0x799]=64;b[0x5d0:0x5d7]=bytes.fromhex('58208f1d4ce005');m.load(b);m.m.prompt('c d40e c0');t=tick();m.run(0x5d0,0x5e0);end=tick();m.m.prompt('c d40e 00')
  b.extend(bytes(65536-len(b)));b[0xd01f]=7;b[0x278]=15;b[0x284]=1;out,_,cycles=execute(b)
  row={'level':level,'physicalCycles':end-t,'frames':(end-t)/29868,'cpuCycles':cycles,'availableCpuPerFrame':cycles/((end-t)/29868)};results.append(row);print(row,flush=True)
finally:m.close()
save_fixture('boulder-clock',{'ntscClock':1789790,'scanlines':262,'cyclesPerLine':114,'cases':results})
