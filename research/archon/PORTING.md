# Archon — nativní HTML5 přepis

Autoritou je dodaný `Archon.xex`, 27 692 bytů, SHA-256 `44be88e99b08731719966cba0b65d1932c48d50c44111749050f8a9a8d7135df`. Adresy níže jsou po původním přesunu `$3000 → $1000`. Video slouží k barvám a vizuální kontrole. Originály, ROM, pracovní RAM a vývojové SAP nejsou v Gitu ani ve veřejném sestavení.

Oprava z 27. 10. nahrazuje vlastní AI a soubojové heuristiky nativním překladem původních rutin. **Úplná shoda celé hry 1:1 zatím potvrzená není.** Průběžný raster a návrat silně zraněného Měňavce mají níže popsané neuzavřené odchylky. [Původní audit](AUDIT-2026-10-27.md) popisuje stav před opravou.

## Architektura a čas

- `engine.js`: deska, životní cyklus, kouzla a návrat z arény.
- `board-ai.js`: rozhodování původního počítače `$3F6B–$4B71`, včetně pořadí kouzel, byte aritmetiky, sdíleného stavu vyhodnocování a spotřeby náhodných bytů.
- `arena.js`: původní generátor `$53A8` a stavové rutiny `$6A0F–$75E6`; původní souřadnice v barevných hodinách a obrazových řádcích.
- `assets/mechanics.js`: pouze číselné a grafické tabulky, žádné instrukce původního programu.
- `game.js`, `audio.js`: Canvas, webové ovládání a přehrávání připravených zvukových dat.

Uživatel zvolil **NTSC**. Frekvence kroku je `1789790 / (114 × 262)`, přibližně **59,9233 Hz**. Nabíjení, pohyb a zvukové exporty používají tento základ. Prohlížeč nespouští 6502, Atari OS ani původní program; hra funguje také přes `file://` bez sítě.

## Přenesené chování

Deska používá původní pole 16 × 16, všech 36 počátečních figur, terén a multiplexovanou bitmapu pěti magických bodů. Volba začínající strany odpovídá inicializaci XEX: Světlo začíná na jasu 6 směrem ke tmě, Stín na jasu 8 směrem ke světlu. Léčení, propouštění vězňů a změna jasu nastávají po tahu druhého hráče. Změna času na krajním jasu ponechá přeskočení protějšího vrcholu až na tuto aktualizaci.

Léčení vybírá pouze vlastní figuru, může léčit vězně a nemůže zasáhnout magický bod. Oživení nabízí od každého padlého druhu první původní index. Výběry ostatních kouzel mají původní kontrolu strany, vězení, obsazení a sousedství. Použitá kouzla snižují jen bonus domácí magické pozice. Čítač malé armády se aktivuje ve skutečné větvi AI; nevymýšlí se remíza po opakování pozice ani prohra kvůli chybějícímu tahu.

Počítač má původní rozhodování, bez nově vymyšlených obtížností. Zachované jsou i zvláštnosti dodaného programu: AI nikdy nezvolí Exchange; Teleport testuje bit indexu figury a může vybrat i nepřítele. Počítačová dispatch obchází lidské odmítnutí výběru. Summon s chráněným cílem může spotřebovat kouzlo a tah bez bitvy; nepřekoná tím ochranu bodu. Aréna při neobvyklé teleportaci přiřazuje bojové strany podle táhnoucího hráče, nikoli podle vlastníka vybrané figury.

Aréna generuje původních 18 překážek ve třech tvarech a třech barevných třídách. Jejich jas se mění po 256 aktualizacích, průchodnost vychází z rozdílu jasů 0/2/ostatní. Tvary i zásahy se počítají z nastavených bitů původních bitmap; žádné obdélníkové náhrady ani elipsy. Těžké figury vynechávají každý čtvrtý způsobilý pohybový krok. Střely používají původní posun bez přidaných podkroků a životnosti.

Útok běžné zbraně vyžaduje směr + FIRE. Samostatné FIRE aktivuje Fénixe nebo Bánší. Fénix má pět fází po deseti aktualizacích, zásah v jejich pátém kroku a původní imunitu během výbuchu; Bánší má vlastní čítače a po uvolnění tlačítka se pohybuje i během účinku. Střela mrtvého střelce zůstává aktivní a může dokončit vzájemnou smrt; doběh bitvy čeká na zánik aktivních zbraní.

Zvuk zachovává šest pohybových smyček, dvě oznámení nabití, dvě sekvence zásahu, samostatný výbuch Fénixe, Bánší a pět parametrů frekvenčního průběhu letící střely. Při pauze/ztlumení se smyčky zastaví a při pokračování navážou. Podrobnosti a hranice signálu jsou v [AUDIO.md](AUDIO.md).

## Reprodukovatelné ověření

```sh
node tools/test-archon.mjs
node tools/test-archon-audio.mjs
node tools/test-archon-original.mjs
node tools/test-archon-raster.mjs
node tools/diagnose-archon-raster.mjs
```

| Kontrola | Rozsah a výsledek |
| --- | --- |
| Funkční hra | 27 kontrol: pohyb desky, kouzla, bonusy, léčení, zbraně, smrt, návrat a výhra |
| Zvukový přehrávač | 10 kontrol: 17 PCM, MP3, smyčky, pauza, ztlumení, autoplay, NTSC a počet hlasů |
| Izolované původní stavové rutiny | 8 polí generátoru, 114 replayů všech bojových druhů; **953 360 shodných porovnání bytového stavu** |
| Úplná původní AI desky | **768 shodných rozhodnutí**, cílů kouzel, spotřeb RNG a přetrvávajícího evaluačního stavu |
| Vykonání AI kouzel | **167 shodných dispatchů** Teleport/Summon do bitvy nebo dalšího tahu, včetně vadných výběrů |
| Inicializace a konec tahu | Obě začínající strany a **44 úplných tahů** s jasem, směrem, léčením a vězni |
| Lidské cíle kouzel | **2 592 shodných rozhodnutí** původního validátoru, včetně prázdných magických bodů |
| Pixelové kolize | 12 úplných izolovaných VBI jader se skutečným GTIA scanoutem; **161 896 shodných porovnání stavu** |

Fixtures obsahují vstupy a výsledné číselné stavy, nikoli strojový program. Vznikají pouze offline nástroji `archon_capture_{mechanics,board,rules,spells,ai_spells,raster}.py` ve skutečném Atari800. Náhodný zdroj je při porovnání nahrazen stejným deterministickým proudem; běžná hra používá náhodné byty a nenapodobuje fázi fyzického POKEY RANDOM.

**Test pixelových kolizí má úzkou podmínku:** vykreslí kompletní PMG, nechá původní GTIA zpracovat celý obraz a dokončí celé VBI jádro. Ověřuje tvary a pravidla zásahu; neprokazuje průběžnou časovou shodu celého počítače.

## Zbývající rozdíly a nejistoty

1. **Průběžný raster.** Zachycené nepřerušované NTSC i PAL souboje (`archon-raster*.json`) se v některých krocích liší. PMG se v originálu přepisuje během běhu paprsku a dlouhé VBI může zasáhnout další obraz. Web dokončuje jednu stavovou aktualizaci atomicky a používá celé bitmapy. Může proto jinak načasovat kontakt či čítač o snímek. Diagnostický příkaz rozdíly výslovně vypisuje; neprocházející stopy nebyly nahrazené úspěšnými daty.
2. **Měňavec po bitvě.** Web zatím ponechává návrat vlastní životnosti 10. V dodaném XEX při energii nižší než uložené HP `$5533` indexuje tabulku původním ID 25 a při záporném bytu následuje další `PLA`. Řízený pokus na úplné návratové cestě tak uložil místo 10 hodnoty závislé na zásobníku (32, 198, 15). Není to doložená obecná regenerace. Přesný dopad při přirozené dlouhé partii, změnách zásobníku a případných nulových HP na obsazeném poli není přenesený. Podobně není uzavřen návrat patologické AI teleportace téže figury proti sobě.
3. **Prezentace tahů.** Český webový panel, zvýraznění dostupných polí, okamžité přesuny desky, mezihry, prodleva počítače a délka výsledkové obrazovky jsou webové. Nejde o časový přepis všech obrazových přechodů, textů a animace přesunu originálu.
4. **RGB a audio.** Barvy vycházejí z původních registrů a kalibrace videem. Analogová PAL/NTSC filtrace, přesná fáze všech POKEY kanálů, jejich vzájemné míchání a spojení hran připravených PCM smyček nejsou identické s fyzickým Atari.

Fyzický gamepad/telefon, úplná ruční partie a dohrání všech kombinací kouzel a původních chyb nejsou vydávané za ověřené. Tyto hranice brání označit celé vydání za dokončené 1:1.
