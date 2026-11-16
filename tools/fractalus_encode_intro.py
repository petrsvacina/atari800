#!/usr/bin/env python3
"""Encode original cinematic rasters as lossless native-canvas patches.

Only graphic pixels, palette, original per-frame POKEY states and metadata are
exported. Numeric caption bases are independently rendered by the original glyph
routine; they permit all selected levels without replaying a wrong LEVEL04.
"""
import argparse,base64,gzip,hashlib,json
from pathlib import Path
import numpy as np
from fractalus_original import ROOT,SHA256
p=argparse.ArgumentParser();p.add_argument('--reference',type=Path,default=Path('/private/tmp/fractalus-intro-capture'));args=p.parse_args()
W,H=320,200
def b64(data):return base64.b64encode(data).decode()
def varint(out,value):
 while value>=128:out.append((value&127)|128);value>>=7
 out.append(value)
def patches(current,previous=None,mask=None):
 changed=current!=previous if previous is not None else current!=0
 if mask is not None:changed&=mask
 same=changed[:-1]&changed[1:]&(current[:-1]==current[1:])
 starts=np.flatnonzero(changed&~np.r_[False,same]);ends=np.flatnonzero(changed&~np.r_[same,False])+1
 out=bytearray();varint(out,len(starts));cursor=0
 for start,end in zip(starts.tolist(),ends.tolist()):varint(out,start-cursor);varint(out,end-start);out.append(int(current[start]));cursor=end
 return bytes(out)
def frame(folder,index):
 raw=(folder/f'{index:04d}.bin').read_bytes();assert len(raw)==92175
 pixels=np.frombuffer(raw[:92160],np.uint8).reshape(240,384)[20:220,32:352].flatten()
 return pixels,raw[92160:92169],raw[-6:]
viewport=np.zeros(W*H,dtype=bool);viewport[22*W:116*W]=True
glyphCount=167 # Last original door-caption pixel leaves the viewport at frame166.
def launchBlank(index):
 pixels,registers,state=frame(args.reference/'launch-04-blank',index)
 original,originalRegisters,_=frame(args.reference/'launch-04',index)
 assert registers==originalRegisters,(index,'Launch timing/audio differs')
 if index>=glyphCount:return original,registers,state
 # The lock indicator uses RANDOM and its phase need not survive emulator
 # savestate restores. Keep the untouched original HUD for every caption basis.
 pixels[~viewport]=original[~viewport]
 return pixels,registers,state
def manifest(folder):
 m=json.loads((folder/'manifest.json').read_text());assert m['sourceSha256']==SHA256
 return m
def encode(folder,tag):
 m=manifest(folder);assert m.get('complete'),(tag,'Original scene boundary was not reached');count=len(m['records'])-1
 out=bytearray();sound=bytearray();old=np.zeros(W*H,np.uint8);hashes=[];phases=[];previous=None
 for i in range(count):
  pixels,registers,state=launchBlank(i) if tag=='launch' else frame(folder,i);out.extend(patches(pixels,old));sound.extend(registers);old=pixels
  hashes.append(hashlib.sha256(pixels.tobytes()).hexdigest())
  vbi=state[1]+256*state[2]
  phase='logo' if tag=='logo' else 'carrier' if tag=='station' else 'descent' if vbi==0x4ff5 else 'tunnel' if state[3] else 'space' if state[4]>3 else 'planet' if state[4] else 'hangar'
  if phase!=previous:phases.append([i,phase]);previous=phase
 packed=gzip.compress(out,compresslevel=9,mtime=0)
 print(tag,count,'frames',len(out),'patch bytes,',len(packed),'gzip',phases,flush=True)
 return {'frames':count,'codec':'gzip-rle-delta-v1','patches':b64(packed),'sound':b64(bytes(sound)),'phases':phases,'patchBytes':len(out)},hashes

logo,logoHashes=encode(args.reference/'logo','logo')
station,stationHashes=encode(args.reference/'station','station')
launch,launchHashes=encode(args.reference/'launch-04-blank','launch')
baseFolder=args.reference/'launch-04-blank';originalFolder=args.reference/'launch-04'
dictionary=[b'\x00'];lookup={dictionary[0]:0};selectors=[];glyphHashes=[];digitHashes=[[]for _ in range(10)]
for i in range(glyphCount):
 base,regs,_=launchBlank(i);tens,tRegs,_=frame(args.reference/'launch-04-tens-mask',i);units,uRegs,_=frame(args.reference/'launch-04-units-mask',i)
 assert regs==tRegs==uRegs,(i,'Caption masks changed audio timing')
 tMask=(tens!=base)&viewport;uMask=(units!=base)&viewport;assert not np.any(tMask&uMask),(i,'Caption regions overlap')
 row=[[],[]]
 for digit in range(10):
  pixels,dRegs,_=frame(args.reference/f'launch-04-digit{digit}',i);assert dRegs==regs,(i,digit,'Caption changed audio timing')
  pixels[~viewport]=base[~viewport];digitHashes[digit].append(hashlib.sha256(pixels.tobytes()).hexdigest())
  assert not np.any((pixels!=base)&~(tMask|uMask)&viewport),(i,digit,'Caption has effects outside original glyph masks')
  for side,mask in enumerate([tMask,uMask]):
   encoded=patches(pixels,base,mask)
   if encoded not in lookup:lookup[encoded]=len(dictionary);dictionary.append(encoded)
   row[side].append(lookup[encoded])
 selectors.append(row)
 # Independent original LEVEL04 frame must equal blank + original glyph0/4.
 combined=base.copy()
 for digit,mask in [(0,tMask),(4,uMask)]:
  pixels,_,_=frame(args.reference/f'launch-04-digit{digit}',i);combined[mask]=pixels[mask]
 original,originalRegs,_=frame(originalFolder,i)
 assert regs==originalRegs and np.array_equal(combined,original),(i,'LEVEL04 differs from untouched original launch')
 glyphHashes.append(hashlib.sha256(combined.tobytes()).hexdigest())
for i in range(glyphCount,722):
 blank,regs,_=frame(baseFolder,i);original,originalRegs,_=frame(originalFolder,i)
 assert regs==originalRegs and np.array_equal(blank[viewport],original[viewport]),(i,'Numeric caption remains visible past overlay stream')
for i in range(glyphCount,launch['frames']):
 original,_,_=frame(originalFolder,i);glyphHashes.append(hashlib.sha256(original.tobytes()).hexdigest())
glyphData=bytearray();offsets=[0]
for item in dictionary:glyphData.extend(item);offsets.append(len(glyphData))
palette=(args.reference/'launch-04-blank/palette.rgb').read_bytes();assert len(palette)==768
assert (args.reference/'logo/palette.rgb').read_bytes()==palette,'Logo palette differs from launch palette'
data={'schema':1,'sourceSha256':SHA256,'width':W,'height':H,'palette':b64(palette),'standard':'PAL',
 'source':'Original ATR4.1 executed offline in Atari8007.2.1; full indexed raster per VBI, original register audio; no video-reference frames or CPU runtime.',
 'logo':logo,'station':station,'launch':launch,'glyphs':{'frames':glyphCount,'patches':b64(bytes(glyphData)),'offsets':offsets,'selectors':selectors},
 'limits':['Logo runs unmodified from a fresh ATR boot, from $5000 through the final $5110 return; disk-loading delays between scenes are not included.','Station ends at the first original $1DF5 cycle boundary; asynchronous loader poll alone is suppressed after ship assets are resident.','Launch capture ends immediately before first $3EBA; selected-level captions use original numeric glyph bases.','Raster data is PAL; NTSC playback uses its VBI rate but a separate continuous NTSC capture has not been verified.','POKEY states are sampled once per displayed original frame; sub-frame analogue phase is not represented.']}
target=ROOT/'rescue-on-fractalus/assets/intro.json';target.write_text(json.dumps(data,separators=(',',':'))+'\n')
fixture={'sourceSha256':SHA256,'logoHashes':logoHashes,'stationHashes':stationHashes,'launchBlankHashes':launchHashes,'launch04Hashes':glyphHashes,'digitHashes':digitHashes,'soundHashes':{name:hashlib.sha256(base64.b64decode(data[name]['sound'])).hexdigest() for name in ['logo','station','launch']},'introSha256':hashlib.sha256(target.read_bytes()).hexdigest()}
(ROOT/'tools/fixtures/fractalus-intro.json.gz').write_bytes(gzip.compress(json.dumps(fixture,separators=(',',':')).encode(),mtime=0))
print('Encoded',target.stat().st_size,'bytes;',len(dictionary),'original glyph overlay patches')
