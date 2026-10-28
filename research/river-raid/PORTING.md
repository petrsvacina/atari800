# River Raid — nativní webová verze

Hra v `river-raid/` používá JavaScript, Canvas a Web Audio. Řeka, objekty, souboje a restart jsou nativní překlady původních rutin. V prohlížeči není 6502, Atari OS ani spouštěná ROM/XEX. Atari800 se používá pouze při vývojovém ověřování.

## Autorita a dodané zdroje

Požadavek projektu je převod podle originálu 1:1, nikoliv odhad pravidel podle videa. Video nemusí zachycovat celou hru.

- `River Raid.rom`, 8 192 bytů, SHA-256 `dc55bef6fa336003772643e68b9bfade7155ff4dde1aad814e1cf56ad818805f`.
- `River Raid.xex`, 8 220 bytů, SHA-256 `a6c3a5f0f8a70632a8402bf54025bba18ec517e12107873c814c8328712a7c3b`.
- `River Raid (Atari XL⧸XE) [2b4ZJLsbm7U].webm`, 533,701 s, 2560×1440/60 fps: kontrola barev a vzhledu.
- `River Raid_DOCS.TXT` je návod pro konzoli 5200; pravidla XL/XE se ověřují z programu.

Načtený XEX se od ROM liší pouze dvěma NOP na `$A158/$A159`. Grafická a zvuková data i herní rutiny jsou stejné. Vývojové porovnání používá režim NTSC; webový krok odpovídá přibližně 59,923 Hz.

## Generátor a objekty

`generator.js` překládá `$A711–$AE96`: původní tříbytový seed, šířky a změny břehů, ostrovy, dekorace, mosty, umísťování všech objektů včetně prázdných slotů, vznik tanků a ukládání checkpointů. Řeka pokračuje bez konce předchozího exportu. Začátky 1/5/20/50 používají přímo původní tabulky seedů a středu. Obtížnost po dosažení interního 80 pokračuje původním střídáním 79/80; řeka se generuje dál.

Objekty skutečně zabírají jedenáct slotů původního programu. Při přetečení Y spodního slotu se ostatní přesunou a změní se parita aktualizací. Předchozí web chybně odvozoval tyto přesuny z konstantního intervalu 256 řádků. Po přesunu se Y spodního objektu změní, a proto tento interval není konstantní. Správu slotů nyní provádí přímo generátor.

`mechanics.js` překládá `$A1F5–$A2F5`: aktivaci náhodného slotu, vynechání nejnovějšího objektu, globální fázi animace, paritu, rychlost balónu, tryskáče, obrat s kontaktní západkou a původní cykly bitmap. **První úsek má nepřátele bez vodorovného pohybu i v originálu.** Pohyb se uplatní od druhého úseku. U nepřátel rozhoduje kontakt s tmavým břehem PF1 (`$B61E` posune P3PF před maskováním); letadlo naopak poškozuje zelená pevnina PF0.

Výbuch zůstává ve svém slotu, zachovává velikost a barvy zasaženého typu a posouvá se s řekou. Silnice mění barvu pevniny podle `$B4E5` a zůstává i po zmizení mostu. Tank má původní bitmapy, animaci, pohyb, zastavení po zničení mostu a střelu z `$A607–$A671`. Vrtulníková střela překládá `$A5B7–$A605`, včetně původní dvojnásobné šířky missile 0. Zásah mostu pod tankem přidělí ověřených 750 bodů.

`assets/original.js` obsahuje jen přibližně 13 kB původní grafiky a číselných tabulek. Předgenerovaná mapa se do webu už neposílá. Rozsáhlý původní export v `research/river-raid/course.json` a 952 potenciálních vzniků tanku slouží jako vývojové reference.

## Let, kolize a nový odlet

Řízení překládá `$A455–$A4B6`, včetně osmibitového zlomku a rozjezdu do stran. Odlet začíná rychlostí 64. Rychlost FE generuje dva řádky každý krok; ostatní rychlosti používají dvě původní samostatná přičtení do zlomkového čítače. Střela sleduje polohu letadla i po výstřelu, stejně jako původní sdílená poloha PM2/M2. Po zásahu se uvolní jediné místo pro střelu.

Kolize z vykresleného stavu se vyhodnotí v následujícím kroku a v původním pořadí. Kontakt s FUEL přičte 512 před spotřebou 32. Nulová nádrž způsobí smrt v následujícím kroku. Náraz letadla zničí také zasaženého nepřítele původní fází 3 a přidělí jeho body. Tanková střela poškozuje letadlo až ve fázi výbuchu.

Smrt používá původní čítač FE a snímky letadla 6 až 0. Po 127 krocích následuje obnova: třináct dalších VBI odpovídá původnímu mazání paměti, pak 160 nových řádků řeky během rozehřívání a stav připraveného letadla. Celkem jde o 220 webových kroků od smrti do připraveného odletu. Vyprazdňování původní RAM během těchto třinácti VBI web zobrazuje prázdným herním polem.

Checkpoint zachovává seed a střed řeky. `$B1C0` podle polohy mostu a příznaku jeho zničení zvolí aktuální, předchozí nebo právě dokončený úsek; nový let obnoví původní počáteční parametry generátoru. Při dvou hráčích se střídají skóre, checkpointy a letadla. Maximum je devět rezervních letadel a jedno aktivní, nikoliv devět celkem.

## Zvuk

Čtrnáct PCM prostředků na 22 050 Hz vzniká vykonáním původní POKEY rutiny `$B2A5–$B3D8` v soukromé SAP obálce. Samotné zvukové instrukce se nemění; následující nezvuková část VBI končí návratem. Exportované kanály se izolují, aby se motor nepřidával vícekrát. Metadata obsahují SHA-256 každého PCM proudu.

Vedle motoru, rychlosti, střely, tankování, plné nádrže, rezervy a varování jsou oddělené původní výbuchy letadla, nepřítele a tanku, vrtulníkový výstřel a celý zvukový průběh tankové střely. Nepřátelský výbuch používá jiný kanál než motor. Vrtulník jej dočasně překryje; pak se obnoví zbývající část. Výbuch letadla se při přepnutí do fáze smrti okamžitě nevypíná. Tanková střela má vlastní čtvrtý kanál.

## Opravy podle testerových postřehů (28. 10. 2026)

Původní DLI nastaví na začátku pole barvu přes `$AFD0`, u mostu ji po
jednotlivých řádcích mění tabulkou `$B4E5` a po posledním řádku obnoví `$0B`
(`$B5FA–$B5FC`). Web dříve správně volil horní barvu a silnici, ale nesprávně
ji používal také pod mostem. `RiverRaster.landColors` nyní zachovává oba
úseky současně. Funguje i s mostem částečně mimo obraz a po jeho zničení.

Palivoměr je skutečný statický rastr původní stupnice (E, ½, F a rám) a
původní překrývání markeru písmem. `$B527–$B52F` určuje 32 poloh M1 z
horního bajtu paliva; marker má čtyři pixely na deset řádků. Původní webový
výpočet `100 + round(fuel / 65535 * 46)` i roztažené písmo byly chybné.

Život navíc má v původním třetím POKEY kanálu přednost před střelbou:
`$B399–$B3AD` přepíše oba zvukové registry, dokud běží `$7E`. Čítač výstřelu
`$7D` se přitom stále zkracuje. Web už život nepřerušuje novou střelou; po
něm může dohrát pouze ještě aktuální část výstřelu. Na maximálních devíti
rezervách se nový život ani jeho zvuk nevyvolá, podle `$A57C–$A587`.

Běžný zvuk výbuchu se podle dojmu neměnil: všech dosavadních třináct PCM
proudů je bytově shodných. Doplněný čtrnáctý zvuk rozlišuje dojití paliva
(`$7A=2`, `$7B=$23`, první AUDF1 `$11`) od nárazu (`$7A=1`, `$7B=$1F`,
první AUDF1 `$39`), jak určuje `$A43F–$A44E`. Je vykreslen stejnou původní
rutinou jako ostatní efekty, nikoliv upravenou náhradní syntézou.

Nové nezávislé reference:

- 80 skutečných DLI rastrů, 12 800 řádků PF0: oba směry změny barvy,
  oříznutí mostu nahoře i dole, živý i zničený most;
- 33 stavů paliva pokrývajících všech 32 poloh, 43 296 porovnaných pixelů
  původního palivoměru;
- 285 vykonaných původních zvukových aktualizací, skutečné POKEY registry
  a čítače, včetně života pod opakovanou střelbou a obou zvuků zániku.

`tools/river_capture_presentation.py` používá vývojový Atari800 s monitorovým
`DUMPSCREEN`; první uložený řádek odpovídá fyzickému scanline 8. Herní pole
proto začíná v uloženém obraze na Y=20 (fyzicky 28), HUD na Y=180.
`tools/river_capture_sound.py` používá běžný Atari800. Obě komprimované
fixture jsou pouze vývojové. Nové testy jsou `test-river-presentation.mjs`
a rozšířené `test-river-audio.mjs`. Analogová fáze POKEY a subjektivní
shoda poslechu zůstávají původními výslovnými limity.

## Ověření

- **268 288 po sobě jdoucích původních řádků**: SHA-256 normalizovaného záznamu zahrnuje všech 48 obrazových bytů, stav generátoru, všechny sloty a checkpoint. Nejde jen o vybrané obrázky. Další test ověřuje pokračování za někdejším koncem exportu.
- **952 vzniků tanku**: všechny původní souřadnice, směry a rychlosti.
- **7 996 kroků celé původní herní smyčky**: řízení, palivo, všech jedenáct slotů a jejich kontaktní příznaky, tank, střely, skóre, pilot, checkpointy a SHA-256 všech 160 širokých obrazových řádků po každém kroku. 3 136 kroků izoluje pohyb bez zásahů hráče, 2 160 používá skutečné kolize a střelbu a 2 700 řízené zásahy pro větve checkpointů. NPC kolize s břehy zůstávají ve všech scénářích skutečné. Devět restartů potvrzuje i třináct dodatečných VBI při čištění paměti.
- **960 izolovaných aktualizací NPC/tanku, 384 tankové a 144 vrtulníkové střely**, včetně obou směrů a zlomkových rychlostí.
- **480 původních aktualizací řízení**, skutečný původní ready raster a souřadnice, **26 herních kontrol** a **15 zvukových kontrol**.
- Čistě vstupní replay projde prvním mostem za **880 kroků**, s **1 860 body** a všemi čtyřmi letadly. Nepoužívá teleport ani nesmrtelnost.
- Brave zobrazil nové místní sestavení, začátek 5, běžící let se střelbou, bodování, ztrátu života a tlačítko pauzy. Vykreslené stavy mostu, tanku a výbuchu byly také přímo zkontrolované.

Referenční scénáře se startují z původního stavu; počáteční fáze animace a aktivace se srovnají s daným záznamem. Po tomto počátku se všechny stavy počítají nativně. Stejný vložený bajt RANDOM zajišťuje porovnatelnost, nikoli shodu celého hardwarového generátoru náhody POKEY.

## Hranice tvrzení

Opravené dřívější zjednodušení AI, správy slotů, checkpointů, smrti a konečné mapy už není použitá náhrada pravidel. Shoda je ověřená uvedenými referencemi; úplné ruční dohrání všech úseků, fyzický gamepad/telefon ani subjektivní poslech se za provedené nevydávají. Několik snímků ani tisíce kroků nejsou matematickým důkazem všech možných stavů.

Nativní zdroj náhodných bajtů nahrazuje nepředvídatelný hardwarový RANDOM. RGB převod je laděný k videu, ne k jediné analogové televizi; PCM přehrávání není úplná emulace POKEY. Nové jsou webová nabídka, české texty, společný lokální rekord, dotykové ovládání, gamepad a vzhled webového HUD. Původní OS/boot a reklamní demo nejsou běžící součástí hry. Rozbor šířek a priority PMG lze porovnat také s [GTIA v Atari800](https://github.com/atari800/atari800/blob/ATARI800_7_2_1/src/gtia.c); žádný z těchto emulátorových modulů není v runtime.

## Reprodukce

Běžné sestavení nepotřebuje originály ani emulátor:

```sh
python3 tools/river_extract_assets.py
node tools/test-river-generator.mjs
node tools/test-river-game-oracle.mjs
node tools/test-river-raid.mjs
node tools/test-river-combat.mjs
node tools/test-river-audio.mjs
node tools/test-river-presentation.mjs
python3 tools/build_portal.py
```

Nová vývojová extrakce vyžaduje dodané originály a Atari800; zvuk také VLC a FFmpeg:

```sh
python3 tools/river_capture_course.py
python3 tools/river_capture_course.py --tank-candidates
python3 tools/river_extract_assets.py --capture
python3 tools/river_capture_game.py
python3 tools/river_capture_combat.py
python3 tools/river_capture_scene.py
python3 tools/river_capture_flight.py
python3 tools/river_extract_audio.py
python3 tools/river_capture_presentation.py
python3 tools/river_capture_sound.py
```

ROM/XEX, video, RAM, strojové obálky a vývojový emulátor zůstávají mimo Git a veřejný web. Veřejný balíček tvoří jen HTML/CSS/JS a herní prostředky.
