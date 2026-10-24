# Archon — původní zvuková data a offline render

Zdroj je uživatelem dodaný `Archon.xex`, SHA-256 `44be88e99b08731719966cba0b65d1932c48d50c44111749050f8a9a8d7135df`. Obsahuje segment `$3000–$9C1F`; loader `$9C00` jej přesune o `$2000` dolů a spustí `$20C3`. Exportér tento přesun provede přímo nad bajty XEX, nepotřebuje OS ROM ani dump celé RAM.

## Hudba

Původní inicializace zvuku je na `$75E7`. Titulní obrazovka nastavuje `$06AB=1` a volá ji na `$37DE`. VBI sekvencer postupuje mezi `$762B`, `$76D7`, `$77E3`, `$7900` a koncovým `$7948`, tabulka přechodů je na `$761D`. Frekvence a délky tónů zůstávají původní. Výstup `archon/assets/audio/title.mp3` má 26,76 s (včetně krátkého doznívání), stereo 44,1 kHz, 160 kbit/s.

Krátký výsledkový motiv používá stejný původní player: callsite `$580F–$5814` nastavuje `$06AB=5`. `result.mp3` má 2,40 s. Nejde o novou napodobeninu melodie a autor hudby zde není bez ověření připisován konkrétní osobě.

SAP obálka nahrazuje pouze původní odchod přes OS `XITVBV` (`JMP $E462`) instrukcí RTS. Vlastní zvukové instrukce, tabulky a zápisy do POKEY jsou beze změny. Pomocný player čte původní VBI vektor `$0224/$0225`; původní přechody skladeb jej tedy normálně mění. Návrat z hudby vede do soukromé tiché RTS obálky. `$06A7=0` potlačuje volání grafické pomocné rutiny, která není součástí hudebního výstupu.

## Původní efekty

Sekvenční čtyřkanálový přehrávač na `$796E` používá vlastní tabulky přes ukazatele `$C3–$CA` a stav `$1276–$127D`. Formát skriptu je původní: `$FD` nastaví AUDC, následující dvojice určuje počet VBI kroků a AUDF; `$FE` vrací ukazatel na začátek, `$FF` efekt ukončí.

Šest pohybových smyček je v tabulce `$574D`:

| ID webového efektu | Původní adresa | Smyčka |
| --- | --- | --- |
| 0 | `$7AB5` | ano |
| 1 | `$7ACE` | ano |
| 2 | `$7AD7` | ano |
| 3 | `$7AF4` | ano |
| 4 | `$7B0D` | ano |
| 5 | `$7A7C` | ano |

Rutina `$3641` vybírá typ postavy z `$D2,X`, převede jej tabulkou `$5759` a nastaví přehrávač. Pro původní typy 0–19 vychází index efektu `[3,4,4,0,1,1,5,4,2,4,3,0,1,2,1,4,1,1,0,2]`. Jde o původní typové indexy, nikoli pořadí anglických názvů v libovolném novém seznamu.

Čtyři jednorázové soubojové efekty má tabulka `$6BD2`: `$7A1A`, `$7A4B`, `$7B2F`, `$7B58`. V exportu jsou ID 6–9. První dva volá `$6BDA` podle indexu bojovníka při vypršení bojového čítače `$0662`; názvy `fire` v runtime metadatech vyjadřují jejich použití pro zpětnou vazbu zbraně v novém portu, nikoli tvrzení, že originál je spouští přesně při stisku FIRE. Poslední dva volá větev kontaktu přes `$6F00/$6BDC` s indexem navýšeným o čtyři: to jsou původní efekty kontaktu/zásahu.

## Časování podle referenčního videa

Uživatelovo video `Archon Atari 8 bit Computer Gameplay Longplay 400 800 XL XE [CokJQ8CI4Xk].mkv` má 30000/1001 snímků/s a hudební titulní část přechází do ticha kolem 26,5 s. Defaultní PAL render původního sekvenceru trval přibližně 31,66 s, což odpovídá poměru 50/60. Proto používá vývojová SAP obálka `NTSC` a explicitní `FASTPLAY 262`, podle [primární specifikace SAP](https://asap.sourceforge.net/sap-format.html). Tento VLC/GME render vychází přibližně na 59,38 volání/s; není vydávaný za přesný analogový zvuk fyzického NTSC Atari. Původní hudební část v něm končí přibližně v 26,61 s.

Krátké efekty jsou vyrenderované se stejnou frekvencí volání. Prohlížeč už jen přehrává PCM/MP3; POKEY ani 6502 nesimuluje. Drobné odlišnosti analogové filtrace a hodin zdroje videa nejsou tvrzené jako zcela odstraněné.

## Runtime API a reprodukce

`archon/assets/audio.js` definuje `globalThis.ARCHON_AUDIO`:

- `encoding: "s16le"`, `sampleRate: 22050`;
- `title` a `result`: relativní cesty k lokálním MP3;
- `unitMovementEffects`: přesná tabulka pro původní typy 0–19;
- `combatEffects.fire: [6,7]`, `combatEffects.impact: [8,9]`;
- `effects`: deset záznamů `{id, data, duration, loop, sourceStart, sourceEndExclusive}`. `data` je base64 PCM, signed 16-bit little endian, mono. Při dekódování dělit hodnoty 32768.

Všechny efekty jsou vložené přímo v JS, takže fungují i přes `file://` bez `fetch()`. Samply se mohou načíst do `AudioBuffer` 22050 Hz. `loop` rozlišuje původní pohybovou smyčku od jednorázové soubojové sekvence; nová webová logika rozhoduje, kdy smyčku ukončit.

```sh
python3 tools/archon_extract_audio.py
```

Potřeba je původní XEX, místní VLC/GME a FFmpeg. VLC má vypnuté uživatelské nastavení i knihovnu médií. Vývojové SAP soubory vznikají pouze v `research/archon/` a jsou ignorované Gitem. Prohlížeči patří pouze `assets/audio.js`, MP3 a jejich provenience.

Ověřeno úplné dekódování MP3, rozměry PCM a nenulový signál všech deseti efektů. Hashe výsledných MP3 a PCM jsou v `archon/assets/audio/provenance.json`. Kódy a bajty původního XEX nebyly upravené.
