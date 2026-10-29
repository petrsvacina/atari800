#!/usr/bin/env python3
"""Render original River Raid POKEY sound routines offline; no CPU in browser."""
import argparse,array,base64,hashlib,json,struct,sys,tempfile,subprocess,wave
from pathlib import Path
from goonies_extract_audio import render
FRAME_HZ=1789772.5/(114*262)
ROOT=Path(__file__).resolve().parents[1]
SHA='dc55bef6fa336003772643e68b9bfade7155ff4dde1aad814e1cf56ad818805f'
EFFECTS={'engine':({},32,True),'fast':({0x59:248,0x19:14},32,True),'slow':({0x59:64,0x19:13},32,True),'shot':({0x7d:15},17,False),'explosion':({0x7a:1,0x7b:31},34,False),'fuelExplosion':({0x7a:2,0x7b:35},38,False),'refuel':({0x7a:3,0x7b:8},8,False),'full':({0x7a:4,0x7b:8},8,False),'life':({0x7e:64},64,False),'warning':({0x5b:32},64,True),'tank':({0x7f:9},10,False),'enemyExplosion':({0x7c:23},23,False),'tankExplosion':({0x7c:55},55,False),'tankBeam':({0x50:1},56,False)}
MOTOR_LOOPS=('engine','fast','slow')

def motor_loop_window(pcm,sample_rate=22050):
 # The private SAP capture starts before the first POKEY update. Retain that
 # original attack once, but loop only settled, already-running channel audio.
 samples=array.array('h');samples.frombytes(pcm)
 if sys.byteorder!='little':samples.byteswap()
 first=round(4/FRAME_HZ*sample_rate);last=min(round(8/FRAME_HZ*sample_rate),len(samples)-32)
 assert first<last
 history=16;tail=samples[-history:]
 def seam(start):
  return sum((samples[start-history+i]-tail[i])**2 for i in range(history))+history*(samples[start]-samples[-1])**2
 start=min(range(first,last+1),key=seam)
 return {'loopStart':start/sample_rate,'loopEnd':len(samples)/sample_rate}

def read_assets():
 result=json.loads((ROOT/'river-raid/assets/audio.js').read_text().split('=',1)[1].strip().rstrip(';'));assert result['sourceSha256']==SHA;return result

def write_assets(result):
 (ROOT/'river-raid/assets/audio.js').write_text('// Original POKEY routines rendered offline.\nglobalThis.RIVER_AUDIO = '+json.dumps(result,separators=(',',':'))+';\n')

def refresh_motor_loops():
 result=read_assets()
 for name in MOTOR_LOOPS:
  effect=result['effects'][name];effect.update(motor_loop_window(base64.b64decode(effect['data']),result['sampleRate']))
 write_assets(result);print('Updated three motor loop windows; every original PCM byte preserved.')

def export(selected=None):
 rom=(ROOT/'River Raid.rom').read_bytes();assert hashlib.sha256(rom).hexdigest()==SHA
 mem=bytearray(rom);assert mem[0x13db:0x13dd]==bytes.fromhex('e618');mem[0x13db]=0x60
 result={'sourceSha256':SHA,'sampleRate':22050,'frameHz':FRAME_HZ,'effects':{}}
 if selected:
  result=read_assets()
 with tempfile.TemporaryDirectory(prefix='river-audio-') as tmp:
  tmp=Path(tmp)
  for name,(state,ticks,loop) in EFFECTS.items():
   if selected and name not in selected:continue
   code=bytearray()
   def setbyte(a,v):code.extend([0xa9,v,0x8d,a&255,a>>8])
   for a in range(0x100):setbyte(a,0)
   for a,v in {0xd20f:3,0xd208:0,0x59:128,0x19:15,0x5b:255,**state}.items():setbyte(a,v)
   code.append(0x60);code.extend(bytes(0x600-len(code)));code.extend(bytes.fromhex('20a5b2'))
   channel=2 if name in ('shot','life') else 1 if name in ('tank','enemyExplosion','tankExplosion') else 3 if name=='tankBeam' else 0
   for muted in range(4):
    if muted!=channel:setbyte(0xd201+muted*2,0)
   if name=='tankBeam':code.extend(bytes.fromhex('e650a550c9399004a9ff8550'))
   code.append(0x60)
   header=f'SAP\r\nAUTHOR "Activision"\r\nNAME "River Raid {name}"\r\nDATE "1983"\r\nNTSC\r\nTYPE B\r\nFASTPLAY 262\r\nINIT 2000\r\nPLAYER 2600\r\nTIME 00:04.00\r\n'.encode()+b'\xff\xff'
   sap=tmp/(name+'.sap');sap.write_bytes(header+struct.pack('<HH',0x2000,0x2000+len(code)-1)+code+struct.pack('<HH',0xa000,0xbfff)+mem)
   duration=ticks/FRAME_HZ;wav=tmp/(name+'.wav');render(sap,wav,duration+.18);out=tmp/(name+'-mono.wav')
   subprocess.run(['/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-t',str(duration),'-ar','22050','-ac','1',str(out)],check=True)
   with wave.open(str(out)) as f:pcm=f.readframes(f.getnframes())
   result['effects'][name]={'loop':loop,'duration':len(pcm)/44100,'data':base64.b64encode(pcm).decode(),'sha256':hashlib.sha256(pcm).hexdigest()}
   if name in MOTOR_LOOPS:result['effects'][name].update(motor_loop_window(pcm))
   print('Rendered',name,flush=True)
 write_assets(result)
if __name__=='__main__':
 p=argparse.ArgumentParser();group=p.add_mutually_exclusive_group();group.add_argument('--effect',action='append',choices=EFFECTS);group.add_argument('--refresh-motor-loops',action='store_true');args=p.parse_args()
 if args.refresh_motor_loops:refresh_motor_loops()
 else:export(args.effect)
