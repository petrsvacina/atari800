# Původní rozhodčí International Karate

Rozhodčí má samostatný původní bitmapový obraz **24 × 32 zobrazovaných pixelů**. Není odvozený zmenšením bojovníka ani překreslený podle videa. Zdrojová grafika je 96 bytů na `$45FB–$465A` v RAM načtené z uživatelova ATR.

Původní rutina `$465B` (`JMP` v tabulce na `$271D`) kopíruje těchto 96 bytů do `$13A0–$13FF` a `$17A0–$17FF`, tedy do posledních dvanácti znaků obou dynamických fontů. Kopie jsou s originálním zdrojem bytově identické.

Postava je složená z matice **tří sloupců a čtyř řádků znaků**:

```text
F4 F8 FC
F5 F9 FD
F6 FA FE
F7 FB FF
```

Jeden znak má osm řádků po čtyřech dvoubitových pixelech s dvojnásobnou šířkou. Glyphy se v paměti ukládají po sloupcích. Výstup `karate/assets/referee.js` obsahuje `globalThis.KARATE_REFEREE` s `width`, `height`, `x`, `y`, `palette` a `frames:[{id:"neutral",pixels:[0..3]}]` v běžném pořadí po řádcích. Barvy přebírá z ověřené bílé postavy v `palette.js`: 0 průhlednost, 1 tmavé části, 2 pleť, 3 bílé kimono.

## Umístění

Původní mapa souboje má široký krok **48 znaků / 384 pixelů**. Rozhodčí začíná na sloupci 40, řádku 1, tj. offset `$58` od začátku aktivní mapy `$0800` nebo `$1800`. Viditelný střed má 320 pixelů, takže se od obou stran odříznou čtyři znaky. Výsledná původní viditelná souřadnice je tedy **x=288** a počátek postavy je na původním obrazovém řádku **y=145** (souboj začíná 137 + jeden znak 8).

Webové pozadí začíná na y=25 namísto původního obrazového řádku 39. Odpovídající souřadnice rozhodčího v tomto webovém canvasu je proto **x=288, y=131**, při původní velikosti 24 × 32. To odpovídá vzdálenému rozhodčímu v pravé části uživatelova videa. Není potřeba měnit měřítko bitmapy.

## Pózy a ověření

Potvrzená je **jedna neutrální póza**. Rozbor přímých zápisů do celého rozsahu obou fontových kopií našel pouze uvedenou kopírovací rutinu; další původní obrazové pózy rozhodčího se nepodařilo doložit. Nápisy při přidělení bodů jsou oddělená znaková grafika a nejsou další pózou postavy. Výstup proto nevydává uměle vytvořené pohyby rukou za původní animaci rozhodčího.

`bitmap.bin` zachovává přesných 96 zdrojových bytů, `neutral.png` je transparentní kontrolní náhled, `provenance.json` obsahuje hash ATR a bitmapy. Náhled byl vizuálně ověřený a původní obraz se současně objevil při přímém dekódování celé obrazové mapy souboje s fontem `$1400`.

```sh
python3 tools/karate_extract_referee.py
# Nebo již načtený neupravený RAM dump:
python3 tools/karate_extract_referee.py --memory /path/to/ram.bin
```

Emulátor se používá jen pro vývojovou extrakci; do webu patří pouze `referee.js`. Zdrojový ATR a výzkumné podklady se nepřidávají do veřejného sestavení.
