#!/usr/bin/env python3
"""Original flight interrupt oracle, with separately verified PMG/HUD writers isolated."""
import argparse,base64,gzip,hashlib,json,random
from pathlib import Path
from fractalus_original import ROOT,SHA256,MAIN_SHA256,processor,call
from fractalus_extract_bootstrap import fields,read_state

base=Path('/private/tmp/fractalus-disk-research/flight-after40.bin').read_bytes()
assert hashlib.sha256(base[0x3cde:0x3cde+31500]).hexdigest()==MAIN_SHA256
metadata=fields();rng=random.Random(0x564249)
p=argparse.ArgumentParser();p.add_argument('--full-pmg',action='store_true');args=p.parse_args()
class Memory(list):
    def __init__(self,m):super().__init__(m);self.random=[];self.writes=[]
    def __getitem__(self,a):
        if a==0xd20a:v=rng.randrange(256);self.random.append(v);return v
        return super().__getitem__(a)
    def __setitem__(self,a,v):
        if isinstance(a,int) and 0xd200<=a<=0xd208:self.writes.append([a-0xd200,v])
        super().__setitem__(a,v)
def snapshot(m):
    s=read_state(m,metadata)
    return {'state':s,'pmg':base64.b64encode(bytes(m[0xb00:0x1100])).decode(),'p3Size':m[0xd00b],'sound':{'parameters':list(m[0x65d:0x714]),'registers':list(m[0xd200:0xd209]),**{k:m[a] for k,a in [('head',0x73),('tail',0x74),('topPriority',0x714),('topIndex',0x715),('scanPriority',0x716),('nextIndex',0x717),('expired',0x718)]}}}
utilities=[]
for routine,count in [(0x4131,256),(0xb70c,256),(0x3ffa,128)]:
 for i in range(count):
    m=Memory(base);cpu=processor(m);cpu.p=0x20
    changes={'energy':rng.choice([0,1,2,14,100,220]),'energyEmpty':rng.randrange(17),'systemsOff':rng.randrange(2),'objectSlot':rng.choice([0,64,120,255]),'thrustNotch':rng.randrange(9),'fuelFraction':rng.randrange(256),'surfaceFraction':rng.choice([0,0,1,200]),'objectPath':rng.choice([0,0,1,5]),'mode':rng.choice([0,2,255]),'dial':rng.choice([0,30,69]),'clock':rng.randrange(256),'indicatorPos':rng.randrange(30),'objectXMid':rng.randrange(256),'objectXHigh':rng.choice([0,1,255]),'objectYMid':rng.randrange(256),'objectYHigh':rng.choice([0,1,255]),'rescueStatus':rng.randrange(10),'collisionClock':rng.randrange(256),'overQuota':rng.randrange(2),'remainingBcd':rng.choice([0,1,4,16,32])}
    for k,v in changes.items():a,w=metadata[k];m[a:a+w]=list(v.to_bytes(w,'little'))
    before=read_state(m,metadata);call(cpu,routine);utilities.append({'routine':routine,'before':before,'after':read_state(m,metadata)})
cases=[]
for i in range(96):
    m=Memory(base);cpu=processor(m);cpu.p=0x20
    # Graphics are tested independently; no gameplay, sound or scoring callee is replaced.
    isolated=[0x3fde,0x43c7,0x4f9f] if args.full_pmg else [0x8c58,0x42a7,0x4467,0x40b0,0x40e5,0x3fde,0x43c7,0x44d6,0x4f9f]
    for address in isolated:m[address]=0x60
    for k,v in {'parity':i%2+1,'clock':rng.choice([0,15,34,254,255]),'energy':rng.choice([1,14,100,220]),'systemsOff':i%7==0,'objectPath':rng.choice([0,0,3]),'energyEmpty':rng.choice([0,1,5,12]),'scoreClock':rng.choice([1,2,30]),'missionTimer':0,'messageFlash':rng.choice([0,1,90,255]),'messageTimer':rng.choice([0,14,84]),'nightPhase':0,'eventOwner':0,'scoreDeltaLow':0,'scoreDeltaHigh':rng.choice([0,0,1,2])}.items():
        a,w=metadata[k];m[a:a+w]=list(int(v).to_bytes(w,'little'))
    port=255&~rng.choice([0,1,2,4,8,5,10]);fire=i%4==0;m[0xd300]=port;m[0xd010]=0 if fire else 1
    if args.full_pmg:
      m[0x36]=rng.choice([0,1,4,7,10,20,25]);m[0x6a]=rng.choice([255,254,4,12,20]);m[0x2822]=4
    before=snapshot(m);m.random.clear();m.writes.clear();cpu.sp=0xfd;cpu.pc=0x4ff5
    for _ in range(500000):
        if cpu.pc==0x52b4:break
        cpu.step()
    else:raise RuntimeError(f'VBI hung {cpu.pc:04x}')
    cases.append({'before':before,'after':snapshot(m),'input':{'port':port,'fire':fire},'random':m.random,'writes':m.writes})
path=ROOT/('tools/fixtures/fractalus-vbi-pmg.json.gz' if args.full_pmg else 'tools/fixtures/fractalus-vbi.json.gz');path.write_bytes(gzip.compress(json.dumps({'sourceSha256':SHA256,'fullPmg':args.full_pmg,'utilities':utilities,'cases':cases},separators=(',',':')).encode(),mtime=0))
print(f'Captured {len(utilities)} blink/fuel/indicator/scanner routines and {len(cases)} VBI orchestration cases')
