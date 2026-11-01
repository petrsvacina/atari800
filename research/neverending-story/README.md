# Původní data a vývojové porovnání

- ENG `neverending_story.atr`: SHA256 `ceae1484d4ba5475a5180eea746db79abffccd21117ce42e72f9386a15358acd`.
- CZE `nekonecny_pribeh.atr`: SHA256 `7133abc4f8e9b686beddcdacc73470a54bc3c5ffd30b08b14d549b9fe8b616e7`.
- Oba ATR mají 720 sektorů po 128 bytech a vlastní loader, nikoliv DOS adresář. Hlavní program je 100 sektorů od 504 do `$6300–$94FF`.

## Rozdělení dat

Kód `$6300–$74BE` je totožný. Parser používá slovník od `$74BF`: první tři znaky slova a identifikátor. Obě jazykové verze mají stejné identifikátory a tabulky příkazů; česká verze mění textová a slovníková data, dále podkladový obrázek a drobnosti diskového ukládání. Společné skripty i všechny tři banky grafiky jsou shodné; extraktor to kontroluje a při rozdílu odmítne pokračovat.

Kapitoly: sektory 408/40, 448/36 a 484/19 → `$A800`. Grafické banky: sektory 68/130, 198/89, 287/121 → `$2000`. Základ obrázku je 25 sektorů od 695 → `$E380`. Počet položek v tabulkách popisů místností je 41 + 36 + 48, včetně rezervovaných/sdílených položek. Šestice obrazových deskriptorů je od `$1E00`, samostatný barevný obdélník PMG tvoří `$93B3`. `picture()` překládá tento postup do indexovaného 320×80 obrazu. Výpis textu používá původní font a pravidla 40×15 buněk včetně velkých iniciál, slovní komprese a zalamování.

Herní stav: objekty `$83A9`, příznaky `$83F9`, čítače překrývají příznaky od `$8419`, místnost `$8429`, část `$842A`, hlavní obrázek `$842C`, šest překryvných obrázků od `$842D`. Žádná z těchto hodnot není navázaná na jazyk.

## Původní načítací obrázek

`tools/neverstory_extract_title.py --emulator /cesta/k/atari800` získá načítací
obrazovku z obou původních disket. Rutina `$2000` složí grafiku, display list
se nastaví na `$2AE9` a capture zastaví hlavní vlákno v `$8F40`, než jej další
diskové čtení nahradí. Původní VBI/DLI vykreslí snímek; vývojová nekonečná
smyčka v dosud nepoužité `$9F00` nemění obrazová data.

Zachovaný výřez x=32..351, y=0..239 obsahuje i původní modré horní a dolní
okraje. Obě jazykové diskety poskytly totožné barevné indexy. Čtyři RGB barvy
jsou odečtené z uživatelem dodaného snímku (sRGB převod), uložené v
`title-palette.json`; herní paleta se nemění. `loading-art.json` uchovává hashe
zdrojů, skutečného snímku, indexů a výsledného `assets/loading.png`. Ve webu
je pouze statický PNG, žádný nový emulovaný program ani přegenerovaná kresba.

## Oracle

`oracle.json.gz` jsou očekávané výstupy získané z původních rutin pomocí py65, a hashe indexovaných snímků Atari800. V prohlížeči se neprovádí původní CPU program. Vývojové RAM dumpy nejsou součástí webu ani tohoto repozitáře.

- 1 029 případů: všechny kořeny příkazových, společných, automatických a místnostních skriptů ve třech částech, tři počáteční stavy s deterministickým seedem 985. RANDOM pro porovnání podmínek nastaven na 128. Porovnávají se objekty, příznaky/čítače, místnost, část, obrázek, překryvy a verbose flag. Výstup textu, kreslení, diskové I/O a hudební volání se při těchto testech zachytávají/obcházejí samostatně. Případy vstupující do další části jsou oddělené.
- 304 případů parseru: slovníky obou jazyků, dlouhé složené směry, neznámé slovo a více slov. Výstupem jsou skutečné tokeny původního parseru před dispatch.
- Oba přechody částí: skutečný hlavní cyklus od `$630C` do dalšího `$64A1`, s automatickým potvrzením SPACE a skutečnými daty nově načtené kapitoly; kontrolní stavy před přechody v místnostech 40 a 54.
- 72 bitmap: všechny odlišné běžné obrázky odkazované tabulkami místností v každé části, v obou jazycích, s nulovými překryvy. Volá se původní `$6374`, nechá se vykreslit celý snímek a porovnává se všech 25 600 barevných indexů v oblasti x=32..351, y=20..99. Stejné obrázky mezi různými částmi jsou samostatné případy.
- Úvodní stav po `$702A` a `$6F68` na prvním `$64A1`: v obou jazycích shodné objekty, příznaky, překryvy a všech 600 buněk původního textového bufferu `$FC80–$FED7`. Úvodní obrázek rovněž ověřen po pixelech.

Znovuzískání snímků: `python3 tools/neverstory_capture.py --emulator /cesta/k/atari800 --output /private/tmp/neverstory-reference`. Nástroj pracuje s privátními kopiemi disků. Používá vývojový SPACE stub v `$8DCD` pouze pro postup přes úvod a odmítnutí obnovy ze save diskety. Rutiny se pro oracle testují s příslušnými daty kapitoly v `$A800` a původním kódem v `$6300`. Generování případů vyžaduje vývojový py65, nikoliv webový runtime.

## Hudba

`audio.json` obsahuje zdrojový hash a výstupní hashe. Inicializace `$9811`, přehrávač `$9800` volaný skutečným PAL VBI. Samostatné provedení původního přehrávače po snímcích prokázalo shodu stavu `$983C–$98EA` mezi snímky 1792 a 3584; následující perioda je 1792 snímků. Atari800 s původním POKEY zvukem nahrál 3584 snímků od restartu skladby. WebAudio opakuje druhou polovinu a zachová úvod. Záznam není bezeztrátový: veřejný asset je MP3 128 kb/s. MP3 se v JS balí kvůli fungování i při otevření místního HTML bez serveru.

`--music` u capture nástroje navíc potřebuje vývojovou podporu Atari800 `RECORD/STOPRECORD` a FFmpeg; sestaví i webový audio asset. `default.act` je používaná vývojová paleta. Shoda barevných indexů nepotvrzuje kalibraci konkrétního televizoru.

## Engywook, krystal a sfingy

Dodaná příručka (původní osmistránkový český sken, soubor a hash v `manual.json`) na straně 3 uvádí čekání v úžlabině 4K. Mapa na straně 2 ani toto slovní doporučení nejsou náhradou programu ATR.

V obou dodaných ATR má místnost 38 popis úžlabiny a její automatický skript pouze končí. Místnost 39 je vstup do jižní věštírny; skript nejprve vypíše zprávu 17, vynuluje příznak 5 a při `RANDOM <= 25` nastaví příznak 5 a vypíše zprávu 26: „Oci Sfing Jsou Zavreny!“ / „The Sphinxes' Eyes Blink!“. Nejde o samostatné pozdější zavolání skřítka. Skript není podmíněný předchozím předáním krystalu. Předání krystalu v místnosti 37 odstraní objekt 9 a vypíše zprávu 14 s radou.

Jižní příkaz v místnosti 39: při otevřených očích a `RANDOM <= 200` následuje smrt. Ve zbývajících 55 hodnotách (201–255) lze s Aurynem projít i bez předchozího mrknutí. Zavřené oči zaručují průchod s Aurynem; bez něj originál nepustí hráče ani tehdy. Pravděpodobnosti zde popisují vyčerpání vstupních hodnot, nikoliv důkaz časového rozložení hardwarového POKEY RANDOM.

`sphinx-oracle.json.gz` byl získán přímým provedením původních rutin, včetně událostí výstupu a game-over větve. Obsahuje 1 280 případů (pět stavů × všech 256 hodnot RANDOM), předání krystalu přes skutečný parser a automatický tah, a čekání ve dvou místnostech se dvěma hodnotami náhody. Testy porovnávají webový stav i zprávy; `cek`, `cekej` a anglické `wait` ověřují i viditelný text. Výsledek v těchto situacích odpovídá originálu, proto se herní pravidla neupravovala.

Reprodukce: `python3 tools/neverstory_sphinx_oracle.py --memory /cesta/en-game.bin --py65-path /cesta/k/py65`. Vstupní RAM je vývojový capture z `neverstory_capture.py`. Původní CPU ani RAM dump nejsou součástí runtime.

## Zbývající shoda

Celý příběh není průchodem ověřený. Časování klávesnicového timeoutu, hardwarová fáze náhody, originální diskové menu a všechny kombinace dočasných obrázků zatím nejsou potvrzené. Původní timeout se při vývojovém měření prvního vstupu ozval přibližně po 4193 PAL snímcích; závisí na vytížení původního CPU hudbou, DMA a přerušeních. Náhrada pevným intervalem není důkazem shody, proto ji pracovní runtime nezavádí. Rutinní a obrazové testy tuto mezeru neskrývají.
