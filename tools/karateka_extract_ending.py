#!/usr/bin/env python3
"""Export original fixed chamber/Mariko presentation frames and final text.

Only the scripted background is captured; player and final-opponent combat
remain independently drawn native actors. No CPU program is exported.
"""
import argparse,base64,hashlib,json
from pathlib import Path
from karateka_extract import ROOT,SOURCE_SHA256,load
from karateka_scenery_oracle import call
def export(a):
 memory=load(a.memory);out={'sourceSha256':SOURCE_SHA256,'frames':{}}
 for pose in range(23,37):
  m=list(memory)
  for addr,value in {7:32,0x39:pose,0x44:6,0x50:1 if 27<=pose<32 else 6,0x83:1,0x84:0}.items():m[addr]=value
  m[0x1500:0x1505]=[0xa2,pose,0x4c,0x0c,0x1d];call(m,0x1500);out['frames'][pose]=base64.b64encode(bytes(m[0x3010:0x47f8])).decode()
 m=list(memory);m[7]=32;call(m,0x2800);call(m,0xa200);out['finalText']=base64.b64encode(bytes(m[0x3010:0x47f8])).decode()
 a.output.mkdir(parents=True,exist_ok=True);target=a.output/'ending.js';target.write_text('// Original scripted chamber graphics and final text only.\nglobalThis.KARATEKA_ENDING='+json.dumps(out,separators=(',',':'))+';\n');(a.output/'ending-provenance.json').write_text(json.dumps({'sourceSha256':SOURCE_SHA256,'routines':['$1D0C','$A200'],'poses':list(range(23,37)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()},indent=2)+'\n');print('Exported 14 original scripted chamber frames and final text')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'karateka/assets');export(p.parse_args())
