#!/usr/bin/env python3
"""Render original CMC music offline; export the Fred effect envelopes."""
import argparse,array,base64,gzip,hashlib,json,math,re,subprocess,wave
from pathlib import Path
from fred_original import ROOT,SOURCE,SHA,image,processor
from neverstory_capture import Capture

def capture_effects(args):
    image();m=bytearray(args.state.with_suffix('.bin').read_bytes());c=processor(m);m[0xfee]=1
    def call(pc,a=0,irq=False):
        c.a=a;c.p=(c.p&127)|(a&128);c.pc=pc;c.sp=253;c.stPushWord(0xbfe)
        for _ in range(20000):
            if c.pc==(0xe462 if irq else 0xbff):return
            c.step()
        raise RuntimeError(hex(c.pc))
    call(0xf00,128);records=[]
    requests={0:[57],1:[1],2:[2],4:[3,4,5,6,7],9:[25],20:[25],30:[57],40:[8],50:[9],60:[10],70:[11],80:[12],100:[13],110:[14],120:[15],160:[0],200:[25],230:[41]}
    for tick in range(320):
        commands=requests.get(tick,[])
        for command in commands:call(0xf00,command)
        call(0x1032,irq=True)
        records.append({'commands':commands,'registers':list(m[0xd200:0xd208]),'values':list(m[0x10ce:0x10d2]),
                        'remaining':list(m[0x10d2:0x10d6]),'periods':list(m[0x10d6:0x10da])})
    file=ROOT/'tools/fixtures/fred-effects.json.gz';file.write_bytes(gzip.compress(json.dumps(records).encode(),mtime=0))
    print('Captured 320 original effect-driver frames.',flush=True)

def period():
    m=image();c=processor(m)
    def call(a=0,x=0,y=0,pc=0x9200):
        c.a=a;c.x=x;c.y=y;c.pc=pc;c.sp=0xfd;c.stPushWord(0x0bfe)
        for _ in range(40000):
            if c.pc==0xbff:return
            c.step()
        raise RuntimeError(hex(c.pc))
    call(0x70,0,0x8b);call();seen={}
    for frame in range(30000):
        key=hashlib.sha256(bytes(m[0x8b00:0xa000])+bytes(m[0xd200:0xd209])).hexdigest()
        if key in seen:
            result={'first':seen[key],'repeat':frame,'period':frame-seen[key],'stateSha256':key}
            assert (result['first'],frame,result['period'])==(1537,23809,22272)
            return result
        seen[key]=frame;call(pc=0x9203)
    raise RuntimeError('CMC player did not repeat')

def signal(path):
    """Check recorded samples, not just the file's length or decodability."""
    count=0;squares=0;peak=0
    with wave.open(str(path),'rb') as f:
        assert f.getsampwidth()==2 and f.getnchannels()==1
        duration=f.getnframes()/f.getframerate()
        while block:=f.readframes(65536):
            samples=array.array('h',block);count+=len(samples)
            peak=max(peak,max(map(abs,samples),default=0));squares+=sum(v*v for v in samples)
    rms=math.sqrt(squares/max(1,count))
    if peak<1024 or rms<128:raise ValueError(f'Original music recording is silent or inaudible: peak={peak}, rms={rms:.3f}')
    return {'duration':duration,'samples':count,'peak':peak,'rms':rms,'rmsDbfs':20*math.log10(rms/32768)}

def capture(args):
    verified=period();print('Verified complete original music loop',verified,flush=True)
    args.output.mkdir(parents=True,exist_ok=True)
    m=Capture(args.emulator,SOURCE,audio=True)
    try:
        # Boot with audio enabled. Restoring the gameplay fixture can generate
        # a console OPTION transition and switch the original VBI into effects
        # mode, producing a correctly sized but completely silent recording.
        m.prompt('bpc bf00');m.prompt('cont');m.prompt('setpc 3000')
        m.prompt('bpc 32aa');m.prompt('cont');m.prompt('c 32aa 38 60')
        m.prompt('bpc 2744');m.prompt('cont');m.prompt('c 32aa a5 14')
        m.prompt('bpc ffff');m.prompt('bline 999')
        m.prompt('c 0c00 a9 70 a2 00 a0 8b 20 00 92 a9 00 a2 00 20 00 92 4c 10 0c')
        m.prompt('setpc 0c00');m.prompt('bpc 0c10');m.prompt('cont');m.prompt('bpc ffff')
        repeat=verified['repeat'];frames=repeat+2
        # Two guard VBIs ensure loopEnd is inside the decoded buffer even when
        # the first VCOUNT edge occurs during the already-running frame.
        code=[0xa9,frames&255,0x85,0xfa,0xa9,frames>>8,0x85,0xfb,
          0xad,0x0b,0xd4,0xc9,0x7c,0xb0,0xf9,0xad,0x0b,0xd4,0xc9,0x7c,0x90,0xf9,
          0xa5,0xfa,0xd0,0x02,0xc6,0xfb,0xc6,0xfa,0xa5,0xfa,0x05,0xfb,0xd0,0xe4,0x4c,0x25,0x0c]
        m.prompt('c 0c00 '+' '.join(f'{b:02x}' for b in code));m.prompt('setpc 0c00');m.prompt('bpc 0c25')
        wav=args.output/'music.wav';m.prompt(f'record {wav}');m.prompt('cont');m.prompt('stoprecord')
        mode=args.output/'music-mode.bin';m.prompt(f'write 0fee 0fee {mode}')
        assert mode.read_bytes()==b'\x00','The original VBI left music mode during capture.'
    finally:m.close()
    measured=signal(wav)
    mp3=args.output/'music.mp3'
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-ac','1','-c:a','libmp3lame','-b:a','64k',str(mp3)],check=True)
    duration=measured['duration'];fps=1773447/(312*114)
    assert abs(duration-frames/fps)<.15,(duration,frames/fps)
    assert duration>repeat/fps,'Music loop ends outside the recorded buffer.'
    source=image();asset={'music':{'encoding':'mp3','data':base64.b64encode(mp3.read_bytes()).decode(),
      'loopStart':verified['first']/fps,'loopEnd':repeat/fps},
      'timing':list(source[0x10da:0x10ea]),'envelopes':[list(source[0x10ea+i*32:0x110a+i*32]) for i in range(16)]}
    (ROOT/'fred/assets/audio.js').write_text('// Original CMC music rendered offline and original POKEY effect envelopes.\n'
      'globalThis.FRED_AUDIO='+json.dumps(asset,separators=(',',':'))+';\n')
    version=hashlib.sha256((ROOT/'fred/assets/audio.js').read_bytes()).hexdigest()[:12]
    page=ROOT/'fred/index.html';page.write_text(re.sub(r'assets/audio\.js(?:\?v=[^"\s]+)?',f'assets/audio.js?v={version}',page.read_text()))
    (ROOT/'research/fred/audio.json').write_text(json.dumps({'sourceSha256':SHA,'player':'$9200 initialization, $9203 PAL VBI tick',
      'period':verified,'duration':duration,'wavSha256':hashlib.sha256(wav.read_bytes()).hexdigest(),
      'mp3Sha256':hashlib.sha256(mp3.read_bytes()).hexdigest(),'capture':'fresh audio-enabled boot, original music VBI',
      'recordedVbis':frames,'loopStart':asset['music']['loopStart'],'loopEnd':asset['music']['loopEnd'],
      'signal':measured},indent=2)+'\n')
    print('Rendered original music:',duration,'seconds.',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('emulator','state','output'):p.add_argument('--'+name,type=Path,required=True)
    p.add_argument('--effects-only',action='store_true');args=p.parse_args();capture_effects(args)
    if not args.effects_only:capture(args)
