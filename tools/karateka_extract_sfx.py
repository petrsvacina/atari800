#!/usr/bin/env python3
"""Render original Karateka effects with its real VBI/DLI audio driver offline.

The web receives PCM only. Requires the Atari800 RECORD/STOPRECORD development
monitor patch; turbo capture retains every emulated sample without device waits.
"""
import argparse,base64,hashlib,json,os,shutil,subprocess,tempfile,wave,array
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256,load
from karateka_capture import Capture

def frames(m,count):
 for _ in range(count):
  m.prompt('bline 0');m.prompt('cont');m.prompt('bline 248');m.prompt('cont')
def capture_effect(args,disk,tmp,identifier,pair):
 m=Capture(args.emulator,disk,audio=True);wav=tmp/f'effect-{identifier}-{pair}.wav'
 try:
  m.load_state(args.state);m.prompt(f'recordpair {pair}');m.prompt('c 1500 20 46 0e 4c 03 15');m.prompt('setpc 1500');m.run_to(0x1503)
  # Quiet settling and capture length use the original VBI countdown. Running
  # to a checked PC breakpoint avoids host-side timing and repeated BLINE traps.
  m.prompt('c 0f15 0c 00');m.prompt('c 1503 ad 15 0f 0d 16 0f d0 f8 4c 0b 15');m.run_to(0x150b)
  m.prompt(f'record {wav}');m.prompt('c 0f15 78 00');m.prompt(f'c 150b a9 {identifier:02x} 20 51 0c ad 15 0f 0d 16 0f d0 f8 4c 18 15');m.run_to(0x1518);m.prompt('stoprecord')
 finally:m.close()
 mono=tmp/f'effect-{identifier}-{pair}-mono.wav';subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-ac','1','-ar','22050',str(mono)],check=True)
 with wave.open(str(mono),'rb') as f:return f.readframes(f.getnframes())
def export(args):
 memory=load(args.memory);source=ROOT/'Karateka.atr';effects=[];args.output.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(prefix='karateka-effects-') as tmp:
  tmp=Path(tmp);disk=tmp/'source.atr';shutil.copyfile(source,disk)
  for identifier in [0,1,2,3,4,7,8,9,10,11,12,13]:
   pcm=capture_effect(args,disk,tmp,identifier,'ALL')
   samples=array.array('h',pcm);active=[i for i,v in enumerate(samples) if abs(v)>30]
   if not active:raise ValueError(f'Original effect {identifier} captured silence')
   # Retain the onset; remove only the long silent tail of the offline capture.
   end=min(len(samples),active[-1]+1+551);pcm=pcm[:end*2]
   pointer=memory[0xd03+identifier*2]+256*memory[0xd04+identifier*2]
   record=list(memory[pointer:pointer+9])
   effect={'id':identifier,'sampleRate':22050,'encoding':'s16le','duration':len(pcm)/44100,'data':base64.b64encode(pcm).decode(),'record':record,'holds':bool(record[-1]),'source':f'{pointer:04X}','sha256':hashlib.sha256(pcm).hexdigest()}
   if not effect['holds']:
    stems=[]
    for pair in range(record[0]+1):
     stem=capture_effect(args,disk,tmp,identifier,pair)[:end*2];stems.append(stem)
    # MZ POKEY uses a nonlinear analogue mixer. Retain the full render as an
    # oracle, plus individual joined-pair renders for correct preemption.
    effect['stems']=[{'sampleRate':22050,'data':base64.b64encode(s).decode(),'sha256':hashlib.sha256(s).hexdigest()} for s in stems]
    if len(stems)==2:
     aa,bb=array.array('h',stems[0]),array.array('h',stems[1]);full=array.array('h',pcm);n=min(len(full),len(aa),len(bb));error=sum((full[i]-aa[i]-bb[i])**2 for i in range(n));power=sum(full[i]**2 for i in range(n));effect['stemMixRelativeRms']=(error/max(1,power))**.5
   effects.append(effect)
   print('Original effect',identifier,'duration',round(len(pcm)/44100,3),'hold',bool(record[-1]),flush=True)
 data={'sourceSha256':SOURCE_SHA256,'effects':effects,'clock':1789790,'frameHz':59.9227434,'driver':'$0C51 and $1044, including original DLI/VBI calls','continuousEffect8':'Captured for audit only; a finite PCM loop is not a continuous POKEY implementation.'}
 target=args.output/'audio.js';target.write_text('// Original Karateka audio, rendered offline from the supplied ATR.\nglobalThis.KARATEKA_AUDIO='+json.dumps(data,separators=(',',':'))+';\n')
 (args.output/'audio-provenance.json').write_text(json.dumps({k:v for k,v in data.items() if k!='effects'}|{'effects':[{k:([{x:y for x,y in s.items() if x!='data'} for s in v] if k=='stems' else v) for k,v in e.items() if k!='data'} for e in effects],'fileSha256':hashlib.sha256(target.read_bytes()).hexdigest()},indent=2)+'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--emulator',required=True,type=Path);p.add_argument('--memory',required=True,type=Path);p.add_argument('--state',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'karateka/assets');export(p.parse_args())
