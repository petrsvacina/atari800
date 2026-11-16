# Rescue on Fractalus! — rozpracovaný nativní převod

Otevři [index.html](index.html) v prohlížeči. Samostatný `game.js` obsahuje
nativní JavaScript i herní data; funguje také přímo přes `file://`, bez serveru.
Anglické rozhraní používá `index.html?lang=en`.

Hra je zařazená do českého i anglického katalogu. Veřejná adresa je
https://atari800.gmork.cz/hry/rescue-on-fractalus/; stav ověřeného nasazení
a zálohu uvádí [DEPLOYMENT.md](../DEPLOYMENT.md).
**Toto je první hratelná vývojová verze, nikoliv dokončený převod celé hry 1:1.**

## Ovládání

| Klávesa | Akce |
| --- | --- |
| ← → | Zatáčení |
| ↑ / ↓ | Klesání / stoupání |
| Mezerník / Ctrl | Torpédo |
| Enter / mezerník během úvodu | Přeskočit úvod |
| + / − | Zvýšit / snížit tah |
| L | Automatické přistání |
| S | Systémy a štíty |
| A | Otevřít / zavřít průlez |
| B | Návrat na mateřskou loď, až je dostupná |
| P / Esc | Pauza |
| F | Celá obrazovka |
| R / M | Restart / vypnutí zvuku |

Gamepad používá směrový ovladač a FIRE. Mobil má společný osmisměrný joystick,
samostatné FIRE a tlačítka pro další povely.

## Co je přeneseno

Původní tvorba světa, celočíselná geometrie a fraktální hory, pozemní objekty,
letová fyzika a kolize, torpéda, talíře, zaměřování a nepřátelská střelba,
spotřeba energie, piloti, klepání, záchrana, Jaggi, počítání bodů a kvót,
zvukové obálky, přidělování kanálů POKEY a původní hudební sekvence.

Před letem se postupně vykreslí původní logo Lucasfilm Games s animovanou
hvězdičkou a zvukem, poté mateřská loď, otevření dveří hangáru, tunel, vesmír
a přílet k planetě. Volba **Přehrát úvod** je standardně zapnutá. Další mise
začíná rovnou hangárem. Pauza zastaví i úvod a jeho zvuk; letová simulace,
energie ani skóre během něj nepostupují. Přeskočení nepřenese držený mezerník
do střelby.

Úvod používá bezeztrátová obrazová data získaná offline přímo z ATR, původní
paletu a zvukové registry. V prohlížeči je vykresluje Canvas a nativní zvukový
generátor. Nejde o přehrávání referenčního videa ani běh původního CPU.
Porovnání pokrývá všech 3 094 snímků PAL záznamu, číselné popisky dveří
a předání do nativního letu. Samostatný souvislý záznam NTSC úvodu není ověřen.

Plynulejší obraz přidává pouze čisté překreslení. Stejný scénář v obou režimech
má stejné fyzikální stavy, herní mapy, náhodné čtení, zvuk a skóre; to ověřuje
integrační test. Volba PAL/NTSC mění normu celé hry, nikoliv pouze grafiku.

## Co ještě není hotové / prokázané

- Původní tempo překreslení závisí na složitosti scény, přerušení a ANTIC DMA.
  Nyní se používají skutečně naměřené intervaly dvou PAL scén; profil úrovně 4
  je dočasný i pro vyšší úrovně. Není to přesný model časování každé scény.
- Návratové animace ještě nejsou přeneseny. Web přechází z úvodu do letu
  z ověřených počátečních dat a návrat zobrazuje v kokpitu.
  Celý přechod letu na návrat a opětovnou inicializaci je třeba ještě porovnat
  s nepřerušeným během originálu.
- Chybí noční rasterový šum čelního skla, původní titulková sekvence,
  demo a tabulka iniciál. Úvodní start je odvozen ze záznamu PAL úrovně 4;
  popisky a kvóta odpovídají zvolené úrovni, úplné srovnání úvodu každé úrovně
  a opakovaného startu po návratu ještě není provedeno.
- POKEY RANDOM má původní 17bitový polynom, ale jeho fáze vůči běhu původního
  CPU není napodobena. Náhodná čtení rutin jsou ověřena vloženými bajty.
- Není dokončené souvislé dohrání a srovnání všech situací s originálem.
  Fyzický telefon a Safari nejsou potvrzené. V Edge prošlo spuštění, let,
  ovládání, aktivní zvukový výstup a přepínání fullscreenu klávesou F.
  Doplněný úvod byl v Edge ověřen přímo přes `file://`, včetně vykreslení
  mateřské lodi a přeskočení do letu; celý průchod úvodem ověřuje testovací host.

Podrobný rozsah nezávislých porovnání je v
[PORTING.md](../research/rescue-on-fractalus/PORTING.md).

## Vývoj

Autoritou je dodané `rescue-on-fractalus.atr`, počítačová verze 4.1.
Původní CPU se používá pouze v offline referenčních nástrojích. Prohlížeč
neobsahuje emulátor CPU, ATR, původní spustitelný program ani obraz celé RAM.

```sh
python3 tools/build_fractalus.py
python3 tools/test_fractalus.py
```

Sestavení potřebuje jen Python. Testy potřebují Deno; nové referenční záznamy
navíc py65 a u některých nástrojů ověřený vývojový snímek Atari800.
