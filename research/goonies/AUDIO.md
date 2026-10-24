# The Goonies — původní hudba a zvukové efekty

Zdrojový disk `Goonies/Goonies.atr` má SHA-256 `ccdea8ff8e56b9d09436de1ec64094e2130dee41f2d3d921f8c02f256f16bed7`. Zdroj a uživatelovo video nejsou upravené ani součástí runtime. Audio je vytažené ze skutečně načteného zvukového driveru `$8A00–$9695`, ne vystřižené z YouTube nahrávky. Prohlížeč dostává pouze MP3 a bezeztrátové PCM.

## Co hraje v původní hře

Původní rozhraní začíná na `$8A00`. Inicializace je `$8A7B`, periodický player `$8AB7` volaný z VBI přes `$8A0C`. Když je `$87=0`, běží efekty; při současném `$86=0` i hudba. Oba příznaky byly nulové v zachycené titulní obrazovce i po čisté inicializaci první herní místnosti. Hudba tedy není v tomto ověřeném výchozím stavu vypnutá.

Samostatný hudební engine má inicializaci `$8E89` a periodickou funkci `$8F0C`. Používá první tři POKEY kanály; efekty používají čtvrtý, takže původní rozhraní dovoluje hudbu i zvuky současně. Žádná samostatná výsledková skladba nebyla v této verzi nalezená. Export proto nepřidává vymyšlenou hudbu pro konec místnosti nebo vítězství.

Rozhraní pro požadavek zvuku `$8A12` dostává ID v A:

- ID 16 a 24 přepínají na seznam `$8FBE`, pattern `$9278`; tento seznam je opravdu aktivní v zachycené titulní obrazovce. Export jej pojmenovává `title`.
- ID 17 a 18 vybírají seznam `$8FBB`, pattern `$8FC1`. Export jej pojmenovává `ingame`.
- Zbylá ID 1–15 a 19–23 vybírají krátké efekty. ID 8 má prázdnou sekvenci a zastaví aktuální efekt; PCM se pro něj nepublikuje.

Herní smyčka vybírá hudbu původní tabulkou `$0890`. V pořadí webových scén jsou požadavky `[17,24,18,18,17,0,17,17]`: u věder hraje titulní seznam, v ostatních scénách herní. Nula u varhan znamená nepřepínat dosavadní skladbu; samostatný trénink varhan začíná herním seznamem. Opakované požadavky skladbu nerestartují.

## Hudební smyčky

Titulní pattern má základní časový počet 832 a tempo 3; herní 640 a tempo 3. Smyčka zahrnuje jeden původní obnovovací VBI navíc: `count*tempo+1`. Obálka používá `NTSC` a `FASTPLAY 262`; při VLC/GME vykreslování je to přibližně 59,38 volání/s. To přibližuje NTSC referenční video, neznamená to úplnou analogovou shodu s fyzickým Atari. [Primární specifikace SAP](https://asap.sourceforge.net/sap-format.html) popisuje INIT, PLAYER a FASTPLAY.

Výsledné délky:

- `title.mp3`: přibližně **42,053919 s**;
- `ingame.mp3`: přibližně **32,353055 s**.

Obě MP3 mají stereo 44 100 Hz a 160 kbit/s. Pole `GOONIES_AUDIO.loops` udává smyčky od 0 do těchto časů. Jde o celou původní patternovou smyčku; na okrajích je jen 3/4ms náběh/doběh proti digitálnímu lupnutí. Soubor MP3 při dekódování respektuje vlastní informaci o encoder delay, v prohlížeči se nastaví `loop=true` nebo se použijí uvedené body.

Do soukromé vývojové SAP obálky se kopírují jen kód a data zvuku. Volá přímo `$8E89/$8F0C` nebo `$8AC9`; není důvod spouštět grafiku, OS či pomocný ochranný kód `$966C`, který mění RAM. Původní instrukce generující zvuk se nepatchují.

## Devatenáct původních efektů

Přehrávač efektů `$8AC9` používá čtvrtý kanál (`AUDF4/AUDC4`). Ukazatele jsou na `$8B1F`. Data jsou trojice `délka ve VBI, frekvence, AUDC`. Nulová délka následovaná nulou ukončí zvuk; nulová délka následovaná nenulovou hodnotou vrátí sekvenci na začátek. Tuto skutečnou smyčku má ID 5.

Publikovaná ID: **1,2,3,4,5,6,7,9,10,11,12,13,14,15,19,20,21,22,23**. Všech 19 je vyrenderovaných původní rutinou, v mono PCM signed 16-bit little endian, **22050 Hz**, vložených přímo v JS jako base64. Načítání proto funguje i přes `file://` bez `fetch()` a bez runtime emulátoru. `duration`, `loop`, původní adresa a hashe jsou uvedené u jednotlivých efektů.

### Ověřené požadavky původních mechanismů

Mechanismy posílají přímo původní číselné ID. Následující adresy volání patří dodanému XEX; společné pomocné rutiny jsou v ATR přeložené jinam. Samotný driver `$8A12` je v obou verzích na stejné adrese.

| Událost | ID | Původní volání |
| --- | --- | --- |
| Uhašení krbu | 1 | `$1942` |
| Obsazená tiskárna, každý herní krok | 2 | `$182E` |
| Výstřel | 3 | `$A579`, resource 1 |
| Prasknutí potrubí | 4 | `$A879`, resource 1 |
| Rumpál zdvihá vědro | 5 | `$A6B1`, resource 2 |
| Přepnutí postavy | 6 | `$09C9` |
| Zvon vypouští netopýry | 7 | `$A462`, resource 3 |
| Otevření odtoku chobotnice | 9 | `$A77F`, resource 6 |
| Dopad kapky mimo klávesy; pád do moře | 10 | `$A6D9`, resource 5; `$A500/$A531`, resource 7 |
| Tři klávesy varhan, tělem i kapkou | 11–13 | `$A57B`, tabulka `$A583`, resource 5 |
| Kontakt s pružinou | 14 | `$09E5` |
| Pohyb zatíženého závaží / lodního zdvihu | 15 | `$A610`, resource 2; `$A76C/$A782`, resource 7 |
| Fratelli se zastaví a pustí vodu | 20 | `$A7FA`, resource 1 |
| Dopad mince | 21 | `$A718`, resource 7 |
| Valící se kámen | 22 | `$A6F0`, resource 3 |
| Obrat padajícího vědra | 23 | `$A4F9`, resource 2 |

Generické zprávy o hádance, průchodu nebo obyčejném skoku nepřidávají dřívější odhadované efekty. `eventEffects` obsahuje pouze ověřené přepnutí postavy na ID 6. ID 19 zůstává dostupné ve zvukových datech, ale žádnému novému hernímu ději se nepřiřazuje odhadem.

### Monofonie a opakování

Přepis respektuje rozhodování driveru `$8A50–$8A76`: požadavky 2, 7 a 22 čekají na volný kanál. Opakovaná tiskárna tedy nepřerušuje svůj přibližně 1,11s cyklus. ID 15 nepřeruší samo sebe, ale může nahradit jiný efekt. Ostatní efekty nahrazují dosavadní hlas. ID 5 má skutečnou PCM smyčku; nahradí ji další přijatý efekt, požadavek 8 nebo přechod/pauza/ztlumení webu. Při opakovaných požadavcích rumpálu se znovu spouští stejně jako původní sekvence.

## API, reprodukce a ověření

`goonies-web/assets/audio.js` definuje `GOONIES_AUDIO` s poli `sourceSha256`, `encoding:'s16le'`, `sampleRate:22050`, `tracks`, `loops`, `effects`, `roomMusic` a `eventEffects`. PCM se převádí z každé little endian dvojice na signed int16 a dělí 32768. Efekty používají jeden hlas s výše popsanými pravidly; hudba pokračuje současně.

```sh
python3 tools/goonies_extract_audio.py
# Nebo použít již načtený ověřený výpis RAM:
python3 tools/goonies_extract_audio.py --memory /path/to/ram.bin
```

Export potřebuje původní ATR, Atari800 pro první načtení (ne při `--memory`), místní VLC/GME a FFmpeg. VLC má vypnuté uživatelské nastavení i knihovnu médií. Vývojové SAP obálky zůstávají v `research/goonies/` a jsou ignorované Gitem.

Obě MP3 byly celé dekódované bez chyb. Všech 19 PCM proudů je nenulových, má správný počet 16bitových vzorků a délky; hashe souhlasí s `goonies-web/assets/audio/provenance.json`. Titulní MP3 má RMS přibližně −24,2 dBFS, herní −24,5 dBFS; špičky jsou −9,6 / −10,8 dBFS. Nejde o tichý export ani přebuzené nahrávky. Původní disk zůstává se stejným SHA-256.

Nové reference `goonies-sound-oracle.json` obsahují **1 466 úplných bitmap a posloupností původních zvukových požadavků** ve 23 situacích všech osmi místností. Vývojová obálka zaznamenává vstup do skutečného driveru a pokračuje jeho původním tělem. Nepřepisuje herní ani zvuková pravidla; log používá jen nepoužívaný pool náhodných bytů při deterministickém RNG. Shoda bitmap současně kontroluje, že logování nemění obraz. Patří sem 40 kroků tiskárny, 420 kroků kamene/zvonu/hejna, varhany, vědra, odtok, střelba a lodní mechanismy. Samostatných **14 zvukových kontrol** ověřuje i nepřerušovaný cyklus tiskárny, priority, smyčku, výběr hudby, mute/pauzu a pozdní či odmítnuté přehrání.
