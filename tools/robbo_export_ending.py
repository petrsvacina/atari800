#!/usr/bin/env python3
"""Export data-only ending clips and the native random-reveal oracle."""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path
from robbo_capture_sound import ROOT, SHA256


def b64(data): return base64.b64encode(bytes(data)).decode('ascii')
def digest(data): return hashlib.sha256(data).hexdigest()


def export(folder):
    manifest = json.loads((folder / 'manifest.json').read_text())
    assert manifest['sourceSha256'] == SHA256
    memory = (folder / 'hold.bin').read_bytes()
    font = memory[0x2000:0x2400]; message = memory[0xB2DA:0xB5DA]
    last_screen = (folder / 'frames' / f"{manifest['closingStartFrame'] - 1:04d}.screen").read_bytes()
    images = []; image_ids = {}; phases = {'intro': [], 'hold': [], 'closing': []}
    intro_fixture = []; hold_fixture = []; closing_fixture = []
    pending_pcs = {0xAABF, 0xAAC2, 0xAAC8, 0xAACB, 0xAAD1, 0xAAD4}
    for record in manifest['frames']:
        prefix = folder / 'frames' / f"{record['frame']:04d}"
        raw = prefix.with_suffix('.cinema').read_bytes()
        raster = b''.join(raw[y * 384 + 32:y * 384 + 352] for y in range(240))
        frame = {'registers': record['registers']}
        if record['phase'] != 'closing':
            key = digest(raster)
            if key not in image_ids:
                image_ids[key] = len(images); images.append(raster)
            frame['image'] = image_ids[key]
        if record['phase'] == 'intro':
            intro_fixture.append({'pixelSha256': digest(raster), 'registers': record['registers']})
        if record['phase'] == 'hold':
            reads = prefix.with_suffix('.random').read_bytes()
            frame.update(random=b64(reads), deferLast=record['pc'] in pending_pcs)
            hold_fixture.append({'screen': b64(prefix.with_suffix('.screen').read_bytes()),
                                 'pixelSha256': digest(raster), 'registers': record['registers']})
        elif record['phase'] == 'closing':
            index = len(phases['closing']); phase = (manifest['holdFrames'] + index) & 7
            rows = []
            for y in range(160):
                colors = [set(), set()]
                for x in range(256):
                    character = last_screen[(y // 8) * 32 + x // 8]
                    glyph = character & 127
                    bits = font[0x300 + (((y & 7) - phase) & 7)] if glyph == 96 else font[glyph * 8 + (y & 7)]
                    bits ^= 255 if character & 128 else 0
                    colors[1 if bits & (128 >> (x & 7)) else 0].add(raster[(y + 40) * 320 + x + 32])
                if any(len(values) > 1 for values in colors):
                    raise ValueError('Closing raster cannot be represented by original foreground/background row colors')
                rows.extend([next(iter(colors[0]), 0), next(iter(colors[1]), 0)])
            frame['rowColors'] = b64(rows)
            closing_fixture.append({'pixelSha256': digest(raster), 'registers': record['registers']})
        phases[record['phase']].append(frame)
    atlas = b''.join(images)
    asset = {'sourceSha256': SHA256, 'clockHz': 1773447, 'vbiHz': 1773447 / (312 * 114),
             'width': 320, 'height': 240, 'palette': b64((folder / 'palette.act').read_bytes()),
             'atlasGzip': b64(gzip.compress(atlas, compresslevel=9, mtime=0)),
             'atlasImages': len(images), **phases, 'returnEffect': 13,
             'sound': json.loads((ROOT / 'robbo/assets/sound.json').read_text()),
             'holdData': {'font': b64(font), 'message': b64(message), 'initialScreen': b64(memory[0x1000:0x1300]),
                          'fontPhase': 0, 'page': 0, 'screenTop': 40, 'columns': 32, 'rows': 20,
                          'clock': manifest['frames'][manifest['holdStartFrame']]['clock'] & 255,
                          'soundParameters': list(memory[0xF0:0x100]),
                          'soundRegisters': manifest['frames'][manifest['holdStartFrame']]['registers']}}
    output = ROOT / 'robbo/assets/ending.json'
    output.write_text(json.dumps(asset, separators=(',', ':')) + '\n')
    fixture = {'sourceSha256': SHA256, 'intro': intro_fixture, 'hold': hold_fixture, 'closing': closing_fixture,
               'atlasSha256': digest(atlas), 'imageSha256': [digest(image) for image in images]}
    path = ROOT / 'tools/fixtures/robbo-ending.json.gz'
    with gzip.GzipFile(filename=str(path), mode='wb', mtime=0) as stream:
        stream.write(json.dumps(fixture, separators=(',', ':')).encode())
    start = (folder / 'start.bin').read_bytes(); hold = memory; returned = (folder / 'return.bin').read_bytes()
    clock = lambda data: int.from_bytes(data[0x12:0x15], 'big')
    report = {'sourceSha256': SHA256, 'captureFolder': str(folder),
              'captureManifestSha256': digest((folder / 'manifest.json').read_bytes()),
              'entry': manifest['entry'], 'entryMethod': manifest['entryMethod'], 'hold': manifest['hold'],
              'return': manifest['return'], 'introVbis': clock(hold) - clock(start),
              'introFrames': len(asset['intro']), 'referenceHoldFrames': len(asset['hold']),
              'closingFrames': len(asset['closing']), 'runtimeAsset': str(output.relative_to(ROOT)),
              'runtimeAssetSha256': digest(output.read_bytes()), 'runtimeBytes': output.stat().st_size,
              'decodedAtlasBytes': len(atlas), 'uniqueImages': len(images),
              'holdAlgorithm': 'Three independent RANDOM-indexed byte copies per COPT iteration, pages 0/1/2; TETR then continues or dismisses.',
              'holdCadence': 'Captured native 30–33 RANDOM reads/VBI, including cross-frame pending stores; 512 frames verified.',
              'audioEvents': [5, 14, 13, 11, 5, 0], 'dismissEffect': 9, 'returnEffect': 13,
              'limits': ['One authentic entry/RTCLOK/POKEY RANDOM phase captured; all possible entry phases are not verified.',
                         'After the 512-frame reference reveal, the native hold algorithm continues until input; its later RANDOM phase is not hardware matched.',
                         'Closing raster row colors are native; an earlier dismissal retains the then-current partial message.',
                         'The final effect 13 starts after return to TITLE and must remain active in its VBI sound driver.']}
    (ROOT / 'research/robbo/ending.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['introFrames', 'referenceHoldFrames', 'closingFrames', 'runtimeBytes', 'decodedAtlasBytes', 'uniqueImages']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', type=Path, default=Path('/private/tmp/robbo-research/ending'))
    export(parser.parse_args().capture)
