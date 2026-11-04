#!/usr/bin/env python3
"""Export original Fred tables, maps, pixels and level art; no CPU shipped."""
import argparse,base64,hashlib,json
from pathlib import Path
from fred_original import ROOT,SHA,SOURCE,Original,image


def extract(args):
    original=image();template=Path(args.memory).read_bytes();assert len(template)==65536
    b64=lambda b:base64.b64encode(bytes(b)).decode()
    pointers=[template[0xb700+i]+256*template[0xb800+i] for i in range(256)]
    chunks=[]
    for p in pointers:
        if not p:chunks.append(None);continue
        out=[];start=p
        while len(out)<128:
            raw=template[p];p+=1;tile=((raw>>1)&63)|(raw&128);out.append(tile)
            if raw&1:
                count=template[p];p+=1
                out.extend([0 if tile==128 else tile]*(count-1))
        assert len(out)==128,(hex(start),len(out))
        chunks.append(out)
    levels=[]
    for level in range(10):
        ref=Original(args.memory,level);m=ref.memory
        levels.append({'colors':list(m[0x2c0:0x2c9]),'foreground':b64(m[0x5800:0x6000]),
                       'animation':b64(m[0x5000:0x5800]),'speed':list(m[0x2e6a:0x2e7a]),
                       'initial':ref.state()})
    result={'sourceSha256':SHA,'palette':list((ROOT/'research/neverending-story/default.act').read_bytes()),
            'chunks':chunks,'levels':levels,'classes':list(original[0x60c0:0x6100]),
            'sprites':b64(template[0x4000:0x4800]),'heroFrames':list(original[0x2595:0x2615]),
            'jumpCurve':list(original[0x261d:0x2641]),'rockCurve':list(original[0x1d00:0x1d13]),
            'stoppedRockDelta':original[0x1d80],
            'deathFrames':list(original[0x2615:0x261d]),'bonusDistribution':list(original[0x1d13:0x1d23]),
            'milestones':list(original[0x1d37:0x1d41]),'levelsAfterDeath':list(original[0x1d42:0x1d4c]),
            'animationOffsets':list(original[0x2e9b:0x2eab]),'hud':list(template[0x6000:0x60b4]),
            'bonusByLevel':list(original[0x1d72:0x1d7c]),
            'hudColors':list(original[0x1d7c:0x1d80]),
            'progress':list(original[0x1dac:0x1dcc]),
            'hudFont':b64(template[0x4800:0x5000])}
    target=ROOT/'fred/assets';target.mkdir(parents=True,exist_ok=True)
    (target/'data.js').write_text('// Original Fred game data and pixels; no 6502 program or CPU runtime.\n'
        'globalThis.FRED_DATA='+json.dumps(result,separators=(',',':'))+';\n')
    from extract_assets import png
    reference=Path(args.memory).parent;palette=bytes(result['palette'])
    for name,capture,rect,transparent in [('title','menu',(32,0,320,240),False),
            ('logo','menu',(70,76,248,60),True),('ending','ending',(32,0,320,240),False)]:
        file=reference/f'{capture}.screen'
        if not file.exists():continue
        screen=file.read_bytes();assert len(screen)==384*240;x,y,width,height=rect
        colors=[screen[(y+j)*384+x+i] for j in range(height) for i in range(width)]
        png(target/f'{name}.png',width,height,b''.join(palette[v*3:v*3+3]+bytes([0 if transparent and not v else 255]) for v in colors))
    research=ROOT/'research/fred';research.mkdir(parents=True,exist_ok=True)
    (research/'source.json').write_text(json.dumps({'source':SOURCE.name,'sha256':SHA,'chunks':sum(c is not None for c in chunks),
        'levels':10,'developmentReference':'Atari800 RAM before first frame; original level initializer via offline py65',
        'dataSha256':hashlib.sha256((target/'data.js').read_bytes()).hexdigest()},indent=2)+'\n')
    print('Extracted ten original level configurations and',sum(c is not None for c in chunks),'original map chunks.')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',type=Path,required=True);extract(p.parse_args())
