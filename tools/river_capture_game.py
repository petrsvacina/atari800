#!/usr/bin/env python3
"""Full original foreground/raster integration oracle, development only.

Player impacts are cleared in the marked collision-free movement scenarios;
NPC/bank and tank/bank collision feedback still comes from real Atari raster.
"""
import argparse,base64,hashlib,json,zlib
from pathlib import Path
from goonies_extract_physics import XexMonitor
ROOT=Path(__file__).resolve().parents[1]
FIELDS={'clock':0x32,'flip':0x33,'target':0x34,'velocity':0x35,'decorSide':0x36,'decorSeed':0x37,'first':0x4d,'nearest':0x4e,'blackRows':0x4f,'gunnerSlot':0x51,'center':0x52,'water':0x53,'inset':0x54,'hold':0x5a,'sections':0x5d,'nextWidth':0x5f,'stage':0x60,'flags':0x23,'segmentRow':0x2f,'layout':0x2d}
def snapshot(b):
 pointer=0x3f03;address=0;rows=[]
 while len(rows)<160:
  op=b[pointer];pointer+=1
  if op&64:address=int.from_bytes(b[pointer:pointer+2],'little');pointer+=2
  rows.append(b[address:address+48]);address+=48
 def bcd(n):return (n>>4)*10+(n&15)
 return {'tick':b[0x18],'plane':{k:b[p] for k,p in {'rawX':0x57,'fraction':0x58,'accel':0x2b,'speed':0x59,'controls':0x19,'pose':0x5e}.items()},'fuel':b[0x5b]*256+b[0x5c],'life':b[0x76],'score':(bcd(b[0x63])*10000+bcd(b[0x64])*100+bcd(b[0x65]))*10,'bridge':bcd(b[0x61])*100+bcd(b[0x62]),'playerIndex':b[0x77],'reserve':b[0x6a],'fields':{k:b[p] for k,p in FIELDS.items()},'seed':list(b[0xaa:0xad]),'checkpoint':list(b[0x66:0x6a]),'previousCheckpoint':list(b[0xad:0xb1]),'tank':{k:b[p] for k,p in {'frame':0x38,'rawX':0x39,'rawY':0x3a,'picture':0x3b,'shotX':0x3c,'fraction':0x3d,'dx':0x3e,'fractionDX':0x3f,'shotY':0x40,'follow':0x41,'phase':0x50}.items()},'gunner':{'rawX':b[0xc1],'rawY':b[0xc2],'dx':b[0xc0]},'actors':[{k:b[p+i] for k,p in {'rawY':0x0c,'frame':0x500,'type':0x50b,'rawX':0x516,'flags':0x42,'size':0x521}.items()} for i in range(11)],'terrainSha256':hashlib.sha256(b''.join(rows)).hexdigest()}
def capture():
 parser=argparse.ArgumentParser();parser.add_argument('--case',type=int);args=parser.parse_args()
 source=ROOT/'River Raid.xex';sha=hashlib.sha256(source.read_bytes()).hexdigest();assert sha=='a6c3a5f0f8a70632a8402bf54025bba18ec517e12107873c814c8328712a7c3b';cases=[]
 configs=[{'bridge':1,'variation':0,'count':1600},{'bridge':5,'variation':2,'count':512},{'bridge':20,'variation':4,'count':512},{'bridge':50,'variation':6,'count':512},{'bridge':1,'variation':0,'count':720,'naturalCollisions':True,'fire':True},{'bridge':20,'variation':4,'count':720,'naturalCollisions':True,'fire':True},{'bridge':1,'variation':1,'count':720,'naturalCollisions':True,'fire':True},{'bridge':1,'variation':0,'count':300,'injections':{40:'bank'}},{'bridge':1,'variation':0,'count':1250,'injections':{1000:'bank'}},{'bridge':1,'variation':0,'count':1150,'injections':{900:'bridge',901:'bank'}}]
 target=ROOT/'tools/fixtures/river-game-oracle.json'
 if args.case is not None:cases=json.loads(zlib.decompress(base64.b64decode(json.loads(target.read_text())['cases'])))
 for case_index,config in enumerate(configs):
  if args.case is not None and case_index!=args.case:continue
  bridge,variation,count=config['bridge'],config['variation'],config['count']
  m=XexMonitor(source)
  try:
   m.prompt('bpc a19e');m.prompt('cont');m.prompt(f'c 09 {variation:02x}');m.prompt('sety 00');m.prompt('setpc a680');m.prompt('cont')
   for _ in range(150):
    m.prompt('cont');m.prompt('write 0000 bfff /private/tmp/river-game-oracle.bin');b=Path('/private/tmp/river-game-oracle.bin').read_bytes()
    if b[0x76]==47:break
   else:raise ValueError('Ready screen not reached')
   initial=snapshot(b);m.prompt('c 76 00');m.prompt('c 59 40');m.prompt('c a205 a9 40 ea');fire=config.get('fire',False);m.prompt(f'c a32d a9 {0 if fire else 1:02x} ea');m.prompt(f'c a59f a9 {0 if fire else 1:02x} ea');frames=[]
   for tick in range(count):
    controls=15 if tick<640 or config.get('naturalCollisions') or config.get('injections') else [15,11,15,7][(tick//48)%4]
    m.prompt(f'c a31a a9 {controls|controls<<4:02x} ea')
    if not config.get('naturalCollisions'):m.prompt('f 001a 001f ff');m.prompt('c 21 ff')
    injection=config.get('injections',{}).get(tick);slot=None
    if injection=='bank':m.prompt('c 1b 00')
    if injection=='bridge':
     slot=next(i for i in range(11) if b[0x500+i]==14);m.prompt(f'c 1c {slot:02x}')
    m.prompt('cont');m.prompt('write 0000 bfff /private/tmp/river-game-oracle.bin');b=Path('/private/tmp/river-game-oracle.bin').read_bytes();frames.append({'controls':controls,'fire':fire,'injection':injection,'slot':slot,'state':snapshot(b)})
    if tick%256==0:print('Full source game',bridge,tick,flush=True)
   case={'bridge':bridge,'mode':'two' if variation&1 else 'solo','randomByte':64,'collisionFreePlayer':not config.get('naturalCollisions'),'initial':initial,'frames':frames}
   if args.case is None:cases.append(case)
   else:cases[case_index]=case
  finally:m.close()
 target.write_text(json.dumps({'sourceSha256':sha,'encoding':'zlib+base64 JSON','cases':base64.b64encode(zlib.compress(json.dumps(cases,separators=(',',':')).encode(),9)).decode()},separators=(',',':'))+'\n')
 print('Captured',sum(len(c['frames']) for c in cases),'full original game frames.',flush=True)
if __name__=='__main__':capture()
