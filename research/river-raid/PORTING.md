# River Raid — nativní webová verze

Runtime je JavaScript + Canvas + Web Audio v `river-raid/`. Neobsahuje CPU, Atari OS, ROM ani XEX a nepotřebuje síťové požadavky pro načítání herních prostředků. Původní Atari800 se používá pouze při vývojové extrakci a tvorbě referencí.

## Dodané zdroje

- `River Raid.rom`, 8 192 bytů, SHA-256 `dc55bef6fa336003772643e68b9bfade7155ff4dde1aad814e1cf56ad818805f`.
- `River Raid.xex`, 8 220 bytů, SHA-256 `a6c3a5f0f8a70632a8402bf54025bba18ec517e12107873c814c8328712a7c3b`.
- `River Raid (Atari XL⧸XE) [2b4ZJLsbm7U].webm`, 533,701 s, 2560×1440, 60 fps; vizuální reference. Video se nekopíruje do webu.
- `River Raid_DOCS.TXT` popisuje konzoli **5200**, proto není jediným zdrojem pravidel XL/XE.

Načtený XEX se od ROM na `$A000–$BFFF` liší pouze dvěma NOP na `$A158/$A159`; jde o výchozí kontrolu přetrvávajících dat. Grafická, řeková a zvuková data i herní rutiny odpovídají stejné verzi.

## Co pochází z originálu

`river_capture_course.py` vykoná skutečný generátor řeky od `$A711`; místo návratu do hlavní obrazové smyčky uloží číselná data každého řádku. Nevykonává kompletní souboj. Zvukové a obrazové přerušení je při této dávkové extrakci vypnuté. Seed, přechody úseků, algoritmus řeky a tvorba objektů zůstávají původní.

Export obsahuje **268 288 řádků**, slovník **27 070 různých řádků** a **12 305 míst vzniku objektů**. Do webu se ukládá jen viditelných 40 obrazových bytů každého řádku, čísla řádků, pozice/typy objektů a bitmapy. Slovník se sdílí, takže hra neobsahuje stovky samostatných velkých obrázků. Dekorace hor, ostrovy, břehy i průlivy jsou součástí původních pixelů, nikoliv dodatečné sinusové křivky.

Počáteční seedy pro mosty **1, 5, 20 a 50** byly porovnané s původní tabulkou `$B494/$B498/$B49C`; průběžné generování dojde ke stejným hodnotám. Interní obtížnost originálu se později omezuje na 79/80, ale seed a další úseky pokračují. Webová mapa má konec po vyčerpání tohoto exportu; původní neomezené pokračování za ním se netvrdí.

Původní jsou snímky letadla, lodí, vrtulníků, střelce, tryskáče, balónu, mostu, paliva, výbuchů a písma. Směr bitmapy i pořadí řádků respektují původní vykreslování. RGB převod barev je přiblížený dodanému videu, nikoli úplná analogová emulace Atari barev.

`RiverRaid.flight` překládá `$A455–$A4B6` přímo do celočíselných pravidel: rozjezd do stran s osminovými kroky čítače a osmibitovým zlomkem, tři náklony, rychlost 64–254 s návratem k 128. Rychlost 128 posune kameru průměrně o jeden řádek za 60Hz krok. Směr nahoru/dolů mění rychlost, nikoli výšku letadla.

Spotřeba je 32 z 65 535 jednotek paliva za krok nezávisle na rychlosti. Kontakt s FUEL doplní 512 jednotek před dalším krokem; nižší rychlost prodlouží dobu tankování. Jedno místo pro střelu se uvolní po zásahu nebo opuštění obrazu. Kolize porovnávají skutečné neprůhledné pixely letadla a objektů, břehy a ostrovy s původní řekovou bitmapou.

Skóre pochází z BCD tabulky `$BB0B`: loď 30, vrtulník/balón 60, palivo 80, tryskáč 100, střelec 150 a most 500. Za každých 10 000 bodů přibude letadlo, nejvýše devět. Začínají čtyři. Dva piloti se po ztrátě střídají a mají vlastní skóre, letadla i checkpoint. Zničení mostu nastaví checkpoint odpovídající začátku dalšího úseku.

## Zvuk

`river_extract_audio.py` vykonává původní POKEY rutinu `$B2A5–$B3D8` v soukromé vývojové SAP obálce. Následná část VBI se nahrazuje návratem; samotné zvukové instrukce se nemění. Pro každý export se izoluje příslušný POKEY kanál, aby se při webovém míchání nezdvojoval motor. Obálky s původním kódem nejsou v runtime ani v Gitu.

Deset mono PCM klipů na 22 050 Hz pokrývá normální motor, přidání/ubrání rychlosti, střelbu, výbuch, tankování, plnou nádrž, rezervní letadlo, málo paliva a nepřátelský výstřel. Metadata obsahují SHA-256 každého PCM proudu. Webové přehrávání mění výšku motoru podle rychlosti, respektuje sdílené kanály, tankovací tón nahrazuje motor, nízké palivo spustí původní varování. Originál zde nemá přidanou novou hudební skladbu.

## Co je nová adaptace a co není ověřené

Aktivace a pohyb nepřátel, rozhodování o obratu u břehu, načasování střelby střelců a výbuchů jsou nové nativní provedení. Nejsou potvrzené jako snímkově shodné s celou původní herní smyčkou. Generátor v originálu navíc může reagovat na právě pohybující se objekt; export zachycuje jeho vývoj bez těchto soubojových vstupů. Bonus 750 za zvláštní most s tankem z dodaného 5200 návodu se automaticky nepovažuje za ověřené pravidlo této XL/XE verze a není přidaný odhadem.

Nové jsou menu, české texty, tréninkové začátky, lokální rekord, dotykové ovládání a podpora gamepadu. Rekord je společný pro webovou hru; nenapodobuje původní paměť jednotlivých variant. Ztráta okna pozastaví probíhající let. Samostatný subjektivní poslech, fyzický gamepad/telefon a úplné ruční dohrání celé dlouhé mapy se nevydávají za provedené kontroly.

## Ověření a reprodukce

**17 herních kontrol** zahrnuje 480 původních kroků řízení, 81 referenčních řekových řádků, všechny čtyři začátky, bodování, spotřebu/tankování, pixelové kolize, střely, checkpoint, životy, střídání pilotů, pauzu a první scénu. Replay prvního mostu obsahuje jen směrové/střelecké vstupy: končí u mostu 2 se skóre **1 670**, čtyřmi letadly a zbývajícím palivem. Nepoužívá teleport, nesmrtelnost ani přepis příznaku mostu. **Osm zvukových kontrol** ověřuje data, autoplay, motor, varování, sdílení kanálů, tankování, pauzu/mute a chybějící zvukový kontext.

Brave přes `file://` zobrazil kompletní stránku s původní řekou a HUD; potvrzené bylo spuštění letu a následná ztráta letadla. Spolehlivá kontrola všech kláves a dotykových prvků se za ručně dokončenou nevydává.

```sh
python3 tools/river_extract_assets.py
python3 tools/river_render_cover.py
node tools/test-river-raid.mjs
node tools/test-river-audio.mjs
python3 tools/build_portal.py
```

Při nové vývojové extrakci jsou potřeba dodané originály a Atari800; zvuk navíc místní VLC a FFmpeg:

```sh
python3 tools/river_capture_course.py
python3 tools/river_extract_assets.py --capture
python3 tools/river_capture_flight.py
python3 tools/river_extract_audio.py
```

Původní soubory, video, dočasné RAM, záznamy generátoru a strojové obálky zůstávají mimo veřejný web. Po naklonování jsou pro běžné sestavení a hraní všechny potřebné prostředky již v repozitáři.
