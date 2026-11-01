#!/usr/bin/env python3
"""Render the original CMC music player and POKEY effects offline in Atari800."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import wave
from neverstory_capture import Capture
from shift_original import ROOT, SHA, image, Original

EFFECTS = {'step':0x4b24, 'switch':0x4b3d, 'gate':0x4b56,
           'death':0x4b6f, 'key':0x4b88, 'shift':0x4ba1}


def verify_period():
    original=Original();original.call(0x4bba)
    first=None
    for frame in range(33282):
        if frame==16641:first=bytes(original.memory[0x400:0xe00])
        if frame==33281:
            assert first==bytes(original.memory[0x400:0xe00]), 'Original CMC loop changed.'
            result={'sourceSha256':SHA,'first':16641,'repeat':33281,'period':16640,
                    'fullPlayerRamSha256':hashlib.sha256(first).hexdigest()}
            (ROOT/'research/shift/music-period.json').write_text(json.dumps(result,indent=2)+'\n')
            print('Verified original CMC player loop:',result,flush=True)
            return
        original.call(0x406)


def capture(args):
    image()  # Check the supplied XEX hash before running its address-specific code.
    verify_period()
    args.output.mkdir(parents=True, exist_ok=True)
    m = Capture(args.emulator, ROOT/'shift.xex', audio=True)
    try:
        m.prompt('bpc 3c95'); m.prompt('cont'); m.prompt('bpc ffff')
        m.prompt(f'savestate {args.output}/initial.a8s')
        # Exactly 33281 original frame calls. The full CMC player RAM repeats
        # at frames 16641 and 33281; loop length 16640, verified separately.
        m.prompt('c 1000 a2 01 a0 83 20 8d 3f ca d0 fa 88 d0 f7 4c 0d 10')
        m.prompt('setpc 1000'); m.prompt('bpc 100d')
        m.prompt(f'record {args.output}/music.wav'); m.prompt('cont'); m.prompt('stoprecord')
        print('Rendered complete original CMC music and repeated cycle', flush=True)
        for name, address in EFFECTS.items():
            m.prompt(f'loadstate {args.output}/initial.a8s'); m.prompt('bpc ffff')
            m.prompt('c 28 00'); m.prompt('r 4b00')
            # Original blocking sound routine, then five silent tail frames.
            m.prompt(f'c 1000 20 {address&255:02x} {address>>8:02x} a2 05 20 8d 3f ca d0 fa 4c 0b 10')
            m.prompt('setpc 1000'); m.prompt('bpc 100b')
            m.prompt(f'record {args.output}/{name}.wav'); m.prompt('cont'); m.prompt('stoprecord')
            print('Rendered original effect', name, flush=True)
    finally:
        m.close()
    assets = {}; records = {}
    for name in ('music', *EFFECTS):
        wav = args.output/f'{name}.wav'; mp3 = args.output/f'{name}.mp3'
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-ac','1','-c:a','libmp3lame','-b:a','64k',str(mp3)],check=True)
        with wave.open(str(wav),'rb') as f:
            duration = f.getnframes()/f.getframerate()
        assets[name] = {'encoding':'mp3','data':base64.b64encode(mp3.read_bytes()).decode()}
        records[name] = {'duration':duration,'wavSha256':hashlib.sha256(wav.read_bytes()).hexdigest(),
                         'mp3Sha256':hashlib.sha256(mp3.read_bytes()).hexdigest()}
        if name == 'music':
            fps = 1773447/(312*114)
            assets[name].update(loopStart=16641/fps,loopEnd=33281/fps)
    (ROOT/'shift/assets/audio.js').write_text('// Original Atari POKEY audio, rendered offline.\n'
        'globalThis.SHIFT_AUDIO='+json.dumps(assets,separators=(',',':'))+';\n')
    (ROOT/'research/shift/audio.json').write_text(json.dumps({'sourceSha256':SHA,
        'player':'Original CMC at $0403/$0406; data $8400, not an emulated browser runtime',
        'loop':{'firstFullState':16641,'repeatedFullState':33281,'frames':16640},
        'effects':{k:f'${v:04X}' for k,v in EFFECTS.items()},'recordings':records},indent=2)+'\n')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emulator',type=Path)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--verify-only',action='store_true')
    args=parser.parse_args()
    if args.verify_only:verify_period()
    else:
        if not args.emulator or not args.output:parser.error('--emulator and --output required for audio rendering')
        capture(args)
