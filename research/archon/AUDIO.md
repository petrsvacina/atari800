# Archon — původní zvuková data a offline render

Zdroj je dodaný `Archon.xex`, SHA-256 `44be88e99b08731719966cba0b65d1932c48d50c44111749050f8a9a8d7135df`. Původní loader přesune segment `$3000–$9C1F` o `$2000` dolů a skočí na `$32EC`. Exportér provede přesun nad XEX; nepoužívá OS ROM ani dump RAM.

## Hudba a hodiny

Inicializace `$75E7`, titulní fáze `$06AB=1` a sekvencer `$762B / $76D7 / $77E3 / $7900` jsou původní. Výsledková fáze má `$06AB=5`. MP3 obsahují původní motivy; délky připraveného signálu jsou přibližně **26,516 s** a **2,378 s** plus rámcování MP3.

Uživatel zvolil NTSC: `1789790 / (114 × 262) ≈ 59,9233 Hz`. SAP obálka má NTSC a FASTPLAY 262, avšak místní VLC/GME renderer používá pro tento výstup hodiny 1773447 Hz (59,3762 volání/s). Export proto opravuje délku i výšku signálu poměrem **1789790/1773447** přes `asetrate` a resampling. Hodnoty, délky a hashe nese `assets/audio/provenance.json`. Referenční video kolem 26,5 s potvrzuje délku titulního motivu, neurčuje herní pravidla.

Offline obálka mění odchod `JMP $E462` na RTS, aby původní zvukový handler vrátil řízení renderéru. Původní tabulky, sekvencer a frekvenční zápisy zůstávají. `$06A7=0` vynechává pomocné vykreslení. Do prohlížeče patří jen MP3 a PCM, žádný původní kód ani emulátor.

## Sedmnáct efektů

Sekvencer `$796E` používá ukazatele `$C3–$CA` a stav `$1276–$127D`. `$FD` nastavuje AUDC, dvojice pak počet volání/AUDF; `$FE` vrací smyčku, `$FF` končí.

| Web ID | Původní zdroj | Účel |
| --- | --- | --- |
| 0–5 | `$7AB5`, `$7ACE`, `$7AD7`, `$7AF4`, `$7B0D`, `$7A7C` | Pohybové smyčky |
| 6–7 | `$7A1A`, `$7A4B` | Nabito, zvlášť pro bojové strany |
| 8–9 | `$7B2F`, `$7B58` | Kontakt zbraně, strana střelce |
| 10 | `$7B1A` | Pět fází Fénixova výbuchu, 50 volání |
| 11 | `$7B81` | Bánší, 40 volání |
| 12–16 | Registrace `$6F2E–$6F3D`, parametry 3/4/5/6/7 | Průběžný tón letící střely |

Tabulka `$5759` mapuje druhy 0–19 na pohybové efekty `[3,4,4,0,1,1,5,4,2,4,3,0,1,2,1,4,1,1,0,2]`. Pohyb v aréně spouští a zastavuje smyčku podle původního animačního stavu. Nabíjecí efekt se spouští až při vynulování čítače, nikoli při výstřelu. Normální letící střela používá AUDC `$8A` a přičítá svůj parametr k AUDF; offline se připraví celý cyklus `256/gcd(parametr,256)` volání. Fénix a Bánší mají vlastní jednorázové sekvence a po jejich zániku zvuk skončí.

`archon/assets/audio.js` obsahuje `ARCHON_AUDIO`: s16le mono PCM při 22050 Hz, 17 záznamů `effects`, `unitMovementEffects`, `combatEffects.charged`, `impact`, `phoenix`, `banshee`, `flight`. Staré `combatEffects.fire` zůstává jen aliasem pro kompatibilitu. Hudba je lokální MP3. Data jsou vložená v JS a fungují přes `file://` bez fetch.

Pauza, ztlumení a návrat zastaví hlasy; pokračování obnoví aktivní smyčky s uloženým posunem. Výzva k bitvě a její výsledek staré smyčky ukončí. Hraje nejvýše čtveřice hlasů. Zvuk čeká na výslovné gesto uživatele.

## Reprodukce a hranice

```sh
python3 tools/archon_extract_audio.py
node tools/test-archon-audio.mjs
```

Export potřebuje XEX, místní VLC/GME a FFmpeg. VLC má vypnuté uživatelské nastavení i knihovnu médií; SAP obálky jsou ignorované Gitem. Výstupy mají ověřené délky, dekódování, nenulový signál a SHA-256. Deset kontrol přehrávače pokrývá 17 efektů, MP3, NTSC, výběr událostí, smyčky, zastavení, autoplay a počet hlasů.

**Není potvrzený fyzický POKEY 1:1.** Připravené klipy nenesou průběžnou fázi všech společně běžících kanálů a jejich přesné analogové míchání, filtraci ani všechny hrany opakovaných smyček. Krátké zvuky výběru/přesunu na desce a kouzla jsou webová prezentace; nekopírují celou původní animaci přesunu. Časování herních událostí má navíc rasterovou hranici popsanou v PORTING.md.
