# Robbo: autorita, implementace a ověření

## Autorita a rozsah

Dodaný `Robbo.xex` (20 827 B), SHA-256
`75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb`,
je autoritou pravidel i dat. Referenční video je pouze vizuální pomůcka.
Archivalní assembler Janusze Pelce z
<http://sources.pigwa.net/files/gry/robbo.zip> pomohl rozboru, ale liší se od
dodaného XEX: adresy, ID svislé laserové zbraně a skutečný návrat z rutiny dveří.
Rozdíly byly rozhodnuty podle dodaného XEX, nikoli podle archivního zdroje.

Atari800 7.2.1 a py65 se používají výhradně offline k vývojovým porovnáním.
Runtime obsahuje pojmenované JS rutiny, původní obrazová/textová/zvuková data
a komprimovaný atlas závěrečné scény. Neobsahuje CPU, interpret instrukcí,
ROM operačního systému, XEX ani celý obraz RAM.

Původní program se rozbaluje ve více krocích včetně warm bootu a obnovení
uloženého stavu. Vývojové fixture vycházejí ze skutečné paměti zachycené až
po těchto krocích, nikoli z neúplného prvního LZ rozbalení.
Adresy a hashe jsou v jednotlivých JSON zprávách v tomto adresáři.

## Běh hry

`robbo/objects.mjs` překládá tabulku PROC a související rutiny, `player.mjs`
robota, inventář a skóre, `vbi.mjs` posouvání a ukazatele. `engine.mjs` řídí
časování, odkrytí planety, životy, smrt, přechody a demo.
`raster.mjs` interpretuje původní mapy, fonty a LOOK jako grafická data.
Každá planeta má 16 × 31 buněk a 16 metadatových bajtů; poslední řádek
pracovní mapy je černý okraj podle PLA1. Zápis mapy a PUT mají oddělenou
viditelnou reprezentaci, což je důležité pro exploze a animace.

Zvláštní raw `$A0` zůstává ve stavové mapě a zobrazuje wall glyph LOOK[0].
Skutečná svislá laserová zbraň v tomto XEX má ID `$27`, nikoli archivní `$22`.
Čísla inventáře a skóre používají původní zabalené BCD i přenosy.
Osm životů jsou náhradní životy: i po dosažení nuly proběhne poslední pokus.

PAL VBI má frekvenci `1773447 / (312 × 114)` Hz. Původní TMR3 nastavuje
sedm VBI na scan. Nativní hra respektuje tento interval, pořadí shora dolů
a zleva doprava, příznak zpracovaného objektu a explicitní HALT čekání
při zrození robota, otevření kapsle a CHNMON.
Klávesy ani dotykové ovládání nevytvářejí frontu pohybů.

Zvukový driver je přepsaný z SOUND_/SOUNDV/SOPL; sdílení čtvrtého kanálu,
priority, restart efektů a jeho čtyřfázové VBI hradlo zůstávají zachované.
POKEY oscilátory zachovávají fázi napříč audio callbacky. Kroky mají vlastní
81bitový CONSOL průběh s původním intervalem 13 CPU cyklů na zápis.
Titulek má původní psací zvuky, nikoli vymyšlenou hudbu.

Závěr používá datový atlas původních obrazů pro pevný úvod a referenční
fázi odkrývání. Samotné odkrývání pokračuje nativním třístránkovým
algoritmem COPT bez časového omezení; FIRE spustí původní barevné setření.
Při předčasném potvrzení se zachová skutečný částečně odkrytý text.

## Diferenciální důkazy

`python3 tools/test_robbo.py` sestavení kontroluje a spouští všechny
`tools/test-robbo-*.mjs`. Referenční fixtures obsahují výsledky skutečných
rutin dodaného XEX při shodných vstupech a proudu RANDOM.

| Oblast | Ověřený rozsah |
| --- | --- |
| Objekty | 6 900 jednotlivých případů a 400 úplných scanů s izolovaným robotem |
| Robot | 3 200 případů pohybu, střelby, inventáře, dveří, teleportů a magnetů |
| Robot spolu s objekty | 400 skutečných CHNGCV scanů napříč 56 planetami; 388 MFAC volání, 1 585 RANDOM čtení, 259 příkazů zvuku |
| Inicializace | Všech 56 planet: pracovní mapa, font, 2 048 znakových bajtů a sdílený stav |
| VBI | 2 574 stavů a 320 souvislých VBI včetně kamery, scroll fáze, HUD a rotace fontu |
| Grafika | 672 kompletních fontů, všech 56 celých planet 256 × 496 px, 2 574 HUD stavů |
| Hardwarový obraz | Jeden celý frozen PAL herní raster 320 × 240, dva titulkové a tři demo rastry včetně třetího blikajícího řádku; bez rozdílu pixelů |
| Zvuk | 63 scénářů, 6 016 VBI, 13 322 uspořádaných POKEY zápisů, všech 15 efektů a samostatné CONSOL kroky |
| Titulek | 6 820 typist VBI / 9 870 POKEY zápisů; 1 024 logo VBI / 4 352 RANDOM čtení |
| Závěr | 745 úvodních, 512 referenčních odkrývacích a 117 zavíracích VBI, předčasné potvrzení i dlouhé čekání |
| Rozhraní | CZ/EN file:// host bez fetch: klávesy i dotykový pohyb/FIRE, skutečně nenulové PCM, pauza, uvolnění kláves, F, demo a celý interaktivní závěr |

Testy zvuku měří i skutečné PCM peak/RMS. Dekódování nebo inicializace
audia samy o sobě nejsou důkazem slyšitelného výstupu.
Ve skutečném Edge bylo ověřené HTTP i přímé `file://` načtení,
CZ/EN rozhraní, start, titulek, první planeta, pauza a přepnutí F do fullscreen.
Ruční ovládání systému zasáhlo do pokusu o delší pohybový test, proto není
takový průchod vykázán jako úspěšně ověřený. Safari a fyzický mobil/gamepad
nebyly v tomto kroku ověřené; vstupní adaptéry jsou společné s portálem.

## Otevřené hranice shody

1. **Práce CPU/DMA uvnitř jednoho scanu.** Skutečný Atari800 záznam 80 scanů
   na první i poslední planetě potvrdil start scanu po sedmi VBI. Samotná
   práce původního CPU zabírá podle obsahu přibližně 3–5 VBI plus HALT na
   konci. Nativní verze provede nečekající část scanu souvisle. To zachová
   stavové pořadí a základní rychlost, ale zatím neprokazuje shodnou fázi
   čtení joysticku, grafických zápisů, zvuku a VBI uprostřed scanu. Odkrytí
   a setření mají původní explicitní čekání; proměnná cena původních
   vykreslovacích instrukcí v nich modelovaná není.
2. **Fáze RANDOM.** Použitý je POKEY 17bitový polynom a všechna ověřená
   sémantická čtení mají správné pořadí. Mezi čteními se nepřičítá přesná
   původní cena každé instrukce a DMA. Náhodná rozhodnutí proto nejsou
   časově identickou kopií jednoho konkrétního zapnutí skutečného Atari.
3. **Analogový zvuk.** Registry a driver jsou ověřené proti originálu.
   Počáteční fáze oscilátorů a analogová filtrace/reproduktor nejsou
   kalibrované na fyzickém stroji.
4. **Závěrečná scéna.** Atlas odpovídá jedné skutečné vstupní fázi RTCLOK
   a RANDOM. Ostatní možné vstupní fáze nejsou prokázané.
5. **Souvislé hraní.** Testy pokrývají všechny původní planety a rutiny,
   nikoli ruční dohrání všech 56 planet v jednom běhu. Životy, demo a závěr
   mají integrační testy, nikoli cyklově přesný důkaz celého životního cyklu.

Z těchto důvodů tato verze není označená za dokončený, plně prokázaný převod
1:1. Žádná známá odchylka není maskovaná náhradním pravidlem.
