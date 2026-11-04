#!/usr/bin/env python3
"""Decode the shipped Fred MP3 and reject silent, inaudible or truncated music."""
import argparse,base64,json,re,subprocess
from pathlib import Path

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--asset',type=Path,default=Path(__file__).resolve().parents[1]/'fred/assets/audio.js')
args=p.parse_args();source=args.asset.read_text()
data=json.loads(source[source.index('=')+1:].strip().rstrip(';'))['music']
assert data['encoding']=='mp3' and 0<data['loopStart']<data['loopEnd']
raw=base64.b64decode(data['data'])
result=subprocess.run(['ffmpeg','-hide_banner','-nostdin','-i','pipe:0','-af','aresample=48000,volumedetect','-f','null','-'],
                      input=raw,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=True)
log=result.stderr.decode();value=lambda key:float(re.findall(rf'{key}:\s*([-\d.]+)',log)[-1])
mean=value('mean_volume');peak=value('max_volume');duration=value('n_samples')/48000
assert mean>-40 and peak>-30,f'Shipped music is silent or inaudible: mean={mean} dBFS, peak={peak} dBFS'
assert duration>data['loopEnd'],f'Music loop ends outside the decoded buffer: {duration} <= {data["loopEnd"]}'
print(f'PASS shipped MP3: mean {mean} dBFS, peak {peak} dBFS, {duration:.3f}s; loop ends inside the buffer.')
