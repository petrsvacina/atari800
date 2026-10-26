#!/usr/bin/env python3
"""Export River Raid numeric course and bitmaps; original CPU never enters runtime."""
import base64,json,hashlib,struct,sys,argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ROM_SHA='dc55bef6fa336003772643e68b9bfade7155ff4dde1aad814e1cf56ad818805f'
def export(records,memory):
 b=memory;assert hashlib.sha256((ROOT/'River Raid.rom').read_bytes()).hexdigest()==ROM_SHA
 unique=[];ids={};track=[];objects=[];stages=[{'bridge':1,'row':0}];rowFlags=[];lastBridge=1
 for row in range(len(records)//192):
  r=records[row*192:(row+1)*192];packed=r[4:44] # crop wide playfield to the visible 160 color pixels
  if packed not in ids:ids[packed]=len(unique);unique.append(packed)
  track.append(ids[packed]);rowFlags.append(r[156])
  if r[96]!=lastBridge and r[96]>lastBridge:stages.append({'bridge':r[96],'row':row});lastBridge=r[96]
  slot=r[78]
  if slot<11:
   y,t,x,size=r[112+slot*4:116+slot*4]
   if 7<=t<=15 and y==((97-(b[0xbb60+t]+4))&255):
    objects.append({'row':row,'worldY':row+97-y,'type':t,'rawX':x,'flags':r[48+0x42-0x30+slot],'size':size,'stage':r[96]})
 # Only keep full sections. Later source difficulty is clamped at internal 79;
 # the deterministic seed and course continue to change beyond that point.
 sprites=[]
 for t in range(16):
  variants=[];height=b[0xbb60+t]+1
  for variant in range(2):
   pointer=0xb900+b[0xbb40+t+variant*16];color=0xb700+b[0xbb30+t]
   variants.append({'bits':list(reversed(b[pointer:pointer+height])),'colors':list(reversed(b[color:color+height]))})
  sprites.append({'height':height,'width':8*(2 if b[0xbba2+t]==1 else 4 if b[0xbba2+t]==3 else 1),'variants':variants})
 planes=[]
 for index in range(10):
  ptr=int.from_bytes(b[0xbacd+index*2:0xbacf+index*2],'little');planes.append(list(b[ptr:ptr+14]))
 scores={str(i):((b[0xbb0b+i]>>4)*10+(b[0xbb0b+i]&15))*10 for i in range(7,16)}
 data={'sourceSha256':ROM_SHA,'width':320,'height':160,'rows':len(track),'dictionary':base64.b64encode(b''.join(unique)).decode(),'indices':base64.b64encode(struct.pack('<'+'I'*len(track),*track)).decode(),'flags':base64.b64encode(bytes(rowFlags)).decode(),'objects':objects,'stages':stages,'sprites':sprites,'planes':planes,'glyphs':[list(b[0x800+i*8:0x808+i*8]) for i in range(64)],'scores':scores}
 (ROOT/'research/river-raid/course.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
 write(data)
 # Independent numeric reference slices, captured before any browser rendering.
 samples=[{'row':i,'packed':base64.b64encode(records[i*192+4:i*192+44]).decode()} for i in range(0,len(track),max(1,len(track)//80))]
 (ROOT/'tools/fixtures/river-course-oracle.json').write_text(json.dumps({'sourceSha256':ROM_SHA,'samples':samples},separators=(',',':'))+'\n')
 print('Exported',len(track),'rows,',len(unique),'unique rows,',len(objects),'original encounters.',flush=True)
def write(data):
 (ROOT/'river-raid/assets/course.js').write_text('// Original course pixels, encounters and bitmaps; no executable Atari code.\nglobalThis.RIVER_ASSETS = '+json.dumps(data,separators=(',',':'))+';\n')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--capture',action='store_true');a=p.parse_args()
 if a.capture:export(Path('/private/tmp/river-records.bin').read_bytes(),Path('/private/tmp/river-menu.bin').read_bytes())
 else:write(json.loads((ROOT/'research/river-raid/course.json').read_text()))
