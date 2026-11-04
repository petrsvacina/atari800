"""Development-only reference for the supplied Fred XEX. Never a web runtime."""
from pathlib import Path
import hashlib
import sys

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'Fred (CZ) (Font 1).xex'
SHA='244238f9508a1bf061d263b448e660ceffaf8a3a01b77777e059575d9b100269'
FIELDS={'chunk':0xa0,'camera':0xa3,'scroll':0xa6,'tick':0xa8,'x':0xa9,'y':0xaa,
        'facing':0xab,'animation':0xac,'motion':0xad,'pose':0xae,'jumpDirection':0xaf,
        'jumpPhase':0xb0,'previousX':0xb3,'previousY':0xb4,'projectileX':0xb7,'projectileY':0xb8,
        'projectilePhase':0xbb,'projectileDX':0xbc,'weapon':0xc0,'bonus':0xc1,'bonusClock':0xc2,
        'dying':0xc5,'deathBits':0xc6,'respawn':0xc7,'fuel':0xc8,'hat':0xc9,'stones':0xca,
        'blast':0xcb,'shield':0xcc,'boots':0xcd,'dropQuota':0xce,'level':0xd0,'triggerReleased':0xd1,
        'lives':0xd2,'demo':0xd3,'invulnerability':0xde}


def image():
    data=SOURCE.read_bytes();assert hashlib.sha256(data).hexdigest()==SHA
    memory=bytearray(65536);a=0
    while a<len(data):
        start=int.from_bytes(data[a:a+2],'little');a+=2
        if start==65535:continue
        end=int.from_bytes(data[a:a+2],'little');a+=2
        assert end>=start and a+end-start+1<=len(data)
        memory[start:end+1]=data[a:a+end-start+1];a+=end-start+1
    return memory


def processor(memory):
    try:from py65.devices.mpu6502 import MPU
    except ImportError:
        for p in ('/private/tmp/shift-oracle-deps','/private/tmp/karateka-python'):
            if Path(p,'py65/devices/mpu6502.py').is_file():sys.path.insert(0,p);break
        from py65.devices.mpu6502 import MPU
    return MPU(memory=memory)


class Bus:
    def __init__(self,data):
        self.data=bytearray(data);self.random=128;self.collisions=[0]*16;self.writes={}
    def __getitem__(self,key):
        if isinstance(key,slice):return self.data[key]
        if 0xd000<=key<0xd010:return self.collisions[key-0xd000]
        if key==0xd20a:return self.random
        return self.data[key]
    def __setitem__(self,key,value):
        if isinstance(key,slice):self.data[key]=value;return
        if 0xd000<=key<0xd010:self.writes[key]=value;return
        self.data[key]=value


class Original:
    def __init__(self,memory,level=0):
        image() # Validate the authority even when using a reference RAM capture.
        self.memory=Bus(Path(memory).read_bytes());assert len(self.memory.data)==65536
        self.cpu=processor(self.memory);self.sounds=[];self.transitions=[]
        self.memory[0xd0]=level;self.memory[0xd3]=0;self.memory[0x11]=0xff
        self.memory[0x284:0x286]=bytes([1,1]);self.memory[0x278:0x27c]=bytes([15]*4)
        self.call(0x15b5);self.call(0x149a);self.call(0x1647)
        self.cpu.pc=0x2758;self.cpu.sp=0xfd
    def ret(self):self.cpu.pc=(self.cpu.stPopWord()+1)&65535
    def step(self):
        c=self.cpu
        if c.pc==0x14f5:self.ret()
        elif c.pc==0x2782:c.pc=0x2789
        elif c.pc==0x279b:c.pc=0x27a2
        elif c.pc==0x2867:c.pc=0x2758
        elif c.pc==0x0f00:
            self.sounds.append(c.a);self.ret()
        else:c.step()
    def call(self,address):
        c=self.cpu;c.sp=0xfd;self.memory[0x1fe:0x200]=bytes((0xfe,0x0b));c.pc=address
        for _ in range(1000000):
            if c.pc==0x0bff:return
            self.step()
        raise RuntimeError(f'Original routine did not return: ${c.pc:04x}')
    def frame(self,stick=15,fire=False,random=128,collisions=None):
        m=self.memory;m.random=random;m.collisions=collisions or [0]*16
        m[0x278:0x27c]=bytes([stick]*4);m[0x284:0x286]=bytes([int(not fire)]*2)
        m[0xd300]=0xf0|stick;m[0x14]=(m[0x14]+3)&255;m[0x21c]=0;m[0x2fc]=255
        self.cpu.pc=0x2758;self.sounds=[];self.transitions=[]
        self.step()
        for _ in range(1000000):
            if self.cpu.pc==0x2758:return
            if self.cpu.pc in (0x14fc,0x1647,0x13b0):self.transitions.append(self.cpu.pc)
            self.step()
        raise RuntimeError(f'Original frame did not settle: ${self.cpu.pc:04x}')
    def state(self):
        m=self.memory
        return {**{name:m[a] for name,a in FIELDS.items()},'terrain':list(m[0xb300:0xb500]),
                'inventory':list(m[0x1d23:0x1d2b]),'inventoryBlink':list(m[0x1d2d:0x1d35]),
                'phase':list(m[0x2e7b:0x2e8b]),'clock':list(m[0x2e8b:0x2e9b]),
                'score':list(m[0x96:0x99]),'highScore':list(m[0x99:0x9c]),
                'threshold':list(m[0x9c:0x9f]),'sounds':self.sounds,'transitions':self.transitions}
