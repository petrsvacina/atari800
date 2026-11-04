#!/usr/bin/env python3
"""Development-only oracle executing the supplied compiled Czech routines.

Requires a full 64 KiB reference RAM captured at the first INPUT (see capture
instructions in research). py65 is a development dependency, never a web asset.
Only text/disk/audio/input boundaries are intercepted; conditions, assignments,
subroutine calls and jumps execute their original 6502 instructions.
"""
import argparse
import gzip
import json
from pathlib import Path
import random
import sys
from neverstory2_extract import files
from neverstory2_program import czech, CS_VARS, bcd


def encode(value):
    if not value:return bytes(6)
    digits=str(abs(int(value))); power=(len(digits)-1)//2
    text=digits.zfill(power*2+2).ljust(10,'0')
    return bytes([0x40+power+(128 if value<0 else 0),*[int(text[i:i+2],16) for i in range(0,10,2)]])


class Reference:
    def __init__(self, ram, part):
        from py65.devices.mpu6502 import MPU
        self.cpu=MPU(memory=bytearray(ram));self.memory=self.cpu.memory;self.part=part
        data=files('cs')[f'GAMES{part}.CTB'];self.memory[0x226f:0x226f+len(data)-8]=data[8:]
        self.mapping=czech(part)[1];self.events=[];self.image=None
    def variables(self):
        return {name:bcd(bytes(self.memory[0xd800+index+256*i] for i in range(6)))
                for index,name in CS_VARS[self.part].items() if name!='P$'}
    def set_variables(self, values):
        for index,name in CS_VARS[self.part].items():
            if name=='P$':continue
            for i,b in enumerate(encode(values.get(name,0))):self.memory[0xd800+index+256*i]=b
    def ret(self):self.cpu.pc=self.cpu.stPopWord()+1
    def literal(self,address):return bytes(self.memory[address+1:address+1+self.memory[address]]).decode('latin1')
    def run(self,start,command=None):
        m=self.cpu;m.pc=start;m.sp=0xff;self.events=[];self.image=None
        first_input=True; input_index=next(i for i,n in CS_VARS[self.part].items() if n=='P$')
        if command is not None:
            # Execute the actual string INPUT conversion/assignment, feeding
            # only its E: line-read boundary with a deterministic input record.
            m.pc=0xf196;m.x=input_index;m.stPushWord(0x11ff)
            for budget in range(10000):
                if m.pc==0x1200:break
                if m.pc==0xf134:
                    raw=command.encode('latin1')+b'\x9b';self.memory[0x1100:0x1100+len(raw)]=raw
                    self.memory[0x88]=m.x;self.memory[0xf2]=0;self.memory[0xf3]=0;self.memory[0xf4]=0x11
                    self.ret()
                else:m.step()
            else:raise RuntimeError('Original INPUT assignment did not return')
            m.pc=start;m.sp=0xff
        for budget in range(300000):
            pc=m.pc
            if pc==0xf196:return {'phase':'input','room':self.mapping['inputAddresses'].index(self.cpu.stPopWord()-2)+1}
            if self.memory[pc:pc+3]==bytes.fromhex('adfc02'):return {'phase':'pause'}
            if pc==0xf98b:
                address=self.memory[0xd4]+256*self.memory[0xd5]
                return {'phase':'run','file':bytes(self.memory[address:address+self.memory[0xd6]]).decode('latin1')}
            if pc==0xecab:self.events.append(['text',self.literal(m.a+256*m.y)]);self.ret()
            elif pc in (0xedef,0xedeb):self.events.append(['text','\n']);self.ret()
            elif pc==0xedf4:self.events.append(['clear']);self.ret()
            elif pc==0xedbf:self.events.append(['position',m.a,m.x]);self.ret()
            elif pc==0xee4a:
                address=self.memory[0xd4]+256*self.memory[0xd5]
                text=bytes(self.memory[address:address+self.memory[0xd6]]).decode('latin1')
                if text.endswith('.MIC'):self.image=text.split(':')[-1]
                self.ret()
            elif pc in (0xeee8,0xef4b,0xeac1,0xff6b,0xcac1,0xfa0f,0xeda2,0xed2e,0x2157):self.ret()
            else:m.step()
        raise RuntimeError(f'Original command did not settle: ${m.pc:04x}')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--memory',type=Path,required=True);parser.add_argument('--memory2',type=Path,required=True)
    parser.add_argument('--py65-path',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True);parser.add_argument('--quick',action='store_true')
    args=parser.parse_args();sys.path.insert(0,str(args.py65_path))
    cases=[];rng=random.Random(20211104)
    for part in (1,2):
        ram=(args.memory if part==1 else args.memory2).read_bytes();assert len(ram)==65536
        program,mapping=czech(part)
        for room,input_address in enumerate(mapping['inputAddresses'],1):
            # Candidate strings come from the actual predicates in this room,
            # plus carried-item examination and unknown/empty input.
            op_start=program['inputs'][room-1] if 'inputs' in program else next(i for i,op in enumerate(program['ops']) if op[:2]==['input',room])
            next_start=next((i for i,op in enumerate(program['ops']) if i>op_start and op[0]=='input'),len(program['ops']))
            strings=[]
            def visit(e):
                if not isinstance(e,list):return
                if e[0]=='s':strings.append(e[1])
                else:
                    for x in e[1:]:visit(x)
            for op in program['ops'][op_start:next_start]:
                if op[0]=='if':visit(op[1])
            commands=sorted(set(strings+['','xyz','i','inv','p','sit','s','j','v','z']))
            for sample in range(1 if args.quick else 8):
                values={name:(0 if sample==0 else [0,1,99,-1][(sample-1)%4] if sample<5 else rng.choice([0,1,99,-1]))
                        for name in CS_VARS[part].values() if name!='P$'}
                for command in commands:
                    ref=Reference(ram,part);ref.set_variables(values)
                    outcome=ref.run(input_address+3,command)
                    cases.append({'part':part,'room':room,'variables':values,'command':command,'outcome':outcome,
                                  'result':ref.variables(),'events':ref.events,'image':ref.image,'color':ref.memory[708]})
        print('Original part',part,'cases',len(cases),flush=True)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with gzip.open(args.output,'wt',encoding='utf8') as f:json.dump({'cases':cases},f,separators=(',',':'))
    print('Recorded',len(cases),'original command results:',args.output)


if __name__=='__main__':main()
