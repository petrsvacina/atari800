#!/usr/bin/env python3
"""Build Czech scene copy. Runtime geometry comes from the original XEX tables."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
COPY = [('Židle pod půdu, peníze z tiskárny a voda do krbu. Každý má svůj úkol.', 'Přesuň židli k otvoru na půdu. Jeden obsluhuje tiskárnu, druhý překlopí vodu a uhasí krb.', 'Židli tlač pod pravý otvor na půdu. Vyskoč na ni a vyšplhej nahoru k tiskárně. Druhým Gooniem dole skoč doprava do nádrže, aby se převrhla. Po uhašení slez krbem a jdi tunelem úplně doprava. Pak přiveď i parťáka.'), ('Jeden drží rumpál, druhý získá klíč nad jezírkem.', 'Spodní rumpál otevře cestu na plovoucí kámen. Z něj doskočíš k horní tyči a klíči.', 'Jeden stojí u spodního rumpálu a drží zdvih. Druhý projde kolem věder na plovoucí kámen a zachytí horní tyč. Klíč je u jejího levého konce. Potom se oba sejdou u levých dolních dveří.'), ('Tři ventily mění proudy vody. Dva správné musí být zavřené současně.', 'Jeden Goonie musí držet levý prostřední ventil, druhý pravý horní. Potrubí potom praskne.', 'Spodní pravý ventil pomůže přesměrovat vodu a dostat parťáka nahoru. Nakonec musí jeden stát u horního pravého a druhý u prostředního levého ventilu. Tlak roztrhne pravé potrubí a oba mohou do tunelu za ním.'), ('Jeden hlídá spodní past. Druhý vede kameny přes troje dvířka.', 'Tři správně vedené kameny rozbijí tři prkna před levým spodním tunelem.', 'Druhého nech na spodním závaží. Za řetězy se zavěšuje šipkou nahoru. Kámen nejprve propadne horní pastí; v druhém patře musí mířit doprava, ve třetím doleva. Při přešlápnutí počkej na další odraz.'), ('Čtyři vejce vytvoří schody u pravého tunelu.', 'Jeden tahá za horní pravou kost. Druhý posouvá padající vejce přes most do pravého spodního kouta.', 'Na pravé horní misce se odrazíš výš, až ke kosti. Nech tam jednoho Goonieho viset a druhým posouvej vejce doprava. Čtyři vejce se složí pod vyvýšeným pravým východem. Pak dostaň ven i držitele kosti.'), ('Kapky a tlakové desky mění barevné podpěry. Načasuj každý skok.', 'Oba překonají barevné podpěry vlevo a z varhan sejdou po pravých římsách k dolnímu výstupu.', 'Sleduj dopadající kapky. Tři tlakové desky u varhan mění, které plošiny drží; může na nich stát i Goonie. Průchody u varhan se používají směrem doprava. Oba nakonec patří do pravého dolního tunelu.'), ('Kost uvolní klec. Z klece dosáhneš na zarážku pod vahadlem.', 'Uvolni klec a dostaň jednoho Goonieho na spodní zarážku. Druhý stlačí odblokované vahadlo a vypustí jezírko.', 'Zatáhni za horní levou kost, aby klec spadla. Posuň ji pod spodní zarážku a vyskoč k ní. Nech jednoho viset a druhým stlač vahadlo nad ní. Voda potom odteče a chobotnice klesne. Horní tyč se pouští dolů.'), ('Páky otevřou průlezy. Sloth pomůže s truhlou a zdvihem stěžně.', 'Přidržujte páky, aby druhý mohl projít průlezy. Posuňte horní truhlu doprava a dostaňte oba Goonies k pokladu.', 'Když jeden drží páku, druhý může průlezem dál. Posunutá truhla sype mince, které odlákají Fratelliovou. Menší se postaví na rameno stěžně a Sloth u prostředního mechanismu přidrží jeho zdvih. Oba se musí sejít nahoře u truhly.')]

def build():
    source = json.loads((ROOT / 'research/goonies/scenes.json').read_text())
    levels = []
    for i, scene in enumerate(source['scenes']):
        intro, objective, hint = COPY[i]
        levels.append({'id': i, 'name': scene['name'], 'sourceRoomId': scene['sourceRoomId'],
                       'intro': intro, 'objective': objective, 'hint': hint})
    (ROOT / 'goonies-web/assets/levels.js').write_text(
        '// Scene labels and hints. Physics and puzzles use original extracted tables.\n'
        'globalThis.GOONIES_LEVELS = ' + json.dumps(levels, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('Built Czech copy for eight original Goonies scenes.')

if __name__ == '__main__':
    build()
