#!/usr/bin/env python3
"""Package measured display-interval profiles, explicitly not a CPU cost model."""
import argparse,json
from pathlib import Path
from fractalus_original import ROOT,SHA256
p=argparse.ArgumentParser();p.add_argument('--reference',type=Path,default=Path('/private/tmp/fractalus-disk-research'));args=p.parse_args()
profiles={}
for level,name in [(1,'flight-level1-cadence.json'),(4,'flight-cadence.json')]:
    source=json.loads((args.reference/name).read_text());assert source['sourceSha256']==SHA256
    intervals=[s['vbiDeltaLowByte'] for s in source['samples']];assert len(intervals)==80
    profiles[str(level)]={'standard':source['standard'],'intervals':intervals,'minimum':min(intervals),'maximum':max(intervals),'mean':sum(intervals)/len(intervals)}
data={'sourceSha256':SHA256,'status':'Measured no-input PAL profiles, not exact scene-dependent foreground timing. Level4 is a provisional fallback beyond level1. NTSC wall pacing is unverified.','profiles':profiles}
(ROOT/'rescue-on-fractalus/assets/timing.json').write_text(json.dumps(data,indent=2)+'\n')
print('Packaged160 measured original PAL half-pass intervals; full scene-cost timing remains open')
