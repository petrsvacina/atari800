#!/usr/bin/env python3
"""Render the Archon catalog cover from its verified original unit bitmaps."""
import json
from pathlib import Path
from extract_assets import ROOT,png

def load(name):return json.loads((ROOT/'archon/assets'/name).read_text().split(' = ',1)[1].rstrip(';\n'))

def render():
    assets,rules,palette=load('sprites.js'),load('rules.js'),load('palette.js')
    width,height=320,192
    def rgba(color):return bytes.fromhex(color.lstrip('#'))+b'\xff'
    pixels=bytearray(rgba(palette['background'])*(width*height))
    def rect(x,y,w,h,color):
        for yy in range(y,y+h):
            for xx in range(x,x+w):
                if 0<=xx<width and 0<=yy<height:
                    i=(yy*width+xx)*4;pixels[i:i+4]=rgba(color)
    cell=20;left,top=70,6
    rect(left-2,top-2,184,184,palette['light'])
    for y in range(9):
        for x in range(9):
            terrain=rules['terrain'][y*9+x]
            color=palette['board']['variable'][3] if terrain=='cycle' else palette['board'][terrain]
            rect(left+x*cell,top+y*cell,cell,cell,color)
            if [x,y] in rules['powerPoints']:
                for dx,dy,w in [(7,7,6),(5,8,10),(4,9,12),(5,10,10),(7,11,6)]:rect(left+x*cell+dx,top+y*cell+dy,w,1,palette['board']['power'])
                rect(left+x*cell+9,top+y*cell+8,2,3,color)
    for unit in rules['layout']:
        sprite=assets['units'][unit['type']];rows=sprite['frames'][0];mirror=sprite['defaultMirror']
        for y,b in enumerate(rows):
            for x in range(8):
                if b&(128>>x):rect(left+unit['x']*cell+2+(14-x*2 if mirror else x*2),top+unit['y']*cell+2+y,2,1,palette[unit['side']])
    expanded=bytearray()
    for y in range(height):
        row=b''.join(pixels[(y*width+x)*4:(y*width+x+1)*4]*4 for x in range(width));expanded.extend(row*4)
    png(ROOT/'portal/assets/archon.png',width*4,height*4,expanded)
    print('Rendered Archon cover from original icons, terrain and video-calibrated palette.')

if __name__=='__main__':render()
