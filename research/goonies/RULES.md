# The Goonies — pravidla podle původního programu

První odhad podle videa je uložený v `scenes.json`, jeho geometrie se v runtime nepoužívá. Aktuální data jsou v `original-physics.json` a `original-mechanisms.json`; JavaScriptový překlad v `movement.js`, `rooms.js` a domovní části `engine.js`. Způsob ověření a omezení uvádí `PORTING.md`.

## Souřadnice a kolize

`actor.x` používá Atari barevné pixely, tedy dva fyzické vodorovné pixely. `actor.y` je původní bitmapový řádek včetně 16 řádků HUD. Bitmapové kreslení používá vodorovnou fázi `x & 3`; kolize používají tělesnou šířku a výšku aktuální logické pózy.

Obdélníky jsou inkluzivní. Typy 0/1 jsou levá/pravá stěna, 2 strop, 3 podlaha, 4 horní konec žebříku, 5 žebřík, 6 pružina a 7 horní tyč. Bit 7 obdélník vypíná. Počty pro osm místností jsou `[24,30,33,22,32,38,37,53]`. Jedna aktualizace pohybu připadá na čtyři obrazové kroky.

Nahoru skáče nebo leze, dolů slézá/pouští tyč, vlevo/vpravo mění pohyb. FIRE přepíná postavu. Neaktivní partner nedostává směrový vstup, ale dál podléhá gravitaci. Na zachycené tyči zůstane viset. Není zaváděný obecný režim „přichytit k odhadnutému objektu“.

Obě tělesa musí současně překrývat původní výstupní oblast. První postava se při pouhém přiblížení nemaže ani neznehybňuje.

## Mechanismy

| Scéna / resource | Původní podmínky přenesené do webu |
| --- | --- |
| Dům / 0 | Židle raw x=36, pohyb jen při tělesném tlačení, rozsah 32..119. Tiskárnu drží tělo v raw oblasti x=118..128, y=32. Nádrž reaguje na pohyb doprava **a vzhůru** v raw x=23..25, y=131..154. Po převržení proběhne pět fází vody a uhašení. Cíl je až na pravém konci spodního tunelu, raw x=144, y=160..191. |
| Vědra / 2 | Rumpál mění zdvih čtvrtého vědra, ostatní mají původní časovače a kolizní stěny. Závaží se při zatížení pohybuje dolů a zpět. Plovoucí kámen reaguje na kontakt a rychlost postavy; nejezdí po sinusové dráze. Klíč je na levém horním zábradlí, cíl v levých dolních dveřích. |
| Ventily / 1 | Jsou **tři** ventily. Dolní pravý přesměrovává proudy při cestě za horním. Potrubí praskne při současné obsazenosti horního pravého a prostředního levého, tedy přesné masce 3. Potom zůstane prostřední pravá cesta otevřená. NPC pouští vodu z galerie a střelec na levém žebříku používá původní čítače a výšky střel. |
| Kameny / 3 | Tři horní závěsné body přepínají tři skupiny skutečných obdélníků pro kámen. Jeho pohyb používá původní fyziku a tabulku směrovacích bodů. Spodní zatížená past rozhoduje o jeho směru. Správný průchod žlábkem ubírá prkno, chybný posouvá kladivo ke zvonu; zvon postupně vypustí netopýry. |
| Vejce / 4 | Pták letí po původních bodech a shazuje skutečné tlačitelné vejce. Po uplynutí času se mění v nebezpečný létající útvar. Průchody mají původní směrové podmínky a přesuny. Pravá kost ovládá spodní most. Čtyři vejce v pravém přijímači postupně zvednou skutečný žebřík/podpěru k výstupu. |
| Varhany / 5 | Devět kapek má vlastní fázi, čekání, dráhu a dopad. Tři prostřední kapky nabíjejí tlakové desky, na deskách může stát i hráč. Jejich maska vybírá jednu z osmi původních tabulek třinácti kolizních podpěr. Nejde o pevné střídání dvou ze tří barev po časové periodě. Průchody se používají směrem doprava. |
| Chobotnice / 6 | Horní kost uvolní klec; klec používá vlastní fyziku a kolize a lze ji posouvat. Držení spodní zarážky odblokuje pružinu. Zatížení odblokovaného vahadla spustí odtok, potom hladina postupně sama klesá z raw 123 na 150. Počet tří libovolných skoků není podmínkou. Proud mění vodorovnou rychlost těles. |
| Loď / 7 | Obsazenost pák vybere masku skutečných průlezů a jejich stropů/podlah. Sloth je jinak vysoké tělo se základem snímků 49. Jeho držení prostředního zdvihu zvedá ráhno i pasažéra po řádcích. Posunutí truhly uvolní mince; ty odlákají Matku Fratelliovou přes okraj lodi. Cílem je společné překrytí raw bodu (144,64). |

Náhodné čekání používá vlastní nativní generátor ve stejných rozsazích. Testy podávají stejné řízené náhodné byty jako vývojový Atari běh, aby šlo porovnávat snímky. Výchozí webová posloupnost náhody není POKEY.

## Co bylo skutečně dohrané

Nové vstupní replaye domu a potrubí končí s oběma postavami ve správném východu a pěti životy. Zkoušky ostatních mechanismů a delší běhy protivníků se porovnávají s původní hrou, ale nenahrazují úplné ruční dohrání zbývajících šesti místností. Staré replaye na odhadovaných plošinách se nepoužívají jako důkaz průchodnosti.
