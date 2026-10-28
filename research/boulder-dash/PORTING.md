# Boulder Dash: původní ATR a nativní web

Autoritou je dodaný `Boulderdash 1.atr`, SHA-256
`90129a4243772349c6a7bfe3c6e4edfdfc3520eb5be84ef730952ad2993223b7`.
Video `Boulder Dash [1984] [fbWequyrVAM].mkv` slouží ke kontrole vzhledu,
především barev, nikoliv k určování pravidel či dalších jeskyní.

## Přenos

DOS2 soubor AUTORUN.SYS začíná sektorem 41 a má 139 sektorů. Obsahuje XEX
segment $2900–$6CBF s RUNAD $6C80. Loader kopíruje 68 stránek na $0900.
Vývojové nástroje čtou tento program; veřejný adresář obsahuje výhradně
nativní JavaScript a vybraná pojmenovaná data. Neobsahuje CPU, interpreter,
WebAssembly emulátor, XEX ani ATR. `assets/timing.js` je slovník číselných
časů sémantických větví a relativních čtení buněk, ne instrukce.

- `engine.js`: generátor všech 20 jeskyní v pěti obtížnostech, dva bajty RNG
  generátoru, postupné skenování mapy a normalizace severozápadní buňky.
  Přenesené jsou kameny a diamanty, kutálení, motýli a světlušky se skutečným
  směrem otáčení, oba typy výbuchů, améba, kouzelná zeď, Rockford, FIRE/grab,
  pravděpodobnost posunutí kamene, čítače, skóre, životy a fáze vstupu/východu.
- `raster.js`, `render.js`: původní znaky, čtyřbarevné bitmapy, osm fází
  animací, mrkání/poklepávání, blikání schránek, zeď, životní záblesky,
  desetinný HUD, titulní grafika a původní dílčí posun obrazu.
- `session.js`: tři životy, banky střídajících se hráčů, skutečné pořadí
  A–D/Q/E–H/R/I–L/S/M–P/T, úroveň nejvýše 5, body za čas podle úrovně,
  život navíc při vstupu do mezihry a vynechání neúspěšné mezihry bez ztráty.
  Volba dvou ovládání zachovává kratší odpočet než společný joystick.
- `sound-core.js`, `audio.js`: původní noty, frekvence, obálka titulní melodie
  a zvukové registry hry. Nativní čtyřhlasý POKEY používá spojené kanály pro
  titulní hudbu, tóny i šumy a časovanou frontu pro AudioWorklet. Místní
  `file://` používá shodný generátor přes ScriptProcessor.

## Ověření a opakování

Fixture jsou malé komprimované JSON v `tools/fixtures/boulder-*.json.gz`.
Veřejný build je nekopíruje. Atari800 7.2.1 je nezávislá vývojová reference;
py65 1.2.0 slouží pouze k dávkovému provedení původních rutin offline.

```
python3 tools/boulder_extract.py
python3 tools/boulder_capture.py
python3 tools/boulder_capture_vbi.py
python3 tools/boulder_capture_cases.py
python3 tools/boulder_capture_timing.py
python3 tools/boulder_capture_extra.py
python3 tools/boulder_capture_long.py
python3 tools/boulder_capture_graphics.py
python3 tools/boulder_capture_random.py
python3 tools/boulder_capture_clock.py
node tools/boulder_build_timing.mjs
node tools/test-boulder-original.mjs
node tools/test-boulder-cases.mjs
node tools/test-boulder-vbi.mjs
node tools/test-boulder-long.mjs
node tools/test-boulder-graphics.mjs
node tools/test-boulder-timing.mjs
node tools/test-boulder-session.mjs
```

Ověřeno:

- všech 100 úplných map a počátečních skalárních stavů;
- 20 replayů, 2 800 úplných skenů, 2 601 200 porovnání buněk/stavů;
- 7 592 cílených původních skenů: překážky, všechny směry kutálení,
  nepřátelé, exploze, zeď, améba, podporované posouvání, sběr s FIRE,
  desetinné přenosy, hranice pro životy, vstupy a předběžné řízení skenu;
- stejná celková CPU práce těchto 7 592 skenů včetně překročení stránek,
  skutečných kreslicích větví, přenosů a desetinných smyček;
- 1 800 úplných VBI včetně všech 1 024 bajtů fontu a rastrálních čítačů;
- dalších 6 000 VBI s řídkými úplnými kontrolními body: dlouhé časy,
  vypršení kouzelné zdi, pauza, nízký čas, nula a posun obrazu tam a zpět;
- 1 100 původních hudebních kroků, 100 přechodů jeskyní a životní banky;
- 422 400 znakových kvadrantů ze 120 úplných původních kreslených map;
- 128 skutečných čtení hardwarového RANDOM proti 17bitovému polynomu;
- 120 000 integrovaných nativních snímků ve všech 100 variantách bez
  neznámé časovací větve ve sledovaném průchodu.

Výchozí rychlost NTSC je 1 789 790 / (114 × 262), asi 59,9233 Hz. Odpočet
má jako původní program 60 VBI na sekundu. Fyzika nemá vymyšlenou pevnou
frekvenci 10 Hz: každá buňka spotřebuje původní změřenou CPU práci.
Atari800 s aktivním původním VBI a zobrazením naměřil první sken jeskyně A
v pěti obtížnostech za 9,199 / 8,069 / 7,192 / 6,843 / 6,718 snímku.
Nativní dostupná práce 13 400 cyklů na VBI je kalibrované přiblížení těchto
měření. Původní data z měření jsou v `boulder-clock.json.gz`.

## Otevřené hranice věrnosti

**Není potvrzena úplná shoda celé hry 1:1.** Izolované rutiny a jejich
časová práce nejsou důkazem stejného průběžného rastru celého Atari.

1. Dostupná CPU práce na VBI je kalibrovaný rozpočet. Neprovádí se přesná
   arbitráž ANTIC DMA, OS a přerušení na každém taktu. VBI může přerušit
   nativní fyziku mezi buňkami, ne uprostřed jedné původní instrukce. Chybí
   dlouhý nepřerušovaný hardware replay se shodou všech rámců.
2. POKEY RANDOM má původní polynom ověřený proti hardwarovým čtením, ale
   okamžik jednotlivých čtení v nativní smyčce má přibližnou fázi. Úplně
   stejná náhodná rozhodnutí při živém hraní nejsou zaručena. Generátor
   všech jeskyní používá vlastní původní dvoubajtový RNG a souhlasí přesně.
3. Rozpočet odkrývání jeskyně a převodu časového bonusu vychází ze smyček
   programu; jejich úplné nepřerušované časování a pitch sweep nejsou
   samostatně potvrzené. Webová nabídka, pauza a konec hry jsou moderní UI.
   Původní automatická ukázka a systémové/OS přepínače se nenapodobují.
4. Noty, obálka a zvukové povely jsou ověřené. Analogový výstup a přesné
   fáze děliček POKEY, filtrace a latence zařízení nejsou bitově shodné.
5. Barvy vycházejí z Atari palety Real.act s výslovnou kalibrací základní
   jeskyně a titulního obrazu podle dodaného videa. Všechny další barevné
   kombinace nejsou samostatně ověřené. Kompletní kompozitní obraz se
   nesimuluje. Nebyl proveden ruční průchod všemi 100 variantami ani test
   fyzického gamepadu a telefonu.

Zvlášť zaznamenané odchylky časovacího slovníku se ukládají do interního
`timingMisses`. U dosud nezachycené větve se použije příbuzný číselný profil;
nejde o změnu fyzikálních pravidel. Test všech variant aktuálně žádnou
zachycenou odchylku nehlásí. Další dlouhé replaye mohou odhalit nové větve.
