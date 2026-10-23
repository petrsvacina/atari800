#!/usr/bin/env python3
"""Decode International Karate's original fighter frames from a loaded RAM dump.

The emulator is a development tool only. This exports graphics, not a web game.
Usage: python3 tools/extract_karate_sprites.py --memory /path/to/ram.bin
"""
import argparse
import hashlib
import json
from pathlib import Path

from extract_assets import png

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA256 = "b30ddd0920a00a99d8b41d97b24d72cc57150e73e9a3686e0f35cb74f3b62bec"
# Preview colors only; the original applies colors and raster effects at runtime.
COLORS = [(0, 0, 0, 0), (229, 183, 135, 255), (198, 63, 52, 255), (244, 239, 207, 255)]
WIDTH, HEIGHT, COUNT, COLUMNS = 80, 96, 56, 8


def export(memory, source, destination):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != SOURCE_SHA256:
        raise ValueError("This extractor is verified only for the supplied International Karate.atr.")
    if len(memory) != 0xC000:
        raise ValueError("Expected a RAM dump of $0000–$BFFF (49152 bytes).")
    frames = []
    sheet_width, sheet_height = WIDTH * COLUMNS, HEIGHT * (COUNT // COLUMNS)
    pixels = bytearray(sheet_width * sheet_height * 4)
    for frame in range(COUNT):
        meta = int.from_bytes(memory[0x6800 + frame * 2:0x6802 + frame * 2], "little")
        start = int.from_bytes(memory[0x6880 + frame * 2:0x6882 + frame * 2], "little")
        if meta != 0x6900 + frame * 12 or not 0x6C00 <= start <= 0x9BB8:
            raise ValueError("RAM does not contain the expected loaded animation tables.")
        layout = memory[meta:meta + 12]
        tile_count = sum(value & 15 for value in layout)
        data = memory[start:start + tile_count * 8]
        if frame + 1 < COUNT:
            following = int.from_bytes(memory[0x6882 + frame * 2:0x6884 + frame * 2], "little")
            if start + len(data) != following:
                raise ValueError(f"Frame {frame} does not end at the next bitmap pointer.")
        tile_index = 0
        for row, value in enumerate(layout):
            offset, length = value >> 4, value & 15
            if offset + length > WIDTH // 8:
                raise ValueError(f"Frame {frame} exceeds its canvas.")
            for column in range(length):
                for y in range(8):
                    packed = data[tile_index * 8 + y]
                    for x in range(8):
                        color = COLORS[(packed >> (6 - (x // 2) * 2)) & 3]
                        dx = frame % COLUMNS * WIDTH + (offset + column) * 8 + x
                        dy = frame // COLUMNS * HEIGHT + row * 8 + y
                        pixel = (dy * sheet_width + dx) * 4
                        pixels[pixel:pixel + 4] = bytes(color)
                tile_index += 1
        frames.append({"id": frame, "layout": list(layout), "data": list(data)})
    destination.mkdir(parents=True, exist_ok=True)
    png(destination / "sprites.png", sheet_width, sheet_height, pixels)
    (destination / "sprites.json").write_text(json.dumps({
        "source": source.name, "sourceSha256": digest,
        "width": WIDTH, "height": HEIGHT, "columns": COLUMNS,
        "paletteIsApproximate": True, "previewPalette": COLORS,
        "frames": frames,
    }, separators=(",", ":")) + "\n")
    print(f"Decoded {COUNT} frame slots ({sum(bool(f['data']) for f in frames)} nonempty); "
          f"all bitmap boundaries agree with the original pointer table.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--memory", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "research/international-karate")
    args = parser.parse_args()
    export(args.memory.read_bytes(), ROOT / "International Karate.atr", args.output)
