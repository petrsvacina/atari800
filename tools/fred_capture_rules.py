#!/usr/bin/env python3
"""Development-only frame/routine fixtures executed by the supplied Fred XEX."""
import argparse,json
from pathlib import Path
from fred_original import Original,ROOT,SHA

def capture(args):
    cases=[]
    sequences={'idle':[15]*80,'right':[7]*260,'left':[11]*110,
      'jump-right':[6]*180,'jump-left':[10]*100,'climb':[14]*100,
      'down':[13]*100,'combat':[7]*45+[6]*50+[11]*30+[15]*40}
    for level in range(10):
        for name,sequence in sequences.items():
            ref=Original(args.memory,level);start=ref.state();frames=[]
            for n,stick in enumerate(sequence):
                fire=name=='combat' and n%7<3
                ref.frame(stick,fire,85)
                state=ref.state();frames.append({'stick':stick,'fire':fire,'state':state})
                if state['transitions']:break
            cases.append({'name':f'{level}-{name}','level':level,'start':start,'frames':frames})
    args.output.write_text(json.dumps({'sourceSha256':SHA,'cases':cases},separators=(',',':')))
    print('Captured',len(cases),'sequences,',sum(len(c['frames']) for c in cases),'original frames.')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',type=Path,required=True);p.add_argument('--output',type=Path,required=True);capture(p.parse_args())
