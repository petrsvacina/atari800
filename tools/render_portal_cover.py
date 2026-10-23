#!/usr/bin/env python3
"""Draw a pixel-art game preview directly from the original extracted graphics."""
import json
from pathlib import Path
import random
import shutil
from extract_assets import ROOT, png


def render():
    data = (ROOT / "web/assets/original-data.js").read_text().split(" = ", 1)[1].rstrip(";\n")
    assets = json.loads(data)
    rng = random.Random(1997)
    terrain = [1 if c else (2 if rng.random() < .45 else 0) for c in assets["maps"][0]]
    actors = [(2, 3, 0, 3, 1), (17, 8, 1, 2, 2), (13, 5, 2, 0, 0)]
    for x, y, *_ in actors:
        for xx, yy in [(x, y), (x + 1, y), (x - 1, y)]:
            if 0 <= xx < 20 and 0 <= yy < 12 and terrain[yy * 20 + xx] != 1:
                terrain[yy * 20 + xx] = 0
    terrain[3 * 20 + 4] = 7
    terrain[6 * 20 + 11] = 5
    terrain[9 * 20 + 7] = 6
    palette = [(8, 9, 9, 255), (249, 204, 119, 255), (177, 131, 57, 255), (79, 59, 27, 255)]
    width, height = 320, 192
    pixels = bytearray(width * height * 4)

    def point(x, y, color):
        if 0 <= x < width and 0 <= y < height:
            i = (y * width + x) * 4
            pixels[i:i + 4] = bytes(color)

    def tile(kind, xx, yy, fire=False):
        colors = palette.copy()
        if fire:
            colors[3] = (233, 139, 58, 255)
        for y in range(16):
            for x in range(8):
                character = kind * 4 + (x >> 2) * 2 + (y >> 3)
                byte = assets["font"][character * 8 + (y & 7)]
                color = colors[(byte >> (6 - (x & 3) * 2)) & 3]
                point(xx + x * 2, yy + y, color)
                point(xx + x * 2 + 1, yy + y, color)

    for i, kind in enumerate(terrain):
        tile(kind, i % 20 * 16, i // 20 * 16)
    for x, y in [(10, 7), (9, 7), (11, 7), (10, 6), (10, 8)]:
        if terrain[y * 20 + x] != 1:
            tile(8, x * 16, y * 16, True)
    shades = [
        [None, (145, 204, 146, 255), (55, 109, 66, 255), (190, 225, 167, 255)],
        [None, (237, 194, 121, 255), (133, 99, 51, 255), (255, 227, 167, 255)],
        [None, (182, 160, 226, 255), (98, 84, 129, 255), (223, 208, 255, 255)],
    ]
    for x, y, who, direction, frame in actors:
        base = direction * 48
        for row in range(12):
            offset = base + row if row < 6 else base + 12 + frame * 12 + row - 6
            a, b = assets["sprites"][offset], assets["sprites"][offset + 6]
            for bit in range(8):
                value = ((a >> (7 - bit)) & 1) | (((b >> (7 - bit)) & 1) << 1)
                if value:
                    point(x * 16 + bit * 2, y * 16 + 2 + row, shades[who][value])
                    point(x * 16 + bit * 2 + 1, y * 16 + 2 + row, shades[who][value])
    scale = 4
    expanded = bytearray()
    for y in range(height):
        row = b"".join(pixels[(y * width + x) * 4:(y * width + x + 1) * 4] * scale for x in range(width))
        expanded.extend(row * scale)
    dest = ROOT / "portal/assets"
    dest.mkdir(parents=True, exist_ok=True)
    png(dest / "dynakillers.png", width * scale, height * scale, expanded)
    shutil.copyfile(ROOT / "web/assets/logo.png", dest / "dynakillers-logo.png")
    print("Rendered Dynakillers portal cover from original game graphics.")


if __name__ == "__main__":
    render()
