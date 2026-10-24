#!/usr/bin/env python3
"""Build native puzzle geometry traced from the supplied Goonies playthrough.

Graphics are extracted separately. These collision surfaces and puzzle timings
are new port data, not claimed to be original Atari collision tables.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALIASES = [
    {'printing-press': 'press', 'fireplace': 'fire'},
    {'float': 'ball'},
    {'left-valve': 'valve1', 'upper-right-valve': 'valve2'},
    {'cannon': 'rock', 'upper-chain': 'chain1', 'middle-chain': 'chain2', 'lower-chain': 'chain3', 'counterweight': 'seat', 'rock-chute': 'pipe'},
    {'right-bone': 'bone', 'egg-stack': 'pile'}, {},
    {'release-bone': 'bone', 'lock-bar': 'lock', 'right-flipper': 'flipper'},
    {'lower-cabin-lever': 'leverA', 'upper-left-lever': 'leverB', 'treasure-chest': 'chest', 'mast-boom': 'boom'},
]
COPY = [
    ('Židle pod půdu, peníze z tiskárny a voda do krbu. Každý má svůj úkol.', 'Přesuň židli k otvoru na půdu. Jeden obsluhuje tiskárnu, druhý překlopí vodu a uhasí krb.', 'Židli tlač tělem k pravému otvoru. Na půdě zůstaň u tiskárny. Přepni postavu, dole přetlač vodní nádrž a vejdi do krbu. Pak se rychle vrať pro parťáka.'),
    ('Jeden drží rumpál, druhý získá klíč nad jezírkem.', 'Spodní rumpál otevře cestu na plovoucí kámen. Z něj doskočíš k horní tyči a klíči.', 'Sestup pravým žebříkem na dno. Jeden zůstane u rumpálu. Druhý vlevo vyskočí na dolní výstupek a vyšplhá k jezírku. Přes plovoucí kámen zachyť horní tyč šipkou nahoru a přeručkuj doprava pro klíč.'),
    ('Zavřete oba ventily současně. Tlak otevře pravý tunel.', 'Jeden Goonie musí držet levý prostřední ventil, druhý pravý horní. Potrubí potom praskne.', 'U ventilu skoč nebo stiskni nahoru a nech postavu zavěšenou. FIRE přepne na druhého. Po prasknutí potrubí se mohou oba pustit a odejít pravým prostředním tunelem.'),
    ('Jeden hlídá spodní past. Druhý vede kameny přes troje dvířka.', 'Tři správně vedené kameny rozbijí tři prkna před levým spodním tunelem.', 'Druhého nech na spodním závaží. Za řetězy se zavěšuje šipkou nahoru. Kámen nejprve propadne horní pastí; v druhém patře musí mířit doprava, ve třetím doleva. Při přešlápnutí počkej na další odraz.'),
    ('Čtyři vejce vytvoří schody u pravého tunelu.', 'Jeden tahá za horní pravou kost. Druhý posouvá padající vejce přes most do pravého spodního kouta.', 'Na pravé horní misce se odrazíš výš, až ke kosti. Nech tam jednoho Goonieho viset a druhým posouvej vejce doprava. Čtyři vejce se složí pod vyvýšeným pravým východem. Pak dostaň ven i držitele kosti.'),
    ('Podpěry se mění s padající vodou. Načasuj každý skok.', 'Oba překonají barevné podpěry vlevo a z varhan sejdou po pravých římsách k dolnímu výstupu.', 'Šikmý skok je nahoru a směr současně. Nespěchej: dvě barvy právě drží, třetí mizí. U prostředního žebříku je bezpečné místo pro prvního. Potom převeď druhého a oba pokračujte doprava.'),
    ('Kost uvolní klec. Z klece dosáhneš na zarážku pod vahadlem.', 'Jeden drží spodní zarážku, druhý skáče na pravém vahadle. Voda klesne a chobotnice uvolní cestu.', 'Nejdřív zatáhni za horní levou kost. Klec zůstane dole i po puštění. Z klece vyskoč k zarážce. Druhý se vrátí na pravé vahadlo a třikrát ho stlačí. Horní tyče zachytíš nahoru; novým stiskem nahoru z nich odskočíš.'),
    ('Páky otevřou cestu. Sloth odtlačí truhlu a zvedne parťáka na stěžni.', 'Nejprve přepněte spodní a horní levou páku. Sloth pak zatlačí truhlu doprava a mince odlákají Fratelliovou.', 'Menší Goonie přepne spodní páku. Sloth obslouží horní levou, pak dosáhne k truhle. Menší se postaví na rameno stěžně a Sloth znovu přepne spodní páku. Z vyzdviženého ramene doskoč k pokladu a sejděte se tam oba.'),
]


def build():
    source = json.loads((ROOT / 'research/goonies/scenes.json').read_text())
    levels = []
    for i, original in enumerate(source['scenes']):
        level = {k: original[k] for k in ('name', 'sourceRoomId', 'platforms', 'ladders', 'exit')}
        level.update(id=i, spawns=original['spawn'], rails=original.get('rails', []), enemies=[], hazards=[], walls=[])
        level['intro'], level['objective'], level['hint'] = COPY[i]
        level['objects'] = [{**o, 'id': ALIASES[i].get(o['id'], o['id'])} for o in original['objects']]
        objects = {o['id']: o for o in level['objects']}
        for o in objects.values():
            if o['kind'] in ('hold-up', 'hang-up'):
                o['y'] += 14  # Convert overhead handle to hanging character's feet.
                o['dy'] = 18
        level['exit'].update(dx=max(12, original['exit']['width'] / 2), dy=14)
        if i == 0:
            level['jumpVelocity'] = 3.1
            objects['chair'].update(minX=42, maxX=208)
            objects['press']['y'] = 32
            level['ladders'][1]['requiresChair'] = True
            level['platforms'].append({'x1': 208, 'x2': 224, 'y': 32})
            level['enemies'] = [{'kind': 'fratelli', 'x': 244, 'y': 134, 'range': 35, 'period': 150, 'w': 9, 'h': 8}]
            level['exit']['y'] = 143
        elif i == 1:
            objects['crank']['y'] = 168
            objects['ball'].update(x=96, centerX=160, range=64, y=112, raisedY=112)
            objects['key']['y'] = 82
            level['walls'].append({'x': 66, 'y': 82, 'w': 8, 'h': 48, 'unlessHeld': 'crank'})
            level['hazards'] = [{'kind': 'water', 'x': 80, 'y': 118, 'w': 160, 'h': 12, 'message': 'Do jezírka jen přes plovoucí kámen a horní tyč.'}]
            level['enemies'] = [{'kind': 'bat', 'x': 160, 'y': 38, 'range': 100, 'period': 110}]
        elif i == 2:
            level['enemies'] = [{'kind': 'fratelli', 'x': 256, 'y': 24, 'range': 28, 'period': 150}]
        elif i == 3:
            for x1, x2, y, gate in [(112, 128, 40, 'chain1'), (112, 128, 80, 'chain2'), (144, 160, 120, 'chain3')]:
                level['platforms'].append({'x1': x1, 'x2': x2, 'y': y, 'gate': gate})
            objects['seat']['y'] = 168
            objects['pipe']['x'] = 136
            level['rockBounds'] = [{'top': 0, 'bottom': 60, 'left': 32, 'right': 310}, {'top': 60, 'bottom': 100, 'left': 32, 'right': 272}, {'top': 100, 'bottom': 150, 'left': 32, 'right': 272}]
        elif i == 4:
            objects['bird']['x'] = 108
            level['objects'].append({'id': 'chute', 'kind': 'receiver', 'x': 264, 'y': 170})
            level['objects'].append({'id': 'spring', 'kind': 'spring', 'x': 264, 'y': 80})
            level['platforms'].append({'x1': 216, 'x2': 256, 'y': 170, 'requiresHeld': 'bone'})
            level['hazards'] = [{'kind': 'lava', 'x': 216, 'y': 172, 'w': 40, 'h': 5}]
        elif i == 5:
            level['spawns'][1].update(x=20, y=56)
            level['platforms'].extend({**p, 'color': p['colorGroup']} for p in original['dynamicPlatforms'])
            level['hazards'] = [{'kind': 'water', 'x': 24, 'y': 169, 'w': 240, 'h': 7}]
        elif i == 6:
            objects['cage']['y'] = 152
            level['spawns'] = [{'x': 72, 'y': 96}, {'x': 168, 'y': 34, 'rail': 0}]
            level['platforms'].append({'x1': 136, 'x2': 168, 'y': 144})
            level['platforms'].append({'x1': 152, 'x2': 168, 'y': 88})
            level['hazards'] = [{'kind': 'water', 'x': 40, 'y': 166, 'w': 240, 'h': 10}]
            level['enemies'] = [{'kind': 'bat', 'x': 190, 'y': 112, 'range': 55, 'period': 115}]
        elif i == 7:
            level['spawns'][1].update(x=62, y=164)
            objects['leverA']['y'] = 164
            objects['leverB']['y'] = 44
            level['enemies'] = [{'kind': 'fratelli', 'x': 248, 'y': 116, 'range': 18, 'period': 130}]
            level['hazards'] = [{'kind': 'water', 'x': 0, 'y': 172, 'w': 320, 'h': 4}]
        levels.append(level)
    dest = ROOT / 'goonies-web/assets/levels.js'
    dest.write_text('// Native collision geometry and puzzle anchors; see research/goonies/RULES.md.\n'
                    'globalThis.GOONIES_LEVELS = ' + json.dumps(levels, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'Built {len(levels)} native Goonies puzzle scenes.')


if __name__ == '__main__':
    build()
