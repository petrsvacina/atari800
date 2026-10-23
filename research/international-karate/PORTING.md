# International Karate — rozbor a nativní webový přepis

Původní `International Karate.atr` má 92 176 bytů, platnou hlavičku ATR, 720 sektorů po 128 bytech a SHA-256 `b30ddd0920a00a99d8b41d97b24d72cc57150e73e9a3686e0f35cb74f3b62bec`. Originál zůstává beze změny. Pracovní kopie úspěšně nabootovala v místním Atari800 do běžícího demonstračního souboje. Emulátor zde slouží pouze pro rozbor; výsledná webová hra by používala vlastní JavaScriptovou logiku.

## Ověřená grafická data

- `$6800`: 56 ukazatelů na popisy snímků.
- `$6880`: 56 ukazatelů na bitmapová data.
- `$6900`: popisy po 12 bytech; každý byte odpovídá jednomu osmipixelovému řádku dlaždic. Horní čtyři bity určují vodorovný posun, spodní počet dlaždic.
- `$6C00–$9BB7`: vlastní bitmapy. Dlaždice má osm bytů, každý obsahuje čtyři dvoubitové pixely, zobrazené s dvojnásobnou šířkou.

Dekódování všech snímků přesně odpovídá hranicím původních ukazatelů. Pozice 4, 54 a 55 mají nulovou délku, ostatních 53 obsahuje obrazová data. V náhledu jsou zřetelné postoje, údery, kopy, skoky, kotouly a pády. Přiřazení snímků ke vstupům i jejich časování se následně podařilo vyčíst z původních tabulek; viz CONTROLS.md.

`sprites.json` uchovává původní popisy a bitmapové bajty; `sprites.png` je odvozený list s pracovní paletou. [preview.html](preview.html) lze otevřít přímo v prohlížeči. Náhled není hratelná implementace.

Opakování exportu z monitorového výpisu RAM `$0000–$BFFF` po načtení originálu:

```sh
python3 tools/extract_karate_sprites.py --memory /path/to/ram.bin
```

Výpis se získá v monitoru Atari800 příkazem `write 0000 bfff /path/to/ram.bin`. Pro rozbor byla použita kopie ATR, PAL, vypnutý BASIC a zakázané ukládání konfigurace emulátoru. Celý výpis RAM se do projektu nekopíruje.

## Hratelný přepis

`karate/` obsahuje samostatnou hratelnou HTML5 verzi. Prohlížeč používá původní bitmapové snímky, animační tabulky a tabulky tělesných oblastí; herní smyčka je nově napsaná v JavaScriptu a běží 50 Hz. Původní animace mění snímek každých pět kroků. Při otočení se kromě znaménka DX přepočítá i kotva snímku: v původních barevných hodinách je střed E0+12 doprava a E0+24 doleva. Tato kompenzace zabraňuje nechtěnému skoku při zadním výpadu.

Tabulky ovládání, kolizí, skóre a jejich adresy jsou v [CONTROLS.md](CONTROLS.md), extrakce všech sedmi původních pozadí a původní hudby v [ASSETS.md](ASSETS.md). Původní hra kombinuje bitmapu, PMG vrstvy a změny palety; ty se rekonstruují pouze při vývojovém exportu do PNG. Prohlížeč nesimuluje Atari hardware. CPU, herní stavový automat a bonusy jsou nově napsané; úplná shoda celé hry s originálem nebyla potvrzená.

Zvuky byly následně nahrazené šesti původními digitálními samply z ATR. [sfx/README.md](sfx/README.md) popisuje jejich nibble, rozsahy, DAC a časování. [SOUND_EVENTS.md](SOUND_EVENTS.md) zachycuje původní výběr efektu podle změny snímku, zásahu či pádu. Browserový přehrávač je monofonní, respektuje původní prioritu hráčů a opakování po 4/5 PAL snímcích. Během samplu ztiší hudbu bez přerušení jejího času, stejně jako původní driver se stavem `$CF`. Drobné rozdíly původního IRQ časování a analogového filtrování nejsou úplně reprodukované.

Katalog zdrojů v `portal/games.json` zahrnuje novou hru; `tools/build_portal.py` ji kopíruje pod `hry/international-karate/` s návratem do portálu. Nasazení a jeho kontrola jsou popsány v kořenovém `DEPLOYMENT.md`. Původní Dynakillers zůstává samostatně v `web/`.

## Rozhodčí a vítězné gesto

`karate/assets/referee.js` obsahuje samostatnou původní 96bytovou grafiku rozhodčího, převod znaků po sloupcích na bitmapu 24 × 32 bodů. Ve webovém poli je na x=288, y=131; není zmenšenou kopií bojovníka. Zdroj, pozice a reprodukce jsou v [referee/README.md](referee/README.md).

Po vítězném plném bodu se nyní spouští původní akce 32, včetně fouknutí do pěsti a pohybu ruky za zády. Podmínka, snímky a původní časování jsou v [REFEREE_GESTURE.md](REFEREE_GESTURE.md). V bodovací fázi animace běží po sedmi PAL snímcích na krok. Sólo používá třísekundovou přestávku; naše série pro dva hráče používá dvě sekundy při běžném zásahu a tři při vítězném plném bodu. Jde o přiblížení původnímu multiplayeru, který má odlišný systém přetahování.

Rozhodčí má jednu doloženou statickou pózu. Body oznamuje samostatnou bublinou v češtině: barva hráče, potom celý/půl bodu, nakonec ticho před pokračováním. České texty kreslí Canvas; nejde o původní bitmapové anglické popisky. Barvy i ostatní grafická data se tím nemění.
