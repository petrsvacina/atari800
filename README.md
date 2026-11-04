# ATARI800 — webová herna

Veřejná herna: **https://atari800.gmork.cz/**. Dynakillers má vlastní adresu **https://atari800.gmork.cz/hry/dynakillers/** a odkaz zpět do katalogu. Portál i hry jsou statické soubory; nepotřebují databázi ani aplikační server.

International Karate je nová samostatná HTML5 hra v `karate/`, veřejně na **https://atari800.gmork.cz/hry/international-karate/**. Stav posledního ověřeného nasazení je v `DEPLOYMENT.md`.

Archon je samostatná nativní HTML5 verze v `archon/`, veřejně na **https://atari800.gmork.cz/hry/archon/**. Aktuální stav zveřejnění je v `DEPLOYMENT.md`.

The Goonies je samostatná nativní HTML5 verze v `goonies-web/`, veřejně na **https://atari800.gmork.cz/hry/goonies/**. Stav zveřejnění je v `DEPLOYMENT.md`.

River Raid je nativní HTML5 hra v `river-raid/`, veřejně na **https://atari800.gmork.cz/hry/river-raid/**. Stav ověřeného nasazení je v `DEPLOYMENT.md`.

H.E.R.O. je nativní HTML5 hra v `hero/`. Adresa v herně je **https://atari800.gmork.cz/hry/hero/**; ověřený stav zveřejnění je v `DEPLOYMENT.md`.

Boulder Dash je nativní HTML5 hra v `boulder-dash/`. Cesta v herně je **https://atari800.gmork.cz/hry/boulder-dash/**; ověřený stav vydání a jeho limity uvádí `DEPLOYMENT.md`.

Shift je nativní HTML5 hra v `shift/`, veřejně na **https://atari800.gmork.cz/hry/shift/**. Obsahuje 36 původních úrovní a tajnou místnost, grafiku, CMC hudbu, POKEY efekty, CZ/EN rozhraní a mobilní joystick. Ověřený rozsah shody i zbývající limity jsou v `shift/README.md`; aktuální nasazení a opravu fullscreenu zaznamenává `DEPLOYMENT.md`.

The NeverEnding Story II je nativní HTML5 hra v `neverending-story-2/`, veřejně na **https://atari800.gmork.cz/hry/neverending-story-2/** v českém i anglickém katalogu. Obsahuje obě původní jazykové varianty, obě části příběhu, sdílené pozice, původní grafiku, hudbu a návody. Rozsah ověření a hranice popisuje `neverending-story-2/README.md`; vydání zaznamenává `DEPLOYMENT.md`.

Fred má první hratelnou nativní verzi v `fred/`, lokálně na **http://127.0.0.1:8010/fred/**. Obsahuje deset původních úrovní, grafiku, hudbu, efekty a dotykový joystick. Zatím není součástí veřejného katalogu. Ovládání a rozsah ověření jsou v `fred/README.md`.

## Obsah repozitáře

`portal/` obsahuje katalog, `web/` samostatné Dynakillers, `karate/` International Karate, `archon/` Archon, `goonies-web/` The Goonies, `river-raid/` River Raid, `hero/` H.E.R.O., `boulder-dash/` Boulder Dash, `karateka/` Karateku, `neverending-story/` The NeverEnding Story a `shift/` Shift, včetně grafických a zvukových prostředků potřebných pro hraní. `tools/` obsahuje sestavení, extrakční nástroje a testy; `research/` dokumentuje rozbor a ukládá podklady potřebné pro opakování grafických exportů. Původní místní adresář `Goonies/` se do Gitu ani veřejného webu nekopíruje.

Původní Atari soubory, referenční video, místní assemblerové podklady, SAP/WAV a pracovní binární výstupy se do Gitu nepřidávají. Pro hraní a sestavení portálu nejsou potřeba; vyžadují je jen některé vývojové extrakční nástroje. Vygenerovaný `dist/` je také ignorovaný. Po naklonování stačí `python3 tools/build_portal.py` a otevření `dist/index.html`, případně publikování obsahu `dist/`. Python používá jen standardní knihovnu; samotné hry pro hraní nepotřebují Python ani Node.js.

## Portál a přidávání her

Zdroj úvodní stránky je v `portal/`. Katalog se spravuje v `portal/games.json`: každá skutečně dostupná hra má unikátní `id`, název, popis, obrázek/logo, počet hráčů a adresář se spustitelnou webovou verzí v položce `source`. Právě jedna hra má `featured: true` a zobrazí se v hlavní nabídce. Nevydané hry se mezi hratelné nezařazují.

Herní stránky zachovávají společné rozložení: na desktopu logo vlevo a návrat do katalogu vpravo, herní plocha vedle informačních a ovládacích panelů. Na mobilu se panely řadí pod hru. International Karate má kvůli rozsáhlejším informacím panely pod hrou i na desktopu. Karateka a Shift přepínají fullscreen také klávesou **F**; NeverEnding Story ponechává F textovým příkazům.

Český portál je na `/`, anglický na `/en/`; přepínají se odkazy CZ/EN v hlavičce. Obě stránky vznikají ze stejné HTML šablony. Texty portálu jsou v `portal/locales/cs.json` a `portal/locales/en.json`; anglický soubor obsahuje také překlady popisů, žánrů, počtu hráčů a ovládání všech her. Přidání hry vyžaduje doplnění anglického překladu, jinak sestavení skončí s chybou. Anglické odkazy na hry nesou `?lang=en`, který volí také anglické rozhraní hry a návrat do anglického katalogu. Karateka, NeverEnding Story a Shift mají lokalizaci vestavěnou přímo ve své webové obálce.

Překlady herních nabídek, ovládání, průběžných hlášek, výsledků, názvů, tooltipů a nápovědy se spravují v `localization/games.en.json`. Společná prezentační vrstva je v `localization/game-i18n.js`; herní pravidla, původní tabulky, obrazové a zvukové prostředky se nepřekládají ani neupravují. Každá hra má vlastní generovaný `i18n.js`, aby fungovala samostatně a offline; angličtinu vybere i při místním otevření s `?lang=en`. Bez parametru zůstává česká verze. Jazyk se zachová při kliknutí na herní logo a v názvech/pokynech se mění až zobrazený text, nikoli stav původního enginu.

Po změně překladů spusť `python3 tools/build_game_i18n.py`. Sestavení kontroluje aktuálnost všech sedmi balíčků a shodu parametrů v překladech. Nové dynamické texty procházejí `AtariI18n.t`, HTML texty `AtariI18n.html`; pokrytí stránek, výsledkových stavů, původních pohybů/kouzel a všech osmi návodů Goonies ověřuje `node tools/test-game-i18n.mjs`.

Po sestavení lze odkazy, jazyková metadata a překlady ověřit příkazem `python3 tools/test-portal-build.py`.

Při každém dalším načtení portálu ve stejné kartě se hlavní nabídka posune na další hru v katalogu a po poslední začne znovu. Společně se změní obrázek, logo, název, údaje, pořadové číslo i oba spouštěcí odkazy. Poslední volbu si pamatuje `sessionStorage`; při prvním otevření nebo zablokovaném úložišti zůstává výchozí hra označená `featured`. Bez JavaScriptu je výchozí nabídka i katalog plně přístupný.

```sh
python3 tools/render_portal_cover.py
python3 tools/karate_render_cover.py
python3 tools/archon_render_cover.py
python3 tools/goonies_render_cover.py
python3 tools/river_render_cover.py
node tools/hero_render_cover.mjs
node tools/boulder_render_cover.mjs
python3 tools/build_portal.py
```

Prvních sedm příkazů vytvoří náhledy her z jejich původních grafických dat; pro další hry přidej jejich vlastní obrázky do `portal/assets/`. Poslední vytvoří kompletní veřejný web v `dist/`: český portál na `/`, anglický na `/en/` a každou hru pod `hry/<id>/`. Do publikované kopie hry přidá návrat do katalogu místo hlavičky `.edition`. Samostatné místní verze her se nemění.

Katalog umí hledat v názvu, žánru a popisu bez rozlišování diakritiky a filtrovat hry pro více hráčů. Odkazy na hry fungují i bez JavaScriptu. Na server patří pouze obsah `dist/`, nikoli kořen projektu s původními binárními soubory, pracovními daty a nástroji. Aktuální webový kořen Apache je `/var/www/atari800` na `mail.gmork.cz`; před jeho změnami pořiď zálohu. Existující konfigurace Apache a HTTPS není potřeba měnit.

## Boulder Dash

Otevři `boulder-dash/index.html`. Šipky nebo WASD řídí Rockforda; **mezerník + směr** sbírá na místě. **Enter** začíná/pokračuje, **Escape** vzdá jeskyni, **P** pozastaví, **M** přepne zvuk, **R** otevře nabídku a **F** celou obrazovku. Hra nabízí původní začátky A/E/I/M (na obtížnostech 4–5 pouze A), všech 16 jeskyní a čtyři mezihry v pěti obtížnostech. Dva hráči se střídají se společným ovládáním, nebo má druhý IJKL + pravý Shift / druhý gamepad. Dotyková tlačítka jsou pod obrazem. Titulní melodii lze spustit samostatným tlačítkem před hrou.

Pravidla, generátor map, bitmapy, animace, hudba a registry zvuků vycházejí z dodaného ATR. Pro hraní není potřeba Atari soubor ani emulátor. Referenční nástroje a všech sedm testů `tools/test-boulder-*.mjs` ověřují původní mapy, stavy, kreslení, zvukové povely a CPU práci. Rozsah a známé hranice průběžného časování, RANDOM, zvuku a barev jsou v [research/boulder-dash/PORTING.md](research/boulder-dash/PORTING.md); úplná shoda celého programu 1:1 se netvrdí.

## H.E.R.O.

Otevři `hero/index.html` přímo v prohlížeči. **←/→** řídí chůzi a let, **↑** roztočí vrtulku, **↓** položí dynamit ve stoje a **mezerník** střílí. Funguje také WASD, gamepad a dotyková tlačítka. **Enter** začne výpravu, **P/Escape** pozastaví hru, **M** přepne zvuk, **R** vrátí nabídku a **F** přepne celou obrazovku. Při přepnutí okna se hra pozastaví.

Hra přebírá všech 256 místností dvaceti misí, bitmapy, pravidla pohybu a kolizí, nepřátele, lampy, dynamit, propalování zdí, energii, skóre a životní cyklus z dodaného XEX. Má původních pět počátečních obtížností a pokračování po dvacáté misi. Zvuk vzniká nativně podle původního řízení registrů POKEY, bez obecné náhradní zvukové sady. V prohlížeči neběží původní procesor ani program.

```sh
node tools/test-hero-terrain.mjs
node tools/test-hero-game.mjs
node tools/test-hero-explosions.mjs
node tools/test-hero-raster.mjs
node tools/test-hero-sound.mjs
```

Rozsah porovnání s originálem a omezení jsou v `research/hero/PORTING.md`. Zdrojové soubory Atari a video jsou pouze vývojové podklady a na web se nekopírují. Fyzický gamepad a telefon zatím nebyly ověřené; úplné ruční dohrání všech misí se netvrdí.

Prochází 28 184 kroků celé herní smyčky, včetně nativních pixelových kolizí, všech místností a záchrany i postupu ve všech dvaceti misích. Dále 328 znakových map, 384 detonací, 640 zvukových stavů a všech 80 640 pixelů kontrolního snímku. Vstupní replay první mise získá 2 770 bodů se čtyřmi životy. Časování přechodů vychází z 2 816 měření původního programu.

## River Raid

Otevři `river-raid/index.html`. **←/→** řídí, **↑/↓** přidávají/ubírají rychlost, **mezerník** střílí, **Enter** spouští let. **P/Escape** pauza, **M** zvuk, **R** nabídka, **F** celá obrazovka. Nádrž FUEL doplníš průletem; zpomalení dá více času na tankování. Pro střelbu je jedno místo, další střela následuje po zásahu nebo opuštění obrazovky.

Čtyři letadla, další za 10 000 bodů, původní checkpointy, začátky 1/5/20/50 a dva střídající se piloti. První úsek má nepřátele bez vodorovného pohybu i v originálu; od druhého úseku se pohybují podle původních pravidel. Řeka, ostrovy, objekty a tanky vznikají průběžně nativním překladem generátoru, bez konce předgenerované mapy. V prohlížeči neběží Atari CPU ani ROM.

Převod nyní zachovává skutečné přesuny jedenácti slotů, obraty u tmavého břehu, střelu sledující letadlo, pořadí kolizí, checkpointy a původní průběh smrti/nového odletu. Výbuchy jedou s řekou; mosty mají silnici, tank a bonus 750 bodů. Třináct původních zvukových PCM prostředků respektuje sdílení čtyř kanálů a výbuch letadla se po smrti nevypíná.

Ověřeno je všech 268 288 referenčních řádků se stavem generátoru a slotů, 952 vzniků tanku a 7 996 kroků celé herní smyčky proti XEX, včetně skutečných kolizí, smrti a střídání pilotů. Prochází také 25 herních a 11 zvukových kontrol. Vstupní replay dokončí první most s 1 860 body a všemi čtyřmi letadly. Rozsah porovnání a zbývající rozdíly webového prostředí jsou v `research/river-raid/PORTING.md`; úplné ruční dohrání všech úseků se netvrdí.

```sh
node tools/test-river-generator.mjs
node tools/test-river-game-oracle.mjs
node tools/test-river-raid.mjs
node tools/test-river-combat.mjs
node tools/test-river-audio.mjs
```

## The Goonies

Otevři `goonies-web/index.html` v prohlížeči. Celá výprava vede osmi scénami od domu Fratelliových k pirátské lodi. Z každé musí uniknout obě postavy. Nabídka dovoluje i samostatný trénink pozdější místnosti.

**Šipky vlevo/vpravo:** běh a posouvání předmětů. **Nahoru:** skok, žebřík nebo zachycení horní tyče/řetězu. **Dolů:** slézání a puštění. **Mezerník / FIRE:** přepnutí Goonieho; ten předchozí zůstane držet mechanismus. Pro šikmý skok drž nahoru a směr současně. Postavu lze zvolit také tlačítky pod hrou nebo klávesami **1/2**. Na horní tyči jde ručkovat; pouští se směrem dolů.

**P / Escape:** pauza, **M:** ztlumení, **R:** nabídka, **F:** celá obrazovka. Ve volitelném režimu dvou lidí ovládá první šipky a druhý WASD; tento režim je doplněk webové verze. Standardní gamepad používá páčku/kříž a A pro přepnutí v sólu. Na dotykovém zařízení jsou směrová tlačítka a FIRE. Ztráta okna hru automaticky pozastaví. Fyzický gamepad a telefon zatím nebyly ověřené.

Původní jsou bitmapy všech osmi scén, titulní a závěrečný obraz, snímky postav, nepřátel a předmětů. Zvuk obsahuje dvě původní hudební smyčky a 19 původních efektů, vyrenderovaných z původního přehrávače. Titulní hudbu spustíš notou v nabídce; během hry vybírá skladbu původní tabulka místností. Tiskárna, vědra, kámen a zvon, střelba, varhany i lodní zdvih spouštějí původní efekty ve skutečných herních okamžicích. Pauza zachová pozici hudby, ztlumení a odchod zastaví efekty.

Hádanky zahrnují tiskárnu a uhašení krbu, rumpál a klíč, přesměrování vody třemi ventily, tři kameny v padacích dvířkách, čtyři vejce jako schody, barevné podpěry varhan, vypuštění chobotnice a páky/zvedání na lodi. Skóre a životy jsou společné. Konkrétní postup místnosti lze zobrazit tlačítkem nápovědy.

Pohyb a volba snímků jsou přeložené z původních rutin XEX. Kolize používají původní obdélníky včetně stěn a stropů; pravidla se aktualizují jednou za čtyři obrazové kroky. Židle se pohybuje pouze při tlačení a její čtyři grafické fáze závisejí na poloze. Hádanek se účastní skutečné podpěry, ventily, vodní proudy, vejce, průlezy a zdvihy podle tabulek originálu. Rozsah a rozdíly jsou v `research/goonies/PORTING.md`.

```sh
node tools/test-goonies.mjs
node tools/test-goonies-audio.mjs
```

Regresní kontroly porovnávají 1 280 kroků pohybu a 2 744 kompletních bitmap s původní hrou, spolu s pozicemi obou postav a kolizními obdélníky. Dům a potrubí prošly celé směrovými replayi s pěti životy bez přesouvání postav a přepisování příznaků. Řízené zkoušky mechanismů ostatních scén nejsou tvrzením o kompletním ručním průchodu celé výpravy. 57 herních kontrol zahrnuje také 1 466 posloupností zvukových požadavků, celé hejno po zazvonění i okamžik zásahu netopýrem. Čtrnáct zvukových kontrol ověřuje hudbu, PCM, priority, dokončení cyklu tiskárny, smyčky, přepínání, pauzu a ztlumení. Pro hraní a běžné sestavení nejsou původní disk, emulátor ani vývojové nástroje potřeba.

## Archon

Otevři `archon/index.html` přímo v prohlížeči. Vyber Světlo nebo Stín proti počítači, případně dva hráče, a začínající stranu. Na desce klikni na vlastní figuru a potom na zvýrazněný cíl; alternativou jsou šipky a mezerník/Enter. Pozemní jednotky postupují kolmo a blokují je figury, létající přelétají i diagonálně. Útok na soupeře přepne do arény.

V sólu se tvoje armáda v aréně vždy ovládá **šipkami + mezerníkem**. Ve dvou: Světlo šipky + mezerník, Stín **WASD + Q**. S drženým FIRE stojíš a míříš, po nabití se může útok opakovat. Podporovaný je standardní gamepad a na dotykové obrazovce směrová tlačítka/FIRE. **P** pozastaví hru, **Escape** ruší výběr/kouzlo nebo přepíná pauzu, **M** tlumí zvuk, **R** vrátí nabídku a **F** otevře celou obrazovku. Přepnutí okna/karty automaticky pozastaví živou hru.

Hra obsahuje původních 36 figur a všech 20 druhů včetně čtyř přivolávaných elementálů. Původní jsou bitmapy, animační snímky, projektily, barevný terén, značka magického bodu a číselné tabulky síly, energie, nabití a pohybu. Hudba a 17 efektů používají původní zvukové rutiny a průběhy registrů; titulní hudbu lze přehrát v nabídce. V aréně běží pohybové smyčky, tóny střel a původní efekty nabití, kontaktu, Fénixe a Bánší.

Všech sedm kouzel je dostupných jednou za stranu, pokud žije a není uvězněný její mág. Kouzla nepůsobí na magických bodech. Bonus energie závisí na cílovém poli; použité kouzlo oslabí bonus vlastní domácí magické pozice. Magické body a vlastní vrchol světla léčí armádu podle původních pravidel. Vyhrává obsazení všech pěti bodů, zničení soupeřovy armády nebo uvěznění jeho poslední figury.

AI desky i arény, generátor 18 překážek, proměny jasů a útoky jsou nativním překladem původního programu. Kolize používají skutečné bitmapové pixely. Zvolená norma je **NTSC, přibližně 59,9233 Hz**. Úplné 1:1 se zatím netvrdí: průběžné rasterové načasování, zásobníková chyba Měňavce, některé chybné AI teleportace a prezentace přesunů zůstávají odlišné či neuzavřené. Přesný rozsah je v `research/archon/PORTING.md`; fyzický gamepad ani telefon zatím nebyly ověřené.

```sh
node tools/test-archon.mjs
node tools/test-archon-audio.mjs
node tools/test-archon-original.mjs
node tools/test-archon-raster.mjs
node tools/diagnose-archon-raster.mjs
```

27 herních a deset zvukových kontrol doplňuje porovnání s XEX: 953 360 bytových stavů ze 114 replayů, 768 rozhodnutí desky, 167 vykonaných AI kouzel, 2 592 lidských cílů kouzel a 44 úplných tahů obou začínajících stran. Pixelové kolize souhlasí v dalších 161 896 porovnáních dvanácti izolovaných VBI jader s úplným stabilním GTIA scanoutem. Samostatná diagnostika ukazuje zbývající rozdíly nepřerušovaného rasteru; není zaměňovaná za úspěšné ověření celého počítače. Pro hraní nejsou potřeba Atari emulátor, ROM, původní XEX, Node.js, Python ani síťové připojení.

## International Karate

Otevři `karate/index.html` přímo v prohlížeči. Hra používá nativní JavaScript + Canvas; nepotřebuje emulátor, ROM, ATR, HTTP server ani instalaci balíčků.

- Pohyb, kontextové ovládání, blokování, AI a kontakty jsou přeložené z dodaného ATR. Zachovávají vracení přípravné animace, držení úderu, otočky, hranice podle snímku a původní prioritu útočníků.
- Souboj běží PAL 50 Hz, animace po pěti snímcích a po sedmi při zásahu. Sólo má 30 sekund a dva body k vítězství; zbytek času přidává 100 bodů za sekundu.
- Dva hráči mají 60 sekund a původní přetahovací ukazatel se dvanácti kroky. Vítěz série pokračuje proti počítači. Bonusové vložky pro oba hráče i výsledkové přechody jsou přeložené podle ATR.
- Původní bitmapy, všechny sekvence a sedm exportovaných pozadí, rozhodčí, hudba Roba Hubbarda a šest původních digitálních samplů zůstávají zachované. Prostředí se již svévolně nemění po každém souboji.
- Původní úklona i gesto fouknutí do pěsti jsou animované. Bodování oznámí rozhodčí; v sólu se body zapíší po 50 PAL snímcích.

Bílý: **šipky + mezerník**. Červený: **WASD + Q**. Po otočce uvolni směr. Ústup a blokování závisí na vzdálenosti a pohybu soupeře. Předčasná změna směru může rozpracovaný útok vrátit zpět. Fungují gamepady a mobilní joystick s nezávislým FIRE.

**P / Escape:** pauza; **M:** zvuk; **R:** nabídka; **F:** celá obrazovka. Přepnutí okna/karty hru pozastaví. Hudba a samply respektují odemčení zvuku kliknutím, pauzu, ztlumení a původní priority efektů.

Bonusy i přechody jsou nyní nativním překladem originálu. Prostředí se mění po bonusu obou hráčů, postupně přes všech sedm scén. Dlaždice vyžadují po GO změnit směr joysticku; čisté dokončení každé disciplíny dává 2 000 bodů.

**Úplná shoda celé hry 1:1 zatím není potvrzena.** Zůstávají hranice průběžného rasteru, hardwarové náhody, pásků podle skóre a zvuku/barev; HUD a bubliny jsou webové. Přesná evidence i zbývající odchylky jsou v [research/international-karate/FIDELITY.md](research/international-karate/FIDELITY.md).

```sh
node tools/test-ik-original.mjs
node tools/test-ik-bonus-original.mjs
node tools/test-ik-flow-original.mjs
node tools/test-karate-bonuses.mjs
node tools/test-karate.mjs
node tools/test-karate-audio.mjs
```

30 000 stavů a společných kroků obou bojovníků souhlasí s výsledky původních Atari rutin včetně spotřeby náhodných bytů. Dále 7 278 bonusových/přechodových stavů, 70 celých řízených průběhů, 96 GTIA kontaktů, osm bonusových, 15 základních integračních a 12 zvukových testů ověřuje napojení, odpočet, body, gesto, přetahování, návaznost bonusů a zvukové události. Nejde o souvislý replay celého turnaje. V Edge byl místně ověřen start, pohyb, pauza a české/anglické menu i multiplayerový ukazatel. Fyzický telefon a gamepad nebyly ověřené.

## Samostatná hra Dynakillers

Samostatná místní implementace hry v HTML5 Canvas a JavaScriptu. Pro hraní nepotřebuje Atari emulátor, ROM, původní XEX, server, instalaci balíčků ani připojení k internetu.

## Spuštění

Otevři **`web/index.html`** v Edge, Brave nebo jiném moderním prohlížeči. V místní verzi nejsou použité moduly ani `fetch()`, takže funguje i přímé otevření souboru dvojklikem.

Vyber hru proti počítači, dva hráče nebo tři hráče na jednom počítači, jednu z osmi arén a počet kol. Potom stiskni **Spustit hru** nebo Enter. Počet kol je délka celého souboje, vítězí nejvyšší skóre. Remíza nepřidává bod.

| Hráč | Pohyb | Bomba |
| --- | --- | --- |
| 1 | Šipky | Mezerník |
| 2 | WASD | Q |
| 3 | IJKL | U |

**P / Escape:** pauza, **M:** zvuk, **R:** návrat do nabídky nové hry, **F:** celá obrazovka. Při přepnutí okna nebo karty se hra automaticky pozastaví. Při souběžném hraní na jedné klávesnici může počet současně rozpoznaných kláves omezovat klávesnice.

**Původní hudba:** v nabídce stiskni **♪ Přehrát titulní hudbu**. Po spuštění hry se automaticky přepne na herní skladbu. Ve zvukovém režimu lze i během hry vybrat hudbu se zvuky, pouze hudbu nebo pouze původní zvukové samply. Pauza zastaví i hudbu a pokračuje ze stejného místa; M tlumí hudbu i efekty. První přehrání vyžaduje kliknutí kvůli pravidlům prohlížečů.

Standardní gamepady: páčka / směrový kříž a A / B pro bombu; jednotlivé ovladače odpovídají hráčům v pořadí připojení. Fyzický gamepad zatím nebyl ověřen. Na úzké obrazovce se zobrazí dotykové ovládání hráče 1.

## Co obsahuje tato verze

- Původní mapy 20 × 12 polí, osm variant a jejich střídání mezi koly.
- Původní obrazová data loga, dlaždic a animovaných postav z dodaného `Dynakillers.xex`.
- Volný pohyb, kolize, bomby, řetězové výbuchy, ničení kamenů a skóre.
- Bonusy bomba, plamen, náhodný dočasný efekt a Stop. Dočasné efekty zahrnují rychlost pohybu, dosah, automatické kladení, zákaz kladení a kratší zápalnici.
- Osm původních zvukových samplů převedených ze čtyřbitových dat na Web Audio.
- Původní stereo soundtrack od Mariana Vybostoka (Goldmaster): titulní skladba 2:36,59 a herní skladba 1:42,84. Přehrává se z místních MP3 souborů, nahrávky se opakují od začátku.
- Jednoduchý počítačový protivník jako výslovný doplněk webové verze; původní hra je pro více lidí.

Je to první hratelný přepis, **nikoli potvrzená přesná replika**. PAL barvy a paleta loga jsou přibližné; rolovací úvod, původní nabídky/cheaty, výsledkové obrazovky a některé detaily kolizí nejsou přeneseny. Časování základních bomb a větvení výbuchů vychází z assembleru; úplná shoda chování s originálem ještě nebyla ověřena vedle sebe. V této verzi jsou odstíny a postavy ve třech hráčích sjednocené s barevnější variantou pro dva hráče.

## Soubory a ověření

`web/` je přenositelná hra. `web/engine.js` je čistá herní logika, `web/game.js` vykreslování/ovládání, `web/audio.js` zvukový přehrávač a `web/assets/` jsou vytažená data včetně dvou hudebních souborů. Originální soubory v kořeni zůstávají zachované.

```sh
node tools/test-engine.mjs
node tools/test-audio.mjs
```

Všech 11 testů prošlo. Pokrývají arény a startovní pozice, časování a limity bomb, kolize, řetězové výbuchy, remízu, bonusy, skóre, střídání map a únik počítače před vlastní bombou. Dlouhé simulace kontrolují souřadnice a limity hry. Ručně ověřeno v místním Edge: načtení přes `file://`, spuštění, vykreslení arény, pohyb, bomba, pauza a výběr/spuštění režimu tří hráčů. Podrobnosti rozboru a původ dat jsou v `research/PORTING.md`.

Dalších devět testů ověřuje hudbu: počáteční zákaz automatického přehrání, přechod titulní/herní skladby, pokračování po pauze, ztlumení, zvukové režimy a opožděné/odmítnuté přehrání. MP3 soubory jsou ověřené dekódováním, délkou a stereo kanály. Přehrání titulní skladby je ověřené v místním Edge přes `file://`.

Hra nemá požadavky na cizí služby ani externí závislosti. Zvuk a grafiku načítá ze stejného webu, při přímém místním otevření ze souborů. Nastavení si podle možností prohlížeče pamatuje v místním úložišti. Veřejná kopie je součástí portálu, výzkumné soubory a původní XEX/ATR se nepublikují.
