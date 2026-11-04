#!/usr/bin/env python3
"""Read the supplied NeverEnding Story II DOS disks without changing them."""
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'Neverending_story_2_CZE_ENG'
SOURCES = {
    'cs': ('The-NeverEnding-Story-II-c2021Tomas-Kratochvil.atr',
           'ec66fd50199e5cf2d3886393f6b2ff4fcf5d0a237f13ca1b5d598f196b79d3be'),
    'en': ('The-NeverEnding-Story-II-20212022Final-ENG.atr',
           'a04846117bd6400e69fa9598959e392488e779a59bc914cea6b854b721e1babb'),
}


def files(language):
    name, digest = SOURCES[language]
    disk = (SOURCE_DIR / name).read_bytes()
    assert hashlib.sha256(disk).hexdigest() == digest
    assert disk[:2] == b'\x96\x02' and int.from_bytes(disk[4:6], 'little') == 128
    sector = lambda number: disk[16 + (number - 1) * 128:16 + number * 128]
    directory = b''.join(sector(n) for n in range(361, 369))
    result = {}
    for entry in range(64):
        row = directory[entry * 16:(entry + 1) * 16]
        if not row[0] & 0x40:
            continue
        name = row[5:13].decode('ascii').rstrip() + '.' + row[13:16].decode('ascii').rstrip()
        count = int.from_bytes(row[1:3], 'little')
        number = int.from_bytes(row[3:5], 'little')
        visited = set(); output = bytearray()
        while number:
            assert number not in visited and 1 <= number <= (len(disk) - 16) // 128
            visited.add(number); data = sector(number)
            assert data[127] <= 125, (name, number)
            if not row[0] & 4:
                assert data[125] >> 2 == entry, (name, number)
            output.extend(data[:data[127]])
            number = ((data[125] if row[0] & 4 else data[125] & 3) << 8) | data[126]
        assert len(visited) == count, (name, count, len(visited))
        result[name] = bytes(output)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    for language in SOURCES:
        folder = args.output / language; folder.mkdir(parents=True, exist_ok=True)
        extracted = files(language)
        for name, data in extracted.items():
            (folder / name).write_bytes(data)
        print(language, json.dumps({n: len(b) for n, b in extracted.items()}))
