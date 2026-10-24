# The Goonies — obrazová data

## Podklady a veřejný runtime

Čistá pozadí, titulní a závěrečná obrazovka pocházejí z dodaného `Goonies.atr` (SHA-256 `ccdea8ff8e56b9d09436de1ec64094e2130dee41f2d3d921f8c02f256f16bed7`). Původní video je barevnou referencí. Nově dodaný 130XE XEX (SHA-256 `3178f530d27b361f4f99a0c4f5454c7d2584b9e5967cd803a1f8057ef44b799a`) poskytl přesné kolize, tělesné rozměry, výchozí stavy, snímky a tabulky mechanismů.

Atari800 slouží pouze při rozboru a vytváření referencí. Veřejné prostředky neobsahují ROM, disk, XEX, úplný dump RAM ani procesorový kód. Původní soubory a video zůstávají místní.

## Obraz a paleta

Logický Canvas má 336×240. Herní bitmapa 320×176 leží na (8,32). V referenčním ATR jde o `$2290..$3E0F`, 7 040 bytů po 40 bytech na řádek. Předchozích 16 řádků patří HUD a nejsou součástí porovnávání herní bitmapy.

Jeden byte obsahuje čtyři dvoubitové barvy, každá je vodorovně zdvojená. Paleta podle dodaného videa:

| Index | RGB |
| --- | --- |
| 0 | `#000000` |
| 1 | `#761200` |
| 2 | `#4e30e2` |
| 3 | `#eeeeee` |

Nulová barva je v softwarových spritech průhledná. Plná analogová shoda všech Atari zobrazovačů se netvrdí.

`graphics-source.json` a `graphics-provenance.json` uchovávají původní obrazová data a jejich původ. `assets/graphics.js` obsahuje čisté bitmapy místností, jejich PNG cesty, logo, titulní a závěrečný obraz. Herní pořadí původních resource ID je `[0,2,1,3,4,5,6,7]`; 8 je závěr, 9 titul.

## Sprite, jeho poloha a fáze

Původní kreslicí počátek je:

```text
x = floor(actor.x / 4) * 8
y = actor.y - 16
phase = actor.x & 3
```

Vodorovná souřadnice tělesa používá dva fyzické pixely na jednotku. Čtyři grafické fáze zajišťují jemný posun mezi osmipixelovými sloupci. Nejsou samy o sobě čtyřmi časovými animačními snímky. To platí i pro čtyři varianty židle; otáčet jimi podle času je chyba.

Pózy 0/2 a 1/3 jsou chůze podle směru a `x & 2`; 4/5 lezení podle `y & 4`; 6 je klid; na horní tyči se používají 5/7. Číselné tělesné rozměry patří aktuální logické póze, nikoli ořezané neprůhledné části obrázku.

Na lodi používá Sloth základ **49**, tedy snímky 49–56. Snímek 57 je zvláštní póza Matky Fratelliové. Dřívější alias přiřazující Slothovi 57 byl chybný. Podobně původní type 6 / room3 frame30 je valící se kámen; skuteční netopýři jsou type 4, snímky 16–19.

## Datové moduly

`assets/physics.js` (`GOONIES_ORIGINAL`) poskytuje:

- globální šířky/výšky kolizních těles;
- původní kolizní obdélníky, hráče a inicializované sloty každé scény;
- čtyři fáze ověřených logických snímků jako `{width,height,packed}`;
- číselné adresy scénických rutin jako údaj o původu, bez jejich kódu.

Exportují se společné snímky 0–29 a prokazatelně používané scénické rozsahy: kámen 30, pták/vejce 31–42, kapky 43–47, klec 48, Sloth a zvláštní lodní póza 49–57. Nepoužívaný zbytek globální LUT se nepovažuje podle náhodně platné hlavičky za grafiku.

`assets/mechanisms.js` (`GOONIES_MECHANISMS`) obsahuje pojmenované tabulky ventilů, drah, plošin, průlezů, zdvihů, stavů a jejich přímo kreslené bitmapové záznamy. `raster.js` skládá čisté pozadí, předměty a postavy v původním pořadí, včetně kreslení některých objektů až za postavami.

`assets/sprites.js` zůstává zdrojovým archivem dřívějšího grafického exportu. Runtime domu používá jeho společné předměty, ostatní scénické rekvizity a postavy používají nové ověřené tabulky. Staré heuristické názvy/pózové aliasy tohoto archivu neurčují herní chování.

## Opakování exportu a kontrola

```sh
python3 tools/goonies_extract_assets.py
python3 tools/goonies_extract_physics.py
python3 tools/goonies_extract_mechanisms.py
node tools/test-goonies.mjs
```

Tyto reexporty čtou uložená grafická a číselná data. Nové zachycení přes Atari800 vyžaduje `goonies_extract_assets.py --capture` pro ATR nebo `goonies_extract_physics.py --capture` a následné `goonies_extract_mechanisms.py --capture` pro XEX.

Referenční testy porovnávají 2 744 celých herních bitmap přes SHA-256 všech původních obrazových bytů. Zahrnují také tlačenou židli a čisté místo, které po sobě nechává. Počítají i tělesné pozice a kolize; nejde pouze o kontrolu rozměrů PNG. Rozsah a omezení herního ověření jsou v `PORTING.md`.
