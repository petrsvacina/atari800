# Podklady pro přepis Dynakillers

## Vstupy

- `Dynakillers.xex`: původní uživatelem dodaná binární hra, 38 140 bytů. Segment `$2AB0–$BF9F` a RUNAD `$AD40`. Vstupní soubor nebyl upraven.
- `dynakill_x1.asx`: uživatelem uložená HTML stránka SourceForge s vloženým výpisem zdrojového kódu. Ponechána beze změny.
- `research/dynakill-unchained.asx`: čistý text 8 277 řádků vytažený z HTML. Je to rozbor **upravené verze Unchained**, takže její odlišnosti nejsou automaticky považované za vlastnosti původního XEX.
- [Zdrojový výpis Unchained, revize 6](https://sourceforge.net/p/dynakillers-unchained/code/6/tree/dynakill_x1.asx), [popis autora úpravy](https://sourceforge.net/p/dynakillers-unchained/wiki/Home/).

Grafika, mapy a samply webové hry jsou vytažené z původního uživatelova XEX, ne z obrázků či změněných dat Unchained. Čtení této varianty slouží především pro názvy rutin a vysvětlení původních adres zachovaných v komentářích. Přepis nemění autorství ani licenci původních herních dat a nepřidává jim novou licenci.

## Rozbalení a extrakce

XEX používá Marco/GMG BitPacker 1.3. Ladicí režim místního Atari800 se zastavil na `$AD40`, následně na kopii rozbalovače `$0480` a nakonec na vstupu rozbalené hry `$9000`. Výpis paměti `$0000–$BFFF` umožnil číst původní data a kód. V tomto kroku je část samplů `$3000–$4FFF` prohozená s pamětí pod OS ROM `$E000–$FFFF`; tato data se samostatně vyčetla po přepnutí PORTB na `$FE`. OS ROM není přiložená k webové hře.

Opakovatelný export:

```sh
python3 tools/extract_assets.py
```

Potřebuje místní `atari800` s ladicím monitorem. Emulátor je pouze vývojový nástroj; výsledné HTML jej nepoužívá. Nástroj spouští SDL s `dummy` ovladačem, nevytváří grafické okno a zakazuje ukládání konfigurace. Výstupem jsou `web/assets/original-data.js` a `web/assets/logo.png`. Export obsahuje SHA-256 zdrojového XEX pro kontrolu původu.

## Ověřené adresy původní hry

| Adresa | Význam a použití |
| --- | --- |
| `$1100` | První bitmapová část titulní obrazovky: logo, 40 bytů na řádek, 53 řádků |
| `$2800–$2BFF` | Znaková grafika ANTIC 4, 128 znaků po osmi řádcích |
| `$2B00` | Osm masek arén po 30 bytech, 240 bitů; v tomto rozsahu současně grafické znaky vyšších indexů |
| `$2C00–$2CBF` | Čtyři směry barevné postavy; každý 48 bytů pro dvě barevné vrstvy a tři fáze nohou |
| `$2CC0` | Jednobarevné postavy původního režimu pro tři hráče |
| `$2A00` | Pracovní logická mapa, 20 × 12; hodnoty 0 podlaha, 1 zeď, 2 kámen, 3 náhoda, 4 stop, 5 bomba+, 6 plamen+, 7 bomba |
| `$A0FF / $A107 / $A10F` | Tři barvy pro osm prostředí |
| `$A117–$A15D` | Rozbalení bitové masky mapy do 240 polí |
| `$A16E–$A1B7` | Náhodné kameny a vyčištění všech čtyř rohů |
| `$A1EF` | Dlaždice: znak TL, BL, TR, BR, 16 × 16 zobrazovaných pixelů |
| `$A4C6–$A4EA` | Dvě barevné vrstvy postav; šest řádků hlavy a šest řádků nohou |
| `$A9A1–$AA4C` | Bonusy; maximálně 10 současných bomb a síla plamene 19 včetně středu |
| `$AC13–$AC4B` | Zápalnice 150 / 75 PAL snímků; síla plamene a vlastník |
| `$ACC3 / $AD97` | Zapálení výbuchu, když zbývá 20 snímků: běžná zápalnice do výbuchu tedy 130/50 = 2,6 s |
| `$AE2E–$AE92` | Zastavení o zeď/kámen/bombu, bonus pod kamenem a zapálení další bomby |
| `$AE95` | Síla včetně středu; před krokem do dalšího pole se dekrementuje |
| `$B095–$B0A8` | Ukazatele na osm zvukových samplů, hranice `$3000,$3AFF,$4090,$4BFF,$5470,$6108,$68FF,$7558,$7ED0` |
| `$B05B–$B079` | Nižší a vyšší nibble jako amplituda, každý držený dva řádky; přibližně 7 800 vzorků za sekundu v PAL |

Web používá pevné simulační kroky 50 Hz. Náhodnost generuje `Math.random`, neduplikuje generátor POKEY. Efekty mají 30 sekund; některé původní čítače mohou mít nepatrně jinou délku. Kolize jsou nově napsané geometrické testy, ne překlad instrukce po instrukci. Web nemá simulaci 6502, ANTIC, GTIA ani POKEY.

## Limity ověření

Původní program byl spuštěný a zastavovaný v hlavním menu i inicializovaném herním stavu v headless Atari800. Získaná data a adresy jsou potvrzené jeho monitorem. Nebyl vizuálně odehraný celý originál a neproběhlo snímkové srovnání obou implementací. Barevná paleta je odhad, zvuková data jsou původní, ale Web Audio není obvod POKEY a má jiné filtrování. Hudba je doplněná jako předem vyrenderovaná nahrávka, viz níže.

## Původní hudba

Obě skladby jsou vytažené z dodaného XEX: herní data začínají na `$3000`, titulní na `$4000`, CMC přehrávač je na `$3800`. Inicializace volá `$3803` s A=$70 a ukazatelem na data, následně s A=$00, X=$00. Periodická rutina volá `$3806` a původní zápis registrů `$9CEB–$9D3F`, který zajišťuje i stereo směrování. Malá SAP obálka v `research/music/dynakillers-title.sap` a `dynakillers-ingame.sap` umožní tyto rutiny spustit pouze pro offline render.

[ASMA reference](https://asma.atari.org/asma/Composers/Vybostok_Marian/Dynakillers.sap) potvrzuje Mariana Vybostoka (Goldmaster), rok 1997, dvě stereo skladby a časy 02:36.59 / 01:42.84. Referenční SAP je uložený jako `research/music/dynakillers-asma.sap`. Hudební data `$3000–$37FF` a `$4000–$45DE` se s XEX shodují bajtově; pracovní stav přehrávače se liší a reference má jinou inicializační obálku. Referenční nahrávka a nahrávka našeho ripu mají odpovídající průběh hudby; nejde o bitově identický audio render.

```sh
python3 tools/extract_music.py
```

Vývojový export potřebuje Atari800 pro rozbalení, místní VLC s podporou GME a FFmpeg s libmp3lame. Přepínač `--memory /path/to/dump.bin` umožňuje využít již rozbalenou paměť. VLC má vypnuté načítání/ukládání uživatelské konfigurace a knihovnu médií. Render je o něco delší než výsledný soubor, aby jej přehrávač předčasně nezeslaboval. FFmpeg z něj ponechá ověřenou délku a přidá pouze šestimilisekundové zeslabení na okrajích proti lupnutí.

Výsledkem jsou dvě místní MP3 nahrávky, 44 100 Hz, stereo, 160 kbit/s. `web/assets/music/provenance.json` obsahuje SHA-256 zdrojového XEX a výstupních souborů. Prohlížeč používá standardní zvukové přehrávání; neobsahuje 6502 ani emulaci POKEY. Titulní a herní skladba se přepínají podle stavu hry, mezi koly hudba pokračuje, pauza zachová pozici. Nahrávky se opakují celé od začátku včetně úvodu, nereprodukují interní skok původního CMC playeru do pozdější části skladby.
