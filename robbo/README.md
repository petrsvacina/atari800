# Robbo — nativní HTML5 verze

Otevři `index.html` přímo v prohlížeči. Funguje také přes libovolný statický
HTTP server. Anglické rozhraní: `index.html?lang=en`.

Autoritou převodu je dodaný `../Robbo.xex`, SHA-256
`75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb`.
Herní pravidla jsou přepsaná do JavaScriptu. Prohlížeč nespouští procesor Atari,
XEX ani původní program. Vývojové oracle a referenční fixtures zůstávají v `tools/`.

- Všech 56 původních planet, původní grafika, animované fonty a posouvání obrazu.
- Bedny, dveře, teleporty, magnety, bomby, různé zbraně, nepřátelé a jejich původní pořadí aktualizace.
- Původní BCD skóre a inventář, osm náhradních životů, rozpad planety po smrti,
  přechody a nový start od začátku poslední čtveřice planet.
- Animovaný titulek, polský původní text s psacími zvuky, automatická ukázka hry.
- Závěrečná scéna po 56. planetě, postupné odkrývání zprávy a čekání na FIRE.
- Patnáct zvukových efektů POKEY a samostatné kroky přes reproduktor CONSOL.
  Dodaná verze nemá hudební skladbu; žádná náhradní není přidaná.
- CZ/EN rozhraní, klávesnice, gamepad a společný dotykový joystick portálu.

Ovládání: šipky nebo WASD; mezerník/Shift je FIRE, se směrem střílí.
Escape obětuje život. P pozastaví, R vrátí na titulek, M přepíná zvuk a F
celou obrazovku. Při přepnutí do jiné aplikace se hra pozastaví a uvolní vstupy.
Zvuk se odemkne prvním kliknutím nebo stiskem klávesy.

Webová verze je v herně na <https://atari800.gmork.cz/hry/robbo/>.
Jde o hratelnou implementaci s rozsáhlými diferenciálními kontrolami,
**ne o prokázanou úplnou shodu 1:1**: zbývá přesné rozložení práce uvnitř
jednoho průchodu polem, fáze hardwarové náhody a ověření souvislým dohráním.
Podrobné důkazy a hranice ověření jsou v `../research/robbo/PORTING.md`.

Sestavení bez npm: `python3 tools/build_robbo.py` ze složky projektu.
Kontrola všech testů: `python3 tools/test_robbo.py`.

Robbo © Janusz Pelc / L.K. Avalon, 1989. Původní obrazové, textové a zvukové
prvky jsou zachované z dodaného programu.
