# Archon — nativní HTML5 přepis

Vstupem je uživatelem dodaný `Archon.xex`, 27 692 bytů, SHA-256 `44be88e99b08731719966cba0b65d1932c48d50c44111749050f8a9a8d7135df`, a referenční video hry. Originály zůstávají beze změny a mimo Git i veřejný výstup. Původní zavaděč přesune jediný herní segment `$3000–$9C1F` na `$1000–$7C1F`; jeho kopie byla porovnaná s nezávisle nabootovaným programem v místním Atari800.

`archon/` je samostatný přepis v JavaScriptu, nikoli obal emulátoru. Prohlížeč nepoužívá 6502, ROM, POKEY ani původní XEX. Součástmi jsou čistý stavový automat `engine.js`, Canvas a ovládání `game.js`, standardní audio přehrávač `audio.js` a předem vytažená data v `assets/`. Vše funguje i při otevření `index.html` přes `file://`, bez síťových požadavků a závislostí.

## Původní podklady

- [ASSETS.md](ASSETS.md): 20 druhů, 295 původních snímků, směry, projektily, plošné efekty, překážky, písmo a terén. Barvy jsou kalibrované podle dodaného videa. Snímky v kontaktním listu jsou kontrolní výstup, nikoli ručně kreslené náhrady.
- [RULES.md](RULES.md): původní rozmístění 36 figur, číselné tabulky, šest fází jasu, pohyb, kouzla, léčení a pravidla výhry. Tabulky z XEX mají přednost před čísly neověřených remaků.
- [AUDIO.md](AUDIO.md): původní hudební a efektové rutiny vyrenderované mimo prohlížeč. Dva MP3 motivy a deset PCM efektů zachovávají původní zvuková data.

## Herní model

Deska má 9 × 9 polí, původní tři kategorie terénu a pět magických bodů. Pozemní pohyb používá průchod po kolmých sousedech, přes ostatní figury se nedostane. Létání a běžný přesun mága používají diagonály a překonávají překážející figury. Výběr protivníkovy pozice zahájí arénu a po bitvě se výsledek vrátí na desku.

Výchozí cyklus odpovídá světlu táhnoucímu jako prvnímu. Proměnlivé bonusy jsou `[0,1,3,4,6,7]`, druhá strana má opačnou hodnotu do součtu sedm. Životy navíc chrání základní energii: po přežití se ukládá minimum předchozích životů a zbývající energie v aréně, bonus se dodatečně neodečítá. Měňavec přebírá soupeřovy vlastnosti a při přežití obnoví svou základní životnost. Přivolaný elementál nedostává bonus pole a po bitvě zmizí.

Použitá kouzla oslabují pouze obranný bonus vlastní výchozí magické pozice, nikoli trvalé životy mága. Jednotka na magickém bodě se léčí o jeden život po celém kole; vlastní vrchol navíc léčí příslušnou armádu. Poslední uvězněná figura znamená porážku. Po dvanácti celých kolech bez boje při nejvýše dvou figurách na každé straně web vyhlásí remízu; tato úplná aktivační cesta původního programu nebyla samostatně odehrána.

Simulace běží v 60 krocích za sekundu, blízko NTSC referenčního videa. Čítače nabití používají původní hodnoty. Pohyb v aréně mění x o dva a y o jeden pixel; těžké jednotky vynechají každý čtvrtý pohyb. Při drženém FIRE se postava zastaví a míří. Střely se vyhodnocují po menších podkrocích, aby rychlá střela nepřeskočila cíl. Střela zemřelého bojovníka zůstává nebezpečná a může způsobit vzájemné zničení.

## Přiznané rozdíly první verze

Nejde o překlad všech instrukcí originálu ani o potvrzenou snímkovou repliku. Počítač na desce i v aréně je nově napsaný. Také kolize, rozmístění a rytmus proměn překážek a dávkování plošných útoků jsou vlastní implementace s původními číselnými daty a grafickými rozměry; nejsou kompletně přenesené z originálu.

České texty, zvýraznění dostupných tahů, přehled figur a ovládací panely jsou nové. Deska má v tomto zobrazení dvacetipixelová pole s nezvětšenou šestnáctipixelovou ikonou uprostřed, původní deska měla šestnáctipixelová pole. Marker magického bodu je nově vykreslený podle motivu z videa; nebyl označen za vytažený originální bitmapový glyph. Oživení na prázdném sousedním magickém bodě je v této verzi zakázané, tento okrajový případ manuál neuzavírá jednoznačně.

Pohybové zvukové smyčky se při výběru/tahu přehrají jako krátké úseky; nekopírují celou původní dlouhou animaci přesunu. Bojové efekty mají původní signál, nová herní smyčka je spouští při výstřelu a zásahu. Hudba používá NTSC přiblížení kolem 59,38 volání/s; přesný analogový filtr fyzického Atari se nesimuluje. Fyzický gamepad a telefon zatím nebyly vyzkoušené.

## Ověření

`tools/test-archon.mjs` ověřuje všech sedm kouzel, imunitu a rušení kouzla, pohybové kategorie, tahy a fáze světla, původní životní bonusy i oslabení domácího bodu, léčení, přenos energie z bitvy, měňavce, elementály, nabíjení, průběžnou kolizi rychlé střely, živou střelu mrtvého bojovníka, plošné útoky, návrat na desku a výhry/remízy. Delší simulace hlídají rozsahy pozic, zdraví a počtu projektilů.

`tools/test-archon-audio.mjs` ověřuje načítání bez autoplay, výslovné přehrání hudby, konec a přerušení titulní skladby, opožděný/odmítnutý požadavek, dekódování všech deseti PCM, mapování druhů a bojových stran, pauzu, ztlumení, návrat do nabídky a omezení současných hlasů.
