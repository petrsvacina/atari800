#!/usr/bin/env python3
"""Capture original board decisions for reproducible native AI comparisons."""
import json,random
from archon_capture_mechanics import Original, FIELDS, stream
from archon_extract_assets import ROOT,SHA256,relocated

def capture():
 o=Original();source=relocated(ROOT/'Archon.xex');cases=[]
 try:
  for number in range(768):
   seed=number*31+37;r=random.Random(seed);b=o.prepare(seed);dark=bool(number&1) if number<8 else bool(r.getrandbits(1));side='dark' if dark else 'light';flag=255 if dark else 85
   b[0xb0]=flag;b[0x604]=flag;b[0x601]=flag if number%3 else flag^255
   luma=[0,2,6,8,12,14][number%6 if number<8 else r.randrange(6)];direction=1 if r.getrandbits(1) else -1
   b[0x608]=0 if direction>0 else 255;b[0x2c7]=0xb0+luma
   b[0x6a9]=r.randrange(4);b[0x6aa]=10;b[0x10f8:0x1149]=bytes([128]*81);b[0x1179:0x119d]=bytes(36)
   count=36 if number<8 else r.randrange(8,34)
   ids=list(range(36)) if number<8 else [8,27]+r.sample([i for i in range(36) if i not in (8,27)],count-2)
   spaces=list(range(81));r.shuffle(spaces);units=[]
   for index,identifier in enumerate(ids):
    if number<8:row=identifier//2 if identifier<18 else (identifier-18)//2;col=identifier%2 if identifier<18 else 7+(identifier-18)%2
    else:row,col=divmod(spaces[index],9)
    hp=source[0x564c+source[0x5698+identifier]]
    health=hp if number<8 else r.randint(1,hp)
    b[0x10f8+row*9+col]=identifier;b[0x1179+identifier]=health
    units.append({'originalIndex':identifier,'type':source[0x5698+identifier],'x':col,'y':row,'health':health,'side':'light' if identifier<18 else 'dark'})
   prisoners=[]
   for i in range(2):
    choices=[u for u in units if (u['originalIndex']>=18)==bool(i)]
    prisoner=r.choice(choices)['originalIndex'] if choices and number%5==i else 255
    b[0x665+i]=prisoner
    if prisoner!=255:prisoners.append(prisoner)
   used=[[],[]]
   for i in range(2):
    for key in range(7):
     spent=number<8 or number%3==0 or r.random()<.65
     b[0x1260+i*7+key]=254 if spent else 253
     if spent:used[i].append(key)
   initialState={'injury':b[0x6a9],'maximumHP':b[0x6aa]};o.load(b)
   # Dedicated wrapper calls the complete original board chooser.
   o.load(bytes.fromhex('78 20 6b 3f 4c e0 08'),0x840);o.run(0x840)
   after=o.read(0,0x12ff);newUsed=[i for i in range(7) if after[0x1260+7*dark+i]!=b[0x1260+7*dark+i]]
   if newUsed:
    key=newUsed[0];action={'spell':key,'x':after[0x689],'y':after[0x68a]}
    if key==0:action.update(destinationX=after[0x11d8],destinationY=after[0x11ea])
    if key==5:action['revive']=after[0x68b]
   else:
    index=after[0xcb];action={'unit':after[0x11a1+index],'x':after[0x11d7+index],'y':after[0x11e9+index]}
   cases.append({'seed':seed,'side':side,'firstSide':side if b[0x601]==flag else ('light' if dark else 'dark'),
                 'luma':luma,'direction':direction,'units':units,'prisoners':prisoners,'usedSpells':used,
                 'state':initialState,'action':action,'randomReads':after[0x8f5],
                 'afterState':{'injury':after[0x6a9],'maximumHP':after[0x6aa]}})
   if number%128==127:print('Captured',number+1,'original board decisions',flush=True)
 finally:o.close()
 (ROOT/'tools/fixtures/archon-board.json').write_text(json.dumps({'sourceSha256':SHA256,'cases':cases},separators=(',',':'))+'\n')
if __name__=='__main__':capture()
