#!/usr/bin/env python3
"""Extract the final opponent's original pixel operators, offline only.

The original specialised compositor is evaluated over black and white. Its
copy/AND/OR operations give a per-pixel value and background-preservation mask.
The browser applies these graphic masks, never original instructions.
"""
import argparse,base64,hashlib,json,time
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256,load
from karateka_extract_sprites import call

def pixels(packed):return bytes(v>>shift&3 for v in packed for shift in (6,4,2,0))
def export(a):
 memory=load(a.memory)
 if memory[0xbc50:0xbc53]!=bytes.fromhex('4c56bc'):raise ValueError('Expected final-bank specialised compositor')
 frames=[];mapping=[];seen={};unsupported=[];start=time.monotonic()
 for lower in range(42):
  for upper in range(38):
   for shift in range(8):
    if lower>=34 or upper>=27:mapping.append(-1);unsupported.append([lower,upper,shift]);continue
    pictures=[]
    for fill in (0,255):
     m=list(memory);m[0x3010:0x47f8]=[fill]*6120
     for addr,value in {7:32,0x20:lower,0x21:upper,0x22:20,0x2c:255,0x50:shift,0x36:0,0x3e:7,0x4d:1,0x44:6,0xf:0,0x62:11}.items():m[addr]=value
     try:call(m,0x6815)
     except RuntimeError as error:raise ValueError(f'Special pose {lower},{upper} phase {shift} background {fill}: {error}') from error
     pictures.append(pixels(m[0x3010:0x47f8]))
    dark,light=pictures;changed=[i for i,(x,y) in enumerate(zip(dark,light)) if x or y!=3]
    if not changed:item={'x':0,'y':0,'width':0,'height':0,'data':'','drawDelta':(m[0x23]-20)&255}
    else:
     left=min(i%160 for i in changed);right=max(i%160 for i in changed)+1;top=min(i//160 for i in changed);bottom=max(i//160 for i in changed)+1
     values=[dark[y*160+x]<<2 | (dark[y*160+x]^light[y*160+x]) for y in range(top,bottom) for x in range(left,right)]
     packed=bytes(values[i]<<4 | (values[i+1] if i+1<len(values) else 0) for i in range(0,len(values),2))
     item={'x':left-80,'y':top,'width':right-left,'height':bottom-top,'data':base64.b64encode(packed).decode(),'drawDelta':(m[0x23]-20)&255}
    digest=hashlib.sha256(json.dumps(item,separators=(',',':')).encode()).hexdigest()
    if digest not in seen:seen[digest]=len(frames);frames.append(item)
    mapping.append(seen[digest])
  print('Special character lower pose',lower,'unique',len(frames),'seconds',round(time.monotonic()-start,1),flush=True)
 out={'sourceSha256':SOURCE_SHA256,'frames':frames,'mapping':mapping,'torsoCount':38,'phaseCount':8};a.output.mkdir(parents=True,exist_ok=True);target=a.output/'special-character.js';target.write_text('// Original graphic pixel operators only, evaluated offline.\nglobalThis.KARATEKA_SPECIAL_CHARACTER='+json.dumps(out,separators=(',',':'))+';\n');(a.output/'special-character-provenance.json').write_text(json.dumps({'sourceSha256':SOURCE_SHA256,'routine':'$6815 to $BC50, final bank','evaluatedStates':len(mapping)-len(unsupported),'uniqueFrames':len(frames),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'unsupported':unsupported,'limits':'Original special renderer has no valid sprites for unrelated running/player-only poses; these entries throw rather than invent graphics. Extracted at x=20; clipping is checked separately.'},indent=2)+'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'karateka/assets');export(p.parse_args())
