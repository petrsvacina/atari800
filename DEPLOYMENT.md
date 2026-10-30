# Nasazení portálu

## Aktuální veřejné vydání — začátky střižených videí v Safari

- Vydání `20261030T073349Z`; **nasazené a ověřené přes HTTPS**.
- Zdrojový commit `7b4844dd21f1bfac03eb6d6287026815ffb749ba`, odeslaný na `origin/main`.
- Archiv `/private/tmp/atari800-portal-20261030T073349Z.tar.gz`, 18 864 141 B.
- SHA-256 `9f1fde083205e9a080404aaf4bce784827945f884bbb7857815cd9b40654f000`.
- Staging `/var/tmp/atari800-release-20261030T073349Z`.
- Ověřená úplná záloha: `/root/atari800-backups/20261030T073349Z/site-before.tar.gz`
  (188 původních souborů); záznam `release.json` v témže adresáři.
- Změněno pět souborů Karateky: `assets/movies/{court,palace-intro,court-palace}.mp4`,
  `assets/movies.js` a `index.html`. Zbývajících 183 veřejných souborů je
  bytově shodných, včetně portálu, všech herních pravidel a ostatních her.
- Preflight ověřil všech 188 původních souborů, publisher ověřil úplnou zálohu
  a všech 188 nových živých hashů. HTML se publikovalo poslední.
- HTTPS ověřilo 188 souborů, deset cest portálu/her, MIME typy a
  13 MP3/MP4 Range požadavků. Konfigurace ani služby se neměnily.

Příčina zbývajícího problému byla reprodukovaná v Safari: po uživatelském
zkrácení klipů zůstal první klíčový snímek v zahazovaných paketech před
časem nula. Safari spouštělo `court` i `palace-intro` až na čase 3,872 s,
takže z Mariko zbylo přibližně 0,85 s včetně načítání. Edge tyto soubory
přehrával od začátku; dřívější kontrola v Edge tuto odchylku neodhalila.

Tři střižené klipy mají nové kódování H.264 High/CRF 1 s klíčovým snímkem
v čase nula. Všech 494 / 267 / 464 dekódovaných obrazů zůstalo zachovaných,
AAC pakety jsou shodné a nevznikl další střih. Původní uživatelské MP4 jsou
v historii Gitu, ověřené serverové záloze a místní kopii
`/private/tmp/karateka-user-edits-before-safari/`. Provenance zaznamenává
původní hashe a nové kódování. Změněné klipy i odkazy mají verzi
`20261030-safari`; není potřeba ručně mazat cache.

V Safari cílený test přehrávače potvrdil začátek všech tří klipů v čase
0,000 s; palácový úvod nově trval 4,573 s včetně načítání, s posledním
pozorovaným časem média 4,459 s. Testovací panel se po ověření zavřel.
Prošly kontroly hashů/délek a prvních klíčových snímků všech šesti videí,
asynchronního přehrávače, nativní integrace a pěti případů sestavení portálu.
Nový test `tools/test-karateka-entry.mjs` prošel celou první částí přes
klávesové události skutečného `app.js` při 8 i 12 krocích/s a ověřil, že
palác čeká na dokončení úvodu. Používá simulované prohlížečové/mediální API;
nejde o důkaz úplné shody celé kampaně 1:1.

## Předchozí veřejné vydání — přechody filmových scén Karateky

- Vydání `20261030T065920Z`; **nasazené a ověřené přes HTTPS**.
- Zdrojový commit `324c62a51cf653d502fb59f61bbd7e4dedd0f991`, odeslaný na `origin/main`.
- Hra: <https://atari800.gmork.cz/hry/karateka/> (také `?lang=en`).
- Archiv `/private/tmp/atari800-portal-20261030T065920Z.tar.gz`, 18 858 117 B.
- SHA-256 `a4556b03caeb6c764a7145b975f8c6c0960d916822dbe1656102294fac67e9eb`.
- Staging `/var/tmp/atari800-release-20261030T065920Z`.
- Ověřená úplná záloha: `/root/atari800-backups/20261030T065920Z/site-before.tar.gz`
  (188 původních souborů); záznam `release.json` v témže adresáři.
- Změněny čtyři soubory: `hry/karateka/app.js`, `assets/movies.js`,
  `style.css` a `index.html`. Zbývajících 184 souborů je bytově shodných,
  včetně portálu, ostatních her a všech šesti uživatelových MP4.
- Preflight ověřil všech 188 původních souborů. Publisher ověřil archiv,
  úplnou zálohu a všechny živé hashe; nové HTML zveřejnil poslední.
- HTTPS ověřilo 188 souborů, deset cest portálu/her, MIME typy a
  13 MP3/MP4 Range požadavků. Konfigurace ani služby se neměnily.

Mezi titulkem a prologem zůstává viditelná neprůhledná video vrstva.
Konec obrazu se kontroluje až po spuštění vlastního klipu; starý čas či
opožděná událost předchozího videa nesmí ukončit novou palácovou scénu.
Pauza během načítání i obnovení používají stejnou kontrolu. Konec titulku
nesmí zrušit dozvuk nového prologu. Tři klipy uživatel před publikováním
zkrátil: metadata nyní odpovídají skutečným MP4 a zachovávají i původní
údaje exportu. Video soubory se při této opravě neměnily.

Prošla nová sada `tools/test-karateka-movies.mjs` (včetně `ffprobe`, hashů
a délek všech šesti klipů), integrace nativní kampaně včetně příchodů,
zvuku a vstupů a všech pět integračních kontrol portálu. Změněné JS/CSS
odkazy mají verzi `20261030-movies`, aby se nepoužila stará cache.

V Edge místní hra přirozeně dokončila titulek i prolog a vrátila se do hry.
Samostatná neveřejná testovací stránka se stejným přehrávačem a veřejnými
prostředky vyvolala palácové scény: poslední naměřený čas obrazu byl
4,464 s (`palace-intro`) a 7,746 s (`court-palace`), poté se obnovila hra.
Jde o cílenou kontrolu přehrávání, nikoli o ručně odehranou cestu do paláce
nebo důkaz shody celé kampaně 1:1.

## Předchozí veřejné vydání — Karateka v českém a anglickém portálu

- Vydání `20261030T062042Z`; **nasazené a ověřené přes HTTPS**.
- Zdrojový commit `5701e6bfe37e9ac24eb53c6e21d41c30f52cd1e0`, odeslaný na `origin/main`.
- Hra: <https://atari800.gmork.cz/hry/karateka/>; anglicky s `?lang=en`.
- Karateka je osmou hrou v českém i anglickém katalogu. Uživatel po
  společném ladění výslovně schválil publikování („je to perfektni, nasad ji“).
- Archiv `/private/tmp/atari800-portal-20261030T062042Z.tar.gz`, 18 858 313 B.
- SHA-256 `088bcca841dd6bd2c9cc4ea8154f06fa241c027004698be33afb029c570d5c06`.
- Staging `/var/tmp/atari800-release-20261030T062042Z`.
- Ověřená úplná záloha: `/root/atari800-backups/20261030T062042Z/site-before.tar.gz`
  (141 původních souborů), SHA-256
  `01aea1c60e03a5c7c639adad6c062471d1a7fe21c6b83982c09c1138440950cb`.
- Serverový záznam: `/root/atari800-backups/20261030T062042Z/release.json`.
- 188 veřejných souborů: 47 nových, změněné pouze dva dosavadní soubory
  (`index.html`, `en/index.html`), žádné odstraněné. Všech 139 ostatních
  původních souborů je bytově shodných, včetně všech sedmi dosavadních her.
- Preflight ověřil všech 141 původních souborů. Publisher ověřil archiv,
  úplnou zálohu a všechny nové živé hashe. Prostředky a hra se publikovaly
  před katalogy, kořenové HTML poslední; každý soubor atomickým přejmenováním.
- HTTPS ověřilo všech 188 souborů, deset cest portálu/her, MIME typy a
  13 Range požadavků (sedm MP3 a šest MP4). Samostatně stažené veřejné HTML
  Karateky i obou katalogů souhlasí s buildem; katalogy mají správné CZ/EN
  odkazy na hru. Konfigurace ani služby se neměnily.

Závěrečnou interaktivní kontrolu veřejného webu v místním Edge se nepodařilo
dokončit: po načtení titulku zůstal obsah stránky prázdný i po obnovení.
HTTP shoda souborů ani předchozí lokální hraní nejsou náhradou této kontroly;
veřejné spuštění zvuku/workletu v tomto běhu není ručně potvrzené.

Karateka používá nativní JavaScript, originální grafiku/zvuk z dodaného ATR,
šest offline zachycených filmových scén a vlastní české/anglické rozhraní.
Výchozí tempo je 12 kroků/s, volitelně 8. Součástí vydání jsou opravy
příchodů stráží a spotřebování kláves po boji. Výzkumné soubory, ATR,
provenance JSON a starý izolovaný souboj nejsou ve veřejném balíčku.

Ověření: 148 200 porovnání původních rutin a vybraných stavů/inicializací,
240 příchodových sekvencí (2 558 obrazů), propojený replay 1 500 kroků,
kontroly zvuku, tempa a rychlých vstupů po boji. Dále prošlo pět integračních
kontrol portálu, aktuálnost překladových balíčků a 799 kontrol překladů
dosavadních sedmi her. To není důkaz úplné shody celé hry 1:1;
konkrétní zbývající limity zachovává `research/karateka/README.md`.

Commit/push vznikl v `/private/tmp/atari800-river-motor-20261029T040010Z`
kvůli chráněnému hlavnímu `.git`. Pracovní soubory obsahují vydání;
hlavní metadata zůstala na `cff7ded`. Pomocník
`/private/tmp/atari800-boulder-sync-git.py` je aktualizovaný pro toto vydání
a v běžném terminálu je srovná až po úplné kontrole souborů proti vzdálenému
stromu; během nasazení se chráněná metadata neměnila.

## Předchozí veřejné vydání — angličtina uvnitř všech sedmi her

- Vydání `20261029T093114Z`; **nasazené a ověřené přes HTTPS**.
- Zdrojový commit `98f08bc`, odeslaný na `origin/main`.
- Anglický vstup: `https://atari800.gmork.cz/en/`; hry přebírají `?lang=en`.
- Archiv `/private/tmp/atari800-portal-20261029T093114Z.tar.gz`.
- SHA-256 `0e45a1bd0f7ab00a5c301b256b3936e700ca62e9ac16a8da8fad2b49bbd8613f`.
- Staging `/var/tmp/atari800-release-20261029T093114Z`.
- Ověřená úplná záloha: `/root/atari800-backups/20261029T093114Z/site-before.tar.gz` (134 souborů).
- 141 veřejných souborů: pro každou hru nový překladový balíček,
  změněný prezentační `game.js` a HTML s verzovanými odkazy. Všech 120
  ostatních souborů je bytově shodných: herní enginy, původní tabulky,
  obrázky, zvuky i portál. Kopírovaná herní HTML přidávají stejnou navigaci.
- Před publikací souhlasilo všech 134 živých souborů. Publisher ověřil
  archiv, staging, úplnou zálohu a všech 141 nových živých hashů.
- HTTPS ověřilo všech 141 veřejných souborů, devět kanonických cest,
  MIME typy a sedm MP3 Range požadavků. Samostatné místní stažení
  verzovaného překladového balíčku Dynakillers a rozhraní River Raidu
  souhlasí s buildem.

Angličtina nyní zahrnuje Dynakillers, International Karate, Archon,
The Goonies, River Raid, H.E.R.O. a Boulder Dash: nabídky, ovládání,
volby režimů, pauzu, výsledky, hlášky během hraní, přístupné popisky,
texty kreslené do Canvasu, názvy postav/pohybů/kouzel a nápovědu.
Goonies mají přeložené všechny názvy scén, úvodní pokyny, cíle, podrobné
návody osmi místností a herní upozornění. Výběr jazyka zůstává v URL
při návratu do portálu i kliknutí na logo samostatné hry.

Společný zdroj je v `localization/game-i18n.js`, překlady v
`localization/games.en.json`. Generátor vytváří sedm samostatných
`i18n.js`, takže místní/offline hry nepotřebují portál. Hra bez parametru
zůstává česká. Statické uzly a atributy se překládají při načtení;
dynamické texty explicitně procházejí prezentačními funkcemi. Původní
stav enginu, pravidla, vstupy, skóre ani časování se kvůli jazyku nemění.

Ověření: 799 kontrol překladů, pět integračních kontrol portálu a kontroly
aktuálnosti balíčků/parametrů překladů. Regrese: Dynakillers 11, Karate 19,
Archon 27, Goonies 57 a River Raid 26 kontrol; H.E.R.O. 28 184 kroků
proti původní referenci a Boulder Dash 120 000 integrovaných snímků
všech 100 variant jeskyní. V místním Edge jsou ověřené anglické nabídky
všech sedmi her, spuštění a pauza Karate/Boulder Dash/Dynakillers,
aktivní pokyny ke kouzlům Archonu a podrobná nápověda Goonies.

V tomto běhu spojení SSH bez PTY po autorizaci uvázlo. Přenos úspěšně
proběhl přes `ssh -e none -tt` a `--rsync-path='stty raw -echo; rsync'`;
příkazy preflight/publisher/verifier přes `ssh -tt`. Žádná konfigurace
serveru se kvůli tomu neměnila; obsah je ověřený stejnými SHA kontrolami.

Commit/push vznikl v `/private/tmp/atari800-river-motor-20261029T040010Z`
kvůli chráněnému hlavnímu `.git`. Pracovní soubory obsahují vydání;
hlavní metadata zůstala na `729b42c`. Aktualizovaný
`/private/tmp/atari800-boulder-sync-git.py` je srovná v běžném terminálu
po úplné kontrole pracovních souborů proti vzdálenému stromu.

## Předchozí veřejné vydání — český a anglický portál

- Vydání `20261029T084716Z`; **nasazené a ověřené přes HTTPS**.
- Zdrojový commit `dabe6e1`, odeslaný na `origin/main`.
- Český portál: `https://atari800.gmork.cz/`.
- Anglický portál: `https://atari800.gmork.cz/en/`.
- Archiv `/private/tmp/atari800-portal-20261029T084716Z.tar.gz`.
- SHA-256 `b62e368d4a7ee12dba14fc57b5def49bd4eaf77310b6a049c68bf4fad81ed78c`.
- Staging `/var/tmp/atari800-release-20261029T084716Z`.
- Ověřená úplná záloha: `/root/atari800-backups/20261029T084716Z/site-before.tar.gz` (132 souborů).
- 134 veřejných souborů: nová anglická stránka a společná navigace,
  změněné oba sdílené prostředky portálu, česká stránka a sedm herních
  HTML se společným navigačním skriptem. Ostatních 122 souborů souhlasí.
  Veškerý herní JavaScript, obrazové a zvukové prostředky jsou bytově stejné.
- Preflight ověřil všech 132 původních živých souborů. Publisher ověřil
  zálohu, nové soubory i živé hashe; kořenové HTML publikoval poslední.
- HTTPS ověřilo všech 134 veřejných souborů, devět kanonických cest,
  MIME typy a sedm MP3 Range požadavků. Nezávislé místní stažení `/en/`
  a verzovaného navigačního skriptu souhlasí s buildem.

Portál se sestavuje ze společné HTML šablony a katalogu. Samostatné
překlady pokrývají všechny texty, metadata, popisy sedmi her, žánry,
hráče, ovládání i dynamické hledání, počítadla a obměnu hlavní hry.
Obě adresy fungují i jako statické stránky bez překládání až po načtení.
Hlavička obsahuje CZ/EN, stránky mají vlastní canonical, jazyk a hreflang.
Anglické odkazy na hry nesou `?lang=en`; společná navigace pak vrací do
`/en/`. Překlady textů uvnitř jednotlivých her jsou samostatný rozsah.

Prošlo pět integračních kontrol sestavení: místní cíle odkazů a assetů,
jazyk v odkazech na hry, canonical/hreflang a aktivní jazyk, běhové texty,
povinné překlady nových her a bezpečný obsah JSON skriptu. Samostatná
JS kontrola ověřila návrat do českého/anglického katalogu a zachování
jazyka při kliknutí na herní logo. V místním Edge je ověřený desktopový
vzhled, anglické hledání (1/7), prázdný stav (0/7), multiplayer (6/7)
a obměna hlavní hry. Mobilní hlavička má dvouřádkové rozložení; spolehlivé
vizuální ověření mobilní emulací se v tomto běhu nepodařilo dokončit.

Commit/push vznikl v `/private/tmp/atari800-river-motor-20261029T040010Z`
kvůli chráněnému hlavnímu `.git`. Pracovní soubory jsou shodné s vydáním;
hlavní metadata zůstala na `0ab6871`. Aktualizovaný
`/private/tmp/atari800-boulder-sync-git.py` je bezpečně srovná v běžném
terminálu po kontrole všech souborů proti vzdálenému stromu.

## Předchozí veřejné vydání — souvislý motor River Raidu

- Vydání `20261029T042025Z`; **nasazené a ověřené přes HTTPS**.
- Zdrojový commit `71b9790`, odeslaný na `origin/main`.
- Archiv `/private/tmp/atari800-portal-20261029T042025Z.tar.gz`.
- Staging `/var/tmp/atari800-release-20261029T042025Z`.
- Ověřená úplná záloha: `/root/atari800-backups/20261029T042025Z/site-before.tar.gz` (130 souborů).
- SHA-256 `4adb02cfeb5105004b52ed0d69c205a07ff6a58dfe812c4769410e0a48840811`.
- 132 veřejných souborů: dva nové moduly motoru, změněný přehrávač
  a HTML River Raidu. Zbývajících 128 souborů je bytově shodných.
- Před publikací souhlasilo všech 130 živých souborů s minulým vydáním.
  Záloha je ověřená, HTML se vyměnilo poslední a souhlasí všechny nové hashe.
- HTTPS ověřilo všech 132 veřejných souborů, osm kanonických cest,
  MIME typy a sedm MP3 Range požadavků. Místní stažení obou verzovaných
  modulů motoru také souhlasí s buildem.

První oprava odstranila opakované ticho na začátku PCM, ale uživatelský
test potvrdil, že pulzování krátké opakované textury zůstává. Nové vydání
už motorové PCM smyčky nepoužívá. Nativní generátor drží průběžný
17bitový polynom a mění dělič/hlasitost podle původních registrů.
AudioWorklet i náhradní ScriptProcessor používají stejnou implementaci.
Ostatní původní zvukové prostředky a jejich priority se nezměnily.

Prošlo 24 zvukových kontrol a 26 herních regresí. Nový Atari800 záznam
ověřuje 768 motorových stavů v původním XEX, včetně vlastní inicializace
AUDCTL/SKCTL. Testy ověřují kontinuitu přes callbacky při 44,1/48/96 kHz,
absenci půlsekundového opakování, změny plynu, mute/pauzu a opožděné
načtení či selhání workletu. Místní Edge kontrola zvukového grafu prošla;
uživatel následně potvrdil funkční místní test. Analogová shoda celého
POKEY a počáteční frekvenční náběh přes `$052C` tím nejsou prokázány.
Podrobnosti a přesné hranice jsou v `research/river-raid/PORTING.md`.

Commit/push vznikl v `/private/tmp/atari800-river-motor-20261029T040010Z`,
protože hlavní `.git` je chráněný. Hlavní pracovní soubory obsahují stejné
změny; metadata zůstala na `6f767db`. Aktualizovaný
`/private/tmp/atari800-boulder-sync-git.py` srovná metadata v běžném
terminálu až po kontrole všech souborů proti vzdálenému stromu.

## Předchozí veřejné vydání — první oprava motorové smyčky River Raidu

- Vydání `20261029T040010Z`; **nasazené a ověřené přes HTTPS**.
- Zdrojový commit `0508abf`, odeslaný na `origin/main`.
- Archiv `/private/tmp/atari800-portal-20261029T040010Z.tar.gz`.
- Staging `/var/tmp/atari800-release-20261029T040010Z`.
- Ověřená úplná záloha: `/root/atari800-backups/20261029T040010Z/site-before.tar.gz` (130 souborů).
- SHA-256 `571379569e4ff9b835657a10b8fd813282e54c1d6b5ac597fb12eca5ce9b69ff`.
- Stále 130 veřejných souborů: mění se jen zvuková metadata, přehrávač
  a HTML River Raidu. Ostatních 127 souborů je bytově shodných.
- Před publikací souhlasilo všech 130 živých souborů s minulým vydáním.
  Ověřená je záloha i kompletní nové živé hashe; HTML se vyměnilo poslední.
- Veřejné HTTPS ověřilo SHA-256 všech 130 souborů, osm kanonických cest,
  MIME typy a sedm MP3 Range požadavků. Nezávislé místní stažení nového
  verzovaného zvukového assetu souhlasí s buildem.

Půlsekundový export původního motoru obsahoval na začátku krátký náběh
s tichem; opakování celého bufferu chybně vytvářelo pulzování. Přehrávač
nyní zahraje náběh jednou a opakuje pouze ustálený úsek původního PCM.
Hranice smyčky mezi čtvrtým a osmým VBI se vybírá podle návaznosti vzorků.
Všech čtrnáct PCM proudů, zrychlování/zpomalování a ostatní efekty zůstaly
nezměněné. Varovný zvuk s úmyslnou modulací se neupravoval.

Prošlo 19 zvukových kontrol, včetně absence opakovaných útlumů motoru
u všech tří režimů a rychlostí 64/128/248, zachování prvního náběhu,
nepřerušeného držení rychlosti, priorit efektů a původních POKEY registrů.
Uživatelské nahrávky `atari001.wav` a `river.m4a` zůstávají pouze lokálními
podklady. Analogová shoda a subjektivní poslech se tím nevydávají za
potvrzené 1:1. Podrobnosti jsou v `research/river-raid/PORTING.md`.

Zápis do hlavního `.git` je stále chráněný; commit/push vznikl v
`/private/tmp/atari800-river-motor-20261029T040010Z`. Hlavní pracovní soubory obsahují opravu,
metadata zůstala na `6729046`. Tentýž `/private/tmp/atari800-boulder-sync-git.py`
je připraven pro bezpečné srovnání v běžném terminálu s kontrolou všech
pracovních souborů a ochranou cizích změn.

## Předchozí veřejné vydání — opravy River Raidu podle originálu

- Vydání `20261028T185524Z`; **nasazené a ověřené přes HTTPS**.
- Zdrojový commit `9402110`, odeslaný na `origin/main`.
- Archiv `/private/tmp/atari800-portal-20261028T185524Z.tar.gz`.
- Staging `/var/tmp/atari800-release-20261028T185524Z`.
- Ověřená úplná záloha: `/root/atari800-backups/20261028T185524Z/site-before.tar.gz` (130 souborů).
- SHA-256 `fc7281b24a83722e3cdc779f10090b353b5839b6d04b088b5dfc770060bb774e`.
- Stále 130 veřejných souborů; mění se pouze šest souborů River Raidu,
  zbývajících 124 včetně portálu a ostatních šesti her je bytově shodných.
- Před publikací souhlasilo všech 130 původních souborů s minulým vydáním.
  Publisher ověřil zálohu i všechny živé hashe a vyměnil HTML jako poslední.
- Veřejné HTTPS potvrdilo SHA-256 všech 130 souborů, osm kanonických cest,
  MIME typy a sedm MP3 Range požadavků. Nezávislé místní stažení HTML hry
  souhlasí s buildem. Konfigurace ani služby se neměnily.

Břehy používají původní DLI barvu zvlášť nad a pod mostem. Palivoměr má
původní E/½/F a všech 32 poloh markeru. Život navíc má podle původní
POKEY rutiny přednost před střelbou; nevzniká při plné rezervě. Doplněný
zvuk dojití paliva je odlišný od nárazu jako v originálu. Všech dosavadních
13 PCM proudů zůstalo bytově shodných, přibyl pouze tento čtrnáctý.

Prošlo 26 herních a 15 zvukových kontrol i všechny dosavadní generátorové,
bojové a 7 996 úplných herních replay kroků. Nové řízené stavy skutečného
Atari rastru ověřují 80 DLI scén / 12 800 řádků a 33 stavů paliva / 43 296
pixelů; 285 původních zvukových kroků ověřuje POKEY registry a čítače.
Soubory mají novou verzi URL pro cache. Výsledné vykreslení je zkontrolované
jako obraz; nový ruční poslech ani fyzický gamepad se netvrdí. Aktuální
browserová kontrola nebyla dostupná (`cgWindowNotFound`). Hranice úplné
1:1 věrnosti zůstávají v `research/river-raid/PORTING.md`.

Zápis do hlavního `.git` je v této relaci stále chráněný. Commit/push
vznikl v `/private/tmp/atari800-river-presentation-20261028T185524Z`.
Hlavní pracovní soubory odpovídají tomuto vydání; jejich metadata zůstala
na `6729046`. Tentýž `/private/tmp/atari800-boulder-sync-git.py` je znovu
připravený pro bezpečné srovnání v běžném terminálu, včetně kontrol bajtů
všech souborů a ochrany cizích změn.

## Předchozí veřejné vydání — Boulder Dash

- Vydání: `20261028T112129Z`; **nasazené a ověřené přes HTTPS**.
- Hra: https://atari800.gmork.cz/hry/boulder-dash/; sedmá hra v katalogu.
- Zdrojový commit: `8ff5cde`, odeslaný na `origin/main`.
- Staging: `/var/tmp/atari800-release-20261028T112129Z`.
- Ověřená záloha předchozích 114 souborů: `/root/atari800-backups/20261028T112129Z/site-before.tar.gz`.
- Archiv: `/private/tmp/atari800-portal-20261028T112129Z.tar.gz`.
- SHA-256: `a8fcb34a1554f7a7003412d819cc4f591c1aecdbd51a62ff0a242dd9223d803f`.
- Sestavení: **130 veřejných souborů, 114 platných místních HTML odkazů**.
- Proti minulému vydání přibývá 16 souborů, mění se pouze úvodní HTML.
  Zbývajících 113 souborů včetně všech dosavadních her je bytově shodných.
- Ověřeno přes veřejné HTTPS: SHA-256 všech 130 souborů, osm kanonických
  cest, MIME typy a sedm MP3 Range požadavků. Nezávislé místní stažení
  HTML nové hry je shodné. Publikace ověřila zálohu i úplné živé hashe;
  nové soubory se zveřejnily před HTML hry a portálu. Konfigurace se neměnila.

Nativní JavaScript přebírá z dodaného ATR všech 100 variant jeskyní, fyziku,
AI, skóre, životní cyklus, bitmapy, animace, posun obrazu, noty i zvukové
registry. Veřejný web neobsahuje původní program ani emulátor.

Prošlo všech sedm sad Boulder Dash: 100 generací, 20 replayů a 2 601 200
porovnání stavů/buněk, 7 592 cílených původních skenů i jejich CPU práce,
1 800 úplných VBI a dalších 6 000 VBI s řídkými kontrolními body, 422 400
znakových kvadrantů, hudební kroky, hardware RANDOM, přechody a životní
banky. Dalších 120 000 integrovaných snímků prošlo všemi 100 variantami
bez neznámé časovací větve. Edge načetl a spustil místní hru; pozdější
revize ověřují automatické testy. Telefon, gamepad ani ruční kompletní
dohrání se nevydávají za ověřené. **Úplná shoda celé hry 1:1 se netvrdí:**
průběžné DMA/VBI časování, fáze RANDOM, odkrývání/bonus a analogový POKEY
mají výslovně uvedené hranice v `research/boulder-dash/PORTING.md`.

Místní `.git` je v této relaci chráněný proti zápisu. Commit a push proto
vznikly v čistém checkoutu `/private/tmp/atari800-boulder-release-20261028T112129Z`.
Soubory v hlavním projektu odpovídají vydání, ale jeho Git metadata zůstala
na původním `705c8a5`. Je připraven `/private/tmp/atari800-boulder-sync-git.py`
pro spuštění v běžném terminálu: stáhne remote refs, ověří původní HEAD,
prázdný staging a shodu všech pracovních souborů s cílovými Git objekty;
teprve potom srovná pouze HEAD/index. Při cizích změnách skončí bez resetu.
Neodstraňuje původní Atari soubory ani žádné pracovní soubory.

## Předchozí veřejné vydání — oprava Archonu podle XEX

- Vydání: `20261027T092825Z`; **nasazené a ověřené přes HTTPS**.
- Hra: https://atari800.gmork.cz/hry/archon/; zdrojový commit `f6a328f`.
- Archiv: `/private/tmp/atari800-portal-20261027T092825Z.tar.gz`; serverová kopie ve `/var/tmp/`.
- SHA-256: `13f8a42e47bdac60bccfd7a55b423ac5e11c6b5d03b50cde2cf9370aee76ee36`.
- Staging: `/var/tmp/atari800-release-20261027T092825Z`.
- Úplná ověřená záloha předchozího webu: `/root/atari800-backups/20261027T092825Z/site-before.tar.gz` (111 souborů).

Vlastní AI a soubojové heuristiky Archonu nahrazuje nativní překlad původních rutin. Přenesený je generátor 18 překážek, jasové třídy a bitmapové kolize, pohyb, zbraně, Fénix a Bánší, rozhodování počítače na desce i v aréně. Opravené jsou oba počáteční směry světla, léčení, výběry kouzel a původní geometrie desky i značka magického bodu. Sedmnáct PCM zahrnuje pohybové smyčky, let střely a efekty nabití, kontaktu a plošných útoků. Podle volby uživatele běží NTSC, přibližně 59,9233 Hz. Nativní web neprovádí původní CPU ani XEX.

Prošlo 27 herních a deset zvukových kontrol, 953 360 porovnání bytového stavu ve 114 původních replayích, 768 úplných rozhodnutí AI, 167 vykonaných Teleport/Summon dispatchů, 2 592 cílů kouzel a 44 úplných tahů obou začínajících stran. Dalších 161 896 porovnání ověřuje původní pixelové kolize dvanácti celých VBI jader při stabilním úplném GTIA scanoutu. **Úplné 1:1 se netvrdí:** nepřerušovaný raster má stále rozdíly; zásobníková chyba Měňavce a návrat patologických AI teleportací nejsou uzavřené. Rozsah, diagnostické neprocházející stopy, webové přechody a hranice zvuku jsou v `research/archon/PORTING.md`. Místní Edge potvrdil načtení desky, zahájení arény a pohyb; úplná ruční partie ani fyzický telefon/gamepad nejsou tvrzené jako ověřené.

Před přípravou i těsně před publikací všech 111 živých souborů souhlasilo s předchozím vydáním. Po ověření úplné zálohy se atomicky přidaly tři a nahradilo osm souborů pouze v Archonu, HTML jako poslední. Ostatních **103 souborů zůstalo bytově shodných**, včetně portálu a dalších pěti her. Konfigurace ani služby se neměnily. Změněné skripty a hudba mají verzi URL pro cache.

Sestavení má **114 veřejných souborů a 97 platných místních HTML odkazů**. Veřejné HTTPS ověřilo SHA-256 všech 114 souborů, sedm kanonických cest, MIME typy a sedm MP3 Range požadavků. Nezávislé místní stažení HTML Archonu je také shodné. Původní hry, video, pracovní RAM, fixture a vývojové obálky nejsou ve veřejném sestavení.


## Předchozí vydání — H.E.R.O.

- Vydání: `20261026T225342Z`; **nasazené a ověřené přes HTTPS**.
- Hra: https://atari800.gmork.cz/hry/hero/; portál nyní obsahuje šest her.
- Archiv: `/private/tmp/atari800-portal-20261026T225342Z.tar.gz`; serverová kopie ve `/var/tmp/`.
- SHA-256: `d415eaceab20a2ce6e7a4efd31c7f6d71f10967da3acb556c200641899940119`.
- Staging: `/var/tmp/atari800-release-20261026T225342Z`.
- Úplná záloha předchozího webu: `/root/atari800-backups/20261026T225342Z/site-before.tar.gz` (96 souborů).

H.E.R.O. je samostatný nativní JavaScript/Canvas port dodaného XEX. Zachovává 256 místností dvaceti misí, původní grafická data, pohyb, nepřátele, laser, lampy, dynamit, žhavé a pohyblivé překážky, energii, záchranu, bonusy a životní cyklus. Zvukové registry řídí nativní generátor potřebných tónů a šumů POKEY. Původní CPU ani program v prohlížeči neběží. Nabídka má původních pět začátků obtížnosti; ovládání zahrnuje klávesnici, gamepad a dotyk.

Prochází 28 184 herních kroků proti skutečnému programu, včetně nativně počítaných pixelových kolizí. Zahrnují se všechny místnosti a skutečně spuštěná záchrana i přechod do další mise u všech dvaceti misí. Čistě vstupní replay první mise má 2 770 bodů a čtyři životy. Prochází také 328 znakových map, 384 detonací se skóre, 640 stavů zvukového řízení a všech 80 640 indexovaných pixelů referenčního snímku. Časování překreslení vychází z 2 816 původních profilů VBI. Rozsah a omezení NTSC, RGB, analogového zvuku, náhodné fáze a ručního hraní jsou v `research/hero/PORTING.md`; úplná shoda celého programu 1:1 se netvrdí.

Před přípravou všechny živé soubory souhlasily s předchozím stagingem. Po úplné záloze se atomicky přidalo 15 souborů hry a náhledů a nahradil úvodní index. Zbývajících 95 souborů, včetně všech pěti dosavadních her, portálového CSS a JavaScriptu, je bytově shodných. Konfigurace ani služby se neměnily.

Sestavení má 111 veřejných souborů a 94 platných místních HTML odkazů. Veřejné HTTPS potvrdilo **111 souborů přes SHA-256**, sedm kanonických cest, MIME typy a sedm MP3 Range požadavků. Nezávislé místní stažení HTML H.E.R.O. souhlasí se sestavením. Na webu nejsou původní Atari soubory, výzkumná RAM, fixture ani referenční video.

## Předchozí vydání — nativní generátor a úplná herní smyčka River Raid

- Vydání: `20261026T205640Z`; **nasazené a ověřené přes HTTPS**.
- Hra: https://atari800.gmork.cz/hry/river-raid/.
- Archiv: `/private/tmp/atari800-portal-20261026T205640Z.tar.gz`; serverová kopie ve `/var/tmp/`.
- SHA-256: `c9c554b4f84a9fe8de46caf1f220ce852f351a8e67b184b6bfb0df86167978f9`.
- Staging: `/var/tmp/atari800-release-20261026T205640Z`.
- Úplná záloha předchozího webu: `/root/atari800-backups/20261026T205640Z/site-before.tar.gz` (95 souborů).

Řeka a všechny objekty se generují průběžným nativním překladem, bez konce exportované mapy. Skutečné přesuny jedenácti slotů nahrazují chybný výpočet přetečení z konstantních 256 řádků. První úsek zůstává bez vodorovného pohybu nepřátel podle originálu. Opravené jsou obraty na tmavém břehu PF1, střela sledující letadlo, pořadí kolizí a paliva, zničení nepřítele při nárazu, checkpointy, smrt a další odlet včetně třinácti VBI obnovy. Třináct původních PCM prostředků zachovává kanály výbuchu letadla, nepřítele, tanku a jeho střely. Výbuch letadla se při smrti už okamžitě nevypíná.

Prochází SHA-256 všech 268 288 referenčních řádků spolu se stavem generátoru, slotů a checkpointů, všech 952 vzniků tanku a 7 996 kroků celé původní herní smyčky. Součástí jsou 2 160 kroků se skutečnými kolizemi a střelbou; ostatní oddělují pohyb nebo cílené větve checkpointů. Dále prochází 25 herních a 11 zvukových kontrol, 960 izolovaných kroků NPC/tanku, 384 tankové a 144 vrtulníkové střely. Čistě vstupní replay prvního mostu má 1 860 bodů a čtyři letadla za 880 kroků. Brave potvrdil místní nové sestavení, začátek 5, střelbu, bodování, smrt a tlačítko pauzy. Úplné ruční dohrání všech úseků a fyzický gamepad/telefon se netvrdí; rozsah a rozdíly webového prostředí jsou v `research/river-raid/PORTING.md`.

Před změnou všech 95 živých souborů souhlasilo s minulým stagingem. Přibyly `generator.js` a přibližně 13kB `assets/original.js`, změnilo se šest souborů River Raidu a odstranil se nevyužitý `assets/course.js`. Zbývajících 88 souborů včetně katalogu a ostatních her je bytově shodných. Po úplné záloze se osm souborů atomicky zveřejnilo, HTML jako poslední, pak se odstranil starý datový export. Konfigurace ani služby se neměnily.

Sestavení má 96 veřejných souborů a 78 platných místních odkazů. Veřejné HTTPS potvrdilo **96 souborů přes SHA-256**, šest kanonických cest, MIME typy a sedm MP3 Range požadavků. Nezávislé stažení HTML hry a verzovaného `generator.js` z místního stroje rovněž souhlasí se sestavením. Ve webu nejsou ROM/XEX, video, pracovní RAM ani strojové obálky.

## Předchozí vydání — oprava soubojů River Raid

- Vydání: `20261026T193306Z`; **nasazené a ověřené přes HTTPS**.
- Hra: https://atari800.gmork.cz/hry/river-raid/.
- Archiv: `/private/tmp/atari800-portal-20261026T193306Z.tar.gz`; kopie na serveru ve `/var/tmp/`.
- SHA-256: `19af1bd6c4f8c98b48088b1258b1cbeb3b709c54594686894d8a61946c9d5c4f`.
- Staging: `/var/tmp/atari800-release-20261026T193306Z`.
- Úplná záloha předchozího webu: `/root/atari800-backups/20261026T193306Z/site-before.tar.gz` (94 souborů).

Výbuchy nepřátel zůstávají v původních slotech a posouvají se s řekou. Mosty mají silnici z původní tabulky barev a tank, jeho animaci, pohyb, zastavení a střelu; zničení mostu pod tankem přidělí původních 750 bodů. Nativní překlad zachovává aktualizaci NPC, první nehybný úsek, původní cykly a střelu vrtulníku. Počáteční rychlost 64 a umístění letadla/objektů byly opravené podle skutečného stavu XEX. **Celá hra stále není potvrzený převod 1:1**; zbývající odchylky jsou v `research/river-raid/PORTING.md`.

Prošlo 22 herních a osm zvukových kontrol, 960 kroků NPC/tanku, 384 kroků tankové a 144 kroků vrtulníkové střely proti XEX. Skutečný původní raster potvrzuje 160 řádků a umístění bitmap; nový čistě vstupní replay dokončí první most za 879 kroků s 1 200 body a čtyřmi letadly. Vykreslené snímky silnice/tanku byly vizuálně zkontrolované. Kontrola skutečného prohlížeče byla omezená nedostupným obsahem okna, úplné ruční hraní se netvrdí.

Před změnou všech 94 živých souborů souhlasilo s předchozím stagingem. Přibyl `mechanics.js`, změnily se pouze čtyři stávající soubory River Raidu; ostatních 90 souborů včetně portálu a ostatních her je bytově shodných. Po úplné záloze bylo pět souborů atomicky nahrazeno, HTML jako poslední. Sestavení má 95 souborů, 77 platných místních odkazů a neobsahuje původní programy či soukromé pracovní dumpy. Konfigurace ani služby se neměnily.

Veřejné HTTPS ověřilo **95 souborů přes SHA-256**, šest kanonických cest, MIME typy a sedm MP3 Range požadavků. Nezávislé stažení HTML hry a verzovaného `mechanics.js` z místního stroje také souhlasí se sestavením.

## Předchozí vydání — první River Raid

- Vydání: `20261026T133810Z`; **nasazené a ověřené přes HTTPS**.
- Nová hra: https://atari800.gmork.cz/hry/river-raid/.
- Archiv: `/private/tmp/atari800-portal-20261026T133810Z.tar.gz`.
- SHA-256: `ff4b7f2563802e187dc944575c0651bacf66e8761c650d6202676f225bc6c949`.
- Staging: `/var/tmp/atari800-release-20261026T133810Z`.
- Úplná záloha předchozího webu: `/root/atari800-backups/20261026T133810Z/site-before.tar.gz` (83 souborů).
- Herní změny: `43e87e2` a oprava průletného tmavého břehu `8ed7fd4`.

Nativní HTML5 River Raid přidává původní řeku, bitmapy a deset původních zvukových PCM klipů, směrové zrychlování a regulaci rychlosti, palivo, tankování, mosty/checkpointy, bodování, další letadla a dva střídající se piloty. Začátky 1/5/20/50 odpovídají původním seedům. Mapa obsahuje 268 288 řádků skutečného generátoru a 12 305 míst vzniku objektů. AI a některé soubojové časy jsou nové provedení, konec exportu ukončí webovou misi. Podrobný rozsah a hranice shody jsou v `research/river-raid/PORTING.md`.

Prošlo 18 herních a osm zvukových kontrol: mimo jiné 480 původních kroků řízení, 81 původních řekových řádků a vstupní replay prvního mostu s 1 670 body a všemi čtyřmi letadly. Brave zobrazil scénu a byl potvrzený začátek letu a ztráta letadla. Úplné ruční dohrání, subjektivní poslech a fyzický gamepad/telefon se nevydávají za ověřené.

Sestavení má 94 veřejných souborů a 76 platných místních odkazů. Proti předchozímu vydání přidává 11 souborů a mění pouze úvodní `index.html`; všech 82 ostatních předchozích souborů souhlasí s rekonstrukcí posledního Git vydání. Server před nasazením obsahoval stejných 83 souborů jako poslední ověřený staging a Apache byl aktivní. Po záloze bylo 12 nových/měněných souborů zveřejněno atomickým nahrazením, úvodní katalog jako poslední. Konfigurace ani služby se neměnily.

Po nasazení veřejné HTTPS ověřilo všech **94 souborů přes SHA-256**, šest kanonických cest, MIME typy a sedm MP3 Range požadavků. Nezávislé stažení místním klientem také potvrdilo shodný úvodní katalog, HTML nové hry a `engine.js`. Původní ROM/XEX, video, pracovní RAM a SAP obálky nejsou ve veřejném sestavení.

## Předchozí vydání — zvuky a netopýři Goonies

- Vydání: `20261024T111210Z`; **nasazené a ověřené přes HTTPS**.
- Archiv: `/private/tmp/atari800-portal-20261024T111210Z.tar.gz` — 83 veřejných souborů.
- SHA-256: `a160af4bcf88aa7daac524ac5568085752141afffd80b662d21881a3d09d785b`.
- Proti poslednímu ověřenému vydání se mění pouze osm souborů v `hry/goonies/`; ostatních 75 je bytově shodných.
- Staging: `/var/tmp/atari800-release-20261024T111210Z-clean`.
- Úplná záloha předchozího webu: `/root/atari800-backups/20261024T111210Z/site-before.tar.gz` (83 souborů).
- Herní změny: commit `4d12b1e`; nasazovací nástroj `/var/tmp/atari800-goonies-sounds-release.py` ověřil stav před zálohou a měněné soubory nahradil atomicky, HTML jako poslední.

Doplněné jsou skutečné původní požadavky tiskárny, uhašení krbu, věder/rumpálu/závaží, střelce, potrubí, kamene/zvonu, varhan, odtoku a lodního zdvihu/mincí. Přehrávač zachovává monofonii, priority, celý cyklus tiskárny a smyčku rumpálu. Hudbu vybírá původní tabulka místností. Opravená je záměna souřadnic za čísla tras netopýrů, přidělování volných slotů a časování kladiva.

Prošlo **57 herních a 14 zvukových kontrol**. Nových 1 466 úplných bitmap a posloupností zvukových požadavků zahrnuje všech osm scén, 40 kroků tiskárny, 420 kroků zvonu/hejna, výstřel a přesný okamžik zásahu netopýrem. Celkem se porovnává 2 744 bitmap a 1 280 kroků pohybu. Všech 19 PCM efektů i hudební soubory zůstaly původní. Podrobnosti a hranice ověření jsou v `research/goonies/PORTING.md` a `AUDIO.md`.

Před nasazením se všech 83 souborů serveru shodovalo s předchozím ověřeným vydáním; Apache byl aktivní. Po nasazení veřejné HTTPS ověřilo všech **83 souborů přes SHA-256**, pět kanonických cest, MIME typy a všech sedm MP3 Range požadavků. Nezávislé stažení HTML, `audio.js` a `rooms.js` z místního stroje také souhlasí se sestavením. Konfigurace ani služby se neměnily. Nové ruční odehrání přes Computer Use nebylo dokončeno kvůli chybě služby; neuvádí se jako provedená kontrola.

## Poslední ověřené veřejné vydání — oprava Goonies podle původního programu

- Vydání: `20261024T091931Z` (24. 10. 2026 v Praze).
- Hra: https://atari800.gmork.cz/hry/goonies/.
- Archiv: `/private/tmp/atari800-portal-20261024T091931Z.tar.gz`, serverová kopie ve `/var/tmp/`.
- SHA-256: `9571137f357ab546af8c20890df0bf2e3d6dc98a8f61a5c2e61632c3505fb9fc`.
- Čistý staging: `/var/tmp/atari800-release-20261024T091931Z-clean`.
- Záloha předchozího webu: `/root/atari800-backups/20261024T091931Z/site-before.tar.gz` (78 souborů).

Odhadovanou fyziku a plošiny nahradil nativní překlad původního pohybu, skutečné kolizní obdélníky včetně stěn/stropů a scénické tabulky. Židle se pohybuje pouze při tlačení, fáze sprite odpovídá poloze; opravené jsou role postav a Slothovy snímky, původní východy, tři ventily, tlakové desky varhan, pohyb věder/kamene/klece, vejce, lodní průlezy, zdvih i protivníci. Podrobnosti a hranice shody: `research/goonies/PORTING.md`.

Prošlo **34 herních a osm zvukových kontrol**. Herní reference zahrnují 1 280 kroků pohybu z XEX a 1 278 kompletních bitmap 320×176 z ATR, současně s pozicemi hráčů a kolizemi. Dům a potrubí byly vyřešené novými skutečnými směrovými replayi s pěti životy. Celá osmiscénová výprava nebyla ručně dohraná; řízené testy ostatních mechanismů se za úplný průchod nevydávají. Starý replay varhan na odhadované geometrii byl odstraněný.

Před změnou se všech 78 živých souborů shodovalo s minulým stagingem. První balíček byl ještě před změnou webu odmítnut kvůli přidaným metadatům macOS; čistý archiv má přesně 83 souborů. Po záloze bylo v Goonies přidaných pět JS/datových souborů a vyměněné čtyři stávající, HTML jako poslední. Zbývajících **74 souborů je bytově shodných**. Úvodní portál, Dynakillers, International Karate i Archon se neměnily. Opravené skripty mají v HTML nový verzovací parametr pro cache.

Po nasazení souhlasí všech **83 souborů přes HTTPS**, všech pět kanonických cest, MIME typy a sedm MP3 Range požadavků. Úplná HTTP kontrola proběhla ze serveru přes veřejnou doménu; místní curl navíc nezávisle ověřil veřejný herní index a verzovaný `rooms.js`. Místní Python měl omezené DNS, proto se nepoužívá jako důkaz vzdáleného ověření. Apache je aktivní. Místní sestavení ověřilo 63 interních odkazů a nepřítomnost disků/RAM dumpů. Konfigurace, služby ani oprávnění přístupu se neměnily.

## Předchozí vydání — první adaptace The Goonies

- Vydání: `20261024T070949Z` (24. 10. 2026 v Praze).
- Portál: https://atari800.gmork.cz/ — čtyři hry včetně střídání hlavního náhledu.
- Hra: https://atari800.gmork.cz/hry/goonies/.
- Archiv: `/private/tmp/atari800-portal-20261024T070949Z.tar.gz`, serverová kopie ve `/var/tmp/` se stejným názvem.
- SHA-256: `1a0c005fc00e962c19625825380be5a8bc649f609fcfbe7b13caa2f0186c3d7e`.
- Staging: `/var/tmp/atari800-release-20261024T070949Z`.
- Záloha: `/root/atari800-backups/20261024T070949Z/site-before.tar.gz`.

Před změnou se všech 53 veřejných souborů shodovalo s předchozím stagingem. Záloha prošla kontrolou gzip a přenesený archiv odpovídá místnímu SHA-256. Nejdřív byla přidaná nová hra a náhled/logo katalogu, potom atomicky vyměněný úvodní index. Kromě úvodního indexu je všech 52 souborů předchozího vydání bytově shodných; zdroje a běžící soubory předchozích her se neměnily. Konfigurace a služby se neměnily.

The Goonies je nativní HTML5 adaptace všech osmi scén s původními pozadími, bitmapovými snímky, titulní a závěrečnou obrazovkou, dvěma hudebními smyčkami a 19 původními efekty. Sólo střídá dvě postavy, volitelně mohou hrát dva lidé současně. Přidaný je trénink místností a česká nápověda. Geometrie, fyzika, časování hádanek, bodování a jednodušší nepřátelé jsou nová implementace. Některé původní vedlejší pasti a střelecké skripty nejsou přenesené; jde o první hratelnou verzi. Podrobnosti a zdroje: `research/goonies/PORTING.md`.

Tehdejších 30 herních kontrol používalo odhadovanou geometrii a neprokazovalo shodu s originálem; byly nahrazené současnými referenčními testy. Prošlo také osm zvukových a 87 dosavadních kontrol. Dům a vodní varhany prošly skutečnými směrovými a přepínacími vstupy s pěti životy bez teleportů či přepsání příznaků. Místní Brave ověřil načtení přes `file://`, spuštění, původní postavy a scénu, přepínání a pauzu. Úplný ruční průchod všech osmi místností, samostatný poslech ani fyzický telefon/gamepad se nevydává za ověřené.

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
