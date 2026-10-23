#!/usr/bin/env python3
"""Render original Dynakillers music to offline MP3s; no emulator runs in the browser."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

from extract_assets import ROOT, unpack

TRACKS = {"title": (0x40, 156.59), "ingame": (0x30, 102.84)}


def make_sap(memory, name, data_page):
    # The capture budget deliberately exceeds the retained loop: GME must not fade
    # the end of the original song before we trim it to ASMA's documented duration.
    header = (f'SAP\r\nAUTHOR "Marian Vybostok (Goldmaster)"\r\n'
              f'NAME "Dynakillers - {name}"\r\nDATE "1997"\r\n'
              'STEREO\r\nTYPE B\r\nINIT 1000\r\nPLAYER 1020\r\nTIME 03:00 LOOP\r\n').encode("ascii")
    init = bytes([0xA9, 0x70, 0xA2, 0, 0xA0, data_page, 0x20, 3, 0x38,
                  0xA9, 0, 0xA2, 0, 0x20, 3, 0x38, 0x60])
    wrapper = init + bytes(0x20 - len(init)) + bytes([0x20, 6, 0x38, 0x4C, 0xEB, 0x9C])
    result = header + b"\xff\xff"
    for address, data in [(0x1000, wrapper), (0x3000, memory[0x3000:0x5000]),
                          (0x9CEB, memory[0x9CEB:0x9D40])]:
        result += struct.pack("<HH", address, address + len(data) - 1) + data
    return result


def render(memory, vlc, ffmpeg):
    dest = ROOT / "web/assets/music"
    research = ROOT / "research/music"
    dest.mkdir(parents=True, exist_ok=True)
    research.mkdir(parents=True, exist_ok=True)
    manifest = {"sourceSha256": hashlib.sha256((ROOT / "Dynakillers.xex").read_bytes()).hexdigest(),
                "composer": "Marian Vybostok (Goldmaster)", "year": 1997,
                "reference": "https://asma.atari.org/asma/Composers/Vybostok_Marian/Dynakillers.sap",
                "tracks": {}}
    with tempfile.TemporaryDirectory(prefix="dynakillers-music-") as folder:
        for name, (page, duration) in TRACKS.items():
            sap = research / f"dynakillers-{name}.sap"
            sap.write_bytes(make_sap(memory, name, page))
            wav = Path(folder) / f"{name}.wav"
            command = [vlc, "-I", "dummy", "--ignore-config", "--no-media-library",
                       "--no-video", "--no-audio", "--play-and-exit", f"--run-time={duration + 2}",
                       "--sout", f"#transcode{{acodec=s16l,channels=2,samplerate=44100}}:std{{access=file,mux=wav,dst={wav}}}", str(sap)]
            subprocess.run(command, check=True, capture_output=True, timeout=180)
            output = dest / f"{name}.mp3"
            subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
                            "-t", str(duration), "-af", f"afade=t=in:d=0.006,afade=t=out:st={duration - .006:.3f}:d=0.006",
                            "-c:a", "libmp3lame", "-b:a", "160k",
                            "-metadata", f"title=Dynakillers - {name.title()}",
                            "-metadata", "artist=Marian Vybostok (Goldmaster)", "-metadata", "date=1997",
                            str(output)], check=True, timeout=60)
            manifest["tracks"][name] = {"duration": duration, "channels": 2, "sampleRate": 44100,
                                       "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}
            print(f"Rendered {name}: {duration} s, stereo, {output.stat().st_size} bytes.", flush=True)
    (dest / "provenance.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--memory", type=Path, help="Optional existing unpacked $0000-$BFFF monitor dump")
    parser.add_argument("--vlc", default=shutil.which("vlc") or "/Applications/VLC.app/Contents/MacOS/VLC")
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"))
    args = parser.parse_args()
    if not args.ffmpeg or not Path(args.vlc).is_file():
        parser.error("Rendering requires local VLC (GME support) and FFmpeg with libmp3lame.")
    if args.memory:
        render(args.memory.read_bytes(), args.vlc, args.ffmpeg)
    else:
        with tempfile.TemporaryDirectory(prefix="dynakillers-unpack-") as folder:
            memory, _ = unpack(ROOT / "Dynakillers.xex", Path(folder))
            render(memory, args.vlc, args.ffmpeg)
