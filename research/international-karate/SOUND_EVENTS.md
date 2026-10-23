# Původní spouštění digitálních efektů

Ověřeno statickým rozborem stejného RAM dumpu jako grafika. Přehrávač má šest ID 0–5, vstup `$3A89`, ID v X. Vždy běží jeden efekt: nový požadavek přepíše předchozí. ID >= 6, vypnuté efekty (`$55=0`) nebo probíhající disková operace (`$619D!=0`) požadavek ignorují.

## Změny snímků

Rutina `$39AE` nastaví vybrané ID `$6175` na 255, projde hráče 1 a 0 a porovná jejich aktuální snímek `$DD/$DE` s minulým `$6173/$6174`. Jen při změně předá snímek přes `$6176`, animační příznaky přes `$6178` a zavolá `$3A23`. Po kontrole obou hráčů provede nejvýše jedno volání přehrávače. Poslední platný požadavek hráče 0 má přednost před požadavkem hráče 1.

Rozpoznané snímky (`$39E0`): 10, 7, 6, 18, 20, 21, 22, 32, 47, 43, 39.

| Snímek | Souboj bez zásahu | Souboj se zásahem | Opožděný efekt při zásahu |
| --- | --- | --- | --- |
| 10, 7, 6 | 1 | žádný | žádný |
| 18, 20 | 2 | 0 | žádný |
| 21 | 2 | 2 | 2 po 4 PAL snímcích |
| 22 | 1 | 0 | 0 po 5 PAL snímcích |
| 32 | 2 | 2 | 2 po 4 PAL snímcích |
| 47 | žádný | 5 | žádný |
| 43 | žádný | 3 | žádný |
| 39 | žádný | 4 | žádný |

Souboj je `$D0=1`, výsledek posledního vyhodnocení zásahu `$D8`. Při `$D8=0` se navíc vyžaduje nenulové `flags & $4D`. Při zásahu se tato podmínka nepoužívá. Půlbod a celý bod nemají samostatná zvuková ID. Je vybraná buď větev bez zásahu, nebo se zásahem; nejde o dva navazující požadavky téhož snímku.

Tabulky: bez zásahu `$39EC`, se zásahem `$39F7`, zpoždění `$3A02`, opožděné ID `$3A0D`. Odpočet `$617C` probíhá ve VBI; ID je `$617D`, spuštění `$3979`. Zpoždění 4/5 tedy znamená 80/100 ms v PAL, nikoli čtyři/pět animačních kroků.

Snímky 47, 43 a 39 jsou první vstup do závěrečného ležícího postoje tří variant pádu (akce 17, 18, 19). Zvuk se nespouští až posledním krokem označeným příznakem `$20`; spouští jej samotná změna indexu snímku. V režimech `$D0=2` a `$D0=5` je aktivní pouze tabulka `$3A18`, která při těchto třech snímcích spouští 5, 3 a 4 bez podmínky na příznaky.

## Dlaždice a další volání

Přímé `LDX #2; JSR $3A89` je na `$3142–$3146` při animaci nárazu hlavou do dlaždic. Další přímá volání přehrávače jsou pouze VBI změny snímků a odložený požadavek. V tomto dumpu není nalezené samostatné spuštění vzorku při zobrazení textu FULL POINT ani při zahájení kola.

Názvy jako výkřik/úder/pád vyjadřují kontext spouštění. Obsah vzorků nebyl rozpoznáván hlasovým modelem a netvrdíme, že některý vzorek vyslovuje konkrétní slova.

## Numerické porovnání s uživatelovým videem

Referenční desetisekundový mono výřez od 5:44 byl porovnán s šesti PCM vzorky (zachování vzorku do další hodnoty, převzorkování na 8 kHz, potlačení DC, několik stupňů klouzavého vyhlazení a normalizovaná křížová korelace). Zkoušená rychlost vzorků 3000–4200 Hz.

Výraznější časově odpovídající maxima: ID2 v 347,008 s při 3715 Hz (r=-0,374), ID0 v 348,913 s při 3675 Hz (r=-0,362), ID3 v 349,475 s při 3665 Hz (r=-0,500). Odpovídají sekvenci pohyb → zásah → pád, mají shodnou obrácenou polaritu a podobné zpomalení oproti nominálnímu časovači. Jsou užitečným podpůrným zjištěním; samotná korelace nepotvrzuje absolutně přesnou shodu přehrávače. Zpomalení a nestejnoměrnost může způsobovat obsluha DLI přerušení původního programu. Mapa efektů výše vychází z původního programu, nikoli z časového odhadu videa.
