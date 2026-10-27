#!/usr/bin/env python3
"""Render original Archon Atari title, result cue and movement effects offline.

The browser receives only MP3 and PCM. Atari code is executed by VLC/GME only
inside this development exporter; no game/ROM emulator ships with the web port.
"""
import base64
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import wave

ROOT=Path(__file__).resolve().parents[1]
SOURCE_HASH='44be88e99b08731719966cba0b65d1932c48d50c44111749050f8a9a8d7135df'
RENDER_FRAME_HZ=1773447/(114*262)
TARGET_FRAME_HZ=1789790/(114*262)
CLOCK_RATIO=1789790/1773447
RATE_FILTER=f'asetrate={round(44100*CLOCK_RATIO)},aresample=44100'
POINTERS=[0x7AB5,0x7ACE,0x7AD7,0x7AF4,0x7B0D,0x7A7C,0x7A1A,0x7A4B,0x7B2F,0x7B58,0x7B1A,0x7B81]


def loaded_memory():
    source=ROOT/'Archon.xex';data=source.read_bytes()
    if hashlib.sha256(data).hexdigest()!=SOURCE_HASH:raise ValueError('Unsupported Archon.xex')
    if data[:6]!=bytes.fromhex('ffff00301f9c'):raise ValueError('Unexpected XEX segment')
    memory=bytearray(65536)
    # Original $9C00 loader copies this segment down by $2000, then jumps $32EC.
    memory[0x1000:0x7C20]=data[6:27686]
    return memory


def sap(memory,kind,phase=1,pointer=None,script=None):
    memory=bytearray(memory)
    # Original deferred-VBI handlers exit through OS XITVBV. The offline caller
    # already owns its stack: turn only these exits into RTS; sound writes stay.
    for address in range(0x75E0,0x7A1A):
        if memory[address:address+3]==bytes.fromhex('4c62e4'):
            memory[address:address+3]=bytes.fromhex('60eaea')
    code=bytearray.fromhex('a900')
    for address in [0x06A7,0x06AC,0x06AD,0x06AE,0x06AF,0x127A,0x127B,0x1276,0x1277,0x1278,0x1279,0xD208]:
        code+=bytes([0x8D,address&255,address>>8])
    values=[(0x06AB,phase),(0x224,0x2B),(0x225,0x76),(0x06B0,0xA0),(0x06B1,2),(0xD20F,3)]
    if pointer is not None:
        values += [(0xC3,pointer&255),(0xC4,pointer>>8),(0x126E,pointer&255),(0x126F,pointer>>8),(0x1276,0x80)]
    for address,value in values:code+=bytes([0xA9,value,0x8D,address&255,address>>8])
    code+=b'\x60';memory[0x200:0x200+len(code)]=code
    memory[0x2A0]=0x60
    player=bytes.fromhex('6c2402') if pointer is None else bytes.fromhex('206e7960')
    memory[0x2C0:0x2C0+len(player)]=player
    header=f'SAP\r\nAUTHOR "(not identified)"\r\nNAME "Archon original {kind}"\r\nDATE "1983"\r\nNTSC\r\nTYPE B\r\nFASTPLAY 262\r\nINIT 0200\r\nPLAYER 02C0\r\nTIME 00:40.00\r\n'.encode()+b'\xff\xff'
    extra=(struct.pack('<HH',0x800,0x800+len(script)-1)+bytes(script)) if script is not None else b''
    return header+extra+struct.pack('<HH',0x200,0x2C0+len(player)-1)+memory[0x200:0x2C0+len(player)]+struct.pack('<HH',0x1000,0x7C1F)+memory[0x1000:0x7C20]


def render_wav(source,output,seconds):
    vlc='/Applications/VLC.app/Contents/MacOS/VLC'
    subprocess.run([vlc,'-I','dummy','--ignore-config','--no-media-library','--no-video','--no-audio','--play-and-exit',f'--run-time={seconds}',
        '--sout',f'#transcode{{acodec=s16l,channels=2,samplerate=44100}}:std{{access=file,mux=wav,dst={output}}}',str(source)],capture_output=True,check=True,timeout=120)


def script_duration(memory,pointer):
    cursor=pointer;ticks=0
    while cursor<0x7BA0:
        command=memory[cursor];cursor+=1
        if command in (0xFE,0xFF):return ticks/TARGET_FRAME_HZ,command==0xFE,cursor
        if command==0xFD:cursor+=1;continue
        ticks+=command;cursor+=1
    raise ValueError('Unterminated original effect')


def main():
    memory=loaded_memory();dest=ROOT/'archon/assets';(dest/'audio').mkdir(parents=True,exist_ok=True)
    research=ROOT/'research/archon';research.mkdir(parents=True,exist_ok=True)
    ffmpeg=shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'
    effects=[];manifest={'sourceSha256':SOURCE_HASH,'originalDriver':'75E7-7B98','musicPlayer':'762B / 76D7 / 77E3 / 7900','movementPlayer':'796E','renderFastplay':262,'renderFrameHz':TARGET_FRAME_HZ,'rendererFrameHz':RENDER_FRAME_HZ,'clockCorrection':CLOCK_RATIO,'files':[]}
    with tempfile.TemporaryDirectory(prefix='archon-original-audio-') as temp:
        temp=Path(temp)
        for name,phase,renderLength in [('title',1,26.76),('result',5,2.4)]:
            length=renderLength/CLOCK_RATIO
            source=research/(name+'-wrapper.sap');source.write_bytes(sap(memory,name,phase=phase))
            wav=temp/(name+'.wav');render_wav(source,wav,40 if name=='title' else 5)
            output=dest/'audio'/(name+'.mp3')
            subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(wav),'-t',str(length),'-af',f'{RATE_FILTER},afade=t=in:d=0.004,afade=t=out:st={length-.006}:d=0.006','-c:a','libmp3lame','-b:a','160k','-metadata',f'title=Archon original {name}',str(output)],check=True)
            manifest['files'].append({'file':output.relative_to(dest).as_posix(),'phase':phase,'duration':length,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()})
            print('Rendered original',name,output.stat().st_size,flush=True)
        for identifier,pointer in enumerate(POINTERS):
            duration,loop,end=script_duration(memory,pointer)
            source=research/f'move-{identifier}-wrapper.sap';source.write_bytes(sap(memory,f'move {identifier}',pointer=pointer))
            wav=temp/f'move-{identifier}.wav';render_wav(source,wav,max(1,duration+.2))
            output=temp/f'move-{identifier}-mono.wav'
            subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(wav),'-t',str(duration),'-af',RATE_FILTER,'-ar','22050','-ac','1',str(output)],check=True)
            with wave.open(str(output),'rb') as f:pcm=f.readframes(f.getnframes());frames=f.getnframes()
            effects.append({'id':identifier,'data':base64.b64encode(pcm).decode(),'duration':frames/22050,'loop':loop,'sourceStart':f'{pointer:04X}','sourceEndExclusive':f'{end:04X}'})
            manifest['files'].append({'effect':identifier,'duration':frames/22050,'sourceStart':f'{pointer:04X}','loop':loop,'pcmSha256':hashlib.sha256(pcm).hexdigest()})
            print('Rendered original movement',identifier,duration,'loop',loop,flush=True)
        # $6F2E–$6F3D: AUDC=$8A, AUDF accumulates the original weapon parameter.
        flight={}
        import math
        for parameter in (3,4,5,6,7):
            frames=256//math.gcd(parameter,256);duration=frames/TARGET_FRAME_HZ
            script=[0xFD,0x8A]
            for frame in range(frames):script.extend([1,((frame+1)*parameter)&255])
            script.append(0xFE)
            source=research/f'flight-{parameter}-wrapper.sap';source.write_bytes(sap(memory,f'flight {parameter}',pointer=0x800,script=script))
            wav=temp/f'flight-{parameter}.wav';render_wav(source,wav,max(1,frames/RENDER_FRAME_HZ+.2))
            output=temp/f'flight-{parameter}-mono.wav'
            subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(wav),'-t',str(duration),'-af',RATE_FILTER,'-ar','22050','-ac','1',str(output)],check=True)
            with wave.open(str(output),'rb') as f:pcm=f.readframes(f.getnframes());sampleFrames=f.getnframes()
            identifier=len(effects);flight[str(parameter)]=identifier
            effects.append({'id':identifier,'data':base64.b64encode(pcm).decode(),'duration':sampleFrames/22050,'loop':True,'sourceStart':'6F2E','sourceEndExclusive':'6F40'})
            manifest['files'].append({'effect':identifier,'weaponParameter':parameter,'duration':sampleFrames/22050,'pcmSha256':hashlib.sha256(pcm).hexdigest()})
            print('Rendered original projectile sweep',parameter,flush=True)
    unit_types=list(memory[0x5759:0x576D]);assert all(value in (0,2,4,6,8,10) for value in unit_types)
    result={'sourceSha256':SOURCE_HASH,'encoding':'s16le','sampleRate':22050,'renderFrameHz':TARGET_FRAME_HZ,'title':'assets/audio/title.mp3?v='+hashlib.sha256((dest/'audio/title.mp3').read_bytes()).hexdigest()[:12],'result':'assets/audio/result.mp3?v='+hashlib.sha256((dest/'audio/result.mp3').read_bytes()).hexdigest()[:12],'unitMovementEffects':[v//2 for v in unit_types],'combatEffects':{'charged':[6,7],'fire':[6,7],'impact':[8,9],'phoenix':10,'banshee':11,'flight':flight},'effects':effects}
    (dest/'audio.js').write_text('// Original Atari Archon audio, rendered offline; see research/archon/AUDIO.md.\n'+'globalThis.ARCHON_AUDIO = '+json.dumps(result,separators=(',',':'))+';\n')
    (dest/'audio/provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')


if __name__=='__main__':main()
