#!/usr/bin/env python3
"""Measure PAL VBI intervals between consecutive original Fred frame entries."""
import argparse,json
from pathlib import Path
from fred_original import ROOT,SOURCE,image
from neverstory_capture import Capture
p=argparse.ArgumentParser(description=__doc__)
for name in ('emulator','reference'):p.add_argument('--'+name,type=Path,required=True)
args=p.parse_args();image();m=Capture(args.emulator,SOURCE)
try:
    m.prompt(f'loadstate {args.reference}/frame.a8s');m.prompt('bpc 2758');m.prompt('bline 999');ticks=[]
    for i in range(25):
        file=args.reference/'clock.bin';m.prompt(f'write 0012 0014 {file}');ticks.append(int.from_bytes(file.read_bytes(),'big'))
        if i<24:m.prompt('cont')
    intervals=[b-a for a,b in zip(ticks,ticks[1:])];warmup=intervals.pop(0);assert warmup==0 and set(intervals)=={3}
    result={'standard':'PAL','clockHz':1773447,'scanlines':312,'cyclesPerLine':114,
            'initialBreakpointReentryVbis':warmup,'logicalVbiIntervals':intervals,'logicalHz':1773447/(312*114*3)}
    (ROOT/'research/fred/timing.json').write_text(json.dumps(result,indent=2)+'\n');print(result)
finally:m.close()
