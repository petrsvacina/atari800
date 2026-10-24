# ATARI800 — webová herna

Veřejná herna: **https://atari800.gmork.cz/**. Dynakillers má vlastní adresu **https://atari800.gmork.cz/hry/dynakillers/** a odkaz zpět do katalogu. Portál i hry jsou statické soubory; nepotřebují databázi ani aplikační server.

International Karate je nová samostatná HTML5 hra v `karate/`, veřejně na **https://atari800.gmork.cz/hry/international-karate/**. Stav posledního ověřeného nasazení je v `DEPLOYMENT.md`.

Archon je samostatná nativní HTML5 verze v `archon/`, veřejně na **https://atari800.gmork.cz/hry/archon/**. Aktuální stav zveřejnění je v `DEPLOYMENT.md`.

## Obsah repozitáře

`portal/` obsahuje katalog, `web/` samostatné Dynakillers, `karate/` International Karate a `archon/` Archon, včetně všech grafických a zvukových prostředků potřebných pro hraní. `tools/` obsahuje sestavení, extrakční nástroje a testy; `research/` dokumentuje rozbor a ukládá podklady potřebné pro opakování grafických exportů.

Původní Atari soubory, referenční video, místní assemblerové podklady, SAP/WAV a pracovní binární výstupy se do Gitu nepřidávají. Pro hraní a sestavení portálu nejsou potřeba; vyžadují je jen některé vývojové extrakční nástroje. Vygenerovaný `dist/` je také ignorovaný. Po naklonování stačí `python3 tools/build_portal.py` a otevření `dist/index.html`, případně publikování obsahu `dist/`. Python používá jen standardní knihovnu; samotné hry pro hraní nepotřebují Python ani Node.js.

## Portál a přidávání her

Zdroj úvodní stránky je v `portal/`. Katalog se spravuje v `portal/games.json`: každá skutečně dostupná hra má unikátní `id`, název, popis, obrázek/logo, počet hráčů a adresář se spustitelnou webovou verzí v položce `source`. Právě jedna hra má `featured: true` a zobrazí se v hlavní nabídce. Nevydané hry se mezi hratelné nezařazují.

Při každém dalším načtení portálu ve stejné kartě se hlavní nabídka posune na další hru v katalogu a po poslední začne znovu. Společně se změní obrázek, logo, název, údaje, pořadové číslo i oba spouštěcí odkazy. Poslední volbu si pamatuje `sessionStorage`; při prvním otevření nebo zablokovaném úložišti zůstává výchozí hra označená `featured`. Bez JavaScriptu je výchozí nabídka i katalog plně přístupný.

```sh
python3 tools/render_portal_cover.py
python3 tools/karate_render_cover.py
python3 tools/archon_render_cover.py
python3 tools/build_portal.py
```

První tři příkazy vytvoří náhledy her z jejich původních grafických dat; pro další hry přidej jejich vlastní obrázky do `portal/assets/`. Poslední vytvoří kompletní veřejný web v `dist/`: úvodní stránku, katalog a každou hru pod `hry/<id>/`. Do publikované kopie hry přidá návrat do katalogu místo hlavičky `.edition`. Samostatné místní verze her se nemění.

Katalog umí hledat v názvu, žánru a popisu bez rozlišování diakritiky a filtrovat hry pro více hráčů. Odkazy na hry fungují i bez JavaScriptu. Na server patří pouze obsah `dist/`, nikoli kořen projektu s původními binárními soubory, pracovními daty a nástroji. Aktuální webový kořen Apache je `/var/www/atari800` na `mail.gmork.cz`; před jeho změnami pořiď zálohu. Existující konfigurace Apache a HTTPS není potřeba měnit.

## Archon

Otevři `archon/index.html` přímo v prohlížeči. Vyber Světlo nebo Stín proti počítači, případně dva hráče. Světlo začíná. Na desce klikni na vlastní figuru a potom na zvýrazněný cíl; alternativou jsou šipky a mezerník/Enter. Pozemní jednotky postupují kolmo a blokují je figury, létající přelétají i diagonálně. Útok na soupeře přepne do arény.

V sólu se tvoje armáda v aréně vždy ovládá **šipkami + mezerníkem**. Ve dvou: Světlo šipky + mezerník, Stín **WASD + Q**. S drženým FIRE stojíš a míříš, po nabití se může útok opakovat. Podporovaný je standardní gamepad a na dotykové obrazovce směrová tlačítka/FIRE. **P** pozastaví hru, **Escape** ruší výběr/kouzlo nebo přepíná pauzu, **M** tlumí zvuk, **R** vrátí nabídku a **F** otevře celou obrazovku. Přepnutí okna/karty automaticky pozastaví živou hru.

Hra obsahuje původních 36 figur a všech 20 druhů včetně čtyř přivolávaných elementálů. Původní jsou bitmapy, animační snímky, projektily, barevný terén a číselné tabulky síly, energie, nabití a pohybu. Hudba a deset efektů jsou vyrenderované z původních zvukových rutin; titulní hudbu lze přehrát v nabídce. Během hry ji nahrazují herní efekty.

Všech sedm kouzel je dostupných jednou za stranu, pokud žije a není uvězněný její mág. Kouzla nepůsobí na magických bodech. Bonus energie závisí na cílovém poli; použité kouzlo oslabí bonus vlastní domácí magické pozice. Magické body a vlastní vrchol světla léčí armádu podle původních pravidel. Vyhrává obsazení všech pěti bodů, zničení soupeřovy armády nebo uvěznění jeho poslední figury.

První hratelná verze má nově napsanou AI, kolize a proměny překážek. Přesná snímková shoda originálu nebyla potvrzená, některé okrajové případy kouzel a časování plošných útoků jsou přiblížené. Původ dat, konkrétní rozdíly a ověření jsou v `research/archon/PORTING.md`. Fyzický gamepad ani telefon zatím nebyly ověřené.

```sh
node tools/test-archon.mjs
node tools/test-archon-audio.mjs
```

28 herních a osm zvukových kontrol pokrývá pravidla desky, všechny druhy kouzel, energii a léčení, návrat z arény, speciální jednotky, projektily, konce hry, delší simulace i přehrávání hudby/PCM a jeho zastavení. Pro hraní nejsou potřeba Atari emulátor, ROM, původní XEX, Node.js, Python ani síťové připojení.

## International Karate

Otevři `karate/index.html` přímo v prohlížeči. Výsledná hra je čistý JavaScript + Canvas; neobsahuje emulátor, ROM ani původní ATR. Není potřeba HTTP server ani instalace balíčků.

- Turnaj proti počítači se třemi obtížnostmi; prohra ukončí turnaj.
- Dva hráči na jedné klávesnici nebo dvou standardních gamepadech, série na dvě vítězství.
- Všech 16 joystickových pohybů, původní snímky, sekvence, posuny a rychlost 5 PAL snímků na krok.
- Vyhodnocení zásahů používá osm původních útoků, šest tělesných oblastí a 27 tříd postojů z dodaného ATR. Stejné tabulky určují plné/poloviční zásahy a skóre.
- Sedm původních prostředí s barevnými grafickými vrstvami, původní hudba Roba Hubbarda (4:31,10) a šest původních digitálních zvukových samplů.
- Původní samostatná postava rozhodčího 24 × 32 pixelů. V bodovací přestávce oznámí barvu útočníka a potom celý/půl bodu. Po vítězném plném bodu karatista přehraje původní gesto: fouknutí do pěsti a zatřepání rukou za zády.
- Souboje na 30 sekund a dva body, pásky podle skóre; po třech výhrách střídavě bonus s dlaždicemi a úhyby zbraním.

Bílý: **šipky + mezerník**. Červený: **WASD + Q**. Směry jsou relativní k otočení postavy; tabulka pod hrou ukazuje obě sady pohybů. Drž směr do zásahu, potom jej uvolni. Ústup blokuje vysoké útoky, podmety vyžadují jinou obranu. Zadní útoky postavu otočí. Gamepad používá páčku/kříž a A/B; Start přepíná pauzu. Na úzkém displeji je dotykový joystick a FIRE. Skutečný gamepad ani telefon zatím nebyly fyzicky ověřené.

**P / Escape:** pauza; **M:** zvuk; **R:** nabídka; **F:** celá obrazovka. Přepnutí okna/karty hru automaticky pozastaví. Hudba začne po kliknutí, při pauze si pamatuje pozici; lze zvolit hudbu s efekty, samotnou hudbu nebo samotné efekty. Zvuky používají všech šest původních čtyřbitových samplů přímo z ATR. Spouštějí je změny původních animačních snímků a zásahy, včetně opožděného opakování a tří různých pádů. Vždy hraje jeden sample, nový přeruší předchozí; během něj hudba ztichne a její čas pokračuje. Pauza, M a návrat do nabídky zastaví i rozběhnuté a čekající efekty.

První hratelný přepis není úplný překlad instrukcí originálu. Nové jsou CPU, řízení soubojů, blokování a bonusové disciplíny. Původní tabulky kolizí i animací jsou zachované; úplná snímková shoda s původním programem ještě není potvrzená. Ve dvou hráčích se série ukončí výsledkem, nepřechází automaticky na souboj vítěze proti počítači. Prostředí se střídají mezi souboji. Hudební nahrávka se opakuje celá od začátku. Podklady jsou v `research/international-karate/`.

Barvy Sydney, podlahy a obou postav jsou kalibrované podle uživatelem dodaného videa. Export prostředí opravuje prioritu GTIA `$04`, takže bílé vrstvy nepřekrývají černé části mostu. Video ukazuje pouze Sydney; zbývající odstíny ostatních scén jsou extrapolované, nikoli přímo ověřené videem. Referenční video zůstává mimo veřejné soubory.

```sh
node tools/test-karate.mjs
node tools/test-karate-audio.mjs
```

Devatenáct herních kontrol zahrnuje všech 16 vstupů, 5snímkové časování, otočení/posuny, předčasné uvolnění a držení útoku, přesné plné/poloviční zásahy, více než 15 tisíc porovnání s původním souřadnicovým výpočtem, bodování, remízy, čas, konec turnaje/série, bonusy, pásky, okraje obrazovky, zprávy rozhodčího, podmínky vítězného gesta pro oba hráče a 20 delších simulací. Po zásahu se animace mění po sedmi PAL snímcích; gesto používá všech dvanáct původních kroků a během bodovací přestávky jej neovlivní hráčův vstup. Dvanáct zvukových kontrol ověřuje zákaz autoplay, přechody, pauzu, ztlumení, odmítnuté/opožděné spuštění, dekódování šesti původních samplů, výběr podle snímků a zásahu, pád pouze při změně postoje, 80/100ms opakování, prioritu hráčů a potlačení hudby bez zastavení jejího času.

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
