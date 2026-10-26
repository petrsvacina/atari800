#!/usr/bin/env python3
"""Record original foreground updates with the real raster collision feedback."""
import argparse,base64,hashlib,json,re,zlib
from pathlib import Path
from goonies_extract_physics import XexMonitor
from hero_extract import ROOT,SHA

code=(ROOT/'hero/engine.js').read_text()
fields={k:int(v,16) for k,v in re.findall(r'(\w+):(0x[0-9a-f]+)',code.split('const fields=')[1].split(';')[0])}
arrays={k:(int(v,16),int(n)) for k,v,n in re.findall(r'(\w+):\[(0x[0-9a-f]+),(\d+)\]',code.split('const arrays=')[1].split(';')[0])}
def snapshot(b):
    def bcd(v):return (v>>4)*10+(v&15)
    s={k:b[p] for k,p in fields.items()}
    s.update({k:list(b[p:p+n]) for k,(p,n) in arrays.items()})
    s.update(upper=[b[p] for p in [0x42,0x41,0x40]],lower=[b[p] for p in [0x45,0x44,0x43]],tiles=list(b[0x2043:0x214b]),score=bcd(b[0x1e])*10000+bcd(b[0x1f])*100+bcd(b[0x20]))
    return s
def capture():
    parser=argparse.ArgumentParser();parser.add_argument('--extended',action='store_true');parser.add_argument('--retry-rescues',action='store_true');args=parser.parse_args()
    if args.retry_rescues:args.extended=True
    source=ROOT/'H.E.R.O..xex';assert hashlib.sha256(source.read_bytes()).hexdigest()==SHA
    m=XexMonitor(source);dump=Path('/private/tmp/hero-game.bin');cases=[]
    def read():m.prompt(f'write 0000 bfff {dump}');return dump.read_bytes()
    try:
        m.prompt('bpc 8177');m.prompt('cont');m.prompt('c 81fc a9 06 ea');m.prompt('cont')
        m.prompt('c 81fc a9 07 ea');m.prompt('c 818c a9 07 ea')
        for p in [0x97d6,0x97e7,0x97f8,0x9809,0x981a,0x982b,0x8987,0x8e84]:m.prompt(f'c {p:04x} a9 00 ea')
        # Complete initialization before recording one foreground pass per frame.
        m.prompt('c 8177 a2 ff ea');m.prompt('cont');m.prompt('cont')
        m.prompt('savestate /private/tmp/hero-game-base.a8s')
        configs=[{'level':0,'room':0,'naturalStart':True,'count':480}]
        configs += [{'level':level,'room':room,'count':120} for level,room in [(0,0),(0,1),(1,1),(3,3),(8,9),(9,11),(12,15),(13,11),(16,8),(16,11),(19,15)]]
        if args.extended:
            b=read();configs=[{'level':0,'room':0,'naturalStart':True,'count':1200,'replay':True}]
            configs += [{'level':level,'room':room,'count':64,'canonical':True} for level in range(20) for room in range(b[0xad28+level]+1)]
            configs += [{'level':level,'room':b[0xad28+level],'count':440,'rescue':True} for level in range(20)]
            if args.retry_rescues:
                previous=json.loads(zlib.decompress(base64.b64decode(json.loads((ROOT/'tools/fixtures/hero-game-extended.json').read_text())['cases'])))
                configs=[c['config']for c in previous if c['config'].get('rescue') and not any(f['state']['rescue']for f in c['frames'])]
        for case,config in enumerate(configs):
            m.prompt('loadstate /private/tmp/hero-game-base.a8s')
            if not config.get('naturalStart'):
                for p,v in [(0x7e,config['level']),(0x8e,config['level']),(0x22,config['room']),(0x24,config['room']),(0x8a,255),(0x33,0),(0x25,49),(0x21,80),(0x26,61),(0x6a,31)]:m.prompt(f'c {p:02x} {v:02x}')
                if config.get('canonical') or config.get('rescue'):
                    flags=b[0xac00+b[0xad00+config['level']]+config['room']];wall=(flags&0xfc)|1 if flags&0xfc else 0
                    m.prompt(f'c 26 {wall:02x}')
                if config.get('rescue'):
                    m.prompt('c 25 5b');m.prompt(f'c 21 {76 if flags&0xfc==8 else 180:02x}');m.prompt('c 31 51');m.prompt('c 35 ff')
                m.prompt('setpc 8472');m.prompt('cont')
            initial=snapshot(read());frames=[]
            for tick in range(config['count']):
                stick=[15,7,15,11,14,6,15,13][(tick//24)%8]
                fire=tick%96<64
                if config.get('replay'):stick=15 if tick<80 or tick>=1000 else 7 if tick<700 else 11;fire=tick>=80
                if config.get('rescue'):stick=15;fire=False
                m.prompt(f'c 8177 a2 {stick|0xf0:02x} ea')
                for p in [0x8182,0x88ca,0x8e53]:m.prompt(f'c {p:04x} a9 {0 if fire else 1:02x} ea')
                m.prompt('cont');frames.append({'stick':stick,'fire':fire,'state':snapshot(read())})
            cases.append({'config':config,'initial':initial,'frames':frames});print('Captured H.E.R.O. foreground',case,config,flush=True)
    finally:m.close()
    target=ROOT/'tools/fixtures'/('hero-game-extended.json' if args.extended else 'hero-game.json')
    if args.retry_rescues:
        replacements={c['config']['level']:c for c in cases}
        cases=[replacements.get(c['config']['level'],c)if c['config'].get('rescue')else c for c in previous]
    target.write_text(json.dumps({'sourceSha256':SHA,'encoding':'zlib+base64 JSON','cases':base64.b64encode(zlib.compress(json.dumps(cases,separators=(',',':')).encode(),9)).decode()},separators=(',',':'))+'\n')
if __name__=='__main__':capture()
