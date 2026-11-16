#!/usr/bin/env python3
"""Extract original Fractalus cockpit pixels, fonts and glyph data; no CPU runtime.

Input: Atari800 indexed DUMPSCREEN captures and matching post-frame RAM from the
supplied read-only ATR. The development-only monitor build adds DUMPSCREEN and
DUMPPALETTE (Screen_atari384x240, Colours_table RGB768). See source metadata in
assets/cockpit.json. No executable program bytes are exported.
"""
import argparse,base64,hashlib,json,sys
from pathlib import Path
from extract_assets import png
ROOT=Path(__file__).resolve().parents[1]
SHA='e8ff23567b219f614a307a309e42929957facb9b9ff838cc8ff91789eace44ab'
WIDTH,HEIGHT=320,200
VIEW={'x':0,'y':22,'width':320,'height':94,'sourceWidth':160,'sourceHeight':47}
def crop(data):return b''.join(data[y*384+32:y*384+352] for y in range(20,220))
def rgba(indices,palette):return bytes(v for n in indices for v in (*palette[n*3:n*3+3],255))
def encode(data):return base64.b64encode(bytes(data)).decode()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--reference',type=Path,default=Path('/private/tmp/fractalus-disk-research'));args=p.parse_args();folder=args.reference
 assert hashlib.sha256((ROOT/'rescue-on-fractalus.atr').read_bytes()).hexdigest()==SHA
 palette=(folder/'palette.rgb').read_bytes();assert len(palette)==768
 raw=(folder/'flight4.screen').read_bytes();assert len(raw)==384*240
 memory=(folder/'flight4-visual.bin').read_bytes();assert len(memory)==65536
 base=crop(raw);mask=bytearray(320*94);overlay=bytearray(320*94)
 for name,colours in [('flight4',[20,42,16,6])]:
  pixels=(folder/(name+'.screen')).read_bytes();ram=(folder/(name+'-visual.bin')).read_bytes()
  for y in range(47):
   for x in range(160):
    value=ram[0x1074+y*96+x//4]>>(6-2*(x%4))&3
    for dy in range(2):
     for dx in range(2):
      at=(y*2+dy)*320+x*2+dx;original=pixels[(42+y*2+dy)*384+32+x*2+dx]
      if original!=colours[value]:mask[at]=1;overlay[at]=original
 # PMG colours are multiplexed by the original DLI; these are the observed
 # canopy/cross-hair foreground pixels, not an invented polygonal frame.
 fixture={
  'sourceSha256':SHA,'capture':'Atari8007.2.1 PAL indexed GTIA raster, private read-only ATR; full frame after original 40 flight iterations',
  'width':WIDTH,'height':HEIGHT,'indexedScreenCrop':{'x':32,'y':20,'width':320,'height':200},'viewport':VIEW,
  'palette':encode(palette),'paletteDescription':'Atari800 default PAL RGB; analogue television RGB varies',
  'base':encode(base),'baseSha256':hashlib.sha256(base).hexdigest(),
  'viewportOverlayMask':encode(mask),'viewportOverlay':encode(overlay),
  'hudFont':encode(memory[0x3800:0x3c00]),'textFont':encode(memory[0x0400:0x0600]),
  'hudCells':encode(memory[0x332d:0x332d+48*10]),'digitGlyphs':list(memory[0x4ae3:0x4ae3+40]),
  'hud':{'x':0,'y':116,'columns':40,'rows':10,'storedColumns':48,'visibleColumn':4,'cellWidth':8,'cellHeight':8,'pixelColours':[144,4,6,44,38]},
  'terrainColours':[20,42,16,6],
  'paletteParams':list(memory[0xcf:0xdf]),
  'hudNoPmg':encode(crop((folder/'no-pmg.screen').read_bytes())[116*320:196*320]),
  'ahRows':encode(memory[0xe00:0xf00]),'ahIndex':list(memory[0x455b:0x4566]),'ahPattern':encode(memory[0x4b57:0x4b57+231]),
  'compassTable':encode(memory[0x4b0b:0x4c0b]),'compassOffsets':list(memory[0x3ff6:0x3ffa]),
  'dialPointers':[int.from_bytes(memory[0x4581+i*2:0x4583+i*2],'little') for i in range(16)],
  'initialInstruments':{'energy':memory[0x62f],'spanTop':memory[0x281a],'spanBottom':memory[0x281b],'delayedCanopyRoll':memory[0x291c],'delayedCanopyPitch':memory[0x291d]},
  'limits':['Native original AH, energy, altimeter, thrust and compass writers are supported; input values must come from the native original state. The LR scanner dot remains the captured state until a native scanner writer supplies its bitmap.','Both raster references have no airborne enemy/P3 in the viewport. Overlay is original static canopy; hostile P3 rendering is a separate layer.','RGB uses emulator PAL palette; indexed pixel values are original-program raster evidence.']}
 dest=ROOT/'rescue-on-fractalus/assets';dest.mkdir(parents=True,exist_ok=True);(dest/'cockpit.json').write_text(json.dumps(fixture,separators=(',',':'))+'\n')
 title_source=folder/'game-title.screen';title=crop(title_source.read_bytes()) if title_source.exists() else base
 if not any(title):title=base
 png(dest/'title.png',320,200,rgba(title,palette))
 # Actual original title-font glyphs and wording; transparent game wordmark.
 label='RESCUE ON FRACTALUS!';scale=2;width=len(label)*8*scale;height=8*scale;pixels=bytearray(width*height*4)
 font=memory[0x400:0x600]
 for n,ch in enumerate(label):
  glyph=font[((ord(ch)-32)&63)*8:(((ord(ch)-32)&63)+1)*8]
  for y,bits in enumerate(glyph):
   for x in range(8):
    if bits&(128>>x):
     for dy in range(scale):
      for dx in range(scale):
       at=((y*scale+dy)*width+n*8*scale+x*scale+dx)*4;pixels[at:at+4]=bytes((*palette[44*3:44*3+3],255))
 png(dest/'logo.png',width,height,pixels)
 print(json.dumps({'basePixels':len(base),'overlayPixels':sum(mask),'viewport':VIEW,'source':SHA}))
if __name__=='__main__':main()
