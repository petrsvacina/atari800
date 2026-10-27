# Archon (Atari 8-bit, 1983): ověřené podklady pravidel

## Zdroje

- [Původní manuál Electronic Arts](https://www.mocagh.org/ea/archon-manual.pdf), zejména strany 2–7 a 9–12.
- [Atari Quick Reference Card](https://www.atarimania.com/8bit/files/Archon_Quick_Reference_Card_EA.pdf), obě strany, viz místní `/private/tmp/archon-quick-reference.pdf`.
- [Oficiální Atari XE manuál](https://mocagh.org/ea/archonxe-manual.pdf), oddíl Magic Spells.
- [Britský původní manuál](https://www.mocagh.org/ea/archonuk-manual.pdf), vlastnosti Phoenix/Shapeshifter/Banshee.
- Uživatelem dodaný `Archon.xex`: segment `$3000–$9C1F`, přeložený původním zavaděčem na `$1000–$7C1F`. Níže uvádíme **adresy po přesunu**, tedy z `/private/tmp/archon-relocated.bin`.

`archon/assets/rules.js` exportuje `ARCHON_RULES`. Čitelná kopie je v `rules.json`. Údaje vyčtené z XEX nepocházejí z odhadu pozdějšího remaku.

## Deska a pohyb

9 × 9, 18 figur na stranu, osm druhů na každé straně a čtyři přivolatelní elementálové. Světlé zadní sloupce x=0/1; temné x=7/8. Rozmístění je přímo v exportovaném `layout` (y=0 horní řada). Pět mocných bodů: (4,0), (0,4), (4,4), (8,4), (4,8).

Pozemní pohyb je po kolmých sousedech, blokovaný figurami, lze zatáčet. Létání používá i diagonály a ignoruje mezilehlé figury. Běžný přesun mága je teleport na vzdálenost tří polí, s prakticky stejným dosahem jako létání; není totožný s velkým kouzlem Teleport. [Původní manuál](https://www.mocagh.org/ea/archon-manual.pdf)

Terén je z `$202B–$207B`, 81 bajtů: 0 stálá temná, 64 stálá světlá, 192 proměnlivá. Export obsahuje původní matici i pole 81 názvů. Nejde o obyčejnou dvoubarevnou šachovnici.

Proměnlivá pole mají šest stupňů a střídají černou → bílou → černou; posun nastává po tahu hráče, který táhne jako druhý, nikoli po každém půltahu. Vítězí obsazení všech pěti bodů nebo vyřazení protivníka. Současná smrt obou bojovníků nechá pole prázdné. [Původní manuál](https://www.mocagh.org/ea/archon-manual.pdf)

## Číselné tabulky původního programu

Pořadí ID: Unicorn, Wizard, Archer, Golem, Valkyrie, Djinni, Phoenix, Knight, Basilisk, Sorceress, Manticore, Troll, Shapeshifter, Dragon, Banshee, Goblin, Air, Fire, Earth, Water. Poslední čtyři potvrzují také ukazatele názvů `$642B–$6432`.

| Adresa | Obsah |
| --- | --- |
| `$564C` | 20 základních životností |
| `$5638` | 20 sil útoku |
| `$5624` | 20 parametrů střely; 64 plošný útok, 32 útok zblízka |
| `$5660` | 16 pohybů desky: spodních 6 bitů dosah, bit 7 létání, bit 6 teleport |
| `$5670` | 20 intervalů útoků v původních snímcích |

Všechny hodnoty jsou v `units`. Interval není čas v milisekundách. PAL a NTSC mají rozdílnou délku snímku; převod na sekundy musí uvést použitou frekvenci.

Poměr rychlosti v aréně je **ověřený z kódu**, nejen kategorie z příručky. `$524A–$525D` nastavuje `$064A=$40` pro Golema, Trolla a Earth Elemental. `$6B2E–$6B42` vynechá jejich každý čtvrtý pohybový krok, tedy rychlost 0,75 ostatních. Funkce pohybu mění x o jednu barevnou hodinu a y o jednu obrazovou řádku: `$6BF7`, `$6C3B`, `$6C8A`, `$6CD2`. Při obrazu šířky 320 bodů to znamená x=2 a y=1 bod za úspěšný pohybový krok. Přesná četnost celé aktualizační smyčky nebyla v této rešerši samostatně měřena.

Bonus životnosti v `$5207–$5225`: světlo přičítá polovinu spodního jasu barvy, temnota přičítá 7 minus tuto hodnotu. Elementálové tuto větev přeskočí. `$5BE5–$5C49` mění jas o dva a vynechává hodnoty 4 a 10. Přesných šest jasů je tedy `[0,2,6,8,12,14]`, bonusy světla `[0,1,3,4,6,7]`, temnoty opačně. Na vrcholech se pouze obrací směr, vrchol se nedrží další cyklus. Výchozí barva `$5A58=$B6` znamená index jasu 2 se směrem ke tmě při začátku Světla; přepínač prvního hráče `$36C0` při temné první straně volí `$B8`, index jasu 3 se směrem ke světlu. Úplná inicializace a 44 navazujících tahů jsou ověřené proti XEX.

Trvalé zranění je potvrzené `$550F–$553A`: přeživší si uloží `min(previousBaseHealth, arenaRemainingHealth)`. **Bonus se od zbývajících životů po bitvě neodečítá.** Pohlcuje počáteční zranění jako dočasný štít. Návrat Shapeshiftera má v dodaném XEX chybu indexu a zásobníku, viz neuzavřené detaily níže; obecný plný návrat vlastní životnosti nelze z této rutiny tvrdit. Například nezraněný Dragon 17 + bonus 6 po zásazích za 10 skončí na 13, nikoli na 7; po zásahu za 5 zůstane jeho trvalá životnost 17.

Přesná pasivní léčba: po tahu druhého hráče `$3D90–$3DB8` projde pět mocných bodů a každou jejich zraněnou živou figuru vyléčí o jeden bod do základního maxima. Při černém vrcholu `$3D74` navíc volá `$599C` na celou temnou armádu, při bílém `$3D83` na světlou; tato rutina každé zraněné živé figuře přidá jeden bod. Tím se obecná pomalá léčba děje na vlastním příznivém vrcholu, nikoli po každém běžném tahu. Figura na mocném bodu může v tomto kole získat oba přírůstky.

## Výjimky boje

Phoenix má plošný výbuch a během proměny je nezranitelný. Banshee působí průběžné plošné zranění a po uvolnění tlačítka se může při útoku pohybovat. Shapeshifter přebírá podobu a bojové vlastnosti soupeře. Manuál popisuje zahojení nefatálních ran, ale návrat dodaného XEX má níže popsanou odchylku. [Britský původní manuál](https://www.mocagh.org/ea/archonuk-manual.pdf)

Troll **nemá zvláštní regeneraci**. Původní manuál to výslovně vysvětluje v otázkách a odpovědích. Při drženém tlačítku bojovník běžně stojí; po nabití může automaticky znovu vystřelit. Střela zůstává nebezpečná i po smrti střelce. [Původní manuál](https://www.mocagh.org/ea/archon-manual.pdf)

## Kouzla

Každé jednou za stranu; nahrazují tah. Vyžadují živého, neuvězněného mága. Mocné body chrání figury před kouzly. Každé kouzlo mága oslabuje.

- Teleport: vlastní figura, libovolná vzdálenost; ne uvězněná, ne z/na mocný bod, ne na spojence. Lze napadnout nepřítele.
- Heal: úplné vyléčení vlastní figury včetně vězně; ne na mocném bodu.
- Shift Time: obrací směr cyklu; na krajním jasu přeskočí na opačný kraj.
- Exchange: prohodí dvě figury libovolných stran; žádná nesmí být uvězněná nebo na mocném bodu.
- Summon Elemental: náhodný ze čtyř; útočí na nepřítele mimo mocný bod, po boji zmizí.
- Revive: mrtvý spojenec na prázdné sousední pole mága, včetně diagonály, mimo magický bod. Nabízí se první původní index každého padlého druhu.
- Imprison: zabrání pohybu a kouzlení, obrana zůstává. Končí při vlastním vrcholu jasu. Ne na mocném bodu ani v okamžiku, který by ihned osvobozoval.

[Oficiální XE manuál](https://mocagh.org/ea/archonxe-manual.pdf), podrobné meze [původní manuál](https://www.mocagh.org/ea/archon-manual.pdf). Zrušení výběru kouzla nemá spotřebovat kouzlo ani tah.

### Přesný účinek spotřebovaných kouzel v dodaném XEX

Dodatečný rozbor potvrzuje konkrétní chování původního kódu, které je užší než obecná formulace manuálu „kouzlení oslabuje mága“:

1. Dokončení výběru kouzla `$4C8E` zapíše marker `$FE` do jeho položky ještě před dispatchí kouzla. Zrušení výběru se neoznačí. Sedm položek světla začíná `$1260`, sedm temnoty `$1267`.
2. `$43C8` projde sedm položek a v `$CC` vrátí počet markerů `$FE` — každý spotřebovaný spell znamená přesně jeden bod.
3. Během inicializace arény `$5225` zavolá `$55C9`, která tento počet vrátí pouze tehdy, když se bojuje na **vlastním výchozím mocném bodě**: `$CF=4` (řada), `$D1=0` pro světlo / `$D1=8` pro temnotu. Arena index X je 0 pro světlo a 1 pro temnotu; po ověření temného sloupce se index spell-listu upraví z 8 na 7.
4. `$5229` počet odečte od startovního HP. Rutina netestuje druh bojovníka: oslabení domácího bodu platí pro libovolnou vlastní figuru, která zde bojuje. Ostatní pole a jiné mocné body tento odpočet nepoužívají.

Proto přesný model je `homeBonus = 7 - usedSpells[side].size`, aktuální trvalé zdraví se při seslání nemění. Vlastní domácí pole má vždy příznivou stálou barvu a nejvýše sedm kouzel, takže odpočet nezasahuje základní HP. Mág se základní životností 10 má doma při 0/3/7 spotřebovaných kouzlech startovní HP 17/14/10.

Heal na `$4D28` vrací trvalé HP přímo na základní tabulkovou hodnotu. Neobnovuje spotřebovaná kouzla. Následný domácí bonus tedy zůstává oslabený, včetně právě spotřebovaného Heal. Protože Heal na mocném bodu není povolen, mág by se pro vlastní léčení musel nejdříve přesunout jinam. Není zde pořadí „nejdříve vyléčit a pak zranit mága o 1“ — takový přímý zásah do HP při kouzlení program nemá.

## Dodatečně ověřené větve a neuzavřené detaily

Celý validátor `$6177` souhlasí ve 2 592 případech. Revive zakazuje i prázdný sousední magický bod: `$6230–$624B` zkouší ochranu a teprve potom dispatchuje sousedství `$6293`. Heal `$6279` kontroluje vlastní stranu, vězení však neodmítá.

Program má samostatné zprávy IT IS A TIE a IT IS A STALEMATE. `$3DBC–$3DDE` potvrzuje prohru strany, jejíž poslední živá figura je uvězněná. `$4048` nastavuje čítač `$06A7=$FC`, když mají obě strany méně než tři figury a AI dojde do této větve; vstup do arény `$523D` jej nuluje. `$3D52` po druhém tahu kontroluje nulový spodní nibble před snížením. Není to univerzální remíza všech lidských partií ani pravidlo tří opakování.

Pět Fénixových fází trvá po deseti voláních, zásahy se zkoušejí v pátém kroku každé fáze. Banshee používá vlastní čítač a zkouší zásah po pěti aktualizacích. Tyto větve jsou součástí 114 původních replayů, včetně weapon/AI stavů. Původní grafické překrytí ověřuje zvláštní test se stabilním úplným scanoutem; průběžné rasterové načasování zůstává rozdílné, viz PORTING.md.

**Chyba návratu Měňavce:** `$552A` uloží energii, `$552B` zjistí typ 12, ale `$5533` čte `$564C,Y` s původním ID 25 místo typu. Záporný byte vede přes další `PLA` a uloží hodnotu ze zásobníku. Řízené návraty celé bitvy s energií 1/5/9 tak postupně uložily 32/198/15; nejde o potvrzení přirozené celé partie. Webový návrat na 10 a patologický souboj stejné figury po vadném Teleportu AI zatím nejsou uzavřený převod tohoto chování.
