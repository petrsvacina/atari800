#!/usr/bin/env python3
"""Invoke the original scene-1 background compositor OFFLINE for a local preview.

This is one static demonstration background, not an export of the campaign.
No character is erased from a screenshot; the original scenery routines redraw
it from the disk's own graphics. Raster color bands still need separate capture.
"""
import argparse,base64,hashlib,json
from pathlib import Path
from karateka_extract import ROOT,load,SOURCE_SHA256
from karateka_extract_sprites import call
from extract_assets import png
ROUTINES=(0x2800,0xb00e,0xad03,0xad06,0xb090,0xbc00)
def export(memory,destination):
 if memory[0xad00:0xad03]!=bytes.fromhex('4c1bad'):raise ValueError('Expected scene-1 banks')
 mem=list(memory);mem[7]=0x20;mem[0x54]=2;mem[0x52]=27
 for routine in ROUTINES:call(mem,routine)
 palette=[(6,6,6,255),(206,112,148,255),(134,134,134,255),(220,220,220,255)]
 pixels=bytes(c for b in mem[0x3010:0x47f8] for bit in (6,4,2,0) for c in palette[b>>bit&3]);destination.mkdir(parents=True,exist_ok=True)
 file=destination/'cliff-preview.png';png(file,160,153,pixels)
 (destination/'background-data.js').write_text('// Original scene-1 preview bitmap only.\nglobalThis.KARATEKA_PREVIEW_BACKGROUND='+json.dumps(base64.b64encode(bytes(mem[0x3010:0x47f8])).decode())+';\n')
 (destination/'background-provenance.json').write_text(json.dumps({'sourceSha256':SOURCE_SHA256,'scene':1,'camera':27,'routines':[f'{p:04X}' for p in ROUTINES],'paletteIsProvisional':True,'scope':'One static preview of scenery only; not a campaign map.','file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()},indent=2)+'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'karateka/assets');a=p.parse_args();export(load(a.memory),a.output)
