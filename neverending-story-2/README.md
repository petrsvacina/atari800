# The NeverEnding Story II — nativní webová verze

Místní náhled: <http://127.0.0.1:8010/dist/hry/neverending-story-2/>.
Samostatně lze otevřít `index.html`, anglicky s `?lang=en`.
Hra je připravená v místním českém i anglickém katalogu; toto ještě není
záznam o veřejném nasazení.

Obě dodané diskety určují samostatné původní varianty hry: české vydání
Tomáše Kratochvíla z roku 2021 a anglickou konečnou verzi z roku 2022
s překladem Martina Němečka. Obsahují dvě části po třinácti scénách,
včetně přechodu mezi částmi a závěru. Web používá původní podmínky,
příkazy, texty, obrázky, fonty i skladbu CMC/POKEY. Neobsahuje emulátor
6502 ani interpret BASICu; běží přímo v JavaScriptu.

CZ/EN lze změnit během hry i při výzvě k pokračování. Přepnutí nemění
předměty, příznaky ani místnost a neprovede herní tah. Změní i herní text,
font, případné obrázky a slovník příkazů. Původní anglické vydání přidalo
obrázek `KING.MIC`; česká královnina komnata ponechává svůj původní obraz.

Osm pozic se ukládá do tohoto prohlížeče pod vlastním klíčem dvojky.
Českou uloženou pozici lze načíst anglicky i naopak. Uložené pozice nejsou
disketové soubory ani pozice z prvního dílu. Po načtení nebo změně jazyka
se obnoví aktuální popis; starší výpis příkazů se znovu nepřehrává.

Používej původní zkratky: česky `s`, `j`, `v`, `z`, `pro krovi`, `seb bobule`,
anglicky `n`, `s`, `e`, `w`, `exa bush`, `take berries`. `r`/`sit` je popis
a `i`/`inv` inventář v obou jazycích. Originál porovnává konkrétní řetězce,
nejde o obecný parser rozpoznávající libovolné první tři znaky všech slov.
Web navíc převádí zadanou diakritiku na původní příkazy bez diakritiky.
Na mobilu slouží směrová tlačítka, rychlé příkazy a předvyplnění sloves.
F zůstává znakem v textovém poli; fullscreen má vlastní tlačítko.

Návod se přepíná podle jazyka: původní české PDF a anglický obrazový list,
oba zachované beze změny. Úvodní obrázek pochází z `TITLESCR.MIC`.
Hudba je offline záznam skutečného původního přehrávače, s celým ověřeným
opakujícím se úsekem; při přechodu mezi částmi začne od začátku jako originál.

## Ověření a hranice

`node tools/test-neverstory2.mjs` kontroluje:

- 4 528 výsledků původních českých rutin: všechny vstupní místnosti, příkazy
  z jejich podmínek, osm kombinací příznaků, inventář, změny místností,
  výstupní text, obrázky, barvu a čekání na pokračování.
- Celé české i anglické průchody oběma částmi až do závěru a nové hry.
- Další dva celé průchody s přepínáním jazyka před každým příkazem,
  včetně přechodu části a závěrečných výzev.
- 48 změn jazyka a načtení pozice v druhém jazyce bez změny příznaků.
- Původní úvodní herní snímek a 21 skutečných rasterových snímků Atari800
  pro všechny herní bitmapy, obě sady fontů a příslušné palety:
  každý případ porovnává všech 64 000 barevných indexů.

V odděleném Edge prošly skutečné vstupy klávesnicí a tlačítky, uložit/načíst
mezi jazyky, fullscreen, vypnutí hudby a mobilní/desktopové rozložení.
Není to důkaz všech dosažitelných stavů celého převodu 1:1. Úplný příběh
byl odehraný automatizovaně ve webovém enginu; anglický interpret na Atari
nemá samostatnou sadu diferenciálních CPU případů. Fyzické Safari/iPhone
nebyly ověřeny. Původní disková prodlení, výpis po jednotlivých znacích,
úvodní časované titulky a čekací smyčky nahrazuje webové rozhraní.
Barevné indexy jsou ověřené, RGB paleta je Atari800 Default bez nového
měření konkrétního televizoru. Hudební asset je ztrátové MP3.

Podrobnosti a opakovatelné vývojové postupy:
[research/neverending-story-2/README.md](../research/neverending-story-2/README.md).
