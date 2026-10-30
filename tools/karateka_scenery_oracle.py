#!/usr/bin/env python3
"""Compare fresh native scenery with complete original background repaint.

These cases cover camera coordinates, not normal campaign handovers or the
original incremental repair of its alternating framebuffers.
"""
import argparse,gzip,hashlib,json,random
from pathlib import Path
from karateka_extract import ROOT,load
from py65.devices.mpu6502 import MPU

def call(m,address):
 cpu=MPU(memory=m);cpu.pc=address;cpu.sp=0xfd;m[0x1fe]=0xfe;m[0x1ff]=0xff
 for _ in range(1000000):
  if cpu.pc==0xffff:return
  cpu.step()
 raise RuntimeError(f'Scenery did not return: {cpu.pc:04x}')

def export(memory,destination):
 rng=random.Random(0xad00);cases=[]
 for i in range(240):
  s={'shift':i%8,'offset':rng.choice(list(range(61))+list(range(240,256))),'cloud':rng.randrange(256),'room':rng.randrange(2),'side':rng.randrange(2)}
  m=list(memory);m[0x3010:0x47f8]=[0]*6120
  for a,v in {7:0x20,0x50:s['shift'],0x51:s['cloud'],0x52:s['offset'],0x44:s['room'],0x4c:s['side'],0x54:255,0x62:16,0x72:28}.items():m[a]=v
  for address in [0xb00e,0xad03,0xad06,0xb090,0xbc00]:call(m,address)
  background=hashlib.sha256(bytes(m[0x3010:0x47f8])).hexdigest()
  for address in [0xad09,0xbc03]:call(m,address)
  cases.append({'state':s,'background':background,'foreground':hashlib.sha256(bytes(m[0x3010:0x47f8])).hexdigest()})
 destination.mkdir(parents=True,exist_ok=True);(destination/'scenery1-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original scene-1 repaints')
def export2(memory,destination):
 rng=random.Random(0xb100);cases=[]
 for i in range(240):
  s={'shift':i%8,'offset':rng.choice(list(range(41))+list(range(224,256))),'cloud':rng.randrange(256),'gateY':rng.randrange(116,161)}
  m=list(memory);m[0x3010:0x47f8]=[0]*6120
  for a,v in {7:0x20,0x50:s['shift'],0x51:s['cloud'],0x52:s['offset'],0xa7:s['gateY'],0x54:255}.items():m[a]=v
  for address in [0xb283,0xb280,0xb000,0xb100]:call(m,address)
  background=hashlib.sha256(bytes(m[0x3010:0x47f8])).hexdigest();call(m,0xb103)
  cases.append({'state':s,'background':background,'foreground':hashlib.sha256(bytes(m[0x3010:0x47f8])).hexdigest()})
 destination.mkdir(parents=True,exist_ok=True);(destination/'scenery2-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original palace repaints')
def export3(memory,destination):
 rng=random.Random(0x7800);cases=[]
 for i in range(240):
  s={'shift':i%8,'offset':rng.choice([0]+list(range(224,256))),'room':i%7,'door':rng.choice((0,5)),'extraDoor':rng.choice((0,5)),'scene':3}
  m=list(memory);m[0x3010:0x47f8]=[0]*6120
  for a,v in {7:0x20,0x50:s['shift'],0x52:s['offset'],0x44:s['room'],0x84:s['door'],0xed:s['extraDoor'],0xd0:3,0x83:255,0x54:255}.items():m[a]=v
  routines=[0xb109,0xb000,0xb100] if not s['room'] else [0x7806] if s['room']==6 else [0x7800]
  for address in routines:call(m,address)
  background=hashlib.sha256(bytes(m[0x3010:0x47f8])).hexdigest();call(m,0xb106 if not s['room'] else 0x7809 if s['room']==6 else 0x7803)
  cases.append({'state':s,'background':background,'foreground':hashlib.sha256(bytes(m[0x3010:0x47f8])).hexdigest()})
 destination.mkdir(parents=True,exist_ok=True);(destination/'rooms-oracle.json.gz').write_bytes(gzip.compress((json.dumps(cases,separators=(',',':'))+'\n').encode(),mtime=0));print('Exported',len(cases),'original room and corridor repaints')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',type=Path,required=True);p.add_argument('--scene',type=int,default=1,choices=[1,2,3]);p.add_argument('--output',type=Path,default=ROOT/'research/karateka');a=p.parse_args();({1:export,2:export2,3:export3}[a.scene])(load(a.memory),a.output)
