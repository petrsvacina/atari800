#!/usr/bin/env python3
"""Compose a portal cover using the original scenery and fighter pixels."""
import json
from pathlib import Path
import struct
import zlib
from extract_assets import ROOT, png


def read_rgba(file):
    data=file.read_bytes(); position=8; compressed=bytearray()
    while position<len(data):
        length=struct.unpack('>I',data[position:position+4])[0]
        kind=data[position+4:position+8];body=data[position+8:position+8+length]
        if kind==b'IHDR':
            width,height,depth,color,*_=struct.unpack('>IIBBBBB',body)
            assert depth==8 and color==6
        if kind==b'IDAT':compressed.extend(body)
        position+=length+12
    raw=zlib.decompress(compressed);result=bytearray()
    for row in range(height):
        start=row*(width*4+1);assert raw[start]==0
        result.extend(raw[start+1:start+1+width*4])
    return width,height,result


def render():
    width,height=320,192
    palette=json.loads((ROOT/'karate/assets/palette.js').read_text().split(' = ',1)[1].rstrip(';\n'))
    def rgba(hex_color):return bytes.fromhex(hex_color.lstrip('#')[:6])+b'\xff'
    pixels=bytearray(rgba(palette['floor'])*(width*height))
    _,bg_height,background=read_rgba(ROOT/'karate/assets/backgrounds/scene-0.png')
    pixels[:len(background)]=background
    frames=json.loads((ROOT/'research/international-karate/sprites.json').read_text())['frames']
    for who,frame_id,x,facing in [(0,16,112,1),(1,19,214,-1)]:
        frame=frames[frame_id];tile=0
        for row,value in enumerate(frame['layout']):
            offset,length=value>>4,value&15
            for col in range(length):
                for y in range(8):
                    packed=frame['data'][tile*8+y]
                    for xx in range(8):
                        color=(packed>>(6-(xx//2)*2))&3
                        if not color:continue
                        sx=(offset+col)*8+xx
                        dx=x-24+sx if facing==1 else x+23-sx
                        dy=height-8-96+row*8+y
                        if 0<=dx<width and 0<=dy<height:
                            index=(dy*width+dx)*4
                            pixels[index:index+4]=rgba(palette['fighters'][who][color])
                tile+=1
    scale=4;expanded=bytearray()
    for y in range(height):
        row=b''.join(pixels[(y*width+x)*4:(y*width+x+1)*4]*scale for x in range(width))
        expanded.extend(row*scale)
    png(ROOT/'portal/assets/international-karate.png',width*scale,height*scale,expanded)
    print('Rendered International Karate cover from original graphics and the display palette.')


if __name__=='__main__':render()
