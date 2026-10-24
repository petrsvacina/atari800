# Nasazení portálu

## Aktuální vydání — The Goonies

- Vydání: `20261024T070949Z` (24. 10. 2026 v Praze).
- Portál: https://atari800.gmork.cz/ — čtyři hry včetně střídání hlavního náhledu.
- Hra: https://atari800.gmork.cz/hry/goonies/.
- Archiv: `/private/tmp/atari800-portal-20261024T070949Z.tar.gz`, serverová kopie ve `/var/tmp/` se stejným názvem.
- SHA-256: `1a0c005fc00e962c19625825380be5a8bc649f609fcfbe7b13caa2f0186c3d7e`.
- Staging: `/var/tmp/atari800-release-20261024T070949Z`.
- Záloha: `/root/atari800-backups/20261024T070949Z/site-before.tar.gz`.

Před změnou se všech 53 veřejných souborů shodovalo s předchozím stagingem. Záloha prošla kontrolou gzip a přenesený archiv odpovídá místnímu SHA-256. Nejdřív byla přidaná nová hra a náhled/logo katalogu, potom atomicky vyměněný úvodní index. Kromě úvodního indexu je všech 52 souborů předchozího vydání bytově shodných; zdroje a běžící soubory předchozích her se neměnily. Konfigurace a služby se neměnily.

The Goonies je nativní HTML5 adaptace všech osmi scén s původními pozadími, bitmapovými snímky, titulní a závěrečnou obrazovkou, dvěma hudebními smyčkami a 19 původními efekty. Sólo střídá dvě postavy, volitelně mohou hrát dva lidé současně. Přidaný je trénink místností a česká nápověda. Geometrie, fyzika, časování hádanek, bodování a jednodušší nepřátelé jsou nová implementace. Některé původní vedlejší pasti a střelecké skripty nejsou přenesené; jde o první hratelnou verzi. Podrobnosti a zdroje: `research/goonies/PORTING.md`.

Prošlo 30 herních a osm zvukových kontrol Goonies i všech 87 dosavadních kontrol. Dům a vodní varhany prošly skutečnými směrovými a přepínacími vstupy s pěti životy bez teleportů či přepsání příznaků. Místní Brave ověřil načtení přes `file://`, spuštění, původní postavy a scénu, přepínání a pauzu. Úplný ruční průchod všech osmi místností, samostatný poslech ani fyzický telefon/gamepad se nevydává za ověřené.

Po nasazení ověřeno všech **78 veřejných souborů pomocí SHA-256**, pět kanonických cest, MIME typy a všech sedm MP3 Range požadavků. Apache je aktivní. Validace místního sestavení prošla pro 58 HTML odkazů. Původní adresář `Goonies/`, disk ATR, video, ROM, pracovní dumpy a vývojové SAP soubory nejsou ve veřejném vydání.

## Předchozí vydání — střídání úvodní hry

- Vydání: `20261024T004601Z` (24. 10. 2026 v Praze).
- Portál: https://atari800.gmork.cz/.
- Archiv: `/private/tmp/atari800-portal-20261024T004601Z.tar.gz`, serverová kopie ve `/var/tmp/` se stejným názvem.
- SHA-256: `f5fbe04052f39825b2dfef1880be3a615fe2ecc6a699d0d80f0bad8bd1598fdd`.
- Staging: `/var/tmp/atari800-release-20261024T004601Z`.
- Záloha: `/root/atari800-backups/20261024T004601Z/site-before.tar.gz`.

Při obnovení stránky v jedné kartě se úvodní hra posune v pořadí katalogu: Dynakillers → International Karate → Archon → Dynakillers. Název, obrázek, logo, žánr, počet hráčů, číslo a oba spouštěcí odkazy se mění společně. Údaje pocházejí z `games.json` přes sestavené karty katalogu, takže přidání hry rozšíří i tento cyklus. Poslední volbu si pamatuje `sessionStorage`; bez úložiště nebo JavaScriptu zůstává funkční výchozí hra.

V místním Brave ověřené tři po sobě jdoucí refresh přechody včetně návratu na první hru, obou odkazů, obrázků, log a čísel 02/03 a 03/03. Sestavení proti minulému vydání mění pouze `index.html`, `portal.css` a `portal.js`; všech 50 ostatních souborů je bytově shodných. Před nasazením ověřeno všech 53 souborů předchozího vydání přes HTTPS a potom vytvořená a zkontrolovaná záloha. Tři soubory byly nahrazené připravenými kopiemi pomocí přejmenování.

Po nasazení ověřeno všech **53 veřejných souborů pomocí SHA-256**, čtyři kanonické cesty, MIME typy a všech pět MP3 Range požadavků. Herní kód a konfigurace serveru se neměnily.

## Předchozí vydání — Archon

- Vydání: `20261024T003656Z` (24. 10. 2026 v Praze).
- Portál: https://atari800.gmork.cz/ — tři hry.
- Nová hra: https://atari800.gmork.cz/hry/archon/.
- Archiv: `/private/tmp/atari800-portal-20261024T003656Z.tar.gz`, serverová kopie ve `/var/tmp/` se stejným názvem.
- SHA-256: `a75fd4d578aad389c5324fc31948f8d49e6f56a9c7abca3c46bd917c966bbf0f`.
- Staging: `/var/tmp/atari800-release-20261024T003656Z`.
- Záloha předchozího webu: `/root/atari800-backups/20261024T003656Z/site-before.tar.gz`.

Před změnou se všech 39 veřejných souborů shodovalo s předchozím stagingem. Archiv zálohy prošel kontrolou gzip; přenesené vydání má shodný SHA-256 s místním archivem. Nejdříve byla přidaná nová hra a obrázky katalogu, potom atomicky vyměněný úvodní index. Soubory Dynakillers a International Karate se neměnily. Konfigurace a služby se neměnily.

Archon je nativní JavaScript a Canvas: deska s původními 36 figurami, arény, 20 druhů jednotek, sedm jednorázových kouzel, proměnlivé světlo, magické body, hra proti CPU za obě strany a dva hráči. Bitmapy, číselné tabulky a zvuk pocházejí z dodaného XEX; barvy jsou porovnané s referenčním videem. AI, kolize, rozložení a proměny překážek jsou nově napsané. Jde o první hratelnou verzi, nikoli o potvrzenou shodu všech snímků a okrajových případů. Podrobnosti jsou v `research/archon/PORTING.md`.

Prošlo 28 herních a osm zvukových kontrol Archonu i všech 51 dosavadních kontrol ostatních her. Místní hra se načetla v Brave přes `file://`; v živém náhledu byl potvrzen průběh desky, arény a dalších tahů. Kompletní ruční průchod všemi kouzly ani fyzické dotykové/gamepadové ovládání se nevydává za ověřené. Zvuková data byla ověřená dekódováním a testy přehrávače; samostatný poslech se nevydává za provedený.

Po nasazení ověřeno všech **53 veřejných souborů pomocí SHA-256**, čtyři kanonické cesty, MIME typy a všech pět MP3 Range požadavků. Apache je aktivní. Původní XEX, Atari ROM, výzkumné dumpy a referenční video nejsou ve veřejném vydání; hra je pro spuštění nepotřebuje.

## Předchozí vydání — rozhodčí a vítězné gesto

- Vydání: `20261023T233958Z` (24. 10. 2026 v Praze).
- Hra: https://atari800.gmork.cz/hry/international-karate/.
- Archiv: `/private/tmp/atari800-portal-20261023T233958Z.tar.gz`, serverová kopie ve `/var/tmp/` se stejným názvem.
- SHA-256: `896b27afcc77e2b8faae448b661c9f2c15077c94b79939691a1c53027f50c185`.
- Staging: `/var/tmp/atari800-release-20261023T233958Z`.
- Záloha: `/root/atari800-backups/20261023T233958Z/site-before.tar.gz`.

Před změnou se všech 38 veřejných souborů shodovalo s předchozím stagingem. Toto vydání přidává `assets/referee.js` a mění pouze `engine.js`, `game.js` a `index.html` International Karate. Všechny dosavadní obrázky, barvy, styly, hudba, samply, portál i Dynakillers zůstávají bytově stejné. Skripty a data byly publikované před atomickou výměnou HTML; konfigurace ani služby se neměnily.

Přidaná je původní samostatná bitmapa rozhodčího 24 × 32 a české bodovací bubliny. Při vítězném plném bodu běží původní akce 32: fouknutí do pěsti a zatřepání rukou. Animace po zásahu nyní používají sedm PAL snímků na krok; bodovací přestávka ponechává čas na celé gesto i zprávu rozhodčího.

Prošlo 19 herních a 12 zvukových kontrol. Nové kontroly zahrnují pořadí zpráv rozhodčího, skrytí bubliny, vítězné gesto obou hráčů a režimů, absenci gesta po půlbodu či prvním plném bodu, neměnnost pozice během gesta a pomalejší animaci po zásahu. Po nasazení ověřeno všech **39 veřejných souborů pomocí SHA-256**, tři kanonické cesty, MIME typy a všechny tři MP3 Range požadavky. Bitmapa rozhodčího i snímky gesta byly vizuálně zkontrolované; pokus o samostatný prohlížečový náhled přerušil nástroj kvůli souběžné práci uživatele v Edge. Nové odehrání v prohlížeči se nevydává za provedené ověření.

## Předchozí vydání — původní digitální samply

- Vydání: `20261023T232511Z` (24. 10. 2026 v Praze).
- Hra: https://atari800.gmork.cz/hry/international-karate/.
- Archiv: `/private/tmp/atari800-portal-20261023T232511Z.tar.gz`, na serveru `/var/tmp/atari800-portal-20261023T232511Z.tar.gz`.
- SHA-256 archivu: `fd99887345f9c1e8daba57a16e5121f3d43859b90c565c5db8056d9125544ac2`.
- Staging: `/var/tmp/atari800-release-20261023T232511Z`.
- Záloha celého předchozího webu: `/root/atari800-backups/20261023T232511Z/site-before.tar.gz`.

Před změnou ověřeno všech 37 souborů předchozího vydání přes veřejné HTTPS proti jeho stagingu. Nové vydání mění pouze pět souborů International Karate: `assets/sfx.js`, `audio.js`, `engine.js`, `game.js` a `index.html`. Všechny obrázky, palety, styly, hudba, portál a Dynakillers se bytově shodují s předchozím vydáním. Soubory efektů a skripty byly nahrané před atomickou výměnou HTML. Konfigurace ani služby se neměnily.

Původních šest čtyřbitových samplů nyní nahrazuje syntetické efekty. Výběr podle snímku, zásahu či pádu, priorita hráčů, monofonie, opakování po 80/100 ms a ztišení běžící hudby vycházejí z původního programu. Rychlost 3700 Hz je empirické přiblížení dodanému videu; nepravidelné původní IRQ časování není plně simulované.

Po nasazení prošla kontrola **38 veřejných souborů pomocí SHA-256**, tří kanonických cest, MIME typů a všech tří MP3 Range požadavků. Apache je aktivní. Prošlo 16 herních a 12 zvukových kontrol, včetně dekódování všech šesti samplů, událostí zásahu/pádu, zabránění dvojímu přehrání při kontaktu, opožděného přehrání, monofonie, pauzy, ztlumení a tichého pokračování času hudby. Další ruční poslech v prohlížeči v tomto vydání není vydávaný za provedené ověření; uživatel měl během práce rozehraný souboj, který se automaticky neobnovoval.

## Předchozí vydání — International Karate

- Vydání: `20261023T230922Z` (24. 10. 2026 v Praze).
- Portál: https://atari800.gmork.cz/ — dvě hry.
- Nová hra: https://atari800.gmork.cz/hry/international-karate/.
- SHA-256 archivu: `397777b5fdb9a560c975ab10d34f614319b0c1fe2bd8315a31aa353acca10a29`.
- Lokální archiv: `/private/tmp/atari800-portal-20261023T230922Z.tar.gz`.
- Serverový archiv: `/var/tmp/atari800-portal-20261023T230922Z.tar.gz`.
- Staging: `/var/tmp/atari800-release-20261023T230922Z`.
- Záloha původního webu a kopií HTTP/HTTPS konfigurace: `/root/atari800-backups/20261023T230922Z/`.

Před změnami bylo všech 16 souborů předchozího vydání porovnáno přes veřejné HTTPS s jeho stagingem. Potom vznikla záloha. Na server se nejdřív přidal adresář nové hry a obrázky katalogu; úvodní index se nahradil atomickým přejmenováním. Soubory existujících Dynakillers se při této aktualizaci nepřepisovaly. Apache, certifikáty ani jiné weby se neměnily. Oba virtuální hosty se po dokončení shodují se záložními kopiemi a Apache je aktivní.

Ověření vydání:

- 37 souborů přes veřejné HTTPS shodných pomocí SHA-256, včetně všech prostředí, skriptů a původní hudby.
- Tři kanonické cesty: portál a obě hry. Správné MIME typy HTML, CSS, JS, PNG, SVG a MP3.
- Všechny tři hudební soubory podporují Range/206.
- 16 kontrol International Karate, 6 kontrol jeho zvuku a původních 20 kontrol Dynakillers prošlo.
- V místním i veřejném Edge ověřeno načtení, spuštění se zvukem, pohyb, živé bodování a klávesová pauza. Veřejná hra zobrazuje opravené `HRAJEME`, sedm původních pozadí a paletu kalibrovanou podle dodaného videa.
- Lokální validace 31 HTML odkazů. Ve vydání nejsou původní ATR/XEX, výzkumné dumpy ani referenční video.

Ovládání gamepadem a dotykem zatím nebylo fyzicky vyzkoušeno. Věrnost všech barev dalších šesti scén nebyla potvrzena videem (ukazuje Sydney). Hra je první hratelný přepis; CPU, blokování, bonusy a řízení soubojů jsou nové.

## Předchozí vydání — první portál

- Veřejná adresa: https://atari800.gmork.cz/
- První hra: https://atari800.gmork.cz/hry/dynakillers/
- Server: `root@mail.gmork.cz`
- Webový kořen: `/var/www/atari800`
- Vydání: `20261023T222905Z` (24. 10. 2026 v časovém pásmu Europe/Prague)
- SHA-256 nasazeného archivu: `086863637558eaf0c56080be25514c38591590721d70330430afb94086fc1af4`
- Záloha před nasazením: `/root/atari800-backups/20261023T222905Z/`
- Ověřený staging na serveru: `/var/tmp/atari800-release-20261023T222905Z`

Původní webový adresář byl prázdný. Záloha přesto obsahuje jeho archiv a kopie HTTP/HTTPS virtuálních hostů. Konfigurace Apache, certifikáty a ostatní weby se neměnily. Soubory hry a prostředků se publikovaly před úvodním indexem; index se nahradil přejmenováním připraveného souboru.

Ověřeno po nasazení:

- všech 16 veřejných souborů se přes HTTPS shoduje pomocí SHA-256 se sestaveným vydáním;
- kořen portálu i adresa hry vrací správné HTML, HTTP přesměrovává na HTTPS;
- CSS, JavaScript a MP3 mají odpovídající MIME typy, obě skladby podporují HTTP Range (206);
- Apache má platnou konfiguraci a běží;
- v Edge na veřejném webu funguje otevření hry z portálu, spuštění se zvukem, návrat do katalogu, hledání s prázdným výsledkem a filtr pro více hráčů;
- 11 testů herní logiky, 9 testů zvuku a kontrola pěti scénářů katalogu prošly.

Pro další vydání uprav zdroje v `portal/` a zdrojích her a spusť `python3 tools/build_portal.py`. Publikuj pouze `dist/`, před každým nasazením zazálohuj aktuální web. Kontrolu shody veřejných souborů lze zopakovat nástrojem `tools/verify_public_site.py` s cestou k odpovídajícímu vydání.
