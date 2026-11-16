#!/usr/bin/env python3
"""Original level parameters, decimal scoring, and bounded rescue-prefix oracle."""
import gzip,json
from fractalus_original import ROOT,SHA256,image,processor,call
base=image();fields={'quota':0x62a,'remainingBcd':0x628,'rescueThreshold':0x61f,'respawnCounter':0x620,'gunDensity':0x623,'fireDelayMask':0x624,'lockonReload':0x618,'alienBase':0x61a,'alienThreshold':0x61b,'alienDelay':0x61c,'thrustOffset':0x625,'nightFlag':0x617,'nightPhase':0x8a2}
levels=[]
for level in range(256):
 memory=bytearray(base);cpu=processor(memory);cpu.p=0x20;memory[0x6d]=level;oldPhase=memory[0x8a2];call(cpu,0x75f5)
 expected={k:memory[p] for k,p in fields.items()};expected['saucerTimers']=list(memory[0x621:0x623])
 levels.append({'level':level,'nightPhase':oldPhase,'expected':expected})
def bcd(n,size):return bytes(int(f'{n:0{size*2}d}'[i:i+2],16) for i in range(0,size*2,2))
def number(data):return int(''.join(f'{v:02x}' for v in data))
scores=[]
for score in [0,1,9,99,999,9999,99999,999999,9999999,99999999,20485]:
 for delta in [0,1,30,100,200,250,500,1000,2000,9999]:
  memory=bytearray(base);cpu=processor(memory);cpu.p=0x20
  memory[0x600:0x604]=bcd(score,4);memory[0x45:0x47]=bcd(delta,2)[::-1];memory[0x32c5:0x32cb]=bytes([65,66,67,68,69,70]);call(cpu,0x497d)
  scores.append({'score':score,'delta':delta,'expected':{'score':number(memory[0x600:0x604]),'scoreCells':list(memory[0x32c5:0x32cb]),'pendingScore':number(memory[0x45:0x47][::-1])}})
rescues=[]
for remaining in range(100):
 for over in [0,1]:
  for ace in [False,True]:
   memory=bytearray(base);cpu=processor(memory);cpu.p=0x20
   memory[0x628]=bcd(remaining,1)[0];memory[0x62b]=over;memory[0x629]=0;memory[0x61f]=3;memory[0xdb]=0x68 if ace else 0x0c
   cpu.pc=0x7af4
   for _ in range(5000):
    if cpu.pc==0x7b36:break
    cpu.step()
   else:raise RuntimeError(f'Rescue prefix did not reach boundary {cpu.pc:04x}')
   rescues.append({'remainingBcd':bcd(remaining,1)[0],'overQuota':over,'ace':ace,'expected':{'remainingBcd':memory[0x628],'overQuota':memory[0x62b],'rescued':memory[0x629],'pendingScore':number(memory[0x45:0x47][::-1])}})
data={'sourceSha256':SHA256,'levels':levels,'scores':scores,'rescues':rescues,'rescueBoundary':'$7B36 before HUD/wait; rescue count starts 0, below replenishment threshold'}
(ROOT/'tools/fixtures/fractalus-mission.json.gz').write_bytes(gzip.compress(json.dumps(data,separators=(',',':')).encode(),mtime=0))
print('Captured',len(levels),'original level setups,',len(scores),'decimal score additions,',len(rescues),'rescue-prefix cases.')
