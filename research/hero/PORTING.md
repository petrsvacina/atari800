# H.E.R.O. — rozbor a nativní převod

Autoritou je uživatelův `H.E.R.O..xex` (10 614 bajtů), SHA-256
`6f8d4e99ed480c3886a771439ce2d8207cfa0601cf1ac7db1c2325117ee83a75`.
Dodané video `H.E.R.O. (Atari XL⧸XE) [YE736nHKQkA].mkv` slouží k posouzení
vzhledu a palety; úrovně ani pravidla nejsou rekonstruované z jeho průběhu.

## Původní program

INIT `$1019` rozbaluje soubor. RUN `$1F3F` přesouvá hru a volá skutečný
vstup `$8000`. Herní program po rozbalení leží v `$8000–$BFFF`.
Atari800 7.2.1 je pouze vývojová reference. Ve veřejných souborech není
XEX, strojový program, procesorový interpret, OS ROM ani emulátor Atari.

| Původní oblast | Význam | Nativní část |
| --- | --- | --- |
| `$832C–$8472` | Akcelerace vrtulky, posun, přechody | `engine.js`, `move` |
| `$8472–$857A` | Tabulky místnosti a barvy | `roomData` |
| `$857A–$8765` | Nepřátelé, zápalnice, pozdější pohyblivé objekty | `actors` |
| `$8765–$8932` | Postoj, cykly animace a laser | `choosePose`, `timers`, `laser` |
| `$8932–$8D70` | Záchrana, smrt, kolize, nálože, energie | zbytek `engine.js` |
| `$8E04–$8EC8` | Řízení dvou zvukových hlasů | `sound-core.js`, `registers` |
| `$9200–$9469` | Barevný raster a sběr kolizí | `raster.js` |
| `$94DA–$9575` | Návrat do místnosti a výměna jejího stavu | `changeRoom` |
| `$9583–$9B5E` | Sestavení znakové mapy a pohyblivé překážky | `terrain.js` |
| `$9BCB–$9CC1` | Původní bitmapy a barvy objektů | `preparePose`, `raster.js` |
| `$9CC2–$9D14` | BCD skóre a životy navíc | `addScore` |
| `$9D36–$9E14` | HUD a výchozí obtížnosti | `hud`, `reset` |
| `$A500–$AD3B` | Nepřátelé, jeskyně, příznaky, dvacet misí | `assets/original.js` |

Číselná pole v `assets/original.js` jsou pojmenovaná grafická a herní data.
Celý obraz původní paměti se do prohlížeče nekopíruje. Pole `Hero.fields`
a `Hero.arrays` popisují vazbu nativních stavů na vývojové referenční dumpy;
nejsou instrukční sadou ani programovým čítačem.

## Zachované vlastnosti

- Všech 256 místností dvaceti misí, včetně zvláštní osmé místnosti mise 17,
  žhavých stěn, vody, pohyblivých stěn a objektů pozdních misí.
- Původní pohyb po barevných hodinách, akcelerace a osm rychlostí vrtulky,
  hrany znaků při svislých i vodorovných kolizích a přechody obrazovek.
- Skutečné druhy a pohyb nepřátel, jejich animační a smrtelné cykly.
- Laser, zhasnutí lampy, postupné propalování zdi, zápalnice a asymetrický
  dosah výbuchu. Zápalnice a animace používají stejná sdílená místa jako hra.
- Výměna stavu při návratu do předchozí místnosti, záchrana horníka,
  původní bonus podle mise, nálože, doplnění výbavy a životní cyklus.
- Pět původních počátečních obtížností. Po dvacáté misi se pokračuje od
  mise 13; PRO volí další misi podle původního rozdělení náhodné hodnoty.
- Původní bitmapy a znakové sady, řádkové barvy a zdrojové kódy barev.

Důležité detaily rozboru: `$D004` při čtení znamená P0PF, zatímco `$D000`
M0PF. Postava a laser mají odlišný sběr kolizí. Čtení a nulování během
rastru vytváří mezery mezi pásmy 75/77 a 118/120; nejde o tři stejné
obdélníky. Pomocná rutina pro mazání postavy vrací A=0, takže porovnání
`CMP #$8C` po jejím volání stále vybírá běžný postoj při návratu do hry.
Bonusový byte `$99` znamená kvůli přenosu po CMP sto bodů, nikoli 99.

Tři nepřátelé sdílejí jednu bitmapovou vrstvu. Zápisy bitmap do stejných
řádků se mohou překrýt a vodorovná poloha se mění uvnitř snímku. Renderer
zachovává pořadí těchto zápisů i změny polohy; nejde o tři nezávislé sprity.

Překreslení místnosti v originálu překročí několik VBI. `assets/timing.js`
obsahuje 2 816 přímo naměřených profilů přechodu a čtyř fází hodin. Nativní
časování tak zachovává i zdržení a posuny animačních hodin při překreslení;
neodhaduje je z videa. Profily obsahují jen čtyři rozdíly čítače, nikoli
instrukce nebo procesorové cykly. Vývojové porovnání běží v režimu NTSC.

## Zvuk

`HeroSound.registers` překládá skutečné volby AUDF/AUDC z VBI. Laser,
vrtulka, zápalnice, výbuch, nabíjení energie, smrt a záchrana nepoužívají
náhradní melodie ani generické zvukové efekty. Nativní generátor vytváří
čistý tón a potřebné režimy šumu s pěti- a sedmnáctibitovým polynomem.
Fáze pokračuje i při změně registrů. Běží v AudioWorklet; při přímém
otevření souboru lze použít stejný generátor přes ScriptProcessor.

Řízení zvuku je porovnávané s originálem. PCM není prohlášené za bitově
shodný záznam analogového výstupu: prohlížeč má jinou vzorkovací frekvenci,
filtr, latenci a počáteční fázi šumu. Hardwarové chování bylo ověřované i
proti zdrojům Atari800 7.2.1 (`pokey.c`, `pokeysnd.c`, `gtia.c`).

## Opakovatelné ověření

```sh
python3 tools/hero_extract.py
python3 tools/hero_capture_terrain.py
python3 tools/hero_capture_game.py
python3 tools/hero_capture_game.py --extended
python3 tools/hero_capture_timing.py
python3 tools/hero_capture_explosions.py
python3 tools/hero_capture_sound.py
node tools/test-hero-terrain.mjs
node tools/test-hero-game.mjs
node tools/test-hero-explosions.mjs
node tools/test-hero-raster.mjs
node tools/test-hero-sound.mjs
node tools/hero_render_cover.mjs
python3 tools/build_portal.py
```

Extrakce vyžaduje původní místní XEX a Atari800; běžné sestavení a hraní je
nevyžaduje. Fixture obsahují pouze vstupy, stavy a znakové mapy. Referenční
strojový program, RAM a rozpracované SAP/WAV zůstávají mimo Git i veřejný web.

Ověření zahrnuje 328 celých znakových map (všech 256 místností a 72 dalších
stavů překážek), 28 184 herních kroků včetně nativně vypočítaných pixelových
kolizí, 384 samostatných detonací se skóre a 640 stavů zvukových registrů.
Porovnávají se pojmenované herní stavy; u hardwarových kolizních registrů
jen bity skutečně používané původním programem. Původní zpětná vazba se
nativní hře nepodsouvá. Sada obsahuje všechny místnosti, vstupní replay
první mise a skutečně spuštěnou záchranu i přechod do další mise u všech
dvaceti misí. Replay zachrání prvního horníka v kroku 751,
do další mise přejde v kroku 988 a má 2 770 bodů a všechny čtyři životy.

Samostatné měření skutečného indexovaného rastru potvrdilo shodu všech
80 640 pixelů kontrolního snímku první jeskyně, včetně HUD a loga. RGB převod je
kalibrovaný podle videa, zbývající odstíny jsou přibližné. Textura kamene
používá kosmetickou náhodu; počáteční fáze fyzického POKEY RANDOM se netvrdí.

Místní Edge ověřil načtení přes `file://`, spuštění, aktivní zvukový výstup,
pohyb a tlačítko pauzy. Fyzický gamepad ani telefon zatím nebyly vyzkoušené.
Úplná snímková shoda celého programu, analogového obrazu/zvuku a ruční
dohrání všech misí nejsou tvrzené. Rozhraní nabídky a ovládací tlačítka jsou
webová. V původním skóre se nepoužívá uložený webový rekord; ten je pouze
vedle hry v místním úložišti prohlížeče.
