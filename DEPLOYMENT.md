# Nasazení portálu

## Aktuální vydání — rozhodčí a vítězné gesto

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
