#!/usr/bin/env python3
"""Record the ATR's linear cinematic routines, including their original audio.

The supplied reference MKV is never used as footage. Game logic remains native
JavaScript; these recordings are presentation assets for fixed cinematics only.
"""
import argparse,hashlib,json,shutil,subprocess,tempfile
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256
from karateka_capture import Capture

def export(a):
 if hashlib.sha256((ROOT/'Karateka.atr').read_bytes()).hexdigest()!=SOURCE_SHA256:raise ValueError('Unsupported source')
 scenes=[('title',a.title,0xb775,0xb8c9),('prologue',a.title,0xb400,0xb4db),('court',a.scene1,0x79a0,None),('palace-intro',a.scene2,0xad8c,None),('hawk-intro',a.scene3,0xb206,None),('court-palace',a.scene2,0x79a0,None)];out=[];a.output.mkdir(parents=True,exist_ok=True)
 for name,state,start,end in scenes:
  if a.only and name not in a.only:continue
  with tempfile.TemporaryDirectory(prefix='karateka-movie-') as folder:
   tmp=Path(folder);disk=tmp/'source.atr';shutil.copyfile(ROOT/'Karateka.atr',disk);m=Capture(a.emulator,disk,True,a.palette)
   try:
    m.load_state(state);m.prompt('bline 999');m.prompt('c df 00');movie=tmp/'original.avi';m.prompt(f'record {movie}')
    if end:m.prompt(f'setpc {start:04x}');m.run_to(end)
    else:
     code=([0xa9,12,0x20,0,0x24] if name=='palace-intro' else [])+[0x20,start&255,start>>8]
     if name in ('palace-intro','hawk-intro'):code += [0x20,0,0x76]
     stop=0x1500+len(code);code += [0x4c,stop&255,stop>>8]
     m.prompt('c 1500 '+' '.join(f'{v:02x}' for v in code));m.prompt('setpc 1500');m.run_to(stop)
    m.prompt('stoprecord')
    m.prompt(f'write 2409 2409 {tmp / "active.bin"}')
    tail=None
    if (tmp/'active.bin').read_bytes()!=b'\0':
     tail=tmp/'tail.wav';m.prompt('c 1500 4c 00 15');m.prompt('setpc 1500');m.prompt(f'record {tail}');m.run_to(0x24d7);m.prompt('bpc ffff')
     from karateka_extract_sfx import frames
     frames(m,6);m.prompt('stoprecord')
   finally:m.close()
   probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,r_frame_rate,duration','-of','json',str(movie)]))['streams'][0]
   num,den=map(int,probe['r_frame_rate'].split('/'));visual=float(probe['nb_frames'])*den/num
   target=a.output/f'{name}.mp4';command=['ffmpeg','-v','error','-y','-i',str(movie)]
   if tail:command+=['-i',str(tail),'-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[sound]','-map','0:v','-map','[sound]']
   command+=['-vf','scale=640:480:flags=neighbor','-c:v','libx264','-crf','12','-preset','slow','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart',str(target)]
   subprocess.run(command,check=True)
   metadata=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(target)]))['format'];out.append({'name':name,'visualDuration':visual,'audioContinuesAfterPicture':bool(tail),'start':f'{start:04X}','end':f'{end:04X}' if end else 'subroutine return','sha256':hashlib.sha256(target.read_bytes()).hexdigest(),**metadata});print('Recorded',name,metadata,flush=True)
 if a.only and (a.output/'provenance.json').exists():
  previous=json.loads((a.output/'provenance.json').read_text());out=[e for e in previous['movies'] if e['name'] not in a.only]+out
 (a.output/'provenance.json').write_text(json.dumps({'sourceSha256':SOURCE_SHA256,'content':'Original fixed cinematics rendered from the supplied ATR; no reference-video footage','paletteSha256':hashlib.sha256(a.palette.read_bytes()).hexdigest() if a.palette else None,'movies':out},indent=2)+'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--emulator',required=True,type=Path);p.add_argument('--title',required=True,type=Path);p.add_argument('--scene1',required=True,type=Path);p.add_argument('--scene2',required=True,type=Path);p.add_argument('--scene3',required=True,type=Path);p.add_argument('--palette',type=Path);p.add_argument('--only',nargs='+');p.add_argument('--output',type=Path,default=ROOT/'karateka/assets/movies');export(p.parse_args())
