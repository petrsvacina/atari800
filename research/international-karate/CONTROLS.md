# International Karate — ovládání a pravidla pro první webovou verzi

## Primární podklady a rozdíly platforem

[Původní manuál System 3, přepis C64.com](https://www.c64.com/games/no-frame.php?from=0&range=222&searchfor=&searchfor_special=9&show_info=1&showid=195) popisuje Macleanovu původní hru, nikoli IK+. Původní atarové scany jsou na [Atarimanii](https://www.atarimania.com/games/atari-400-800-xl-xe-games-international-karate-2592), ale jejich dostupný náhled má velmi nízké rozlišení. C64 pravidla proto nejsou prohlášena za úplně ověřenou shodu Atari verze.

## Směry postavy otočené doprava

| Směr | Bez tlačítka | S tlačítkem |
| --- | --- | --- |
| ↑ | skok (1) | letící kop (9) |
| ↗ | přední výpad pěstí (2) | salto vpřed (10) |
| → | chůze vpřed (3) | přední kop (11) |
| ↘ | kop do hrudi (4) | přední boční kop (12) |
| ↓ | podmet (5) | zadní úder z dřepu (13) |
| ↙ | úder z dřepu (6) | zadní boční kop (14) |
| ← | ústup / blok (7) | obloukový kop (15) |
| ↖ | zadní výpad pěstí (8) | salto vzad (16) |

Při otočení doleva se směry zrcadlí. Útok je třeba držet do provedení; předčasné uvolnění jej ruší. Trvalé držení samo útok neopakuje. Ústup blokuje horní zásahy, nikoli útoky na holeně a podmety. [Manuál](https://www.c64.com/games/no-frame.php?from=0&range=222&searchfor=&searchfor_special=9&show_info=1&showid=195)

## Body

Plný / poloviční zásah: výpady a údery z dřepu 800/400; kopy na holeně 200/100; letící a obloukový kop 1000/500; kop do břicha 200/100; do obličeje 800/400; podmet 400/200. [Dobový manuál původního IK](https://www.gamesdatabase.org/Media/SYSTEM/Sinclair_ZX_Spectrum/Manual/formated/International_Karate_-_1985_-_System_3_Software.htm)

## Turnaj a bonusy

Solo: 30 sekund, vítězí první se dvěma body; prohra ukončí turnaj. Po třech soubojích bonus: střídavě dlaždice a úhyby zbraním. Dlaždice: reagovat na GO, deset kusů, každý 100 bodů; všechny přidají 2000. Zbraně: za každý úhyb 100, dokončení 2000. Multiplayer: nejlepší ze tří soubojů, potom vítěz proti počítači. [Manuál C64](https://www.c64.com/games/no-frame.php?from=0&range=222&searchfor=&searchfor_special=9&show_info=1&showid=195)

Pásky mají prahy: bílý 0, žlutý 6000, zelený 12000, fialový 18000, hnědý 24000, černý 40000. Uvádí je dobový hráčský tip v [Atari User, listopad 1987, strana 61](https://vtda.org/pubs/AtariUser/AtariUser31-Nov87.pdf). Zatím nebyly potvrzeny z kódu.

## Sekvence přímo z dodaného Atari ATR

`animations.json` obsahuje 35 ohraničených sekvencí původních snímků a paralelních posunů. Ověřené adresy:

- `$558D–$55B0`: 36 hranic sekvencí (první 0, poslední 199).
- `$55B1–$5677`: 199 indexů snímků. Pohyby 1–16 odpovídají očíslování tabulky ovládání.
- `$5679` + index kroku: vodorovný posun se znaménkem. Použití potvrzuje rutina `$5509`: sčítá nebo odčítá podle orientace.
- `$5740` + index kroku: původní stavové příznaky. Jejich úplná interpretace není hotová, JSON je uchovává bez domyšlených názvů.

Kód `$53BC–$5508` vybírá a aktualizuje snímek přes tabulku `$55B1`, odděleně zpracovává orientaci a pohyb. Hlavičky posunů byly zjištěny z operandů kódu. Surová čísla nejsou odhad vizuálních animací.

`$3C06` čeká, až VBI čítač `$6121` překročí X z `$3C02`, pak čítač nuluje. Běžný index rychlosti 0 má X=4: krok tedy trvá 5 PAL snímků, 100 ms. Další indexy mají 3, 6 a 7 PAL snímků. Demo s nenulovým `$D8` vynucuje 7. Vodorovné posuny jsou v barevných hodinách, tedy dvojnásobek pixelů na obrazovce široké 320 bodů.

Příznak `$02` obrací orientaci, `$08` drží útočný postoj při trvajícím vstupu a zvyšuje čítač `$6185`, `$10` umožňuje změnu chůze a `$20` ukončuje pád. Kolizní rutina přijímá útočné snímky pouze při `$6185 < 2`, takže trvalé držení nezpůsobuje další zásahy.

## Původní kolizní tabulky

`karate/assets/animations.js` exportuje `KARATE_ANIMATIONS` (pole záznamů podle ID) a `KARATE_HIT_DATA`. Totéž je čitelně v `animations.json` a `hit-data.json`.

Osm útočných snímků `$4008`: 11, 14, 16, 18, 20, 21, 22, 32. Paralelní tabulky: `$4011` poloha zásahu, `$4019` maska šesti tělesných oblastí, `$4021` dosah polovičního zásahu, `$4029` dosah plného zásahu, `$4031` plné skóre v BCD stovkách, `$4039` poloviční skóre. Konkrétní skóre se v některých položkách liší od přepsaného univerzálního manuálu; pro port lze upřednostnit přímo data dodaného Atari originálu.

`$407F` mapuje snímek obránce na třídu postoje (255 znamená nezasažitelný); `$40B8` je 27 tříd po šesti souřadnicích zranitelných oblastí, 128 znamená nepřítomnou oblast. `$4059` obsahuje bity oblastí (32,16,8,4,2,1).

Referenční výpočet z `$4182–$4305`: A = x útočníka + attackX (doprava), případně x + 36 - attackX (doleva). T = x obránce + bodyOffset, případně x + 36 - bodyOffset. Podle orientací (útočník,obránce) R/R: vzdálenost=A-T+halfRange; R/L: A-T; L/R: T-A; L/L: T-A+halfRange. Hodnoty 0 až fullRange-1 dávají plný zásah, od fullRange do halfRange včetně poloviční. Vyhodnocují se pouze oblasti zahrnuté v masce útoku. Útočný snímek 18 používá pro obráncův snímek 32 speciální třídu 26 místo 24.

Všechny souřadnice jsou v původních barevných hodinách, před překreslením na 320pixelový obraz násobit dvěma. Původní šířka zrcadleného pole je 36 hodin (72 bodů); exportovaný PNG má pole šířky 80 bodů kvůli zarovnání. Nezaměňovat šířku PNG pole s původními souřadnicemi kolizí.
