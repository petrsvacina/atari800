#!/usr/bin/env python3
"""Extract named initialized game data, never code or a full machine image."""
import argparse,hashlib,json,re
from pathlib import Path
from fractalus_original import ROOT,SHA256,MAIN_SHA256,files

MODULES=[('flight.mjs','FLIGHT_FIELDS'),('flight-services.mjs','SERVICE_FIELDS'),
 ('systems.mjs','SYSTEM_FIELDS'),('rescue.mjs','RESCUE_FIELDS'),('vbi.mjs','VBI_FIELDS'),
 ('combat.mjs','COMBAT_FIELDS'),('sprites.mjs','SPRITE_FIELDS'),('lifecycle.mjs','LIFECYCLE_FIELDS')]
ARRAYS={'eventRing':(0x719,32),'horizonCells':(0x2159,80),'paletteParams':(0xcf,16),
 'savedPalette':(0x7e9,16),'messageCells':(0x32b7,14),'scoreCells':(0x32c5,6),
 'lockCells':(0x3492,6),'energyCells':(0xd98,64)}
ARRAYS['terrainScreenSpans']=(0x28b6,32)
THRUST=[0x3392,0x33c2,0x33c3,0x33f3,0x3423,0x3424,0x3454,0x3484,0x3485,0x34b5,0x34e5,0x34e6]

def fields():
    result={}
    for filename,symbol in MODULES:
        path=ROOT/'rescue-on-fractalus'/filename
        if not path.exists():continue
        text=path.read_text();match=re.search(r'export const '+symbol+r'\s*=\s*\{(.*?)\};',text,re.S)
        if not match:raise ValueError(f'Missing metadata {filename}:{symbol}')
        for key,address,width in re.findall(r'(\w+)\s*:\s*\[\s*(0x[0-9a-f]+)\s*,\s*([123])\s*\]',match[1]):
            value=(int(address,16),int(width))
            if key in result and result[key]!=value:raise ValueError(f'Conflicting field {key}')
            result[key]=value
    return result

def read_state(m,metadata=None):
    result={k:int.from_bytes(m[a:a+w],'little') for k,(a,w) in (metadata or fields()).items()}
    result.update({k:list(m[a:a+n]) for k,(a,n) in ARRAYS.items()})
    result['history']=[list(m[0x2893+j*7:0x289a+j*7]) for j in range(5)]
    result['thrustCells']=[m[a] for a in THRUST]
    result['score']=sum(((v>>4)*10+(v&15))*100**(3-i) for i,v in enumerate(m[0x600:0x604]))
    result['pendingScore']=0
    result['projectedX']=[m[0x2400+i]+256*m[0x242d+i] for i in range(45)]
    result['projectedY']=[m[0x245a+i]+256*m[0x2487+i] for i in range(45)]
    return result

def extract(path):
    m=path.read_bytes();assert len(m)==65536
    assert hashlib.sha256(m[0x3cde:0x3cde+31500]).hexdigest()==MAIN_SHA256
    metadata=fields()
    return {'state':read_state(m,metadata),'world':{'terrain':list(m[0x900:0xa00]),'objects':list(m[0xa00:0xb00]),'visibleCells':list(m[0x2276:0x22a3])},
      'sound':{'parameters':list(m[0x65d:0x714]),'registers':list(m[0xd200:0xd209]),
       **{k:m[a] for k,a in [('head',0x73),('tail',0x74),('topPriority',0x714),('topIndex',0x715),('scanPriority',0x716),('nextIndex',0x717),('expired',0x718)]}},
      'spritePmg':{name:list(m[a:a+256]) for name,a in [('missiles',0xb00),('p0',0xc00),('p1',0xd00),('p2',0xe00),('p3',0xf00)]}}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--reference',type=Path,default=Path('/private/tmp/fractalus-disk-research/flight-init.bin'))
    p.add_argument('--output',type=Path,default=ROOT/'rescue-on-fractalus/assets/bootstrap.json');args=p.parse_args()
    files();data=extract(args.reference)
    data.update(sourceSha256=SHA256,source='First original flight-loop entry; named initialized data only',schema=1)
    args.output.write_text(json.dumps(data,separators=(',',':'))+'\n')
    print(f'Extracted {len(fields())} native scalar fields, HUD/voice data and map into {args.output.stat().st_size} bytes')
