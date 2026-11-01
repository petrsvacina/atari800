#!/usr/bin/env python3
"""Extract adventure data from the two supplied disks (no CPU in the web runtime)."""
import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {'en': ('neverending_story.atr', 'ceae1484d4ba5475a5180eea746db79abffccd21117ce42e72f9386a15358acd'),
           'cs': ('nekonecny_pribeh.atr', '7133abc4f8e9b686beddcdacc73470a54bc3c5ffd30b08b14d549b9fe8b616e7')}
ACTION_ARGS = [0, 2, 0, 0, 2, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0]
CONDITION_ARGS = [1, 1, 1, 1, 1, 2, 1, 1, 1, 1]


def extract(language):
    name, digest = SOURCES[language]
    disk = (ROOT / name).read_bytes()
    assert hashlib.sha256(disk).hexdigest() == digest, 'Unexpected source disk'
    sectors = lambda s, n: disk[16 + (s - 1) * 128:16 + (s + n - 1) * 128]
    memory = bytearray(65536)
    memory[0x6300:0x9500] = sectors(504, 100)
    memory[0x300:0x2000] = sectors(10, 58)
    memory[0xe380:0xf000] = sectors(695, 25)
    word = lambda a: int.from_bytes(memory[a:a + 2], 'little')
    table = lambda a, n: [word(a + i * 2) for i in range(n)]
    b64 = lambda b: base64.b64encode(bytes(b)).decode()

    def message(address):
        """Retain original word boundaries and proper-name dictionary tokens."""
        parts = []
        while memory[address] != 64:
            c = memory[address]
            address += 1
            if c & 128:
                p = word(word(0x76f8) + (c & 127) * 2)
                parts.append([bytes(memory[p + 1:p + 1 + memory[p]]).decode('latin1'), True])
            else:
                chars = [c]
                while memory[address] != 64 and not (65 <= memory[address] <= 90 or memory[address] & 128):
                    chars.append(memory[address]); address += 1
                parts.append([bytes(chars).decode('latin1'), False])
        return parts

    def script(address):
        out = []
        for _ in range(2048):
            code = memory[address]; address += 1
            if code in (254, 255): count = 0
            elif code >= 128: count = CONDITION_ARGS[code & 127]
            else: count = ACTION_ARGS[code]
            out.append([code, *memory[address:address + count]])
            address += count
            if code == 255: return out
        raise ValueError('Unterminated adventure script')

    command_count = memory[0x84fc]
    commands = [list(memory[0x7431 + 2 * i:0x7433 + 2 * i]) for i in range(command_count)]
    command_scripts = [script(a) for a in table(word(0x846e), command_count)]
    vocab = []
    a = word(0x742d)
    while memory[a] != 64:
        vocab.append([bytes(memory[a:a + 3]).decode('latin1'), memory[a + 3]]); a += 4
    movements = []
    for p in table(word(0x7145), 10):
        path = []
        while memory[p] != 255:
            path.append(list(memory[p:p + 2])); p += 2
        movements.append(path)
    item_texts = [message(word(word(0x76fc) + 2 * i) + 1) for i in range(memory[0x7d93])]
    item_prefixes = [memory[word(word(0x76fc) + 2 * i)] for i in range(memory[0x7d93])]
    chapters = []
    for i in range(3):
        memory[0xa800:0xc000] = bytes(0x1800)
        data = sectors(word(0x90c0 + i * 2), memory[0x90c6 + i])
        memory[0xa800:0xa800 + len(data)] = data
        rooms = (word(word(0xa800)) - word(0xa800)) // 2
        messages = (word(word(0xa802)) - word(0xa802)) // 2
        graphics = sectors(word(0x90c9 + i * 2), memory[0x90cf + i])
        chapters.append({'base': memory[0x68be + i], 'rooms': [message(a) for a in table(word(0xa800), rooms)],
                         'messages': [message(a) for a in table(word(0xa802), messages)],
                         'automatic': script(0xa806), 'roomScripts': [script(a) for a in table(word(0xa804), rooms)],
                         'initialize': script(word(0x68c1 + i * 2)), 'graphics': b64(graphics)})
    return {'source': name, 'sha256': digest, 'vocabulary': vocab,
            'common': [message(a) for a in table(word(0x76fa), 71)], 'items': item_texts,
            'itemPrefixes': item_prefixes, 'commands': commands, 'commandScripts': command_scripts,
            'automatic': script(word(0x76fe)), 'chapters': chapters,
            'initialObjects': list(memory[0x7d5c:0x7d5c + memory[0x7d93]]),
            'objectSprites': list(memory[0x7d94:0x7db3]),
            'movements': movements, 'roomImages': list(memory[0x6841:0x68be]),
            'descriptors': [list(memory[0x1e00 + i * 6:0x1e06 + i * 6]) for i in range(57)],
            'sceneColors': list(memory[0x3bb:0x3f4]),
            'initialOverlays': [list(memory[0x842d + i * 6:0x8433 + i * 6]) for i in range(6)],
            'background': b64(memory[0xe380:0xf000]), 'font': b64(memory[0x400:0xb20]),
            'smallGraphics': b64(memory[0xb00:0x2000])}


def main():
    languages = {language: extract(language) for language in SOURCES}
    en, cs = languages['en'], languages['cs']
    localized = ['source', 'sha256', 'vocabulary', 'common', 'items', 'chapters', 'background']
    for key in en:
        if key not in localized:
            assert en[key] == cs[key], f'Different game rules/assets: {key}'
    for i, (a, b) in enumerate(zip(en['chapters'], cs['chapters'])):
        for key in ['base', 'automatic', 'roomScripts', 'initialize', 'graphics']:
            assert a[key] == b[key], f'Different chapter {i} {key}'
    shared = {k: v for k, v in en.items() if k not in localized}
    shared['chapters'] = [{k: v for k, v in c.items() if k not in ['rooms', 'messages']} for c in en['chapters']]
    text = {lang: {k: v for k, v in data.items() if k in localized and k != 'chapters'} |
            {'chapters': [{k: c[k] for k in ['rooms', 'messages']} for c in data['chapters']]} for lang, data in languages.items()}
    palette = (ROOT / 'research/neverending-story/default.act').read_bytes()
    output = ROOT / 'neverending-story/assets/data.js'
    output.parent.mkdir(parents=True, exist_ok=True)
    result = {'rules': shared, 'languages': text, 'palette': list(palette)}
    output.write_text('// Extracted original adventure data; no 6502 instructions or emulator.\n' +
                      'globalThis.NEVERENDING_DATA=' + json.dumps(result, separators=(',', ':')) + ';\n')
    print('Extracted both languages, all 125 locations, 70 command scripts and three chapters:', output)


if __name__ == '__main__': main()
