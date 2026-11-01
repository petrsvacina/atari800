# Shift: původní XEX jako autorita

Zdroj, hash a adresní mapa: `source.json`. Dodaný soubor je úplná Atari verze,
nikoliv desetimístnostní preview z videa. Binární originál a referenční video
zůstávají nedotčené a mimo Git. Nativní webová hra je v `shift/`.

## Rozbor

| Oblast | Původní adresy | Nativní převod |
|---|---|---|
| Vstup programu, výuka, kódy | `$3C00–$3E19` | `app.mjs`, původní panely a tabulka kódů |
| Hlavní herní smyčka | `$3E1C–$3F52` | `Shift.run()` |
| Raster a časovač | `$3F8D–$3FFE` | `wait()`, 50 snímků na BCD sekundu |
| Inicializace/dekomprese místnosti | `$408B–$428B` | extrakce RLE do dat, `load()` |
| Sestavení adresy kolize | `$4303–$434F` | `address()`, původní 9bitová souřadnice |
| Joystick a kolize | `$4362–$4532` | `controls()`, `touch()`, `side()`, `pair()` |
| Převrácení světa | `$4533–$4671` | `shift()`, reverze 1000 buněk, bank znaků a souřadnic |
| Skok a gravitace | `$4672–$4778` | `support()`, `gravity()`, původní fáze a čítače |
| Smrt, mazání obrazovky | `$4779–$47ED` | `die()`, `wipe()` |
| Vysouvání a obnova plošin | `$47EE–$496A` | čtyři osmibajtové sloty, původní směrové masky |
| Přepínače a klíč | `$496B–$49F4` | kontakty s původními typy dlaždic |
| Titulní přechod a konec | `$49F5–$4AFE` | původní panely, sloupcové odkrývání a konečné číslo subjektu |
| POKEY efekty | `$4B00–$4BB9` | šest offline renderovaných originálních efektů |
| CMC přehrávač | `$0403/$0406`, data `$8400` | offline render, MP3 intro a přesná smyčka stavu přehrávače |
| PMG a animace | `$4BDA–$4F60` | původní 16bajtové snímky, pozice a počet snímků |

Kolizní tabulka `$7F30` rozlišuje barvy podlahy, běžné prostředí, bodce,
bránu, klíč, skrytý přechod a čtyři druhy přepínačů. Zachované jsou také
vedlejší efekty kolizních sond při skoku, pádu, podpírání a animaci plošiny.
Převrácení neprovádí obecná webová fyzika; přesně obrací původní pole,
mění font, paletu, adresy plošin a jejich směrové masky.

## Reprodukce

Vývojové závislosti: Python 3, `py65` (například `pip install py65`), Node,
FFmpeg a vývojový Atari800 s příkazy `DUMPSCREEN`, `RECORD`, `STOPRECORD`.
Žádná z těchto vývojových závislostí není herním runtime prohlížeče.

```sh
python3 tools/shift_extract.py
python3 tools/build_shift.py
node tools/test-shift.mjs
python3 tools/shift_capture_graphics.py --emulator /path/to/development/atari800
node tools/test-shift-raster.mjs
python3 tools/shift_capture_audio.py --verify-only
python3 tools/shift_capture_audio.py --emulator /path/to/development/atari800 --output /private/tmp/shift-audio
```

`oracle.json.gz` obsahuje 63 479 snímků. Pro každou místnost jsou původní
vstupy a výsledky; další případy přemisťují postavu vedle konkrétních prvků
mapy a nechají je zpracovat původní herní smyčkou. Kontakty se provádějí
v normální i převrácené orientaci. Zvláštní případ nechává vypršet celý
časovač úrovně 13. Další tři průběhy ověřují čtení kolizí mimo spodní okraj mapy. Tyto kontakty nejsou tvrzením o odehraném walkthrough.

`shift_original.py` vykonává originální 6502 pouze offline. Na vstupu
`$3F8D` přeskočí rasterové polling smyčky a pokračuje původním kódem
čítačů a časovače od `$3F97`. Na `$4B15` zkrátí výhradně CPU busy-wait,
se zachováním výsledného A/stavových bitů. Testuje se tedy pořadí logických
snímků, ne všechny cyklické náklady a vynechané fyzické rastry v režimu efektů.

`raster-oracle.json.gz` vzniká samostatně na skutečném Atari800 jádře:
originální display list, fonty, inverzní znaky, PMG, priorita a GTIA barvy.
Zápis do vývojové RAM slouží pouze k výběru místnosti a zastavení hlavního
vlákna; samotné obrazové řádky zpracuje ANTIC/GTIA. Fixture má 74 snímků,
po jednom výchozím a jednom po pokusu o převrácení pro každou místnost.
První dvě výukové místnosti a tajná místnost převrácení blokují i v originálu.
Výsledné porovnání zahrnuje všech 5 683 200 pixelů, ne několik vybraných bodů.

Hudba má celý stejný stav přehrávače na snímcích **16 641 a 33 281**,
perioda je 16 640 PAL snímků. Podrobnosti a hash RAM v `music-period.json`,
hash nahrávek a původní adresy efektů v `audio.json`.
Paleta je popsaná v `palette.json`; video určuje černou a bílou, pravidla
a všechny úrovně pocházejí z XEX.

Webová obálka byla funkčně ověřená v izolovaném headless Microsoft Edge
na desktopu i s mobilním viewportem a dvěma současnými touch kontakty.
Nativní Safari/iOS, fyzický gamepad, průchod celou hrou a úplná shoda
reálného časování ve všech zvukových režimech zatím ověřené nejsou.
