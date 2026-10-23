#!/usr/bin/env python3
"""Render the verified ASMA International Karate driver offline to an HTML audio asset."""
import hashlib,json,shutil,subprocess,tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DURATION=271.10

def render():
    sap=ROOT/'research/international-karate/international-karate-asma.sap'
    data=sap.read_bytes()
    header=data[:data.index(b'\xff\xff')]
    if b'INIT 1F00' not in header or b'PLAYER 1F06' not in header or b'TIME 04:31.10 LOOP' not in header:
        raise ValueError('Unexpected reference SAP')
    # Tell GME to postpone its fade until after the retained original loop.
    with tempfile.TemporaryDirectory(prefix='international-karate-music-') as folder:
        folder=Path(folder)
        source=folder/'render.sap'
        source.write_bytes(data.replace(b'TIME 04:31.10 LOOP',b'TIME 04:40.00 LOOP',1))
        wav=folder/'karate.wav'
        vlc='/Applications/VLC.app/Contents/MacOS/VLC'
        subprocess.run([vlc,'-I','dummy','--ignore-config','--no-media-library','--no-video','--no-audio','--play-and-exit',f'--run-time={DURATION+2}',
                        '--sout',f'#transcode{{acodec=s16l,channels=2,samplerate=44100}}:std{{access=file,mux=wav,dst={wav}}}',str(source)],check=True,capture_output=True,timeout=180)
        dest=ROOT/'karate/assets/music';dest.mkdir(parents=True,exist_ok=True)
        out=dest/'international-karate.mp3'
        subprocess.run([shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-t',str(DURATION),
                        '-af',f'afade=t=in:d=0.006,afade=t=out:st={DURATION-.006:.3f}:d=0.006','-c:a','libmp3lame','-b:a','160k',
                        '-metadata','title=International Karate','-metadata','artist=Rob Hubbard','-metadata','date=1986',str(out)],check=True,timeout=60)
        (dest/'provenance.json').write_text(json.dumps({
            'composer':'Rob Hubbard','year':1986,
            'source':'https://asma.atari.org/asma/Composers/Hubbard_Rob/International_Karate.sap',
            'sapSha256':hashlib.sha256(data).hexdigest(),
            'atrSha256':hashlib.sha256((ROOT/'International Karate.atr').read_bytes()).hexdigest(),
            'originalDriverRange':'1F00-26D3',
            'driverComparison':'Reference matches 1974 of 2004 bytes in the running ATR RAM dump; 30 differing bytes are player state and self-modified operands.',
            'duration':DURATION,'sampleRate':44100,'channels':2,'loop':'Whole rendered track repeats from the beginning.',
            'mp3Sha256':hashlib.sha256(out.read_bytes()).hexdigest()
        },indent=2)+'\n')
        print(f'Rendered {out}: {DURATION}s, {out.stat().st_size} bytes')

if __name__=='__main__': render()
