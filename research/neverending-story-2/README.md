# NeverEnding Story II — původní data a vývojové reference

Zdroje jsou v uživatelově adresáři `Neverending_story_2_CZE_ENG/`, který
se spolu s původními ATR nepublikuje a neukládá do Gitu.
`sources.json` zaznamenává SHA-256 disket a všech vyjmutých souborů.
Návody v herních assets mají stejné hashe jako dodané originály.

- CS ATR: `ec66fd50199e5cf2d3886393f6b2ff4fcf5d0a237f13ca1b5d598f196b79d3be`.
- EN ATR: `a04846117bd6400e69fa9598959e392488e779a59bc914cea6b854b721e1babb`.

## Programy

Diskety mají DOS adresář od sektoru 361 a 1 040 sektorů po 128 bytech.
Aktivní soubory používají 125 datových bajtů a navazování sektorů MyDOS
s příznakem pro šestnáctibitové číslo. Extraktor kontroluje zdrojové hashe,
cykly řetězců, délky sektorů a deklarované počty sektorů.

Anglické `GAMES.BAS`, `GAMES1.BAS`, `GAMES2.BAS` jsou tokenizované zdroje
Turbo BASIC XL. Offline překladač rozebere tabulku názvů proměnných, BCD
konstanty a jednotlivé výroky; překládá herní IF, přiřazení, přechody,
podprogramy, text a vstupy do stejného formátu pojmenovaného herního stavu.
Tokenové rozhraní bylo porovnáno s tabulkami původního vývojového nástroje
<https://github.com/dmsc/tbxl-parser/tree/master/peg>.

České `.CTB` jsou kompilované programy se vstupem `$226F`. Jejich podmínky
a přiřazení se offline rekonstruují podle skutečných volání kompilátorových
knihovních funkcí. Například `$EB77` načítá proměnnou, `$EBD9` přiřazuje BCD
konstantu, `$F29D` porovnává rovnost a `$ECAB` tiskne řetězec s délkou.
Původní instrukce a adresy se na web neexportují. Runtime dostane pouze
adventurní predikáty, texty a akce s obyčejnými indexy příběhových větví.
Neznámý výrok nebo knihovní funkce při sestavení způsobí chybu.

Verze mají rozdílné texty, slovníky, font a některé větve příkazů. Anglický
závěr navíc používá `KING.MIC`. Každý jazyk proto vykonává své vlastní
původní větve; mezi nimi se předává společný význam proměnných, část,
místnost a bod čekání. Překreslení po přepnutí pracuje s kopií příznaků
a poté obnoví nezměněný stav. Nevkládá nový příkaz do originální logiky.

## CPU reference

`tools/neverstory2_capture.py` spustí privátní kopii české diskety v Atari800.
Ověří postupně načtené programy a zachytí 64 KiB RAM obou částí na prvním
`INPUT` v `$F196`. Pro pokračování úvodem/přechodem se pouze nastaví
původní klávesa RETURN. Adresa `$5A39` vede do skutečného načítání druhé
části; příběhová pravidla se neobcházejí pro generování příkazových případů.

`tools/neverstory2_oracle.py` vykonává původní české rutiny pomocí py65.
Původní konverze a přiřazení vstupního řetězce se provádí také; nahrazený je
jen E: záznam klávesnice. Textové a diskové hranice a hudba se zachytávají,
aby běh mohl být deterministický bez operačního systému a mechaniky.
Podmínky, přiřazení, skoky a podprogramy běží svými původními instrukcemi.

`oracle.json.gz` obsahuje 4 528 případů (2 160 v části I, 2 368 v části II).
Každá ze 24 vstupních místností dostává své skutečné řetězce příkazů,
neznámý a prázdný vstup, inventář a osm stavů příznaků. Hodnoty 0, 1, 99,
−1 a deterministické kombinace pokrývají také položky v inventáři a spotřebu.
Výsledky obsahují všechny herní proměnné, místnost, text, nově načtenou
bitmapu, barvu a typ čekání. Náhodný výběr případů má seed 20211104;
nejde o důkaz všech kombinací příznaků ani o samostatný anglický CPU oracle.

## Obraz a zvuk

Herní `.MIC` jsou přímo 3 200 bajtů režimu ANTIC E: 160×80 čtyřbarevných
pixelů s dvojnásobnou šířkou. Následuje 40×15 znaků z původního `NICE.FNT`.
Aktuální `COLPF0` se přebírá z programu; další indexy obrázku jsou 134, 30,
16. DLI pro text nastavuje pozadí na index 4 a popředí 14.

`graphics.json` porovnává úvodní skutečně vykreslenou českou obrazovku a
21 rasterových konfigurací všech herních bitmap/fontů. Referenční nástroj
ponechává skutečný VBI/DLI a textový buffer Atari, načte původní bitmapové
a fontové bajty a zachytí ANTIC/GTIA scanout. Výřez je x=32..351,
y=20..219. Tyto obrazové případy samy neověřují průchod hádankami.

Titulní `.MIC` má 7 680 obrazových bajtů a čtyři barevné bajty. Zohledněny
jsou i následné původní `SETCOLOR 1,15,15` a `POKE 708,0`. Je uložen jako
neměnný PNG a slouží také jako obrázek místního katalogu.

CMC data i přehrávač jsou v obou disketách bytově totožné. Přímá inicializace
`$A016` s A=$70, X=$00, Y=$98, poté příkaz A=0/X=0 zahajují skladbu.
Původní PAL VBI volá `$A26E`. Úplný stav `$9800..$A70C` i zápisových POKEY
registrů se shoduje po snímcích 5 761 a 11 521: perioda 5 760 snímků.
Atari800 nahrál skutečný POKEY průběh celé skladby a opakování; `audio.json`
obsahuje hashe a časové body smyčky. MP3 96 kb/s je balené do JS pro chod
samostatného HTML bez fetch. Zachycení není měřením fáze analogového Atari.

## Reprodukce

Z kořene projektu, s vývojovým Atari800 podporujícím DUMPSCREEN a RECORD:

```sh
python3 tools/neverstory2_extract.py --output /private/tmp/neverstory2-files
python3 tools/neverstory2_capture.py --emulator /cesta/atari800 --output /private/tmp/neverstory2-reference
python3 tools/neverstory2_oracle.py --memory /private/tmp/neverstory2-reference/cs-game.bin --memory2 /private/tmp/neverstory2-reference/cs-game2.bin --py65-path /cesta/py65 --output research/neverending-story-2/oracle.json.gz
python3 tools/neverstory2_audio.py --verify-only --memory /private/tmp/neverstory2-reference/cs-game.bin --py65-path /cesta/py65 --period /private/tmp/neverstory2-reference/music-period.json
python3 tools/neverstory2_audio.py --emulator /cesta/atari800 --disk /private/tmp/neverstory2-reference/reference.atr --state /private/tmp/neverstory2-reference/cs-game.a8s --period /private/tmp/neverstory2-reference/music-period.json --output /private/tmp/neverstory2-audio
python3 tools/build_neverstory2.py
node tools/test-neverstory2.mjs
python3 tools/build_portal.py
python3 tools/test-portal-build.py
```

RAM dumpy, původní tokenizované/kompilované programy a vývojový CPU nejsou
součástí webového sestavení ani Gitu. Rozsah a limity jsou také v herním README.
