#!/usr/bin/env python3
"""Extract original Goonies backgrounds and software-sprite graphics.

Atari800 is a development-only extractor; the browser receives PNG/JS data.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

from extract_assets import png
from karate_extract_backgrounds import Monitor

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Goonies/Goonies.atr'
SHA256 = 'ccdea8ff8e56b9d09436de1ec64094e2130dee41f2d3d921f8c02f256f16bed7'
VIDEO = ROOT / 'Goonies/The Goonies Playthrough (Atari XL⧸XE) [PZRqQE76Nc0].mkv'
ROOM_ORDER = [0, 2, 1, 3, 4, 5, 6, 7]
NAMES = ['The House', 'The Buckets', 'The Valves', 'The Bats', 'The Skull', 'The Organ', 'The Octopus', 'The Ship']
PALETTE = [[0, 0, 0], [118, 18, 0], [78, 48, 226], [238, 238, 238]]
CHARACTER_FRAMES = [
    [0x780E, 0x7846, 0x787E, 0x78B9, 0x78F4, 0x792C, 0x7964, 0x799C, 0x79D4],
    [0x7A0C, 0x7A44, 0x7A7C, 0x7AB7, 0x7AF2, 0x7B2A, 0x7B62, 0x7B9A, 0x7BD2],
    [0x7C0A, 0x7C30, 0x7C56, 0x7C91, 0x7CCC, 0x7D3C, 0x7D62, 0x7D9A, 0x7D04],
    [0x7DD2, 0x7DF8, 0x7E1E, 0x7E59, 0x7E94, 0x7F04, 0x7F2A, 0x7F62, 0x7ECC],
    [0x7F9A, 0x7FC0, 0x7FE6, 0x8021, 0x805C, 0x80CC, 0x80F2, 0x812A, 0x8094],
    [0x8162, 0x8188, 0x81AE, 0x81E9, 0x8224, 0x8294, 0x82BA, 0x82F2, 0x825C],
    [0x832A, 0x834E, 0x8372, 0x83AA, 0x83E2, 0x844C, 0x8470, 0x84A5, 0x8417],
]


def frame(memory, address, index):
    width_bytes, height = memory[address:address + 2]
    if not 1 <= width_bytes <= 16 or not 1 <= height <= 100:
        raise ValueError(f'Invalid source sprite header at ${address:04X}.')
    width = width_bytes * 8
    packed = memory[address + 2:address + 2 + width_bytes * height]
    if len(packed) != width_bytes * height:
        raise ValueError('Truncated sprite.')
    pixels = []
    for y in range(height):
        for x in range(width):
            pixels.append((packed[y * width_bytes + x // 8] >> (6 - (x % 8 // 2) * 2)) & 3)
    occupied = [(i % width, i // width) for i, p in enumerate(pixels) if p]
    bounds = ([min(x for x, y in occupied), min(y for x, y in occupied),
               max(x for x, y in occupied) + 1, max(y for x, y in occupied) + 1]
              if occupied else [0, 0, 0, 0])
    return {'frameIndex': index, 'sourceAddress': f'{address:04X}',
            'width': width, 'height': height, 'bounds': bounds,
            'packedBase64': base64.b64encode(packed).decode(), 'pixels': pixels}


def record_stream(memory, start, end):
    records, address = [], start
    while address < end:
        records.append(frame(memory, address, len(records)))
        address += 2 + memory[address] * memory[address + 1]
    if address != end:
        raise ValueError(f'Sprite record stream ended at ${address:04X}, expected ${end:04X}.')
    return records


def sprite_data(memories):
    common = memories[0]
    characters = []
    for identifier, addresses in enumerate(CHARACTER_FRAMES):
        characters.append({'id': identifier, 'sourceBase': f'{addresses[0]:04X}',
                           'frames': [frame(common, a, i) for i, a in enumerate(addresses)],
                           'poses': {'walkRight': [0, 2], 'walkLeft': [1, 3],
                                     'jumpRight': 4, 'jumpLeft': 5, 'idle': 6,
                                     'climb': [6, 7], 'special': 8}})
    common_frames = record_stream(common, 0x757F, 0x780E)
    objects = record_stream(common, 0x1A1B, 0x1BE2)
    for i in range(8, 12):
        objects[i]['tag'] = 'chair'
    scene_characters, room_objects, initial_entities = [], [], []
    for identifier, source_room in enumerate(ROOM_ORDER):
        memory = memories[source_room]
        pointers = [int.from_bytes(memory[0x6BAC + i:0x6BAE + i], 'little') for i in (0, 64)]
        scene_characters.append([next(i for i, a in enumerate(CHARACTER_FRAMES) if p == a[0]) for p in pointers])
        # Only immediate, statically provable calls into the original software blitter.
        # Per-room resource includes code, not just graphics. Never interpret arbitrary bytes as sprites.
        resource_end = 0xA400 + memory[0x6BA2 + source_room] * 128
        refs = {}
        for pc in range(0xA400, resource_end - 8):
            b = memory[pc:pc + 8]
            if b[0] != 0xA9 or b[2] != 0x85 or b[4] != 0xA9 or b[6] != 0x85:
                continue
            if (b[3], b[7]) == (0xC6, 0xC5):
                address = b[1] * 256 + b[5]
            elif (b[3], b[7]) == (0xC5, 0xC6):
                address = b[1] + b[5] * 256
            else:
                continue
            if not 0xA400 <= address < resource_end - 2:
                continue
            following = memory[pc + 8:pc + 48]
            if b'\x20\xA7\x67' not in following and b'\x20\xAB\x67' not in following:
                continue
            try:
                candidate = frame(memory, address, 0)
            except ValueError:
                continue
            if address + 2 + candidate['width'] // 8 * candidate['height'] <= resource_end:
                refs.setdefault(address, []).append(f'{pc:04X}')
        # The global actor LUT also references art in per-room banks. Restrict it
        # to the logical frames belonging to that room; unused slots retain
        # pointers into another room and must not be mistaken for current art.
        room_logical_frames = {3: range(30, 31), 4: range(31, 43),
                               5: range(43, 48), 6: range(48, 49), 7: range(57, 58)}
        actor_refs = {}
        for logical in room_logical_frames.get(source_room, []):
            for phase in range(4):
                p = 0x6BAC + logical * 8 + phase * 2
                address = int.from_bytes(memory[p:p + 2], 'little')
                candidate = frame(memory, address, 0)
                if not 0xA400 <= address < resource_end or address + 2 + candidate['width'] // 8 * candidate['height'] > resource_end:
                    raise ValueError('Room sprite lookup escaped its original resource.')
                refs.setdefault(address, [])
                actor_refs.setdefault(address, []).append({'logicalFrame': logical, 'phase': phase})
        frames = []
        for address, calls in sorted(refs.items()):
            item = frame(memory, address, len(frames))
            item.update(sourceObjectId=f'room-{source_room}-{address:04x}', callSites=calls)
            if address in actor_refs:
                item['actorFrames'] = actor_refs[address]
                if source_room == 3:
                    item['tag'] = 'bat'
                elif source_room == 5:
                    item['tag'] = 'musical-note'
            frames.append(item)
        room_objects.append({'id': identifier, 'sourceRoomId': source_room, 'frames': frames})
        actors = []
        for slot in range(11):
            kind = memory[0x1F00 + slot]
            if not kind:
                continue
            x_raw, y_raw = memory[0x1F21 + slot], memory[0x1F2C + slot]
            actor = {'sourceObjectId': slot, 'sourceType': kind,
                     'xRaw': x_raw, 'yRaw': y_raw, 'x': x_raw * 2, 'y': y_raw - 16,
                     'status': memory[0x1F37 + slot], 'direction': memory[0x1F4D + slot]}
            if slot < 2 and kind == slot + 1:
                actor.update(tag='character', characterId=scene_characters[-1][slot])
            elif kind == 5:
                actor['tag'] = 'fratelli'
            elif kind == 6:
                actor['tag'] = 'bat'
            actors.append(actor)
        initial_entities.append({'id': identifier, 'sourceRoomId': source_room,
                                 'slotCapacity': 11, 'activeCount': len(actors), 'actors': actors})
    bat_frames = [dict(f, frameIndex=i) for i, f in enumerate(room_objects[3]['frames']) if f.get('tag') == 'bat']
    return {'palette': ['#' + bytes(c).hex() for c in PALETTE], 'transparentIndex': 0,
            'characters': characters, 'sceneCharacters': scene_characters,
            'fratelli': {'frames': common_frames[4:13],
                         'alternateFrames': record_stream(common, 0x1C7A, 0x1E8A)},
            'bat': {'frames': bat_frames}, 'commonHazards': common_frames[13:17],
            'projectiles': common_frames[:4], 'objects': objects,
            'roomObjects': room_objects, 'initialEntities': initial_entities}


def rgba_bitmap(packed, width, height, transparent=False):
    pixels = bytearray()
    stride = width // 8
    for y in range(height):
        for x in range(width):
            value = (packed[y * stride + x // 8] >> (6 - (x % 8 // 2) * 2)) & 3
            pixels.extend(PALETTE[value])
            pixels.append(0 if transparent and value == 0 else 255)
    return pixels


def export(data):
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SHA256:
        raise ValueError('This extractor is verified only for the supplied Goonies ATR.')
    output = ROOT / 'goonies-web/assets'
    (output / 'scenes').mkdir(parents=True, exist_ok=True)
    graphics = {'sourceSha256': SHA256, 'width': 320, 'height': 176,
                'palette': ['#' + bytes(c).hex() for c in PALETTE],
                'scenes': [], 'sprites': {}}
    provenance = {'sourceSha256': SHA256, 'playfieldAddress': '2290-3E0F',
                  'bytesPerRow': 40, 'width': 320, 'height': 176,
                  'displayList': '6200', 'frontBitmap': '2010-3E0F',
                  'backBitmap': '4010-5E0F', 'palette': PALETTE,
                  'sourceRoomOrder': ROOM_ORDER, 'scenes': []}
    for identifier, source_room in enumerate(ROOM_ORDER):
        packed = base64.b64decode(data['rooms'][str(source_room)]['packedBase64'])
        if len(packed) != 7040:
            raise ValueError('Expected a 320×176 ANTIC E bitmap.')
        file = output / f'scenes/scene-{identifier}.png'
        png(file, 320, 176, rgba_bitmap(packed, 320, 176))
        graphics['scenes'].append({'id': identifier, 'sourceRoomId': source_room,
                                   'name': NAMES[identifier], 'src': f'assets/scenes/{file.name}',
                                   'packedBase64': base64.b64encode(packed).decode()})
        provenance['scenes'].append({'id': identifier, 'sourceRoomId': source_room,
                                     'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
    for room, key, name in [(8, 'ending', 'ending.png'), (9, 'title', 'title.png')]:
        packed = base64.b64decode(data['rooms'][str(room)]['packedBase64'])
        png(output / name, 320, 176, rgba_bitmap(packed, 320, 176))
        graphics[key] = {'src': f'assets/{name}', 'width': 320, 'height': 176}
    # Original title wordmark, cropped from the supplied binary bitmap.
    original_title = base64.b64decode(data['rooms']['9']['packedBase64'])
    full = rgba_bitmap(original_title, 320, 176, transparent=True)
    crop = (30, 110, 150, 37)
    x, y, width, height = crop
    logo = bytearray()
    for row in range(y, y + height):
        logo.extend(full[(row * 320 + x) * 4:(row * 320 + x + width) * 4])
    png(output / 'logo.png', width, height, logo)
    graphics['logo'] = {'src': 'assets/logo.png', 'width': width, 'height': height,
                        'sourceCrop': list(crop)}
    (output / 'graphics.js').write_text('// Original Goonies scene bitmaps; see research/goonies/ASSETS.md.\n'
                                       'globalThis.GOONIES_GRAPHICS = ' + json.dumps(graphics, separators=(',', ':')) + ';\n')
    (ROOT / 'research/goonies/graphics-provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    if 'sprites' in data:
        sprites = data['sprites']
        (output / 'sprites.js').write_text('// Original software sprites; index 0 is transparent. See ASSETS.md.\n'
                                          'globalThis.GOONIES_GRAPHICS.sprites = ' +
                                          json.dumps(sprites, separators=(',', ':')) + ';\n')
        # Reference contact sheet is not needed by the native browser renderer.
        groups = [c['frames'] for c in sprites['characters']]
        sheet_width, sheet_height = 9 * 32, len(groups) * 28
        sheet = bytearray([0, 0, 0, 255] * sheet_width * sheet_height)
        for row, frames in enumerate(groups):
            for column, item in enumerate(frames):
                source = rgba_bitmap(base64.b64decode(item['packedBase64']), item['width'], item['height'])
                for y in range(item['height']):
                    target = ((row * 28 + y) * sheet_width + column * 32) * 4
                    sheet[target:target + item['width'] * 4] = source[y * item['width'] * 4:(y + 1) * item['width'] * 4]
        png(ROOT / 'research/goonies/characters.png', sheet_width, sheet_height, sheet)
        print(f'Exported {sum(len(c["frames"]) for c in sprites["characters"])} character frames, '
              f'{len(sprites["fratelli"]["frames"])} Fratelli frames, '
              f'{len(sprites["bat"]["frames"])} bat frames and original object graphics.')
    print('Exported eight actor-free 320×176 backgrounds, original title/ending and title wordmark.')


def capture():
    with tempfile.TemporaryDirectory(prefix='goonies-assets-') as folder:
        folder = Path(folder)
        image = folder / 'source.atr'
        shutil.copyfile(SOURCE, image)
        monitor = Monitor(image)
        try:
            monitor.prompt('bpc 0786')
            monitor.prompt('cont')
            rooms, memories = {}, {}
            for room in range(10):
                monitor.prompt(f'c 112e {room:02x}')
                monitor.prompt('c 1130 ff')  # Force a fresh original map, avoiding cached actors.
                monitor.prompt('bpc 0f69')
                monitor.prompt('cont 074a')
                dump = folder / 'ram.bin'
                monitor.prompt(f'write 0 bfff {dump}')
                memory = dump.read_bytes()
                if memory[0x1130] != room:
                    raise ValueError(f'Original loader did not reach room {room}.')
                rooms[str(room)] = {'packedBase64': base64.b64encode(memory[0x2290:0x3E10]).decode()}
                monitor.prompt('bpc 0786')
                monitor.prompt('cont')
                monitor.prompt(f'write 0 bfff {dump}')
                memories[room] = dump.read_bytes()
            return {'sourceSha256': SHA256, 'rooms': rooms, 'sprites': sprite_data(memories)}
        finally:
            monitor.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', action='store_true', help='Recapture all original rooms in Atari800')
    args = parser.parse_args()
    stored = ROOT / 'research/goonies/graphics-source.json'
    if args.capture:
        data = capture()
        stored.parent.mkdir(parents=True, exist_ok=True)
        stored.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    else:
        data = json.loads(stored.read_text())
    export(data)
