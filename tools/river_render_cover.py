#!/usr/bin/env python3
"""Render a portal cover from the original River Raid course and bitmaps."""
import base64,json,math,shutil,struct
from pathlib import Path
from extract_assets import png
ROOT=Path(__file__).resolve().parents[1]
def render():
 a=json.loads((ROOT/'research/river-raid/course.json').read_text());dictionary=base64.b64decode(a['dictionary']);indices=base64.b64decode(a['indices']);rgba=bytearray([0,0,0,255]*(320*192));palette=[(0,0,0),(0,128,0),(0,0,0),(0,42,174)];scroll=370
 def dot(x,y,c):
  if 0<=x<320 and 0<=y<192:rgba[(y*320+x)*4:(y*320+x)*4+4]=bytes([*c,255])
 def color(code):
  h,l=code>>4,code&15
  if not l:return (0,0,0)
  if not h:return (l*17,l*16,min(255,l*18))
  hues=[0,50,24,5,335,310,275,245,215,192,170,150,125,108,85,65];h=hues[h]/60;v=min(255,l*20+8);c=v*.86;x=c*(1-abs(h%2-1));m=v-c
  t=(c,x,0) if h<1 else (x,c,0) if h<2 else (0,c,x) if h<3 else (0,x,c) if h<4 else (x,0,c) if h<5 else (c,0,x)
  return tuple(round(n+m) for n in t)
 for y in range(160):
  r=159+scroll-y;index=struct.unpack_from('<I',indices,r*4)[0];row=dictionary[index*40:index*40+40]
  for x in range(320):dot(x,y,palette[row[x//8]>>(6-(x%8//2)*2)&3])
 def bitmap(bits,x,y,scale,colors):
  for yy,b in enumerate(bits):
   c=colors if isinstance(colors,tuple) else color(colors[yy])
   for xx in range(8):
    if b&(128>>xx):
     for i in range(scale):dot(x+xx*scale+i,y+yy,c)
 for e in a['objects']:
  y=159+scroll-e['worldY']
  if -25<y<160:
   s=a['sprites'][e['type']];f=s['variants'][1 if e['flags']&8 else 0];bitmap(f['bits'],(e['rawX']-48)*2,y,s['width']//4,f['colors'])
 bitmap(a['planes'][9],144,145,2,(246,255,146))
 for y in range(160,192):
  for x in range(320):dot(x,y,(91,87,100))
 def text(s,x,y):
  for c in s:
   i=0 if c==' ' else int(c)+16 if c.isdigit() else ord(c)-32;bitmap(a['glyphs'][i],x,y,2,(242,255,156));x+=16
 text('P1  000460  HI 000000',0,161);text('GAME 1      BRIDGE 1',0,173);text('E     F',96,182)
 out=bytearray()
 for y in range(192):
  line=b''.join(rgba[(y*320+x)*4:(y*320+x+1)*4]*4 for x in range(320));out.extend(line*4)
 png(ROOT/'portal/assets/river-raid.png',1280,768,out);shutil.copyfile(ROOT/'river-raid/assets/logo.svg',ROOT/'portal/assets/river-raid-logo.svg')
 print('Rendered River Raid cover using original course and sprites.')
if __name__=='__main__':render()
