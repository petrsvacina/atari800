# Původní prostředí a hudba

## Sedm pozadí

`karate/assets/backgrounds/scene-0.png` až `scene-6.png` jsou původní panoramata o rozměrech **320 × 98**. Pořadí odpovídá původním indexům scén: Sydney, New York, Rio de Janeiro, japonský chrám, Egypt, Atény, hora Fudži. Názvy slouží jako popis motivu, nejsou načtené z původních textových tabulek.

Jsou vytažené z uživatelova ATR s SHA-256 `b30ddd0920a00a99d8b41d97b24d72cc57150e73e9a3686e0f35cb74f3b62bec`. Původní disk se nekopíruje do webové hry a při extrakci se používá jen jeho dočasná kopie. Obrazová data jsou na `$B000–$BF4F` (98 řádků po 40 bytech). Jde o ANTIC E, ale vícebarevný výsledek zahrnuje i původní player/missile vrstvy a DLI změny barev; čtyřbarevná konverze samotné bitmapy by byla chybná.

Nástroj po nabootování zastaví hlavní vlákno na `$2F33`, přes původní rutinu `$4389` postupně načte všech sedm scén. Pro každý obraz nastaví původní display list rutinou `$3451`, nechá běžet původní VBI/DLI a zachytí GTIA registry na konci každého obrazového řádku. Rekonstrukce skládá ANTIC bitmapu, PMG masky, šířky, pozice, barvy a prioritu `04`. Mezipodklady jsou `background-data.json`; neobsahují OS ROM ani celý dump RAM. Prohlížeč vykresluje jen hotové PNG, žádný Atari hardware nesimuluje.

Priorita `$04` znamená **všechny PF0–PF3 před player/missile grafikou**. PMG tedy doplňuje jen průhledné pixely pozadí. Teprve `$08` by dávalo PMG před PF2/PF3. Oprava této záměny obnovila černé plochy pod mostem, ve stínech opery a na dalších stavbách; bitmapová data se nezměnila. Pořadí potvrzují [původní Atari Hardware Manual](https://www.atarimania.com/documents/atari-400-800-hardware-manual.pdf) a [Altirra Hardware Reference, oddíl 6.7](https://www.cpcwiki.eu/imgs/0/04/Altirra_Hardware_Reference_Manual_-_20240921.pdf).

RGB odstíny Sydney nyní vycházejí z **uživatelem dodaného videa** `INTERNATIONAL KARATE (ATARI 800XL) [gRUhpxmUl1o].mkv`. Byly prohlédnuté snímky v časech 20, 100, 200, 350, 440 a 490 sekund; všechny ukazují Sydney. Původní indexová bitmapa byla zarovnaná se snímkem 200 s (počátek přibližně x=47,8 / y=93,2 ve videu 642 × 480; měřítko 1,69 × 1,67). Mediány byly měřené na vnitřních pixelech stejných původních barevných tříd, s erozí okrajů kvůli škálování a kompresi H.264/YUV. Voda má RGB `(41,66,155)`, obloha `(126,192,229)`, šedá `(118,122,123)`, bílá `(215,217,216)` a slunce `(230,215,146)`.

`reference-palette.json` ukládá hash videa, geometrické zarovnání, změřené barvy, úplnou výstupní paletu a výslovné rozlišení změřených a nezměřených barev. Exportér ji automaticky použije před původní pracovní `Default.act`. U odstínů nepřítomných v Sydney používá tlumenou RGB extrapolaci z těchto měření; **dalších šest scén není videem barevně potvrzených**. Žádná geometrie ani původní bitmapový bajt se barevnou kalibrací nemění. Výsledek nereprodukuje analogové PAL filtrování či artefakty a nebyl porovnaný s fyzickým Atari. Video a vyjmuté referenční snímky se nepublikují.

### Bojovníci a podlaha

Původní dvoubitové pixely snímků mají pořadí **0 průhlednost, 1 tmavé vlasy/pásek/stín, 2 pleť, 3 kimono**. Pracovní náhled měl indexy 1/2 barevně chybně interpretované. Přesné zarovnání původního snímku 0 s oběma bojovníky ve videu 200 s potvrdilo jejich správný význam. Měřené mediány vnitřních pixelů jsou:

| Bojovník | Index 1 | Index 2 | Index 3 |
| --- | --- | --- | --- |
| Bílý | `(23,2,0)` | `(188,153,138)` | `(226,217,203)` |
| Červený | `(31,0,0)` | `(200,148,129)` | `(151,91,74)` |

Odlišnost odstínů pleti/stínu mezi hráči souvisí i s barevným přeléváním komprimovaného videa. `karate/assets/palette.js` zachovává tyto změřené odstíny a pořadí. Podlaha je RGB **`(138,95,32)` / `#8a5f20`**, medián volné oblasti x60–450/y260–330 ve snímku 200 s. Během souboje je původní `COLBK=$16`; černý `$00` z pozdější části snímku odpovídá jiné zobrazovací oblasti a nelze jej přenést na celou podlahu.

```sh
# Převést již zachycené podklady na PNG:
python3 tools/karate_extract_backgrounds.py
# Úplně zopakovat extrakci originálem v Atari800:
python3 tools/karate_extract_backgrounds.py --capture --palette /path/to/palette.act
```

Obrázky byly vizuálně zkontrolované, všechny mají 320 × 98 a SHA-256 v `backgrounds/provenance.json`.

## Původní hudba Roba Hubbarda

Původní skladba z roku 1986 je zachovaná jako MP3 `karate/assets/music/international-karate.mp3`: **4:31,10**, 44 100 Hz, dva kanály, 160 kbit/s. Hudba je vyrenderovaná mimo prohlížeč z [ASMA SAP](https://asma.atari.org/asma/Composers/Hubbard_Rob/International_Karate.sap), jehož ověřená kopie je `international-karate-asma.sap`.

Reference nahrává přehrávač a data na `$1F00–$26D3`, INIT `$1F00`, PLAYER `$1F06`. Porovnání s RAM běžícího dodaného ATR potvrdilo shodu **1974 z 2004 bytů**. Zbylých 30 bytů jsou dva samomodifikované operandy `$204E`/`$2101` a pracovní stav přehrávače v `$2149–$216F`. Nejde o novou napodobeninu hudby.

```sh
python3 tools/karate_render_music.py
```

Render používá místní VLC/GME s vypnutým ukládáním konfigurace a knihovnou médií a následně FFmpeg. Zdrojové časování SAP je 04:31.10 LOOP. GME dostane při renderu delší čas, aby neztišil originál před koncem; FFmpeg ořízne ověřených 271,10 sekundy a přidá pouze 6ms náběh/doběh proti lupnutí. Výsledná MP3 byla ověřená úplným dekódováním a kontrolou délky, kanálů a vzorkování. Prvních 15 sekund má RMS −18,39 dBFS a špičku −5,95 dBFS; nejde o tichý nebo oříznutý render.

Web může nahrávku opakovat celou od začátku. Přesný vnitřní návrat originálního driveru není simulovaný. Pro reprodukci původu a kontrolu výstupu slouží `music/provenance.json` s hashi ATR, SAP a MP3. Původní skladatel a autor grafiky zůstávají původními autory; výtažky zde nedostávají novou licenci.
