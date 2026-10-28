#!/usr/bin/env python3
"""Extract named game data from the user's DOS2 ATR; no CPU code is exported."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Boulderdash 1.atr'
SHA = '90129a4243772349c6a7bfe3c6e4edfdfc3520eb5be84ef730952ad2993223b7'


def autorun():
    image = SOURCE.read_bytes()
    assert hashlib.sha256(image).hexdigest() == SHA, 'Unsupported supplied ATR'
    disk = image[16:]
    entry = disk[360 * 128 + 16:360 * 128 + 32]
    assert entry[5:16] == b'AUTORUN SYS'
    sector = int.from_bytes(entry[3:5], 'little')
    visited, result = set(), bytearray()
    while sector:
        assert 1 <= sector <= len(disk) // 128 and sector not in visited
        visited.add(sector)
        data = disk[(sector - 1) * 128:sector * 128]
        assert data[127] <= 125
        result.extend(data[:data[127]])
        sector = ((data[125] & 3) << 8) | data[126]
    assert len(visited) == int.from_bytes(entry[1:3], 'little')
    return bytes(result)


def memory():
    source = autorun()
    assert source[:6] == bytes.fromhex('ffff0029bf6c')
    loaded = bytearray(65536)
    cursor = 0
    while cursor < len(source):
        start = int.from_bytes(source[cursor:cursor+2], 'little'); cursor += 2
        if start == 65535:
            continue
        end = int.from_bytes(source[cursor:cursor+2], 'little'); cursor += 2
        loaded[start:end+1] = source[cursor:cursor+end-start+1]
        cursor += end-start+1
    result = bytearray(65536)
    # The original $6C80 loader copies 68 pages from $2900 to $0900.
    result[0x0900:0x4d00] = loaded[0x2900:0x6d00]
    return result


def export():
    m = memory()
    def data(start, count): return list(m[start:start + count])
    records = []
    for cave in range(20):
        address = 0x3528 + int.from_bytes(m[0x3500+cave*2:0x3502+cave*2], 'little')
        end = address + 32
        while m[end] != 255:
            end += [3, 5, 6, 5][m[end] >> 6]
        records.append(data(address, end + 1 - address))
    palette = Path.home() / 'Games/Atari800/Palettes/Real.act'
    rgb = palette.read_bytes()
    result = {
        'sourceSha256': SHA,
        'caves': records,
        'normalize': data(0x3c00, 64),
        'tileCharacters': data(0x3c40, 64),
        'font': data(0x4400, 1024),
        'titleFont': data(0x4000, 512),
        'titleMap': data(0x4200, 512),
        'titleArtwork': data(0x2d80, 1920),
        'animation': [data(a, 256) for a in [0x3d00, 0x3e00, 0x3f00, 0x4800, 0x4900, 0x4a00, 0x4b00]],
        'musicNotes': data(0x4400, 256),
        'musicFrequencies': data(0x2328, 120),
        'nextCave': [m[0x1e0b+i*2] for i in range(20)],
        'intermissions': [m[0x1e0c+i*2] for i in range(20)],
        'scanDelay': data(0x1c2a, 5),
        'cameraY': data(0x15e7, 12),
        'cameraX': data(0x15f3, 12),
        'introTemplate': data(0x0aab, 20),
        'menuText': [data(a,20) for a in [0x0a18,0x0a2d,0x0b14,0x0a42,0x0aea]],
        'titleColors': data(0x25be,5),
        'palette': ['#'+rgb[i*3:i*3+3].hex() for i in range(256)],
        'paletteSha256': hashlib.sha256(rgb).hexdigest(),
        'videoColors': {'0':'#111111','6':'#7a7471','12':'#dcd4d0','32':'#541414','38':'#b06a30','148':'#1d6b9c','150':'#3386c9','158':'#9bffff'},
    }
    dest = ROOT / 'boulder-dash/assets/original.js'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text('// Original Boulder Dash data from supplied ATR. No executable Atari code.\n'
                    'globalThis.BOULDER_ORIGINAL=' + json.dumps(result, separators=(',', ':')) + ';\n')
    print('Exported 20 caves, graphics, animation, music and original tables.')


if __name__ == '__main__':
    export()
