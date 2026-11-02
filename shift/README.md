# Shift — nativní webová verze

Veřejná hra: <https://atari800.gmork.cz/hry/shift/>, anglicky s `?lang=en`.
Vydání `20261101T232915Z` je desátou hrou českého i anglického portálu.
Lokálně otevři `shift/index.html`, nebo <http://127.0.0.1:8010/shift/>.

Fullscreen využívá zbývající plochu pod horní lištou a nad ovládáním;
obraz zachovává poměr stran 4:3. Dřívější `width:auto` ponechával canvas
na jeho základní šířce 320 px. Oprava je ověřená přímo přes HTTPS v Edge
na rozměrech 1280×1000, 1996×1236, 390×844 a 844×390 včetně návratu z fullscreenu.

Převod vychází z dodaného `shift.xex`, SHA-256
`1e0f317e36ca10190dd8f4d328bb85a3c968f4dbae0ced1d91bd52f540fdb9e8`.
Obsahuje všech **36 původních úrovní a jednu tajnou místnost**, původní kódy,
grafiku, animace, CMC hudbu a šest zvukových efektů. Dodané video je preview
s menším počtem úrovní; jeho pravidla ani mapy nejsou podkladem převodu.

Runtime tvoří nativní JavaScript a canvas. Původní 6502/Atari800 se používá
pouze při vývoji, získání dat, renderování zvuku a přípravě srovnávacích dat.

## Ovládání

- Šipky vlevo/vpravo nebo A/D: pohyb.
- Šipka nahoru nebo W: skok.
- Mezerník, Shift nebo FIRE: převrácení světa. Stejně jako originál nejprve
  čeká na uvolnění joysticku/tlačítka. První dvě výukové úrovně převracení nepovolují.
- R: restart aktuální úrovně.
- S: původní přepínání hudba / efekty; originál je nepřehrává současně.
- P/Escape: webová pauza. Ztráta zaměření a skrytí karty hru pozastaví.
- F: zapnutí/vypnutí fullscreenu. Při zadávání kódu zůstává F znakem kódu.
- Gamepad: levá páčka nebo D-pad, první tlačítko = FIRE.
- Mobil: levým palcem virtuální joystick, pravým FIRE; skok pohybem nahoru.

Po původním titulním obrázku lze zadat čtyřmístný hexadecimální kód. Tlačítko
„Od začátku“ nebo FIRE jej přeskočí. Kód lze měnit i joystickem: vlevo/vpravo
volí znak, nahoru/dolů mění hodnotu; platný kód spustí příslušnou úroveň.
Číslo subjektu používá původní cyklickou tabulku a původní výběrové podmínky.

## Ověření a hranice shody

- `node tools/test-shift.mjs`: **63 479** shodných původních stavů. Porovnává
  souřadnice, skok/pád, orientaci, animace, časovače, celou mapu, čtyři plošiny,
  modifikované znaky klíče a bodců, barevný stav postavy i přechody místností.
  Obsahuje všechny místnosti, cílené kontakty v obou orientacích a vypršení časovače.
- `node tools/test-shift-raster.mjs`: **74 snímků a 5 683 200 pixelů** shodných
  se skutečným scanoutem Atari800. Originální mapa má 25 řádků, obraz jich
  zobrazuje 24; tato vlastnost i převracený okraj jsou zachované.
- Microsoft Edge v izolovaném profilu: úvod, kódy, pohyb, skok, převrácení,
  pauza/pokračování, dekódování všech sedmi zvukových souborů, přepnutí hudby
  a efektů, vypnutí zvuku, anglické rozhraní a současné ovládání dvěma prsty.
- Hudební smyčka je ověřená opakováním celého RAM stavu původního CMC
  přehrávače; zvuk renderuje vývojový Atari800 a web přehrává MP3.

**Celý průchod všemi úrovněmi až do konce není odehraný.** Uvedené srovnání
neprokazuje všechny dosažitelné herní stavy. Reference pravidel nahrazuje
rasterové čekání explicitními hranicemi herních snímků a zkracuje CPU
busy-wait zvukových rutin: jejich přesný dopad na vynechané rastry v režimu
efektů zatím není ověřený. Web běží tempem PAL přibližně 49,86 Hz;
NTSC varianta zatím není součástí této verze.

Černá a bílá odpovídají dodanému videu. Barvy smrti a cíle mají paletu
Atari800 Default a nejsou nově kalibrované. Webový formulář kódu, pauza,
jazykové odkazy a návrat do herny jsou obálka pro prohlížeč. Původní počet
opakování čekací smyčky na titulu se mezi webem a Atari nesynchronizuje,
takže náhodné číslo subjektu nemusí být při stejně dlouhém čekání totožné.
Reálné Safari/iOS a fyzický gamepad ještě nebyly testované.

## Sestavení

`python3 tools/build_shift.py` sestaví zdrojové moduly do `game.js` bez npm.
Podklady, adresy původních rutin a reprodukce: [vývojová dokumentace](../research/shift/README.md).

Původní hra: [Haplo — Shift](https://h4plo.itch.io/shift). Autor kódu Ali Pouladi,
grafika také Andy Johns a Marukpa, podle hry Antonyho Lavelle / Armor Games.
