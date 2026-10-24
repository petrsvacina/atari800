# The Goonies — původní hudba a zvukové efekty

Zdrojový disk `Goonies/Goonies.atr` má SHA-256 `ccdea8ff8e56b9d09436de1ec64094e2130dee41f2d3d921f8c02f256f16bed7`. Zdroj a uživatelovo video nejsou upravené ani součástí runtime. Audio je vytažené ze skutečně načteného zvukového driveru `$8A00–$9695`, ne vystřižené z YouTube nahrávky. Prohlížeč dostává pouze MP3 a bezeztrátové PCM.

## Co hraje v původní hře

Původní rozhraní začíná na `$8A00`. Inicializace je `$8A7B`, periodický player `$8AB7` volaný z VBI přes `$8A0C`. Když je `$87=0`, běží efekty; při současném `$86=0` i hudba. Oba příznaky byly nulové v zachycené titulní obrazovce i po čisté inicializaci první herní místnosti. Hudba tedy není v tomto ověřeném výchozím stavu vypnutá.

Samostatný hudební engine má inicializaci `$8E89` a periodickou funkci `$8F0C`. Používá první tři POKEY kanály; efekty používají čtvrtý, takže původní rozhraní dovoluje hudbu i zvuky současně. Žádná samostatná výsledková skladba nebyla v této verzi nalezená. Export proto nepřidává vymyšlenou hudbu pro konec místnosti nebo vítězství.

Rozhraní pro požadavek zvuku `$8A12` dostává ID v A:

- ID 16 a 24 přepínají na seznam `$8FBE`, pattern `$9278`; tento seznam je opravdu aktivní v zachycené titulní obrazovce. Export jej pojmenovává `title`.
- ID 17 a 18 vybírají seznam `$8FBB`, pattern `$8FC1`. Export jej pojmenovává `ingame`.
- Zbylá ID 1–15 a 19–23 vybírají krátké efekty. ID 8 má prázdnou sekvenci; proto není publikované jako falešný tichý efekt.

V nativním webovém portu se titulní stopa použije v nabídce a druhá po spuštění hry. Úplné mapování původních místností na oba seznamy nebylo potvrzené; toto rozdělení je poctivě uvedené chování portu, nikoli tvrzení o každé původní scéně.

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

### Výběr pro události nové webové hry

`eventEffects` má výchozí mapování:

| Webová událost | Původní ID |
| --- | --- |
| jump | 1 |
| switch | 23 |
| puzzle | 3 |
| hurt | 4 |
| door | 6 |
| exit | 20 |
| clear | 9 |
| life | 21 |
| complete | 19 |

**Jsou to volby nové webové implementace.** Samotné zvuky jsou původní, ale přesné původní callsite přiřazení těchto herních událostí nebylo potvrzené. Metadata tento rozdíl uvádějí v `eventEffectsEvidence`; názvy událostí se nevydávají za názvy původních efektů. Audio API zachovává všechna původní číselná ID, takže lze později konkrétní přiřazení upřesnit bez nové extrakce.

## API, reprodukce a ověření

`goonies-web/assets/audio.js` definuje `GOONIES_AUDIO` s poli `sourceSha256`, `encoding:'s16le'`, `sampleRate:22050`, `tracks`, `loops`, `effects` a `eventEffects`. PCM se převádí z každé little endian dvojice na signed int16 a dělí 32768. Doporučená je monofonie krátkých efektů nebo malý limit hlasů; hudba může pokračovat současně.

```sh
python3 tools/goonies_extract_audio.py
# Nebo použít již načtený ověřený výpis RAM:
python3 tools/goonies_extract_audio.py --memory /path/to/ram.bin
```

Export potřebuje původní ATR, Atari800 pro první načtení (ne při `--memory`), místní VLC/GME a FFmpeg. VLC má vypnuté uživatelské nastavení i knihovnu médií. Vývojové SAP obálky zůstávají v `research/goonies/` a jsou ignorované Gitem.

Obě MP3 byly celé dekódované bez chyb. Všech 19 PCM proudů je nenulových, má správný počet 16bitových vzorků a délky; hashe souhlasí s `goonies-web/assets/audio/provenance.json`. Titulní MP3 má RMS přibližně −24,2 dBFS, herní −24,5 dBFS; špičky jsou −9,6 / −10,8 dBFS. Nejde o tichý export ani přebuzené nahrávky. Původní disk zůstává se stejným SHA-256.
