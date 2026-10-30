#!/usr/bin/env python3
"""Render gameplay music cues using the supplied game's real interrupt driver."""
import argparse,array,base64,hashlib,json,shutil,subprocess,tempfile,wave
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256,load
from karateka_capture import Capture
from karateka_extract_sfx import frames

def export(a):
 memory=load(a.memory);out=[];a.output.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(prefix='karateka-music-') as folder:
  tmp=Path(folder);disk=tmp/'source.atr';shutil.copyfile(ROOT/'Karateka.atr',disk)
  for cue in range(16,27):
   m=Capture(a.emulator,disk,True)
   try:
    state=a.scene4_state if cue<21 else a.state
    m.load_state(state);m.prompt('bline 999');m.prompt('c 1500 20 46 0e 4c 03 15');m.prompt('setpc 1500');m.run_to(0x1503);m.prompt('bpc ffff');frames(m,12)
    original=tmp/f'{cue}.wav';m.prompt(f'record {original}');m.prompt(f'c 1503 a9 {cue:02x} 20 00 24 4c 08 15');m.prompt('setpc 1503')
    # Let the real CPU/interrupts run at turbo speed until the original music
    # terminator. No host-time waits or guessed per-frame cadence are used.
    m.run_to(0x1508);m.run_to(0x24d7);m.prompt('bpc ffff')
    frames(m,6);m.prompt('stoprecord')
   finally:m.close()
   target=tmp/f'{cue}-mono.wav';subprocess.run(['ffmpeg','-v','error','-y','-i',str(original),'-ac','1','-ar','22050',str(target)],check=True)
   with wave.open(str(target),'rb') as f:pcm=f.readframes(f.getnframes())
   values=array.array('h',pcm);last=max(i for i,v in enumerate(values) if abs(v)>30);pcm=pcm[:min(len(values),last+552)*2]
   out.append({'id':cue,'scene':4 if cue<21 else 1,'encoding':'s16le','sampleRate':22050,'duration':len(pcm)/44100,'sha256':hashlib.sha256(pcm).hexdigest(),'data':base64.b64encode(pcm).decode()});print('Captured original music cue',cue,'seconds',round(len(pcm)/44100,3),flush=True)
 data={'sourceSha256':SOURCE_SHA256,'music':out,'driver':'$2400, real gameplay VBI/DLI cadence'};target=a.output/'music.js';target.write_text('// Original gameplay music rendered offline; no CPU program.\nglobalThis.KARATEKA_MUSIC='+json.dumps(data,separators=(',',':'))+';\n');(a.output/'music-provenance.json').write_text(json.dumps({**data,'music':[{k:v for k,v in e.items() if k!='data'} for e in out]},indent=2)+'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--emulator',required=True,type=Path);p.add_argument('--memory',required=True,type=Path);p.add_argument('--state',required=True,type=Path);p.add_argument('--scene4-state',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'karateka/assets');export(p.parse_args())
