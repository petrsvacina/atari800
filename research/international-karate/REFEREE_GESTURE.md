# Rozhodčí, vítězné gesto a úklona

Ověřeno z původního RAM dumpu dodaného Atari ATR. Nejde o odhad podle IK+ ani o nově nakreslenou animaci.

## Fouknutí do pěsti a zatřepání rukou

Je to původní akce 32: snímky `0,34,34,35,24,35,24,35,0,0,0,0`. Snímek 34 má zadní pěst u úst, střídání 35/24 pohybuje rukou za bokem. Zvětšený výřez `gesture-strip.png` ukazuje zleva snímky 0, 34, 35 a 24; barvy jsou pracovní paleta exportu.

Přesný spouštěč je v obsluze zásahu `$2899–$2908`. Po nastavení pádu zasažené postavy kód na `$28D8` testuje:

1. `$6144 >= 2` — udělený plný bod, nikoli půlbod.
2. `RAM[$D9 + attackerIndex] >= 2` — útočník už měl před tímto zásahem nejméně dvě půlbodové jednotky.

Při splnění obou testů nastaví `$6131=32`, vymaže `$6183` útočníka a přes `$277A → $51DC → $530F` vynutí jeho vítěznou akci. Přímo druh útoku se netestuje: gesto není omezené na zásah pěstí.

V sólu tedy jde o vítězství souboje plným bodem. Bodovací rutina `$44FF` přičítá `$6144` do `$D9/$DA`; ukončení souboje `$2BA2` testuje čtyři půlbodové jednotky. Vítězný půlbod gesto nespouští.

Samotný test gesta nemá podmínku jen na sólo. Původní multiplayer ale používá ukazatel přetahování (`$6167`), a při běžném zásahu před dosažením hranic 54/66 nastaví `$6144=0`. Proto nelze prosté sólo pravidlo bez dalších podmínek vydávat za přesný původní multiplayer.

## Délka animace a bodovací přestávky

Při nenulovém `$D8` vynucuje čekací smyčka `$3C06` sedm PAL snímků na animační krok. Akce 32 tak zabere 12 × 7 = 84 snímků, asi 1,68 s. Běžná nezasažená animace při standardní rychlosti používá pět snímků na krok.

`$2899` nastavuje čítač `$DF=0`, VBI `$3961` jej po jednom zvyšuje a `$2902` čeká do 150. Sóločást po zásahu tedy trvá tři sekundy. Běžný multiplayerový zásah nastaví `$DF=50` (`$28D3`), takže zbývají dvě sekundy. Výherní situace na hranici přetahování má delší průběh, protože toto zkrácení přeskočí.

V sólové větvi `$2DF5–$2E30` má řeč rozhodčího tento sled:

| Původní `$DF` | Zpráva |
| --- | --- |
| 0–49 | ID 1/2: barva útočníka |
| 50–129 | ID 5 při půlbodu, jinak ID 6 při plném bodu |
| 130–149 | ID 7: prázdná bublina (nulová délka bitmapy) |

Pozor: jméno/barva se zobrazuje od začátku přestávky; práh 50 přepíná teprve na HALF/FULL POINT. Původní multiplayerová větev `$2E36` zobrazuje barvu do `$DF<100`, potom zprávu 10 související s časem/skóre; nepoužívá totožný sólový sled.

## Úklona

Akce 28 je sekvence čtrnácti snímků: pětkrát 48, pětkrát 49 a čtyřikrát 48. Při běžných pěti PAL snímcích na krok trvá 1,4 s. Nastavuje ji rutina nových startovních pozic `$2D8A` (výběr `$2DC1`) a následně nulováním vstupní akce nechá dokončit a vrátit se do postoje.

V sólo režimu se úklona nastaví při tomto resetu běžně, tedy před pokračováním souboje. V původním multiplayeru se potlačí, když čas `$DC` klesl pod 60; na úvod nového souboje s časem 60 zůstává. Nejde tedy primárně o oslavu vítěze po skončení kola.

Při akci 28 používá `$2E92` zprávu rozhodčího 3. Rozluštění její původní bitmapy `$47E3` potvrzuje text BEGIN, nikoli BOW. Další krátké bitmapy potvrzují zprávy 1 WHITE, 2 RED, 4 STOP a 16 DRAW.

## Samotný rozhodčí

Tělo má 96 bytů na `$45FB–$465A`, kopie `$465B` je přenáší do fontových oblastí `$13A0–$13FF` a `$17A0–$17FF`. Je to původní statická postava. Přímé zápisy do těchto oblastí jsou pouze tyto kopie; alternativní ručně přepínané tělesné pózy nebyly nalezené.

Reset `$271D → $465B` volá inicializace scény `$32BB` a reset zvláštní obrazovky `$5D55`. Řečová bublina je samostatná: `$2717 → $4A51`, A určuje ID zprávy 0–16; bitmapové ukazatele jsou `$4A1D`, délky `$4A3F`. Bublina zapisuje do jiných znaků `$11A0–$11FF` a `$15A0–$15FF`, nikoli do těla rozhodčího.
