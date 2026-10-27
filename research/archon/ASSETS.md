# Archon — původní grafické podklady

## Vstupy a ověření

Uživatelův `Archon.xex` má 27 692 bytů a SHA-256 `44be88e99b08731719966cba0b65d1932c48d50c44111749050f8a9a8d7135df`. Obsahuje blok `$3000–$9C1F` a RUNAD `$9C00`. Vstupní rutina přenese 108 stránek (`$6C00` bytů) z `$3000` na `$1000` a skočí na `$32EC`. Rozložení bylo potvrzené spuštěním originálu v místním Atari800 s vypnutým BASICem, zakázaným ukládáním konfigurace a ladicím breakpointem na `$32EC`.

Nástroj `tools/archon_extract_assets.py` pak provádí stejný přesun přímo nad byty XEX. Veškeré exportované bitmapy jednotek, terénní tabulka, font a ukazatele byly porovnané s nezávislým monitorem získaným RAM dumpem a jsou bytově identické. Do výstupů nepatří celý RAM dump ani OS ROM. Původní soubor zůstává beze změny.

```sh
python3 tools/archon_extract_assets.py
```

Výstup `archon/assets/sprites.js` definuje `globalThis.ARCHON_ASSETS`. Původní Atari kód se v prohlížeči neprovádí; HTML5 hra používá jen tyto grafické podklady.

## Jednotky a animace

Tabulka `$56C0` obsahuje 20 ukazatelů na souvislá bitmapová data `$207C–$32EB`. Každý snímek má **16 bytů, jeden byte na řádek**. Bit je vykreslený s dvojnásobnou šířkou: osm bitů tedy tvoří **16 × 16 zobrazovaných pixelů**. Jednotky mají po patnácti snímcích, Shapeshifter deset, celkem **295 původních snímků**.

| ID | Jednotka | ID | Jednotka |
| --- | --- | --- | --- |
| 0 | Unicorn | 10 | Manticore |
| 1 | Wizard | 11 | Troll |
| 2 | Archer | 12 | Shapeshifter |
| 3 | Golem | 13 | Dragon |
| 4 | Valkyrie | 14 | Banshee |
| 5 | Djinni | 15 | Goblin |
| 6 | Phoenix | 16 | Air |
| 7 | Knight | 17 | Fire |
| 8 | Basilisk | 18 | Earth |
| 9 | Sorceress | 19 | Water |

API: `ARCHON_ASSETS.units[id].frames[frameId]` je pole šestnácti původních bytů. Nastavený bit na pozici `bit` se vykreslí do `x=bit*2`, šířka 2, výška 1. `boardFrame=0` je počáteční ikona; původní inicializace pro druhy 8–15 používá vodorovné zrcadlení, zaznamenané v `defaultMirror`.

Renderovací rutina `$5C75` vybírá snímek z tabulky posunů `$5CDC` podle směrového příznaku `$0624,X` a fáze `$0628,X & 3`. Horní bit příznaku otáčí pořadí bitů každého řádku:

- Chůze doprava: snímky **0,1,2,3**; doleva totéž zrcadlené.
- Chůze dolů: **4,5,4,6**.
- Chůze nahoru: **7,8,7,9**.
- Počáteční útočná póza: doprava/doleva **12**, nahoru **10**, dolů **14**. Další detailní načasování a speciální schopnosti určuje herní logika, nikoli samotné bitmapy.

`research/archon/unit-frames.png` obsahuje kontaktní list: dvacet řádků ve výše uvedeném pořadí, snímky zleva od nuly. Byl vizuálně prohlédnutý: koně, postavy s lukem a mečem, obři, ptáci, draci, duchové i čtyři elementálové mají samostatnou původní grafiku.

## Projektily a plošné efekty

Tabulka `$56E8` dává každému druhu ukazatel do `$1E00–$1FFF`. Běžný projektil má **čtyři varianty po osmi řádcích**, tedy 16 × 8 zobrazovaných pixelů: vertikální, horizontální a obě diagonály. API `units[id].projectile.frames[0..3]` uchovává všechny čtyři varianty; `raw` má původních 32 bytů. Příslušná tabulka směrových posunů začíná za rámcovou tabulkou `$5CED` hodnotami 8,0,16,24. Čtyři elementálové některé z těchto původních projektilů sdílejí.

Phoenix a Banshee používají jejich 32bytová data jinak, jako plošný efekt PMG s měněnou vodorovnou velikostí:

- **Phoenix:** `$1EC0–$1EDF`; původní tabulka `$6E92` má rozměry **16×16 → 32×32 → 64×32 → 32×32 → 16×16**. Největší fáze začíná 24 pixelů vlevo a 8 nahoru od postavy. Přechodné malé fáze současně používají grafiku vlastní postavy.
- **Banshee:** `$1FC0–$1FDF`; rutina `$6E63` nastavuje výšku 32 a `SIZEP=3`, tedy **64×32**, rovněž posunuté o −24/−8.

Tyto rozměry jsou přímo důsledkem původní šířky PMG bitů a počtu řádků. Nemají být vydávané za kruhový zásah se stejným poloměrem ve všech směrech. API `areaEffects` obsahuje surová data, rozměry a posuny; úplné vyhodnocení střetů patří do přepisu herní logiky.

## Šachovnice, překážky a písmo

`$202B–$207B` obsahuje přesnou tabulku **81 polí 9 × 9**, řazenou po řádcích. Hodnoty: `0` trvale tmavé, `64` trvale světlé, `192` proměnlivé podle cyklu. Rutina `$43A9` čte tuto tabulku, u proměnlivých polí používá spodní čtyři bity `COLOR3`. Export `terrain` zachovává originální hodnoty, nepoužívá prosté střídání barev jako běžné šachy.

**Barva podlahy arény odpovídá cílovému poli souboje.** Kód `$5171` čte typ pole `$0664`: nula vybírá základ `$5A59` (`B0`), kladná hodnota vybírá `$5A57` (`BE`), záporná/proměnlivá hodnota skládá `(COLOR3 & $0F) + základ B0`. `$518D` ukládá výslednou barvu do `$0633` a její jasový index `(color & $0F) >> 1` do `$0653`. Po otevření arény `$5373/$5376` přenese tuto barvu do `COLBK` shadow `$02C8`. Jas 0–7 tedy může být klíčem pro výběr odpovídajícího odstínu `palette.board.variable`; pevná světlá/tmavá pole používají krajní odstíny. Přechodové vykreslování při otevírání arény může krátce používat jinou barvu.

Původní ikony se na desce rozmisťují po 16 × 16 pixelech (`$5903`), horizontální pozice v barevných hodinách je `column*8+$5C` a řádková `row*16+$31`. Po přepočtu z PMG je levý okraj první ikony x=88; absolutní obrazový řádek jejího počátku y=49. Web nyní používá toto původní rozestoupení bez mezery mezi poli.

První tři neprázdné znaky fontu `$1C00` (indexy 1–3) tvoří překážky arény. V původním **ANTIC 7** jde o jednobitové glyphy 8 × 8, zvětšené 2 × 2 na **16 × 16 bodů**; horní dva bity znaku volí PF barvu. Dřívější export `obstacles.pixels` chybně předpokládal dvoubitový režim a runtime jej už nepoužívá. `assets/mechanics.js` nese původní řádky a `arena.js` z nich stejně počítá obraz i kolize. Generátor má 18 překážek; proměny určuje rozdíl jasu registrů.

Bitmapa magických bodů pochází z `$63A2–$63B1`, čtyři multiplexované HPOS fáze z `$63B2–$63B5`, barva `$34`. Exportér `tools/archon_extract_mechanics.py` ji přidává spolu s tabulkami generátoru, AI a 256 RGB odstíny místní Atari palety. Paletu lze změnit parametrem `--palette`; její SHA-256 je v exportu.

`font.rows` obsahuje prvních 64 znaků stejného fontu, osm bytů na znak, `firstChar=32`. Běžná velká písmena a číslice se tedy čtou podle `charCode-32`. Jsou to původní čtyřbarevné znaky ANTIC 4 o 8 × 8 zobrazovaných pixelech. Celá autorská titulní obrazovka ani logo Electronic Arts zde nejsou deklarované jako samostatně vytažený bitmapový obrázek.

## Barvy podle uživatelova videa

`Archon Atari 8 bit Computer Gameplay Longplay 400 800 XL XE [CokJQ8CI4Xk].mkv` sloužilo jako vizuální a barevná reference. Byly prohlédnuté časy 10,60,180,400 a700 s. `reference-palette.json` zaznamenává hash videa, měřené oblasti a metodu. Video a vytažené pracovní snímky se nepublikují.

`archon/assets/palette.js` definuje `globalThis.ARCHON_PALETTE`. Používá mediány velkých jednolitých ploch zmenšeného referenčního snímku 960 × 540, pro jednotky prahově vybrané barevné popředí:

- Pozadí / tmavé pole: RGB **0,23,0**.
- Světlé pole: **161,253,218**; proměnlivé prostřední pole na 60 s: **8,136,59**.
- Světlé jednotky: **161,195,66**; tmavé: **1,59,123**.
- Aréna na700 s: podlaha **46,176,100**, rám **117,25,55**.

Původní tabulka barev `$5A55` potvrzuje různé registry `EA` pro světlou stranu, `94` pro tmavou, `BE` pro světlá pole, `B6` jako počáteční proměnlivou barvu a `B0` pro pozadí. Mezistupně v `board.variable` jsou interpolované mezi doloženými barvami, Značka magického bodu a nové arénové třídy už používají původní registry; další odstíny vycházejí z exportované Atari palety. **Jde o přiblížení konkrétní ztrátově komprimované nahrávce, nikoli o přesné měření fyzického PAL/NTSC Atari.**

`asset-provenance.json` uvádí SHA-256 XEX, rozsahy, tabulky a hash původních bitmap. Výstupní JavaScript a jeho tvar prošly kontrolou počtů všech dvaceti druhů, 295 snímků, 81 polí, tří překážek a 64 fontových znaků.
