# The Goonies — nativní webový přepis

## Oprava po první adaptaci

Původní vydání `0a18063` používalo odhadované plošiny, vlastní gravitaci, automatický pohyb některých rekvizit a zjednodušené hádanky. Tím vznikalo propadávání, pohyb židle bez kontaktu a rozdíly ve skutečném řešení místností. Jeho testy kontrolovaly tuto odhadovanou implementaci; nedokazovaly věrnost originálu. Staré replaye domu a varhan proto byly nahrazené novými referencemi.

Aktuální pohyb je ruční JavaScriptový překlad původních rutin `$0B5A–$0E66` a výběru snímků `$0A86`. V prohlížeči běží pravidla hry a Canvas, bez procesorového emulátoru, Atari OS, ROM, ATR nebo XEX.

## Podklady

- `Goonies/Goonies.atr`, SHA-256 `ccdea8ff8e56b9d09436de1ec64094e2130dee41f2d3d921f8c02f256f16bed7`.
- `Goonies/Goonies, The (1985)(Datasoft)(US)(130XE)[cr Mian-Software].xex`, SHA-256 `3178f530d27b361f4f99a0c4f5454c7d2584b9e5967cd803a1f8057ef44b799a`.
- Místní video a textové řešení slouží jako doplňková reference. Nepublikují se.

`original-physics.json` obsahuje skutečné kolizní obdélníky, tělesné rozměry, výchozí pozice a ověřené snímky jednotlivých scén. `original-mechanisms.json` obsahuje pojmenované tabulky mechanismů, drah a jejich bitmapy. Kód procesoru ani kompletní RAM se neexportují. Původní odhady v `scenes.json` zůstávají historickým rozborem; do běžící geometrie se nepřekládají.

## Běh a obraz

`movement.js` používá původní celočíselné souřadnice a pravidla podlah, stěn, stropů, žebříků, pružin a horních tyčí. Herní pravidla se aktualizují jednou za čtyři obrazové kroky: při 60 Hz tedy 15krát za sekundu. Neaktivní postava dál podléhá původní gravitaci a zůstává na zachycené tyči bez dalšího vstupu.

`rooms.js` překládá původní mechanismy sedmi jeskynních/lodních scén; dům je v `engine.js`. Pohybující se podpěry mění stejné kolizní obdélníky jako originál. V `raster.js` se skládá čisté pozadí, rekvizity, postavy a předměty kreslené až za postavami. Čtyři fáze bitmapy podle `x & 3` jsou vodorovné posuny, nikoli časová animace. Židle se proto mění pouze při skutečném tlačení.

Obraz používá původní výřez 320×176 na pozici (8,32) v Canvasu 336×240. RGB paleta je přiblížená dodanému videu; analogová shoda pro všechny Atari monitory se netvrdí. Hudba a 19 efektů zůstaly zachované; podrobnosti přehrávání jsou v `AUDIO.md`.

Webové doplňky: samostatný trénink, současná hra dvou lidí, česká nápověda, dotykové ovládání, gamepad a automatická pauza při ztrátě okna. Náhodné časy používají nativní generátor, nikoli emulovaný POKEY. Výprava po osmé scéně zobrazí konec; nezačíná další těžší smyčku originálu. HUD, nabídka, délka přechodové obrazovky a napojení zvukových událostí jsou webové provedení.

## Ověření

`node tools/test-goonies.mjs` obsahuje 34 regresních kontrol:

- 1 280 kroků pohybu a volby snímku proti původním rutinám XEX ve všech osmi scénách.
- Osm úvodních kompletních snímků každé místnosti proti ATR, včetně skutečných pozic a kolizí.
- Šestnáct řízených referenčních situací z originálu: židle a nádrž, rumpál a závaží, tři ventily, řetězové brány, vejce a žebřík, tlakové desky, klec, vypouštění, lodní průlezy, Slothův zdvih s pasažérem a truhla s mincemi.
- Delší původní běhy ptáka (176 kroků), netopýra u věder (320), vodopádu (80) a kapek/varhan (300). U prvních kolizí se ověřuje i stejný okamžik zásahu.
- Celkem **1 278 kompletních bitmap** souhlasí pomocí SHA-256 původních 7 040 obrazových bytů, současně se kontrolují tělesné souřadnice obou hráčů a všechny aktivní kolizní obdélníky.
- Kompletní dům a potrubí prošly novými směrovými a přepínacími replayi s pěti životy. Tyto dva testy nepřesouvají postavy, nevypínají nebezpečí a nenastavují příznaky vyřešení.

Řízené situace záměrně začínají v připravených pozicích; ověřují shodu mechanismu, nikoli celý přístup k němu. **Kompletní ruční průchod všech osmi scén nebyl provedený.** Dřívější replay varhan na odhadované geometrii se jako důkaz nepoužívá. Fyzický telefon a gamepad zůstávají neověřené.

Osm zvukových kontrol ověřuje autoplay, přepnutí skladeb, pauzu, ztlumení, monofonii, PCM a opožděné/odmítnuté přehrávání. Místní Brave ověřil načtení přes `file://`, spuštění původního domu a vykreslení postav/rekvizit. Samostatný subjektivní poslech se nevydává za provedený.

## Reprodukce

Bez emulátoru a bez původních souborů lze ze zařazených číselných/grafických dat znovu sestavit runtime:

```sh
python3 tools/goonies_extract_physics.py
python3 tools/goonies_extract_mechanisms.py
python3 tools/goonies_build_levels.py
node tools/test-goonies.mjs
node tools/test-goonies-audio.mjs
python3 tools/build_portal.py
```

Nové načtení podkladů vyžaduje místní zdroje a Atari800:

```sh
python3 tools/goonies_extract_physics.py --capture
python3 tools/goonies_extract_mechanisms.py --capture
python3 tools/goonies_capture_movement.py
python3 tools/goonies_capture_reference.py tools/fixtures/goonies-native-reference-cases.json tools/fixtures/goonies-native-mechanism-oracle.json
python3 tools/goonies_capture_reference.py tools/fixtures/goonies-native-actors-reference-cases.json tools/fixtures/goonies-native-actors-oracle.json
```

Referenční nástroj mění pouze vstupní hranici joysticku a zdroj náhodného bytu ve vývojovém běhu. Fyziku a scénické rutiny vykonává původní hra. ATR má pomocné rutiny přeložené na jiné adresy než dodaný XEX; například RNG je `$6324` proti `$641D`. Adresy se mezi těmito verzemi nesmějí bez ověření zaměňovat. Dočasné dumpy zůstávají v `/private/tmp` a nejsou závislostí veřejného vydání.
