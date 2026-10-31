# International Karate — audit podle dodaného ATR, 31. 10. 2026

Autoritou je `International Karate.atr`, SHA-256
`b30ddd0920a00a99d8b41d97b24d72cc57150e73e9a3686e0f35cb74f3b62bec`.
Referenční video nebylo použito pro odhad herních pravidel. Verze zůstává nativní
JavaScript; původní procesor je pouze vývojová reference. Režim je PAL, 50 Hz.

## Co původní přepis měnil

Předchozí `engine.js` používal vlastní pravděpodobnostní AI, minimální rozestup
25 pixelů, obecný příznak blokování, zjednodušené rušení pohybů a současné zásahy
anuloval. Ignoroval také kontextové tabulky joysticku, návrat přípravné animace,
počítání zbytku času do skóre a původní multiplayerový ukazatel. Autentické
bitmapy a některé původní tabulky proto nezajišťovaly věrný souboj.

## Nová implementace a evidence

`karate/original.js` překládá následující rutiny do pojmenovaných stavů a operací.
`assets/routines.js` obsahuje pouze extrahované tabulky, nikoli strojový program.

| Oblast | Původní rutina | Ověření |
| --- | --- | --- |
| Geometrie, orientace a vzdálenost | `$3F8F` | Součást AI, ovládání a kontaktů; zachováno i asymetrické odečítání s carry |
| Joystick a automatické blokování podle hrozby | `$51F9` | 5 000 samostatných případů |
| Výběr a průběh animací, vracení přípravy, držený úder, otočka | `$530F`, `$53BC` | 5 000 případů, včetně stavových příznaků a počtu čtení náhody |
| Posuny a hranice podle šířky konkrétního snímku | `$5509`, `$550E` | Součást animačních případů; odstraněna umělá separace postav |
| Počítačový soupeř | `$3D00`, `$3F6E` | 5 000 rozhodnutí, všech šest sad prahů, původní rejection sampling |
| Kontakt, plný/poloviční bod, skóre, výběr pádu | `$4182` | 5 000 případů |
| Priorita útoků včetně situace, kdy první způsobilý útok mine | `$415A` | 5 000 případů; žádné vymyšlené anulování současných zásahů |
| Společné zpracování obou postav, vstupů a AI | `$51C0` | 5 000 případů; obě pořadí, dva lidé i člověk na kterékoli straně |

Celkem **30 000 srovnávacích případů** je uloženo v `combat-oracle.json.gz`.
Jsou to vstupní a výsledné sémantické stavy, nikoli RAM nebo původní kód.
Očekávaný výsledek vytvořil offline py65 spuštěním původních rutin v načteném
obrazu dodaného ATR. JavaScript dostává stejný proud čtených náhodných bytů
a hodnot rasterového registru; test porovnává také počet těchto čtení.

Adapter v `engine.js` dále podle rozboru mění:

- pět PAL snímků na běžný krok, sedm při zásahu (`$3C06`);
- úklonu akcí 28, včetně její animace a zastavených hodin (`$2D8A`, `$398E`);
- první odpočet sekundy po 25 PAL snímcích, další po 50 (`$2D1F`, `$3995`);
- oznámení zásahu před přičtením bodů v DF=50; sólo má 150 snímků přestávky;
- časový bonus 100 bodů za sekundu, odpočítávaný po čtyřech snímcích (`$29FB`);
- dvěma hráčům 60 sekund a ukazatel `$6167`: začátek 60, každý zásah +/-1,
  konec při 54/66, běžná přestávka 100 snímků bez nové úklony po odpočtu času;
- původní růst síly AI podle fáze hry namísto nabídky vlastních obtížností;
- první bonus ve fázi 4 a druhý ve fázi 9, namísto pevného bonusu každé tři výhry;
- scénu již svévolně nestřídá po každém souboji.

Základní adapter pokrývá dalších 15 integračních testů. Samotný souboj lze
spustit z `karate/index.html`; `tools/build_portal.py` připravuje aktualizovaný
portál v `dist/`. V Edge byl ověřen start, pohyb, pauza, CZ/EN a multiplayerový
čas i ukazatel. Kontrola zvuku má 12 testů; dotykový joystick zůstává zachován.

## Bonusy a turnaj — dopracování 31. 10. 2026

`karate/bonus.js` a nativní generátory v `engine.js` nahrazují dosavadní náhradní
bonusy a časové přechody. Web nepoužívá Atari CPU ani obraz RAM.

- **Dlaždice (`$3059–$31A7`)**: příprava, proměnlivé čekání, 13 PAL snímků
  klidného joysticku, penalizace při nepřetržitém přepínání, GO a změna směru.
  Samotný FIRE v neutrálu nestačí. Počet je `10 - (reakce >> 2)` do 39 snímků,
  od 40 snímků jeden kus; po 100 snímcích bez reakce neúspěch. Deset kusů dává
  **2 000 bodů celkem**, ostatní po 100. Každé lámání používá původní sample 2.
- **Grafika dlaždic (`$31E2`)**: původní bitmapové pózy 52/53 a tři PMG vrstvy,
  včetně mezikroků rozbití. Zachováno i chybějící uložení každého třetího prostředního
  řádku v původní rutině. Žádné nově kreslené prkénkové obdélníky.
- **Zbraně (`$2F3E`, `$5807–$5AA3`)**: původní tři tvary, bitové vzory, PMG
  vrstvy, barvy, velikosti, výšky, směry, rychlosti a jejich výběrové tabulky.
  Pohyb zbraní běží při každém VBI, postava po pěti snímcích. Používá všechna
  původní joysticková gesta. Počty jsou 8/12/16 podle původního stupně.
  Úspěch přidává 2 000; nejsou nově přidávané body za jednotlivé úhyby.
- **Kolize**: původní čtení P0PF (`$388A`) je přeloženo na průnik litých bitů
  PM0 s neprázdnými pixely původní postavy. Pád se vybírá podle strany příletu
  a orientace postavy. Původní zbraň pokračuje v letu během pádu.
- **Turnaj (`$2918–$2D87`)**: BCD pořadí fází, kontrola obtížnosti před zvýšením
  fáze, odpočet zbývajících sekund, remízy, bonusové vložky pro oba hráče,
  běžné a předčasné ukončení série, prémie a převod do hry proti počítači.
  Čekání přes `$3C06` respektuje zbylý VBI čítač a pět/sedm snímků; nesčítá
  nezávisle nově odhadnuté prodlevy.
- **Prostředí**: `$303C` nejprve dokončí disciplínu obou hráčů, čeká 40 snímků,
  zavolá přípravu další fáze a pak `$4389`. Scény tedy běží
  Sydney → New York → Rio → Japonsko → Egypt → Atény → Fudži → Sydney.
  V sólu jsou první bonusové fáze 4, 9, 13, 18, 22, 27, 31; v multiplayeru
  2 (dlaždice) a 4 (zbraně), se souboji ve fázích 1, 3, 5.
- **Umístění**: proti skutečnému Atari snímku byla opravena svislá kotva postav
  o 21 pixelů. Plocha má 320 × 224, aby byl vidět celý původní sloupec dlaždic.

Zachována je také doložená zvláštnost série: `$2B6E/$2B76` oznámí výsledek,
ale nepřepíše D1. `$2C0E` proto při převodu může ponechat vítěze posledního
souboje (při remíze D4), i když oznámení podle součtu skóre ukazuje jinou barvu.
Test tuto odchylku originálu zachytil; nepřidáváme vlastní opravu jeho pravidel.

### Ověření dopracování

| Sada | Rozsah |
| --- | --- |
| `bonus-oracle.json.gz` | 5 000 VBI kroků zbraní včetně všech PMG bytů a čtení náhody, 22 stavů dlaždic, všech 256 reakcí a 2 000 přechodů fáze |
| `flow-oracle.json.gz` | 18 celých lámacích disciplín, 12 zbraňových disciplín, 40 celých vyhodnocení výsledku; souhlasí počet PAL snímků, skóre, fáze, režim, postup obou hráčů i čtení náhody |
| `weapon-pixel-oracle.json.gz` | 96 izolovaných obrazových stavů z Atari800/GTIA: souhlasí zásah/neúspěch, 9 zásahů a 87 minutí |
| `test-karate-bonuses.mjs` | 8 návazných kontrol včetně obou hráčů, pořadí disciplín, přechodu do sóla a cyklu všech sedmi prostředí |

Reference průběhů provádí původní kód s řízenými VBI/vstupy; kreslení a diskové
I/O jsou při tomto testu oddělené. Zbraňové průběhy mají řízený vstup P0PF pro
izolaci výsledkových větví. Skutečné pixely mají samostatný GTIA test. Nejde
o tvrzení, že stojící postava ve skutečné hře automaticky přežije celou disciplínu.

V Edge bylo v soukromém náhledu vidět původní skládání dlaždic; vstup joystickem
rozbil všech deset, připsal 2 000 a přešel na New York. Soukromá testovací tlačítka
nejsou v `karate/` ani v portálu.

## Zbývající hranice shody

**Celou hru stále neoznačujeme za úplně prokázanou 1:1.** Nové bonusy a přechody
už nejsou náhradní mechanismy, ale úplná souvislá emulátorová validace celého
turnaje se všemi rasterovými okamžiky dosud neproběhla.

- Prahy barevných pásků dosud nejsou potvrzeny proti rutinám konkrétního ATR.
- Náhodné byty a rasterové hodnoty browser generuje sám. Rozhodovací algoritmy
  jsou ověřené, přesný hardwarový proud POKEY RANDOM není bitově reprodukovaný.
- Webové HUD, nabídka a bubliny nejsou původní znakové obrazovky. Návrat do
  demonstrace po konci hry je zobrazen překryvem konce hry.
- PNG prostředí jsou přednačtené; proměnlivá latence původní disketové mechaniky
  není herní přestávka ve webu. Přesné podřádkové rasterové přechody a analogové
  zvukové detaily zůstávají mimo důkaz těchto testů.

## Reprodukce

Načíst pracovní kopii ATR v PAL Atari800, zastavit v hlavním vlákně po načtení
(například breakpoint `$3C06`, pak `$2F33`), uložit monitorovým příkazem
`write 0 bfff /path/to/ram.bin`. Žádný RAM dump se nepublikuje.

```sh
python3 tools/ik_extract.py --memory /path/to/ram.bin --oracle research/international-karate
node tools/test-ik-original.mjs
node tools/test-ik-bonus-original.mjs
node tools/test-ik-flow-original.mjs
node tools/test-karate-bonuses.mjs
node tools/test-karate.mjs
node tools/test-karate-audio.mjs
node tools/test-touch-joystick.mjs
node tools/test-game-i18n.mjs
python3 tools/build_game_i18n.py --check
python3 tools/build_portal.py
```

Generování reference vyžaduje vývojový balík py65; běžné testy a web jej nepoužívají.

Generování nových referencí:

```sh
python3 tools/ik_bonus_oracle.py --memory /path/to/ram.bin
python3 tools/ik_flow_oracle.py --memory /path/to/ram.bin
python3 tools/ik_pixel_oracle.py --emulator /path/to/development-atari800 --state /path/to/weapons.a8s
```

Pixelový stav se pořídí v PAL při začátku disciplíny `$2FB6`, po přípravě hráčů
`$50/$51` a spuštění `$2F3E`; používá se pracovní kopie ATR. Snímek pro kontrolu
polohy dlaždic byl zachycen na `$30D3`. RAM, snapshoty a původní program se
nepublikují.
