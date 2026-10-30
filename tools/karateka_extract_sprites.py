#!/usr/bin/env python3
"""Export Karateka's composite fighter pictures with its original OFFLINE blitter.

Requires py65 in the development Python environment. The exported assets are PNGs
and rectangle metadata; no original executable program is included in the game.
Colors are a provisional presentation palette pending raster/video verification.
"""
import argparse,hashlib,json
from pathlib import Path
from extract_assets import png
from karateka_extract import load,ROOT,SOURCE_SHA256

def call(memory,address):
 from py65.devices.mpu6502 import MPU
 cpu=MPU(memory=memory);cpu.pc=address;cpu.sp=0xfd
 memory[0x1fe]=0xfe;memory[0x1ff]=0xff
 for _ in range(100000):
  if cpu.pc==0xffff:return
  cpu.step()
 raise RuntimeError(f'Original renderer did not return: {cpu.pc:04x}')

def export(memory,destination):
 result={};palette=[(0,0,0,0),(212,116,157,255),(158,158,158,255),(238,238,238,255)]
 destination.mkdir(parents=True,exist_ok=True)
 for style in range(8):
  sprites=[];mapping={};seen={};x=y=row=0
  for legs in range(42):
   for torso in range(38):
    mem=list(memory);mem[0x3010:0x47f8]=[0]*6120
    for address,value in {7:0x20,0x20:legs,0x21:torso,0x22:16,0x2c:1 if style==0 else 255,0x50:0,0x36:0 if style==0 else 1,0x3e:max(0,style-1),0x4d:0,0x44:0,0xf:0}.items():mem[address]=value
    call(mem,0x6815)
    raw=bytes(mem[0x3010+py*40+px//4]>>(6-2*(px%4))&3 for py in range(89,153) for px in range(32,96))
    digest=hashlib.sha256(raw).digest();key=f'{legs},{torso}'
    if digest in seen:mapping[key]=seen[digest];continue
    index=len(sprites);seen[digest]=index;mapping[key]=index
    occupied=[(px,py) for py in range(64) for px in range(64) if raw[py*64+px]]
    if not occupied:sprites.append([0,0,0,0,0,0,b'']);continue
    left=min(p[0] for p in occupied);top=min(p[1] for p in occupied);right=max(p[0] for p in occupied)+1;bottom=max(p[1] for p in occupied)+1;w=right-left;h=bottom-top
    if x+w>1024:y+=row+1;x=row=0
    pixels=bytes(raw[py*64+px] for py in range(top,bottom) for px in range(left,right))
    sprites.append([x,y,w,h,left-32,top-64,pixels]);x+=w+1;row=max(row,h)
  height=y+row;rgba=bytearray(1024*height*4)
  for sx,sy,w,h,dx,dy,pixels in sprites:
   for py in range(h):
    for px in range(w):
     at=((sy+py)*1024+sx+px)*4;rgba[at:at+4]=bytes(palette[pixels[py*w+px]])
  file=f'fighters-{style}.png';png(destination/file,1024,height,rgba)
  result[style]={'file':file,'frames':[s[:6] for s in sprites],'pairs':mapping}
  print('Style',style,':',len(sprites),'unique composite pictures',flush=True)
 (destination/'fighters.js').write_text('// Original composite fighter pictures, exported offline; indexed by leg and torso pose.\nglobalThis.KARATEKA_FIGHTERS='+json.dumps(result,separators=(',',':'))+';\n')
 (destination/'provenance.json').write_text(json.dumps({'source':'Karateka.atr','sourceSha256':SOURCE_SHA256,'routine':'$6815','combinationsPerStyle':42*38,'styles':8,'paletteIsProvisional':True,'capture':{'width':64,'height':64,'anchor':[32,64],'originalX':16,'framebuffer':'$3010','firstRow':89},'limits':['All leg/torso combinations include unreachable combinations.','Cinematics, falls beyond this crop, raster palette changes and background composition require separate verification.'],'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in destination.glob('fighters*')}} ,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'research/karateka/atlas');a=p.parse_args();export(load(a.memory),a.output)
