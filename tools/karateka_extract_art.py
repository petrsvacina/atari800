"""Export observed original bitmap sources and named character geometry offline."""
import argparse,hashlib,json,time
from karateka_extract import ROOT,load,SOURCE_SHA256
from pathlib import Path
from py65.devices.mpu6502 import MPU
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--memory',type=Path,required=True);parser.add_argument('--output',type=Path,default=ROOT/'karateka/assets');args=parser.parse_args()
m=load(args.memory);art={};t=time.monotonic()
for style in range(8):
 for lower in range(42):
  for upper in range(38):
   mem=list(m)
   for a,v in {7:0x20,0x20:lower,0x21:upper,0x22:16,0x2c:1 if style==0 else 255,0x50:0,0x36:0 if style==0 else 1,0x3e:max(0,style-1),0x4d:0,0x44:0,0xf:0}.items():mem[a]=v
   c=MPU(memory=mem);c.pc=0x6815;c.sp=0xfd;mem[0x1fe]=0xfe;mem[0x1ff]=0xff
   for _ in range(100000):
    if c.pc==0xffff:break
    if c.pc in (0x2803,0x2806,0x2809,0x280c):
     p=mem[3]+256*mem[4];h,w=mem[p:p+2]
     if h and w and h<=153 and w<=40:
      item={'width':w*4,'height':h,'data':list(mem[p+2:p+2+w*h])}
      if str(p) in art and art[str(p)]!=item:raise ValueError(f'Mutable bitmap {p:04x}')
      art[str(p)]=item
    c.step()
   else:raise ValueError(hex(c.pc))
 print('style',style,'art',len(art),round(time.monotonic()-t,1),flush=True)
tables={'legLow':(0x6000,42),'legHigh':(0x602a,42),'legX':(0x6054,42),'legY':(0x607e,42),'legMaskLow':(0x60a8,42),'legMaskHigh':(0x60d2,42),'legMaskX':(0x60fc,42),'legMaskY':(0x6126,42),'bodyX':(0x6150,42),'bodyPhase':(0x617a,42),'headForm':(0x61a4,38),'heroHeadHigh':(0x61ca,3),'heroHeadLow':(0x61cd,3),'headMaskHigh':(0x61d6,3),'headMaskLow':(0x61d9,3),'headX':(0x61da,38),'headY':(0x6200,38),'armLow':(0x6226,38),'armHigh':(0x624c,38),'armX':(0x6272,38),'armY':(0x6298,38),'mirroredLeg':(0x62be,42)}
# Lower-body masks are called by the game's outer draw pass.
for i in range(42):
 p=m[0x60a8+i]+256*m[0x60d2+i]
 if p>=256:
  h,w=m[p:p+2]
  if h and w and h<=153 and w<=40:art[str(p)]={'width':w*4,'height':h,'data':list(m[p+2:p+2+w*h])}
for p in (0x0b12,0x0b1c):
 h,w=m[p:p+2];art[str(p)]={'width':w*4,'height':h,'data':list(m[p+2:p+2+w*h])}
out={'art':art,'tables':{k:list(m[a:a+n]) for k,(a,n) in tables.items()},'heads':[]}
for hi,lo in [(0x61d0,0x61d3),(0x62e8,0x62eb),(0x62ee,0x62f1),(0x62f4,0x62f7),(0x62fa,0x62fd),(0x6af3,0x6af6),(0x6af9,0x6afc)]:out['heads'].append([m[lo+i]+256*m[hi+i] for i in range(3)])
args.output.mkdir(parents=True,exist_ok=True)
target=args.output/'art.js';target.write_text('// Original bitmap art and geometry only; no original program.\nglobalThis.KARATEKA_ART='+json.dumps(out,separators=(',',':'))+';\n')

(args.output/'art-provenance.json').write_text(json.dumps({'sourceSha256':SOURCE_SHA256,'routine':'$6815 and lower mask pointer table','bitmapCount':len(art),'tables':{k:{'address':f'{a:04X}','count':n} for k,(a,n) in tables.items()},'runtime':'Bitmap graphics and named geometry only; no original executable program','sha256':hashlib.sha256(target.read_bytes()).hexdigest()},indent=2)+'\n')
