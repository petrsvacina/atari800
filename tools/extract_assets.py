#!/usr/bin/env python3
"""Extract data from the supplied original XEX. Atari800 is a development tool only.

Usage: python3 tools/extract_assets.py
Or reuse monitor dumps: --memory /path/to/ram.bin --samples /path/to/under-os.bin
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import pty
import select
import shutil
import struct
import subprocess
import tempfile
import time
import zlib

ROOT = Path(__file__).resolve().parents[1]


def unpack(xex, folder):
    executable = shutil.which("atari800")
    if not executable:
        raise SystemExit("For asset extraction install Atari800, or supply --memory and --samples.")
    master, slave = pty.openpty()
    process = subprocess.Popen(
        [executable, "-no-autosave-config", "-nosound", "-no-video-accel",
         "-pal", "-nobasic", "-turbo", "-monitor", "-run", str(xex)],
        stdin=slave, stdout=slave, stderr=slave,
        env={**os.environ, "SDL_VIDEODRIVER": "dummy", "SDL_AUDIODRIVER": "dummy"},
    )
    os.close(slave)

    def prompt(command=None):
        if command:
            os.write(master, (command + "\n").encode())
        result = b""
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            if select.select([master], [], [], 1)[0]:
                result += os.read(master, 65536)
                if result.endswith(b"> "):
                    return result
            if process.poll() is not None:
                break
        raise RuntimeError(f"Emulator monitor did not reach its prompt: {result[-600:]!r}")

    try:
        prompt()
        for address in ("ad40", "480", "9000"):
            prompt("bpc " + address)
            prompt("cont")
            print(f"Reached original program address ${address.upper()}.", flush=True)
        memory, samples = folder / "ram.bin", folder / "samples.bin"
        prompt(f"write 0000 bfff {memory}")
        prompt("c d301 fe")
        prompt(f"write e000 ffff {samples}")
        prompt("c d301 ff")
        os.write(master, b"quit\n")
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            # SDL dummy-driver shutdown can stall after successful extraction.
            process.kill()
            process.wait(timeout=5)
        return memory.read_bytes(), samples.read_bytes()
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        os.close(master)


def png(path, width, height, pixels):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    raw = b"".join(b"\0" + bytes(pixels[y * width * 4:(y + 1) * width * 4]) for y in range(height))
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def export(memory, under_os, xex):
    assert len(memory) == 49152 and len(under_os) == 8192
    dest = ROOT / "web/assets"
    dest.mkdir(parents=True, exist_ok=True)
    masks = [[(memory[0x2B00 + arena * 30 + i // 8] >> (7 - i % 8)) & 1
              for i in range(240)] for arena in range(8)]
    sounds_memory = bytearray(memory)
    sounds_memory[0x3000:0x5000] = under_os
    sounds = {}
    for sample in range(2, 18, 2):
        start = int.from_bytes(memory[0xB095 + sample:0xB097 + sample], "little")
        end = int.from_bytes(memory[0xB097 + sample:0xB099 + sample], "little")
        assert 0x3000 <= start < end <= 0x7ED0
        sounds[str(sample)] = base64.b64encode(sounds_memory[start:end]).decode()
    assets = {
        "sourceSha256": hashlib.sha256(xex.read_bytes()).hexdigest(),
        "maps": masks,
        "font": list(memory[0x2800:0x2C00]),
        "sprites": list(memory[0x2C00:0x2CC0]),
        "monoSprites": list(memory[0x2CC0:0x2D20]),
        "palettes": [[memory[0xA0FF + i], memory[0xA107 + i], memory[0xA10F + i]] for i in range(8)],
        "samples": sounds,
    }
    (dest / "original-data.js").write_text(
        "// Extracted from the user-supplied Dynakillers.xex; see research/PORTING.md.\n"
        + "globalThis.DYNA_ASSETS = " + json.dumps(assets, separators=(",", ":")) + ";\n")
    # Original 160-color-clock logo, displayed with the original 2:1 pixel aspect.
    # DLI palette gradients are approximated; bitmap pixels are unchanged.
    colors = [(4, 6, 12, 0), (225, 219, 159, 255), (111, 151, 208, 255), (39, 66, 112, 255)]
    pixels = bytearray()
    for y in range(53):
        for x in range(320):
            value = memory[0x1100 + y * 40 + x // 8] >> (6 - (x % 8 // 2) * 2) & 3
            pixels.extend(colors[value])
    png(dest / "logo.png", 320, 53, pixels)
    print("Exported 8 maps, 128 characters, player sprites, 8 samples and the original logo.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--memory", type=Path)
    parser.add_argument("--samples", type=Path)
    args = parser.parse_args()
    xex = ROOT / "Dynakillers.xex"
    if args.memory and args.samples:
        export(args.memory.read_bytes(), args.samples.read_bytes(), xex)
    elif args.memory or args.samples:
        parser.error("Supply both --memory and --samples")
    else:
        with tempfile.TemporaryDirectory(prefix="dynakillers-") as tmp:
            export(*unpack(xex, Path(tmp)), xex)
