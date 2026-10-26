#!/usr/bin/env python3
"""Store a development raster capture as data; no original program is exported.

The Atari800 monitor needs the development-only DUMPSCREEN command, which
writes its 384x240 indexed Screen_atari buffer. Pass the matching RAM dump.
"""
import argparse,base64,hashlib,json,zlib
from pathlib import Path
from hero_capture_game import snapshot
from hero_extract import ROOT,SHA
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--memory',type=Path,required=True);parser.add_argument('--pixels',type=Path,required=True);args=parser.parse_args()
    assert hashlib.sha256((ROOT/'H.E.R.O..xex').read_bytes()).hexdigest()==SHA
    b=args.memory.read_bytes();pixels=args.pixels.read_bytes();assert len(b)==49152 and len(pixels)==384*240
    crop=b''.join(pixels[y*384+24:y*384+360]for y in range(240));state=snapshot(b)
    result={'sourceSha256':SHA,'width':336,'height':240,'state':state,'body':{'offset':b[0x11],'reverse':b[0x12]==0x30,'sheet':'actor' if b[0x12]==0xa1 else 'hero'},'pixels':base64.b64encode(zlib.compress(crop,9)).decode(),'pixelSha256':hashlib.sha256(crop).hexdigest()}
    (ROOT/'tools/fixtures/hero-raster.json').write_text(json.dumps(result,separators=(',',':'))+'\n');print('Saved indexed H.E.R.O. raster oracle:',result['pixelSha256'])
if __name__=='__main__':main()
