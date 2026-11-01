# The NeverEnding Story — webová verze

Veřejná hra: <https://atari800.gmork.cz/hry/neverending-story/>, anglicky s `?lang=en`.
Vydání `20261101T200111Z` je devátou hrou českého i anglického portálu.

Úvodní obrazovka zobrazuje původní načítací obrázek Atari se symbolem Aurynu,
titulky a logem Datasoft. Barvy odpovídají dodanému referenčnímu snímku.
Tlačítko **Začít příběh** je pod obrázkem; po spuštění se obnoví herní canvas.

Otevři [index.html](index.html) v prohlížeči, případně tuto složku pod lokálním HTTP serverem. Výběr **CZ / EN** přepíná rozhraní, původní texty, podklad obrázku i parser příkazů. Neprovede herní tah a nemění místnost, předměty, příznaky ani počítadla. Oba jazyky používají společných osm pozic pro uložení v tomto prohlížeči. Uloženou hru lze načíst v druhém jazyce.

Česká verze zachovává text dodané české diskety včetně původního pravopisu a textu bez diakritiky. Diakritiku zadanou do příkazového pole web odstraní. Například `sv`, `vezmi jidlo`, `o`, `p`; anglicky `ne`, `take food`, `i`, `l`. Tlačítka směru a rychlých příkazů posílají stejné příkazy do původního slovníku.

Odkaz **Návod (PDF)** otevírá dodaný osmistránkový český návod s mapami v novém panelu. Anglické rozhraní jej označuje **Walkthrough (CZ PDF)**; dokument zůstává původní český sken.
Stejný soubor je dostupný i samostatně: <https://atari800.gmork.cz/manuals/neverending-story-cs.pdf>.

Pozor na rozlišení místností u sfing: čekání v úžlabině samo hlášení nespustí. Původní program kontroluje oči až o místnost jižněji, u vstupu do věštírny. Tam se po tahu může objevit „Oči sfing jsou zavřeny!“. Originál navíc s Aurynem připouští šťastný průchod i bez tohoto hlášení. Pravidla webu se kvůli odlišnému popisu v návodu nemění.

Runtime je nativní JavaScript. Adventure má vlastní podmínky a akce přeložené do pojmenovaného herního stavu, nikoliv emulátor 6502. Originální data určují všechny tři části příběhu: tabulky pohybu, příkazy, předměty, události, popisy a obrázky. Hudba je předem vyrenderovaný původní přehrávač POKEY s intro a opakujícím se úsekem.

## Ověření

`node tools/test-neverstory.mjs` z kořene projektu ověřuje uložené výsledky původního programu: 1 029 případů rutin, 304 případů parseru, 72 obrázků, oba přechody mezi částmi, přesný úvodní textový buffer EN/CZ a pokračování uložené hry v druhém jazyce. Dalších 1 280 případů sfing pokrývá všechny hodnoty náhody, čtyři čekací situace kontrolují `wait` / `cek` / `cekej` včetně skutečně viditelného hlášení; kontroluje se i odměna za předaný krystal v obou jazycích.

`python3 tools/neverstory_extract.py` znovu získá data obou originálních ATR. `python3 tools/build_neverstory.py` sestaví samostatný `game.js`. Moduly `.mjs` zůstávají zdrojovým kódem pro testování.

## Hranice této verze

Toto ještě není dokončený a v celém rozsahu ověřený převod 1:1. Není odehraný celý příběh až do konce. Ověřené obrázky nepokrývají všechny dočasné ilustrace a kombinace předmětů. Paleta je vývojová Atari800 Default, bez nové barevné kalibrace. Náhodné podmínky mají původní prahové porovnání, ale zdrojem náhody není časově synchronizovaný POKEY.

Zbývá převést časování automatického `WAIT` při nečinnosti v příkazovém řádku. Zatím se tahy posouvají zadáním příkazu; dlouhé čekání u webu samo nevyvolá tah jako na Atari. Titulní/obnovovací diskové menu nahrazuje webový úvod a lokální uložené pozice; ty nejsou kompatibilní se save disketou. Přerušení události příkazem `LOAD` během rozehraného příkazu potřebuje další porovnání proti originálu; tlačítko Načíst obnovuje stav přímo.

Podrobné zdroje a metodika: [research/neverending-story/README.md](../research/neverending-story/README.md).
Publikační záznam a ověření veřejné verze jsou v [DEPLOYMENT.md](../DEPLOYMENT.md).
