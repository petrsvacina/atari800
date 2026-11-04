#!/usr/bin/env python3
"""Exercise original Fred pickups, weapons, protection and actor events offline."""
import argparse,json
from pathlib import Path
from fred_original import Original,FIELDS,SHA

def capture(args):
    cases=[]
    def ref(level=0):
        r=Original(args.memory,level);r.memory.random=85;r.sounds=[];return r
    def patch(r,**kwargs):
        for k,v in kwargs.items():r.memory[FIELDS[k]]=v
    def record(name,r,action,run,params=None):
        start=r.state()
        if action=='protection':start['playerColors']=list(r.memory[0x2c0:0x2c4])
        r.sounds=[];run();state=r.state()
        if action=='protection':state['playerColors']=list(r.memory[0x2c0:0x2c4])
        cases.append({'name':name,'action':action,'params':params or {},'start':start,'state':state})
    for type in [0,1,2,3,4,5,6,8]:
        for inventory in [[],[0,1,2,5,6],[0,0,1,1,2,2,5,6]]:
            r=ref();m=r.memory;patch(r,bonus=type,stones=0,fuel=0,hat=0)
            m[0x1d23:0x1d2b]=bytes((inventory+[128]*8)[:8]);m[0xb300+3*64+12]=7;m[0xa1]=12;m[0xa2]=3
            def run():r.cpu.a=7;r.cpu.x=7;r.cpu.y=16;r.call(0x1f7e)
            record(f'pickup-{type}-{len(inventory)}',r,'pickup',run,{'col':12,'row':3})
    for hat in [0,1,2,3]:
        for shield in [0,1,199,255]:
            for invul in [0,1,2,32]:
                for inventory in [[],[0,0,5,5]]:
                    r=ref();patch(r,hat=hat,shield=shield,invulnerability=invul);r.memory[0x1d23:0x1d2b]=bytes((inventory+[128]*8)[:8]);r.memory.collisions[4]=8
                    record(f'protection-{hat}-{shield}-{invul}-{len(inventory)}',r,'protection',lambda:r.call(0x19bc),{'mask':8})
    for value in [1,2,3,5,10,80]:
        for score in [0,0x799000,0x999900]:
            r=ref();r.memory[0x96:0x99]=score.to_bytes(3,'big')
            record(f'score-{value}-{score:x}',r,'score',lambda:(setattr(r.cpu,'a',value),r.call(0x1ad3)),{'value':value})
    for level in [0,4,9]:
        for value in [0,1,2,3,4,5,7,8,9,10,11,12,13,14,15,85,127,255]:
            r=ref(level);r.memory.random=value;r.memory[0xa1]=12;r.memory[0xa2]=3;r.memory[0xb300+3*64+12]=6
            record(f'pot-{level}-{value}',r,'pot',lambda:(setattr(r.cpu,'x',6),setattr(r.cpu,'y',16),setattr(r.cpu,'a',6),r.call(0x18bf)),{'random':value,'col':12,'row':3})
    for weapon in [0,1]:
        for facing in [1,2,3]:
            for stock in [0,1,2,10,40]:
                r=ref();patch(r,weapon=weapon,facing=facing,fuel=stock,stones=stock,triggerReleased=1);r.memory[0x2593]=255
                record(f'fire-{weapon}-{facing}-{stock}',r,'fire',lambda:r.call(0x17dc))
    for phase in range(19):
        r=ref();patch(r,projectilePhase=phase,projectileX=90,projectileY=60,projectileDX=254)
        record(f'projectile-{phase}',r,'projectile',lambda:r.call(0x16dd),{'fire':False,'mask':0})
    for tile in range(64):
        for shot in [False,True]:
            r=ref();m=r.memory;m[0xb300:0xb500]=bytes(512);m[0xb300+7*64:0xb500]=bytes([35]*64)
            patch(r,projectilePhase=0 if shot else 128,projectileX=90,projectileY=60,projectileDX=2,
                  triggerReleased=1,bonus=8,dropQuota=4)
            col,row=(10,2) if shot else (9,5);m[0xb300+row*64+col]=tile
            m.collisions[6]=1 if shot else 0
            record(f'frame-tile-{tile}-{shot}',r,'frame',lambda:r.frame(15,False,85,m.collisions),
                   {'stick':15,'fire':False,'collisions':{'hero':0,'projectile':1 if shot else 0}})
    for direction in [15,14,13,6,10]:
        for y in [64,65,79,80,81,127,128]:
            r=ref();m=r.memory;m[0xb300:0xb500]=bytes(512)
            for row in range(8):m[0xb300+row*64+9]=56
            patch(r,x=81,y=y,motion=64,facing=3)
            record(f'climb-{direction}-{y}',r,'frame',lambda:r.frame(direction,False,85),{'stick':direction,'fire':False,'collisions':{'hero':0,'projectile':0}})
    for tile in range(32):
        r=ref();m=r.memory;m[0xb300:0xb500]=bytes(512);m[0xb300+4*64+10]=tile
        patch(r,weapon=1,fuel=40,triggerReleased=1);m.collisions[6]=1
        record(f'spray-hit-{tile}',r,'frame',lambda:r.frame(15,True,85,m.collisions),{'stick':15,'fire':True,'collisions':{'hero':0,'projectile':1}})
    for tile in range(1,32):
        for value in [0,1,128,255]:
            r=ref();m=r.memory;m.random=value;m[0xb300:0xb500]=bytes(512);m[0xb300+3*64+20]=tile
            m[0x2e7b:0x2e8b]=bytes([3]*16);m[0x2e8b:0x2e9b]=bytes([1]*16);patch(r,tick=255)
            # Enter the original actor loop, returning at its keyboard section.
            def run():
                r.cpu.pc=0x27b2;r.cpu.sp=253
                for _ in range(200000):
                    if r.cpu.pc==0x282e:return
                    r.step()
                raise RuntimeError(hex(r.cpu.pc))
            record(f'actor-{tile}-{value}',r,'actors',run,{'random':value})
    for level in range(9):
        r=ref(level);patch(r,chunk=17+16*level,camera=15,respawn=7,y=150,dropQuota=4)
        record(f'next-level-{level}',r,'transition',lambda:r.frame(7,False,85),{'stick':7,'fire':False})
    for raw in range(256):
        for blast in [0,128]:
            r=ref();m=r.memory;m[0xb300:0xb500]=bytes(512);m[0xb300+3*64+20]=raw
            m[0x2e7b:0x2e8b]=bytes([3]*16);m[0x2e8b:0x2e9b]=bytes([1]*16);patch(r,tick=255,blast=blast)
            def run():
                r.cpu.pc=0x27b2;r.cpu.sp=253
                for _ in range(200000):
                    if r.cpu.pc==0x282e:return
                    r.step()
                raise RuntimeError(hex(r.cpu.pc))
            record(f'actor-byte-{raw}-blast-{blast}',r,'actors',run)
    args.output.write_text(json.dumps({'sourceSha256':SHA,'cases':cases},separators=(',',':')))
    print('Captured',len(cases),'original mechanic cases.',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--memory',type=Path,required=True);p.add_argument('--output',type=Path,required=True);capture(p.parse_args())
