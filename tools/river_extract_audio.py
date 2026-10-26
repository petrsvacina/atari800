#!/usr/bin/env python3
"""Render original River Raid POKEY sound routines offline; no CPU in browser."""
import base64,hashlib,json,struct,sys,tempfile,subprocess,wave
from pathlib import Path
from goonies_extract_audio import render,FRAME_HZ
ROOT=Path(__file__).resolve().parents[1]
SHA='dc55bef6fa336003772643e68b9bfade7155ff4dde1aad814e1cf56ad818805f'
EFFECTS={'engine':({},32,True),'fast':({0x59:248,0x19:14},32,True),'slow':({0x59:64,0x19:13},32,True),'shot':({0x7d:15},17,False),'explosion':({0x7a:1,0x7b:31},34,False),'refuel':({0x7a:3,0x7b:8},8,False),'full':({0x7a:4,0x7b:8},8,False),'life':({0x7e:64},64,False),'warning':({0x5b:32},64,True),'tank':({0x7f:9},10,False)}
def export():
 rom=(ROOT/'River Raid.rom').read_bytes();assert hashlib.sha256(rom).hexdigest()==SHA
 mem=bytearray(rom);assert mem[0x13db:0x13dd]==bytes.fromhex('e618');mem[0x13db]=0x60
 result={'sourceSha256':SHA,'sampleRate':22050,'frameHz':FRAME_HZ,'effects':{}}
 with tempfile.TemporaryDirectory(prefix='river-audio-') as tmp:
  tmp=Path(tmp)
  for name,(state,ticks,loop) in EFFECTS.items():
   code=bytearray()
   def setbyte(a,v):code.extend([0xa9,v,0x8d,a&255,a>>8])
   for a in range(0x100):setbyte(a,0)
   for a,v in {0xd20f:3,0xd208:0,0x59:128,0x19:15,0x5b:255,**state}.items():setbyte(a,v)
   code.append(0x60);code.extend(bytes(0x600-len(code)));code.extend(bytes.fromhex('20a5b2'))
   channel=2 if name in ('shot','life') else 1 if name=='tank' else 0
   for muted in range(4):
    if muted!=channel:setbyte(0xd201+muted*2,0)
   code.append(0x60)
   header=f'SAP\r\nAUTHOR "Activision"\r\nNAME "River Raid {name}"\r\nDATE "1983"\r\nNTSC\r\nTYPE B\r\nFASTPLAY 262\r\nINIT 2000\r\nPLAYER 2600\r\nTIME 00:04.00\r\n'.encode()+b'\xff\xff'
   sap=tmp/(name+'.sap');sap.write_bytes(header+struct.pack('<HH',0x2000,0x2000+len(code)-1)+code+struct.pack('<HH',0xa000,0xbfff)+mem)
   duration=ticks/FRAME_HZ;wav=tmp/(name+'.wav');render(sap,wav,duration+.18);out=tmp/(name+'-mono.wav')
   subprocess.run(['/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-t',str(duration),'-ar','22050','-ac','1',str(out)],check=True)
   with wave.open(str(out)) as f:pcm=f.readframes(f.getnframes())
   result['effects'][name]={'loop':loop,'duration':len(pcm)/44100,'data':base64.b64encode(pcm).decode(),'sha256':hashlib.sha256(pcm).hexdigest()}
   print('Rendered',name,flush=True)
 (ROOT/'river-raid/assets/audio.js').write_text('// Original POKEY routines rendered offline.\nglobalThis.RIVER_AUDIO = '+json.dumps(result,separators=(',',':'))+';\n')
if __name__=='__main__':export()
