# Karateka — nativní webová verze

Stav 30. 10. 2026: propojená nativní webová kampaň, publikovaná po schválení.
**Není označena za dokončený převod celé hry 1:1.**

Původní pokyn nezařazovat hru automaticky do portálu platil během společného
ladění. Uživatel následně schválil vydání („je to perfektni, nasad ji“).
První vydání `20261030T062042Z`, zdrojový commit `5701e6b`, je na Gitu i veřejném
webu; Karateka je osmou hrou českého/anglického katalogu. Ostatních sedm her
zůstalo bytově shodných. Zálohu a veřejné kontroly dokumentuje
[`DEPLOYMENT.md`](../../DEPLOYMENT.md).

- <https://atari800.gmork.cz/hry/karateka/> — česky;
- <https://atari800.gmork.cz/hry/karateka/?lang=en> — anglicky.

Otevření přímo ze souboru:

- `karateka/index.html` — česky;
- `karateka/index.html?lang=en` — anglicky.

Tlačítko Hrát začne u útesu. Původní úvod přehraje titulní obrazovku a prolog;
každou scénu lze přeskočit. Jsou připojeny všechny čtyři banky, kamery,
příchody stráží, brána, oba rozdílní jestřábi, dveře, Akuma a Mariko.
Zvuky, hudba a šest filmových scén pocházejí z programu na dodaném ATR.
Žádná část herních pravidel nebyla odvozena pouze z dodaného videa.

## Autorita a povolená výjimka

`Karateka.atr`, 92 176 B, SHA-256:
`4db2200ce3fbefa109f337fe835fc0fbd7efd1144f598e14aafffb62e256d675`.
Původní ATR se nezměnilo. MKV `Karateka [1984] [ivpV-MXiND8].mkv` je pouze
pomocná reference vzhledu a barev; neobsahuje celý závěr hry.

Uživatel povolil svižnější tempo/odezvu této konkrétní hry. Volby 8/12
herních kroků za sekundu (výchozí 12) jsou záměrná nastavení webu. Žádná se
nevydává za změřenou rychlost celé původní hry. Původní blokující čekání a
film/hudba používají čas NTSC, přibližně 59,9227434 snímků/s.
Výjimka nedovoluje vymýšlet pravidla, vynechat nástrahy nebo zjednodušit AI.

## Běhová architektura

`index.html` načítá `app.js`, `campaign.js`, `stage1.js`–`stage4.js`, pravidla,
kompozitor a zvuk. Všechny herní stavy a rozhodování jsou běžný JavaScript.
**CPU, interpret instrukcí, ATR/ROM ani emulovaný OS nejsou součástí webu.**
Atari800 a py65 slouží pouze offline při rozboru, exportu grafiky/zvuku a
přípravě referenčních výstupů. Assety obsahují grafická data, geometrii,
PCM a MP4, nikoli spustitelný původní program.

`fight.js` a `preview.js` jsou starý izolovaný souboj pro vývoj. Aktuální
HTML je nenačítá; nejsou motorem nové kampaně.

Kompozitor sestavuje původní 160×153 bitmapu s maskami/OR/COPY operacemi,
poté ji převádí do 320×240 obrazu s oddělenými paletami. Finální protivník
má vlastní kompozici i samostatnou masku pod nohama. Skriptované obrazy
Mariko a závěrečný text byly vyhodnoceny offline z původních grafických rutin.
Nepodporovaná póza speciálního protivníka vyvolá chybu; není nahrazena jiným
sprite. Její úplnou nedosažitelnost za všech herních vstupů zatím neprokazujeme.

Přechody bank používají původní inicializátory. Například poslední banka
znovu inicializuje postavy a zachová pouze původně přenášená pole; nepřenáší
celou bojovou pózu z podzemí. Tato chyba i příznak první stráže podzemí byly
nalezeny novým porovnáním inicializátorů a opraveny.

## Zvuk a filmové scény

`audio.js` přehrává originální PCM efekty a cue 16–26. Hudba má přednost před
běžnými efekty. Dvoupárový efekt přepíše oba joined hlasy, jednopárový efekt
4/13 pouze první. Brána může přerušit hudbu. Pauza zastaví i audio; herní
čekání samo hudbu nezastavuje. Hra nečeká na vyřízení browserového povolení
zvuku — čekající `AudioContext.resume()` nesmí zablokovat start.

Normálně zní plný původní PCM mix. Pokud jednopárový efekt přeruší dvoupárový,
pokračuje druhý pár z odděleného offline stemu ve stejném časovém posunu.
**Součet stemů není totožný s plným MZ POKEY záznamem:** relativní RMS rozdíl
u zachycených dvoupárových efektů je 0,017–0,207. Příčina mixu/fáze není
zcela oddělena. Tuto vzácnější větev tedy neoznačujeme za zvukově 1:1.
Podrobnosti a hashe jsou v `assets/audio-provenance.json`.

Kontinuální efekt 8 používá nativní poly5/poly17 a trvale běžící čítače,
nikoli krátkou PCM smyčku. Při dvou hlasech zatím sdílí fázi; úplná shoda
s analogovým/mixovaným zvukem POKEY nebyla změřena. HTTP používá AudioWorklet,
`file://` má fallback se stejným generátorem. Skutečný HTTP/worklet běh a
fyzický gamepad zatím nebyly zkoušeny.

Filmy jsou offline obrazové/zvukové záznamy z ATR, ne výřezy dodaného MKV.
Uživatel před publikováním zkrátil začátky klipů `court`, `palace-intro`
a `court-palace`. Časování i hashe odpovídají upraveným souborům.
Původní údaje exportu zachovává
`untrimmedCapture` v provenance. Obraz palácového úvodu trvá 4,456 s,
pozdější scéna s Mariko 7,746 s; konec hudby je vedený samostatně.
`assets/movies/provenance.json` a `assets/movies.js` rozlišují konec obrazu a
konec zvuku: po konci obrazu se obnoví nativní hra, hudba může ještě doznít.
Nová hudba nebo brána tento dozvuk přeruší. V prohlížeči byl zkoušen start,
přeskočení titulku/prologu a pauza; všechny přirozené konce filmů nejsou
ručně odehrané při každé volbě tempa.
Po opravě přehrávače v Edge přirozeně doběhl titulek i prolog. V samostatném
testu přehrávače s veřejnými prostředky doběhly oba palácové klipy (naměřeno
4,464 a 7,746 s obrazu); tento test neodehrává příchod do paláce.

Přehrávač čeká na dokončení vlastního `play()` požadavku a dostupná data,
než vyhodnotí konec obrazu. Událost konce předchozího klipu nesmí ukončit
nový klip ani zrušit jeho dozvuk. Mezi titulkem a prologem zůstává video
neprůhledné a viditelné; během načítání neodhalí herní plochu.

Při dalším ověření se chyba podařila zachytit v Safari: původní zkrácené
`court` a `palace-intro` začínaly událostí `playing` až na čase 3,872 s.
Z palácového úvodu pak zbývalo přibližně 0,85 s včetně načítání. Klíčový
snímek zůstal před nulou v zahazovaných paketech; Edge dokázal potřebné
snímky před začátkem dekódovat, Safari přešlo na další klíčový snímek.
Tři střižené klipy proto mají nové kódování H.264 High/CRF 1 s klíčovým
snímkem přesně v čase nula, bez B snímků a s kopírovanými AAC pakety.
Zůstává všech 494 / 267 / 464 dekódovaných obrazů, střih i původní zvuk.
Rozdíl délky obrazové stopy je nejvýše 2,696 ms (méně než jeden NTSC snímek).
Původní uživatelovy MP4 jsou dohledatelné v předchozím Gitu a v
`/private/tmp/karateka-user-edits-before-safari/`; jejich hashe zachovává
`userEditedSource` v provenance. Parametry nového kódování zaznamenává
`webEncoding`; obraz je znovu komprimovaný, nikoli bytově shodný s původním
MP4. Obsah záběrů nebyl nově stříhán.
Po opravě byly všechny tři klipy v Safari zkoušeny ve stejné návaznosti:
událost `playing` už vždy nesla čas 0,000 s. Palácový úvod trval 4,573 s
včetně načítání (poslední pozorovaný čas média 4,459 s), místo původních
0,850 s. Jde o cílený test přehrávače s nativní kampaní; přechodové události
jsou v této prohlížečové pomůcce vyvolané, nejde o ručně odehranou kampaň.

## Ověření a jeho hranice

Příkazy:

```sh
node tools/test-karateka.mjs
node tools/test-karateka-integration.mjs
node tools/test-karateka-movies.mjs
node tools/test-karateka-entry.mjs
```

Poslední sada vyžaduje `ffprobe`: kontroluje skutečné délky a hashe všech
šesti MP4, zpožděné načítání, přirozený konec titulku/prologu, palácové
scény při 8/12 krocích/s, zvukový dozvuk, pauzu, přeskočení a restart.
Kontroluje také první použitelný klíčový snímek v nule. Sada `entry`
prochází nativní kampaň přes klávesové události skutečného `app.js` při
obou rychlostech, bez vkládání události přechodu nebo změn herního stavu;
prohlížeč a média jsou v tomto testu simulované.

Obě sady prošly. Celkem **148 200 porovnání** původních rutin a vybraných
stavů/inicializací, nikoli 148 200 kroků celé hry:

| Oblast | Porovnání |
|---|---:|
| Animace a spotřebování vstupů | 16 000 |
| AI a pořadí RNG | 12 000 |
| Kontakt/dosah úderů | 10 080 |
| Brána | 10 000 |
| Jestřáb podzemí / paláce | 16 000 / 10 000 |
| Bitmapa / společné postavy | 2 200 / 2 600 |
| Kamera / zásahy a energie | 18 000 / 12 000 |
| Pozadí tří bank | 720 |
| Původní klávesové povely | 12 000 |
| Část hlavní smyčky bank 1/2/3/4 před kreslením | 6 000 / 4 000 / 7 000 / 5 000 |
| Speciální kompozice finálního protivníka | 1 200 |
| Dopady, jestřábí vrstvy a tělo pod bránou | 1 300 |
| Samostatná maska finálního protivníka | 500 |
| Volba DLI palety u útesu | 1 000 |
| Inicializátory bank a zachovaná pole | 600 |

Navíc: 240 úplných sekvencí příchodu/přiblížení stráže v bankách 1/2,
celkem 2 558 prezentovaných snímků. Původní rutiny v tomto testu běží až
k jednotlivým předáním obrazu; ověřují se pózy, souřadnice, kamera, výběr
kreslené postavy a návrat do herních souřadnic. Pixelové/audio rutiny jsou
v tomto konkrétním testu vynechané.

Dále: 1 500krokový běh nativních vstupů od útesu do paláce včetně
vykreslování; kouřové zkoušky pozdějších bank; hashe PCM, přerušování hlasů,
přednost hudby, pauza a nezávislost noise na velikosti audio bloku;
regrese startu při čekajícím audio povolení a přeskakování scén.

Microsoft Edge `file://`: viditelně načtené CZ/EN rozhraní, start hry,
původní úvod, přeskočení scén, pauza/pokračování, ztlumení a klávesový
pohyb/souboj. Fyzický gamepad a mobilní dotykové zařízení nebyly k dispozici.

**Dosud chybí souvislé porovnání celé vítězné hry od útesu po závěr proti
běžícímu originálu.** Části hlavní smyčky mají v referenčních testech vynechané
blokující filmy, příchody a/nebo kreslení; samostatně se ověřují jinými testy.
Úspěšné izolované porovnání neprokazuje jejich úplnou návaznost. Kompletní
raster včetně historie obou bufferů, všechny filmové přechody, celkové audio
časování a všechny dosažitelné koncové stavy zůstávají předmětem ladění.

## Reprodukce referencí

Vývojové závislosti zůstávají mimo veřejný runtime: Atari800 s monitorovými
rozšířeními a Python s py65. RAM dumpy a savestaty jsou mimo Git i web.

```sh
python3 tools/karateka_capture.py --emulator /cesta/k/atari800 --output /tmp/karateka-capture
python3 tools/karateka_extract.py --memory /tmp/karateka-capture/scene-1-active.bin
python3 tools/karateka_oracle.py --memory /tmp/karateka-capture/scene-1-active.bin
python3 tools/karateka_presentation_oracle.py --scene1 /tmp/scene1.bin --scene2 /tmp/scene2.bin --scene3 /tmp/scene3.bin
python3 tools/karateka_initializer_oracle.py --scene2 /tmp/scene2.bin --scene3 /tmp/scene3.bin --scene4 /tmp/scene4.bin
python3 tools/karateka_palette_oracle.py --memory /tmp/scene1.bin
python3 tools/karateka_extract_special_mask.py --memory /tmp/scene4.bin
```

Ostatní `tools/karateka_*` mají své parametry v `--help`. Původní dev audio
patch je `atari800-offline-record.patch`; předpokládá dřívější DUMPSCREEN.
DLI barvy mají číselný podklad v `palette-registers.json`; `reference.act`
obsahuje zvolenou prezentační paletu kontrolovanou proti videu.

Monitor Atari800: `$3000` je loader, nikoli smyčka. `SHOW` vypisuje registry;
`R` spouští rutinu. `BLINE 999` vypíná řádkový breakpoint. Opakované CONT na
stejném BLINE neposune celý snímek; pro snímky střídat řádek 0 a 248.
DUMPSCREEN používat po dokončení viditelného rastru. Metoda `run_to()` vypíná
BLINE před během k PC. Existenci savestatu kontrolovat před LOADSTATE.

## Doplňkové zdroje

- Manuál Brøderbund Atari/C64: <https://www.atarimania.com/8bit/files/Karateka_Broderbund_Software.pdf>
- Poznámky k XEGS cartridge: <https://github.com/Miasmark/Karateka-XE-to-7800-port>

Cartridge se liší rozložením segmentů; poznámky obsahují i později opravené
hypotézy. Autoritou zůstává dodané ATR a jeho rutiny.

## Oprava podle záznamu uživatele (29. 10. 2026)

Záznam `Záznam obrazovky 2026-10-29 v 18.42.21.mov`, přibližně 12.–13. s,
ukázal hráče omylem kresleného ve sledovacím záběru stráže. Originál v tomto
záběru kreslí pouze stráž. Poslední snímek záběru se musí zobrazit před
obnovením skutečných herních souřadnic. `renderState` nyní uchovává tento
snímek, včetně okamžiku návratu procedury; hra pokračuje až dalším krokem.
Hráč ani jestřáb se v záběru nekreslí a během něj neběží kolize ani AI souboje.

Nové reference také odhalily původní posloupnost venkovního zkracování
náběhu 14, 12, 10, 8, 6, 6… (před opravou port nastavil místo poslední 6
hodnotu 5). Palác má vlastní pevnou délku 14. Hranice příchodu stráže
v paláci nyní respektuje i příznak zapnutého jestřába podle `$ADFD`.

Na přání uživatele jsou v CZ i EN nabídce pouze **8 a 12 kroků/s**, výchozí
12. Hodnoty 18 a 24 byly z aktivního rozhraní odstraněny. Změna tempa
nepřepisuje původní vnitřní počítadla ani čekání v NTSC video snímcích.

## Oprava hromadění vstupů po souboji (29. 10. 2026)

Webový sběr kláves měl FIFO `edges`, do něhož se při rychlém mačkání během
blokujících hit pauz ukládaly jednotlivé stisky. Nyní má pouze jeden poslední
čekající povel: původní IRQ `$1107–$1117` zapisuje kód do `$DD` a příznak do
`$DF`, klávesová rutina `$6E78` jej spotřebuje, nemá frontu minulých stisků.

Na výslovnou žádost uživatele se při přechodu protivníka z živého do poraženého
navíc vyčistí čekající/held útoky webového ovládání a native vstupní příznaky
pěsti/kopu. Již probíhající pohyb ani jeho animace se nepřepisují. Nové stisky
po souboji fungují dál, včetně kopání dveří a brány; nejde o zákaz útoků bez
živé stráže. Dříve držené gamepad fire musí být uvolněno, jeho uvolnění samo
nepřidá starý punch. Soubojové, AI a animační rutiny zůstaly beze změny.

Integrační test skutečného `app.js` pokrývá 60 rychlých stisků, hit pauzu,
8/12 kroků/s, vyčištění původních pending příznaků při porážce, zachování
pózy, potlačení held/autorepeat, nový samostatný kop a uvolnění gamepadu.
