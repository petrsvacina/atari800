"""Development-only Atari800 oracle for the supplied Boulder Dash ATR."""
import re
import tempfile
from pathlib import Path
from boulder_extract import ROOT, SHA, autorun
from goonies_extract_physics import XexMonitor

FIELDS = {
 'rng0':0x781,'rng1':0x782,'stick':0x788,'amoebaGrowing':0x789,'magicState':0x78a,
 'magicFrames':0x78b,'magicSeconds':0x78c,'enough':0x78d,'amoebaOpen':0x78e,'amoebaWasOpen':0x78f,
 'preSpawn':0x792,'spawnSeconds':0x793,'missing':0x794,'status':0x795,'tone':0x796,'volume':0x797,'pitch':0x798,
 'walkSound':0x799,'explosionTone':0x79a,'explosionVolume':0x79b,'explosionPitch':0x79c,
 'facing':0x79d,'playerX':0x79e,'playerY':0x79f,'amoebaMask':0x7a1,'amoebaCount':0x7a2,'amoebaPrevious':0x7a3,
 'freeze':0x7a4,'scanDelay':0x7a5,'player':0x7a6,'twoPlayers':0x7a7,'won':0x7a8,'gameOver':0x7a9,
 'cave':0x7b7,'level':0x7b8,'lives':0x7b6,'secondsFrame':0x839,'elapsed':0x83a,
 'moving':0x842,'trigger':0x843,'boxFlash':0x844,'flash':0x7ae,'bonusFlash':0x833}
ARRAYS = {'score':(0x7b9,6),'time':(0x836,3),'diamonds':(0x83b,2),'needed':(0x83d,2),'value':(0x7b3,3),'extraValue':(0x83f,3)}


def state(ram):
    return {**{key:ram[a] for key,a in FIELDS.items()},
            **{key:list(ram[a:a+n]) for key,(a,n) in ARRAYS.items()}}


def stream(seed):
    result=[]
    for _ in range(256):
        seed=(seed*1664525+1013904223)&0xffffffff;result.append(seed>>24)
    return bytes(result)


class Original:
    def __init__(self):
        self.temp=tempfile.TemporaryDirectory(prefix='boulder-original-',dir='/private/tmp')
        self.dir=Path(self.temp.name)
        source=self.dir/'autorun.xex';source.write_bytes(autorun())
        self.m=XexMonitor(source)
        self.m.prompt('bpc 2a02');self.m.prompt('cont')
        self.m.prompt('bpc 29fb');self.m.prompt('cont')
        self.m.prompt('c d40e 00')
        self.base=self.read(0,0xbfff)
    def close(self):
        self.m.close();self.temp.cleanup()
    def read(self,start,end):
        path=self.dir/'output.bin';self.m.prompt(f'write {start:04x} {end:04x} {path}');return path.read_bytes()
    def load(self,data,start=0):
        path=self.dir/'input.bin';path.write_bytes(data);self.m.prompt(f'read {path} {start:04x} {len(data):04x}')
    def run(self,start,end):
        self.m.prompt(f'setpc {start:04x}');self.m.prompt(f'bpc {end:04x}');out=self.m.prompt('cont')
        assert f'PC={end:04X}' in out,out[-1000:]
    def cave(self,cave=1,level=0,seed=37):
        b=bytearray(self.base);b[0x7b7]=cave;b[0x7b8]=level;b[0x7a0]=255;b[0x7ab]=0;b[0x7b6]=3
        b[0x7b9:0x7bf]=bytes(6);b[0x2fc]=0
        self.load(b);self.run(0x2645,0x2671)
        return self.read(0,0xbfff)
    def prepare(self,ram,seed=37):
        b=bytearray(ram)
        stub=bytes.fromhex('8c f4 05 ac f5 05 ee f5 05 b9 00 06 08 ac f4 05 28 60')
        b[0x5a0:0x5a0+len(stub)]=stub;b[0x5f5]=0;b[0x600:0x700]=stream(seed)
        # Only the offline reference replaces POKEY RANDOM; native tests consume
        # the same bytes. VBI scheduling is validated in separate captures.
        for address in range(0xb00,0x2a00):
            if b[address:address+3]==bytes.fromhex('ad 0a d2'):b[address:address+3]=bytes.fromhex('20 a0 05')
        b[0x5d0:0x5d7]=bytes.fromhex('78 20 8f 1d 4c e0 05')
        return b


def load_fixture(name):
    import gzip, json
    return json.loads(gzip.decompress((ROOT/'tools/fixtures'/(name+'.json.gz')).read_bytes()))


def save_fixture(name, value):
    import gzip, json
    data=json.dumps(value,separators=(',',':')).encode()+b'\n'
    (ROOT/'tools/fixtures'/(name+'.json.gz')).write_bytes(gzip.compress(data,mtime=0))
