#!/usr/bin/env python3
"""Extract the supplied Atari Goonies driver and render original audio offline."""
import argparse,base64,hashlib,json,struct,subprocess,tempfile,wave,shutil
from pathlib import Path
from karate_extract_backgrounds import Monitor
ROOT=Path(__file__).resolve().parents[1]
SOURCE_HASH='ccdea8ff8e56b9d09436de1ec64094e2130dee41f2d3d921f8c02f256f16bed7'
FRAME_HZ=1773447/(114*262)
FX_IDS=[i for i in range(1,24) if i not in (8,16,17,18)]


def capture(source):
    with tempfile.TemporaryDirectory(prefix='goonies-audio-') as folder:
        folder=Path(folder);copy=folder/'original.atr';copy.write_bytes(source.read_bytes());m=Monitor(copy)
        try:
            m.prompt('bpc 0786');m.prompt('cont');dump=folder/'ram.bin';m.prompt(f'write 0 bfff {dump}');return dump.read_bytes()
        finally:m.close()


def source_memory(memory):
    if len(memory)!=49152 or memory[0x8A00:0x8A03]!=bytes.fromhex('4c7b8a') or memory[0x8F0C:0x8F0F]!=bytes.fromhex('ad5096'):
        raise ValueError('Expected a loaded Goonies title/game RAM dump, not the initial boot loader.')
    return memory


def make_sap(memory,name,music=None,effect=None):
    code=bytearray()
    def setbyte(address,value):code.extend([0xA9,value,0x8D,address&255,address>>8])
    for address in [0x80,0x81,0x86,0x87,0x9656,0x9657,0x9650,0xD208]:setbyte(address,0)
    setbyte(0xD20F,3)
    if music is not None:
        setbyte(0x88,music&255);setbyte(0x89,music>>8);code.extend(bytes.fromhex('20898e'))
        player=bytes.fromhex('200c8f60')
    else:
        setbyte(0x80,effect);player=bytes.fromhex('20c98a60')
    code.append(0x60);state=bytearray(0x104);state[:len(code)]=code;state[0x100:0x104]=player
    header=f'SAP\r\nAUTHOR "<?>"\r\nNAME "The Goonies original {name}"\r\nDATE "1985"\r\nNTSC\r\nTYPE B\r\nFASTPLAY 262\r\nINIT 0200\r\nPLAYER 0300\r\nTIME 02:00.00\r\n'.encode()+b'\xff\xff'
    # Call only the real audio functions; copy-protection helper $966C and all
    # graphics/game functions are deliberately outside the private wrapper.
    return header+struct.pack('<HH',0x200,0x303)+state+struct.pack('<HH',0x8A00,0x9695)+memory[0x8A00:0x9696]


def render(source,output,length):
    subprocess.run(['/Applications/VLC.app/Contents/MacOS/VLC','-I','dummy','--ignore-config','--no-media-library','--no-video','--no-audio','--play-and-exit',f'--run-time={length}',
                    '--sout',f'#transcode{{acodec=s16l,channels=2,samplerate=44100}}:std{{access=file,mux=wav,dst={output}}}',str(source)],capture_output=True,check=True,timeout=120)


def effect_info(memory,identifier):
    start=int.from_bytes(memory[0x8B1F+(identifier-1)*2:0x8B21+(identifier-1)*2],'little');cursor=start;ticks=0
    while memory[cursor]:ticks+=memory[cursor];cursor+=3
    return start,cursor+2,ticks/FRAME_HZ,memory[cursor+1]!=0


def export(memory):
    memory=source_memory(memory);dest=ROOT/'goonies-web/assets';(dest/'audio').mkdir(parents=True,exist_ok=True)
    notes=ROOT/'research/goonies';notes.mkdir(parents=True,exist_ok=True);ffmpeg=shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'
    result={'sourceSha256':SOURCE_HASH,'encoding':'s16le','sampleRate':22050,'renderFrameHz':FRAME_HZ,'tracks':{},'loops':{},'eventEffects':{'jump':1,'switch':23,'puzzle':3,'hurt':4,'door':6,'exit':20,'clear':9,'life':21,'complete':19},'eventEffectsEvidence':'Native web-port defaults; original numeric effect data, unverified original event callsites.','effects':[]}
    manifest={'sourceSha256':SOURCE_HASH,'musicInit':'8E89','musicPlayer':'8F0C','effectPlayer':'8AC9','renderFastplay':262,'renderFrameHz':FRAME_HZ,'files':[],'effectEvents':'Native port mapping is documented in AUDIO.md.'}
    with tempfile.TemporaryDirectory(prefix='goonies-audio-render-') as tmp:
        tmp=Path(tmp)
        for name,pointer,pattern in [('title',0x8FBE,0x9278),('ingame',0x8FBB,0x8FC1)]:
            ticks=memory[pattern]*(int.from_bytes(memory[pattern+1:pattern+3],'little'))+1
            length=ticks/FRAME_HZ
            sap=notes/(name+'-wrapper.sap');sap.write_bytes(make_sap(memory,name,music=pointer));wav=tmp/(name+'.wav');render(sap,wav,length+.2)
            output=dest/'audio'/(name+'.mp3')
            subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(wav),'-t',str(length),'-af',f'afade=t=in:d=0.003,afade=t=out:st={length-.004}:d=0.004','-c:a','libmp3lame','-b:a','160k','-metadata',f'title=The Goonies original {name}',str(output)],check=True)
            result['tracks'][name]='assets/audio/'+name+'.mp3';result['loops'][name]={'start':0,'end':length}
            manifest['files'].append({'file':output.relative_to(dest).as_posix(),'songList':f'{pointer:04X}','pattern':f'{pattern:04X}','framesPerLoop':ticks,'duration':length,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()})
            print('Rendered',name,length,flush=True)
        for identifier in FX_IDS:
            start,end,length,loop=effect_info(memory,identifier)
            sap=notes/f'effect-{identifier}-wrapper.sap';sap.write_bytes(make_sap(memory,f'effect {identifier}',effect=identifier))
            wav=tmp/f'effect-{identifier}.wav';render(sap,wav,max(.4,length+.15));out=tmp/f'pcm-{identifier}.wav'
            subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(wav),'-t',str(length),'-ar','22050','-ac','1',str(out)],check=True)
            with wave.open(str(out),'rb') as f:pcm=f.readframes(f.getnframes());frames=f.getnframes()
            entry={'id':identifier,'duration':frames/22050,'loop':loop,'sourceStart':f'{start:04X}','sourceEndExclusive':f'{end:04X}'}
            result['effects'].append({**entry,'data':base64.b64encode(pcm).decode()});manifest['files'].append({**entry,'pcmSha256':hashlib.sha256(pcm).hexdigest()})
            print('Effect',identifier,length,'loop',loop,flush=True)
    (dest/'audio.js').write_text('// Original Goonies driver rendered offline; see research/goonies/AUDIO.md.\nglobalThis.GOONIES_AUDIO = '+json.dumps(result,separators=(',',':'))+';\n')
    (dest/'audio/provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--memory',type=Path);args=parser.parse_args()
    source=ROOT/'Goonies/Goonies.atr'
    if hashlib.sha256(source.read_bytes()).hexdigest()!=SOURCE_HASH:raise ValueError('Unexpected original Goonies ATR')
    export(args.memory.read_bytes() if args.memory else capture(source))
