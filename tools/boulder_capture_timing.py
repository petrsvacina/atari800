#!/usr/bin/env python3
"""Profile original handler path timings offline, exporting numbers only."""
import base64,json
from boulder_capture_cases import Ram,MPU
from boulder_original import ROOT,FIELDS,ARRAYS,SHA,Original,save_fixture,load_fixture
PLOTS={0:0,1:1,2:2,40:3,39:4,41:5,42:6,43:7,80:8,81:9,82:10,120:11,121:12,122:13}

def profile(b,seed=37):
 m=Ram(b,seed);m[0x5d0:0x5d7]=bytes.fromhex('78208f1d4ce005');c=MPU(memory=m,pc=0x5d0);c.sp=255
 result=[];active=None
 while c.pc!=0x5e0:
  if c.processorCycles>2000000:raise RuntimeError(hex(c.pc))
  if c.pc==0x1bd1:
   ptr=m[0x80]|m[0x81]<<8;index=ptr+41-0x4c50;code=m[ptr+41]
   if m[0x3c81+code*2]:active={'index':index,'code':code,'start':c.processorCycles,'subtract':0,'reads':[]}
  if active:
   if c.pc in (0xbdc,0x140d):active['subtract']+=149+13*(PLOTS[41 if c.pc==0x140d else c.y]+1)+(1 if m[0x791]*2+0xeb>255 else 0)+(1 if m[0x791]*2+0xec>255 else 0)
   if m[c.pc]==0xb1 and m[c.pc+1]==0x80:
    active['reads'].append(c.y);active['subtract']+=1 if (m[0x80]+c.y)>255 else 0
   if c.pc==0x1da2:
    result.append([active['index'],active['code'],c.processorCycles-active['start']-active['subtract'],active['reads']]);active=None
  c.step()
 return result

def capture():
 ref=load_fixture('boulder-cases');o=Original()
 try:base=bytearray(o.cave(1,0))
 finally:o.close()
 base.extend(bytes(65536-len(base)));results=[]
 for i,test in enumerate(ref['cases']):
  b=bytearray(base);b[0x4c50:0x4fc0]=base64.b64decode(test['cells']);b[0x278]=test['input']['stick'];b[0x284]=int(not test['input']['fire']);b[0xd01f]=7
  for key,address in FIELDS.items():b[address]=test['initial'][key]
  for key,(address,n) in ARRAYS.items():b[address:address+n]=bytes(test['initial'][key])
  results.append(profile(b))
  if i%500==0:print('Timing paths',i,flush=True)
 save_fixture('boulder-timing',{'sourceSha256':SHA,'cases':results})
 print('Profiled',len(results),'original scans',flush=True)
if __name__=='__main__':capture()
