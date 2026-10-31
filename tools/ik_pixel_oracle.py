"""Capture isolated P0PF contacts in the original Atari800 GTIA. Offline only.

Use a private ATR copy and a PAL loaded state stopped at $2FB6. The actor and
projectile routine run in original code; only their subsequent motion is frozen.
Requires the development Atari800 DUMPSCREEN-capable build used by the project.
"""
import sys,random,re,json,gzip,argparse,hashlib,shutil,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from karateka_capture import Capture
from ik_extract import ROOT,SHA
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--emulator',required=True,type=Path);p.add_argument('--state',required=True,type=Path);p.add_argument('--output',type=Path,default=ROOT/'research/international-karate/weapon-pixel-oracle.json.gz');args=p.parse_args()
assert hashlib.sha256((ROOT/'International Karate.atr').read_bytes()).hexdigest()==SHA
work=tempfile.TemporaryDirectory(prefix='ik-pixels-');image=Path(work.name)/'source.atr';shutil.copyfile(ROOT/'International Karate.atr',image)
rng=random.Random(0x388a);cases=[]
m=Capture(args.emulator,image)
try:
 for i in range(96):
  f=rng.choice((0,17,23,32,20,25,39));facing=rng.randrange(2);pos=rng.randrange(55,151);height=rng.choice((10,16,24,32,40,48,56));kind=rng.randrange(3);direction=rng.randrange(2)
  m.load_state(args.state);m.prompt('bline 999');m.prompt('bpc ffff');m.prompt('c 2780 60');m.prompt('c 615d 00');m.prompt(f'c dd {f:02x}');m.prompt('c e0 54');m.prompt(f'c e2 {facing:02x}');m.prompt('c d1 00');m.prompt('c d2 00');m.prompt('r 2f0d');m.prompt('r 2f0d');m.prompt('r 586f')
  m.prompt('c 6153 00');m.prompt(f'c 6156 {height:02x}');m.prompt(f'c 6159 {pos:02x}');m.prompt(f'c 615b {direction:02x}');m.prompt(f'c 615c {kind:02x}');m.prompt(f'r {[0x595a,0x59e0,0x5a37][kind]:04x}')
  m.prompt('setpc 9f00');m.prompt('c 9f00 4c 00 9f');m.prompt('c d01e 00');m.prompt('bline 0');m.prompt('cont');m.prompt('bline 248');m.prompt('cont');out=m.prompt('m d004');mask=int(re.search(r'D004: ([0-9A-F]{2})',out)[1],16)
  cases.append({'fighter':{'frame':f,'facing':-1 if facing else 1,'origin':84},'kind':kind,'height':height,'pos':pos,'dir':direction,'mask':mask})
  if i%24==23:print('Captured',i+1,'GTIA contacts',flush=True)
finally:m.close();work.cleanup()
args.output.write_bytes(gzip.compress(json.dumps(cases,separators=(',',':')).encode(),mtime=0))
