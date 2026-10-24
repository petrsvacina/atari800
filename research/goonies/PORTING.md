# The Goonies — nativní webový přepis

Zdroj `Goonies/Goonies.atr` má 92 176 bytů a SHA-256 `ccdea8ff8e56b9d09436de1ec64094e2130dee41f2d3d921f8c02f256f16bed7`. Původní disk, textový návod i video zůstávají místní a beze změny. Na macOS je `goonies/` stejný adresář jako `Goonies/`, proto zdroj nové hry záměrně používá **`goonies-web/`**. Do veřejného sestavení patří pouze tento adresář.

## Co běží v prohlížeči

Vlastní JavaScriptová smyčka 60 Hz, Canvas 336×240 ve dvojnásobném rozlišení a místní PNG/JS/MP3. Scéna 320×176 je na pozici (8,32), stejně jako v dodaném videu. Žádný procesorový emulátor, Atari OS, ROM nebo ATR se do prohlížeče nekopíruje. Vše funguje i přímo z `index.html` bez serveru, `fetch()` a modulů.

`engine.js` spravuje pohyb, žebříky, horní tyče, přepínání obou postav, trvalé zavěšení neaktivní postavy, všech osm hádanek, smrt a sdílené životy, skóre a přechody místností. Sólo zachovává princip původního joysticku: nahoru skáče/leze, FIRE přepíná. Web mapuje FIRE na mezerník a pauzu na P/Escape; původní mezerník pauzoval. Přímá současná hra dvou lidí je doplněk portu (šipky a WASD). Trénink libovolné místnosti je také doplněk; kompletní výprava začíná domem.

`game.js` vykresluje původní bitmapy a snímky, ovládá menu, nápovědu, klávesnici, standardní gamepad a dotyk. Při ztrátě okna se hra pozastaví. `audio.js` přehrává dvě původní hudební smyčky a 19 původních PCM efektů; spuštění vyžaduje gesto, pauza zachová pozici hudby, ztlumení/odchod zastaví efekty.

## Původní data a nová logika

- Přesné původní obrazové bajty: osm čistých místností, titulní a závěrečná obrazovka, slovo GOONIES, sedm sad postav po devíti snímcích, dospělí, netopýři a původní předměty. [ASSETS.md](ASSETS.md) uvádí adresy a reprodukci. Některé původní strukturální předměty zůstávají součástí pozadí.
- Paleta je přiblížená referenčnímu videu. Dominantní modrá ve snímku ve 20 s je RGB(76,46,224), zatímco export používá (78,48,226); červené plochy mají ve videu často (116,18,2), export (118,18,0). Komprese a přechodové pixely se liší, úplná analogová shoda se netvrdí.
- Zvuk je vyrenderovaný přímo původním driverem. Přiřazení efektů novým herním událostem a rozdělení titulní/herní smyčky jsou volby portu; podrobnosti v [AUDIO.md](AUDIO.md).
- Geometrie je ručně odvozená z videa a přizpůsobená nové fyzice, není vytaženou kolizní maskou. [RULES.md](RULES.md) a `scenes.json` odlišují ověřený postup od přibližných rozměrů, čítačů a časování.

Pořadí podle videa je dům, vědra, ventily, kameny, lebka/vejce, varhany, chobotnice, loď. Diskové resource ID je `[0,2,1,3,4,5,6,7]`. V páté scéně dodané video skládá čtyři vejce **vpravo**; starý textový návod chybně píše vlevo a vynechává šestou scénu. Varhany přepínají podpěry, nezadává se melodie.

Pohyb, časování skoku, podpěry, automatické zachycení mechanismů, proměny varhan, dráha plováku, čerpání chobotnice, řízení pák lodi, skóre, bonusové životy a nepřátelé jsou nově napsané aproximace. Pátá scéna používá zjednodušené posouvání vajec a vytvoření schodů u přijímače; loď používá přehledné stavové podmínky dvou pák a zdvihu ramene. Úloha druhé postavy na lodi je přiřazená velké původní postavě z room7/logical57; původní interní přebírání kontroly nad NPC není přeložené instrukci po instrukci. Občasné značky klíče/východu a přehledně kreslené změny podpěr jsou nativní doplňky.

**Jde o první hratelnou adaptaci, nikoli potvrzenou přesnou repliku.** Nepřátelé mají jednodušší pohyb; není přenesena každá původní past, střelecký skript ani tajný bodový bonus. Smrt obnoví celou místnost a ubere společný život. Celá výprava končí po osmé scéně místo automatického začátku další smyčky. Fyzický gamepad a telefon nebyly vyzkoušené.

## Reprodukce a ověření

```sh
python3 tools/goonies_extract_assets.py
python3 tools/goonies_build_levels.py
python3 tools/goonies_render_cover.py
node tools/test-goonies.mjs
node tools/test-goonies-audio.mjs
python3 tools/build_portal.py
```

Grafický reexport je možný z uložených čistých grafických dat bez ROM; vyžaduje zachovaný místní ATR pro kontrolu hashe. `--capture` používá Atari800 pouze vývojově a pracuje s dočasnou kopií disku. Audio reexport navíc potřebuje vývojové nástroje popsané v AUDIO.md. Samotné sestavení portálu nic z toho nepotřebuje a kopíruje již hotové prostředky.

Třicet herních testů ověřuje fyziku, přepínání a trvalé držení, podmínky všech osmi místností, fyzický průjezd tří kamenů, čtyři vejce, odraz ke kosti, barevné podpěry, čerpání a zdvih lodi, pády/životy/pauzu, dokončení tréninku i výpravy a delší simulace. Kompletní dům i vodní varhany prošly skutečnými směrovými a přepínacími vstupy s pěti životy, bez teleportů, vypnutí nepřátel nebo přepsání příznaků; oba replaye jsou v `tools/fixtures/`. Kompletní ruční odehrání všech osmi scén zatím není potvrzené. Osm zvukových testů pokrývá autoplay, přechody, zpožděné/odmítnuté přehrání, pauzu, monofonii, ztlumení a přesnost PCM. Oba MP3 jsou dekódované a všech 19 efektů obsahuje zvuk.

Místní Brave ověřil načtení přes `file://`, spuštění, vykreslení původní scény, přepnutí postavy a klávesovou pauzu. Jednotlivé screenshoty mohou zachytit přechod se zpožděním; stav po akci byl ověřený následným čerstvým přístupnostním výpisem. Samostatný subjektivní poslech se nevydává za provedený.
