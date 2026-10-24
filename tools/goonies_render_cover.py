#!/usr/bin/env python3
"""Compose the Goonies catalog cover using original map and character pixels."""
import base64
import json
from pathlib import Path
import shutil
from extract_assets import ROOT, png


def load(file):
    return json.loads(file.read_text().split(' = ', 1)[1].rstrip(';\n'))


def render():
    graphics = load(ROOT / 'goonies-web/assets/graphics.js')
    sprites = load(ROOT / 'goonies-web/assets/sprites.js')
    width, height = 320, 192
    palette = [bytes.fromhex(c[1:]) + b'\xff' for c in graphics['palette']]
    pixels = bytearray(palette[0] * (width * height))
    packed = base64.b64decode(graphics['scenes'][0]['packedBase64'])
    for y in range(176):
        for x in range(320):
            value = packed[y * 40 + x // 8] >> (6 - (x % 8 // 2) * 2) & 3
            index = ((y + 8) * width + x) * 4
            pixels[index:index + 4] = palette[value]
    def draw(frame, x, y):
        for yy in range(frame['height']):
            for xx in range(frame['width']):
                color = frame['pixels'][yy * frame['width'] + xx]
                dx, dy = x + xx, y + yy
                if color and 0 <= dx < width and 0 <= dy < height:
                    index = (dy * width + dx) * 4
                    pixels[index:index + 4] = palette[color]
    draw(sprites['characters'][0]['frames'][2], 110, 94)
    draw(sprites['characters'][2]['frames'][6], 202, 40)
    draw(sprites['fratelli']['frames'][0], 228, 130)
    draw(sprites['objects'][8], 180, 59)
    expanded = bytearray()
    for y in range(height):
        row = b''.join(pixels[(y * width + x) * 4:(y * width + x + 1) * 4] * 4 for x in range(width))
        expanded.extend(row * 4)
    png(ROOT / 'portal/assets/goonies.png', width * 4, height * 4, expanded)
    shutil.copyfile(ROOT / 'goonies-web/assets/logo.png', ROOT / 'portal/assets/goonies-logo.png')
    print('Rendered Goonies portal cover from original map, kids, Fratelli and chair.')


if __name__ == '__main__':
    render()
