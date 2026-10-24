# The Goonies — podklady pro nativní webový přepis

## Co je ověřené a odkud

- Uživatelem dodaný `Goonies/Goonies_SOLUTION.TXT`: řešení scén 1–5, 7 a 8; šestá chybí. Jeho směrové popisy místy neodpovídají dodanému Atari videu.
- Uživatelem dodané `Goonies/The Goonies Playthrough (Atari XL⧸XE) [PZRqQE76Nc0].mkv`: přímé pozorování průchodu, pořadí místností, umístění plošin a hlavních objektů, doplnění šesté scény.
- [Původní manuál Datasoft / American Action, včetně Atari XL/XE a diagramu ovládání](https://uta.pokefinder.org/Ultimate_Tape_Archive/Goonies%2C_The_%281986_American_Action_AB%29_%5B6951%5D/Extras/Instructions.pdf), zejména strany 4–6. Jde o původní Datasoft hru, nikoli pozdější Konami titul.

`scenes.json` obsahuje všech osm scén v pořadí videa, jejich objekty, průchod a přibližnou geometrii. **Nejde o vytaženou původní kolizní mapu.** Souřadnice jsou ručně odměřené z videa; jednotlivé hrany mohou potřebovat posun asi 2–8 nativních bodů. Časy mechanismů, délky skoků a některé vnitřní vazby objektů nejsou potvrzené z assembleru.

## Souřadnice a pořadí scén

Video má 672 × 480. Herní výřez po zmenšení na polovinu je x=8..327, y=32..207. V JSON používáme **320 × 176**, počátek vlevo nahoře:

`nativeX = videoX / 2 - 8`, `nativeY = videoY / 2 - 32`.

U plošiny znamená y její pochozí horní hranu, tedy polohu chodidel. Objekty mají interakční bod, nikoli nezbytně levý horní roh bitmapy. Žebříky mají střed x a horní/dolní y. Dynamické podpěry jsou označené samostatně.

| Scéna videa | Obsah | Čas ve videu | Původní room ID |
| --- | --- | --- | --- |
| 1 | Dům, tiskárna a krb | přibližně 10–48 s | 0 |
| 2 | Jeskyně s vědry a klíčem | 50–108 s | 2 |
| 3 | Potrubní labyrint | 110–175 s | 1 |
| 4 | Kameny, padací dvířka, zvon | 176–342 s | 3 |
| 5 | Lebka, pták a vejce | 343–471 s | 4 |
| 6 | Vodní varhany | 473–526 s | 5 |
| 7 | Chobotnice a ploutve | 528–606 s | 6 |
| 8 | Pirátská loď | 608–716 s | 7 |

Od 718 s běží vítězná obrazovka. Hranice byly zjištěné porovnáním snímků po jedné sekundě; přechodové černé snímky mohou posunout přesnou hranici asi o sekundu. **Room ID 1 a 2 jsou oproti pořadí tohoto videa prohozené.** Grafické podklady je potřeba přiřadit podle obsahu, ne pouze podle čísla.

## Ovládání a společná pravidla

Původní joystick: vlevo/vpravo běh, nahoru skok nebo lezení, šikmo nahoru skok do strany, dolů lezení dolů. **Fire přepíná ovládání mezi dvěma postavami.** Není to střelba ani obecné tlačítko použití. Space pozastavuje, S zapíná/vypíná hudbu. Původní manuál neuvádí zvláštní skrčení, útok, zvednutí ani hození předmětu. Interakce proto vycházejí z přiblížení, tlačení tělem, skoku, stání nebo zavěšení. [Diagram a Atari ovládání v manuálu](https://uta.pokefinder.org/Ultimate_Tape_Archive/Goonies%2C_The_%281986_American_Action_AB%29_%5B6951%5D/Extras/Instructions.pdf)

Při přepnutí musí druhá postava **zůstat ve svém postoji a držet zachycenou interakci**: tiskárnu, kliku, ventil, řetěz, kost, závaží či závěsnou tyč. „Hold“ v JSON tedy není požadavek, aby neaktivní postava dostávala stále stisknuté nahoru. Je to stav, který trvá do uvolnění/pohybu po opětovném převzetí postavy. Jinak by řešení většiny scén jedním joystickem nefungovalo.

Scény 1–7 vyžadují odchod **obou** dětí. První dítě lze u výstupu bezpečně označit jako odešlé a pokračovat s druhým. V poslední scéně je partnerem Sloth a cílem je společný příchod k pokladu. Původní manuál uvádí 1000 bodů za opuštěnou obrazovku a závěrečný bonus podle postav v záloze; přesný systém přidělování životů není v této rešerši odvozený.

## 1. Dům Fratelliových

Z horního obytného podlaží je potřeba posunout židli doprava pod půdní otvor. Stoupnutí na židli zpřístupní vyšší žebřík do půdy. Tam první dítě obsluhuje tiskárnu: vyhazované peníze drží Matku Fratelliovou venku. Druhé dítě může sestoupit do sklepa a převrhnout/posunout zásobník vody ke krbu. Uhašením vznikne průchod do podzemí. Nejprve jím projde sklepní dítě, potom musí operátor tiskárnu pustit a rychle se k němu připojit.

Hlavní body: židle zhruba (80,68), cíl kolem x=200; půdní žebřík (216,32–68); tiskárna (248,32); zásobník vody (54,143); krb/výstup (80,143). Matka se po skončení vyhazování peněz vrací. Přesný čas návratu musí být implementační parametr, není z videa jednoznačně změřený.

## 2. Vědra, plovák a klíč

Jeden pomocník sestoupí ke spodní klice kolem (112,168). Jejím držením zvedá kamennou překážku v prostřední komoře. Druhý vstoupí k plovoucí kouli, využije ji a výstupek k dosažení horního zábradlí a postupuje pod pohyblivými vědry ke klíči napravo. Potom sleze pravým žebříkem k dolním dveřím. Pomocník může kliku pustit až poté, co sběratel bezpečně prošel pod kamenem; následně také dojde ke dveřím.

Podstatná vazba je **klika → zvednutý kámen → přístup k plováku/klíči**, nikoli pouhé okamžité přidání klíče po dotyku kliky. Plovák je prostředek k pohybu, výstup se odemyká získáním klíče. Přesná zdvižená výška kamene a dynamika hladiny/koule nejsou z kódu potvrzené. Klíč přibližně (264,64), spodní dveře (192,168). Hrozí vědra, voda a netopýr.

## 3. Potrubí

Děti musejí uzavřít dva odtokové ventily: levý ve střední komoře přibližně (164,122) a horní pravý (248,58). Souběžné uzavření zvýší tlak a prorazí potrubí u pravého výstupu. Po prasknutí má zůstat cesta otevřená, aby oba pomocníci mohli svoje stanoviště opustit. Odchod je vpravo po střední pravé podestě, přibližně (312,104).

Fratelli střílí z horní galerie. Čas potřebný k prasknutí a přesné časy páry jsou v JSON označené jako přibližné. Cílem není postupné jednorázové „sebrání“ dvou ventilů bez potřeby spolupráce.

## 4. Kameny a zvon

Na spodní mechanismus/závaží se postaví menší dítě a zůstane tam. Druhé ovládá řetězy a otevírá padací dvířka, aby správně směrovalo valící se kameny. Nestačí otevřít všechny průchody: důležitý je okamžik a směr kamene. Podle řešení má kámen na prvním podlaží jet zprava doleva a odrazit se; na druhém propadnout při pohybu zleva doprava a na třetím při pohybu zprava doleva.

Tři správné průchody spodním vedlejším žlábkem odstraní tři prkna, která blokují dolní levý únik. Kladivo se mezitím blíží ke zvonu; zvon vypouští smrtelný roj netopýrů. Po odstranění prken musí dolů oba. Polohy jednotlivých řetězů, vazby řetěz–dvířka a krokování míče jsou v JSON **návrhem funkčního přepisu**, nikoli potvrzenou původní fyzikou. Umístění dolního mechanismu a složité šikmé plochy zejména vyžadují ověřit při hraní.

## 5. Lebka a geometrická vejce

Pták shazuje vejce; děti je dostávají do spodní pravé místnosti a vytvářejí z nich schůdky k vyššímu výstupnímu okraji. Druhá postava musí obsloužit kost zavěšenou v horní pravé části, která ovlivňuje mosty/mechanismus skládání. Základní způsob manipulace je kontextový kontakt/tlačení a pád přes okraje; originální manuál nemá samostatné tlačítko nesení či hodu. Přesný přechod mezi tlačením a případným automatickým zachycením vejce nebyl odvozený z kódu.

**Oprava směru z textového řešení:** dodané Atari video má hromadu a výstup **vpravo dole**, ne vlevo dole. Na konci je zřetelný sloupec přibližně x=264, od y=170 směrem nahoru k pravé plošině y=124. Úspěšné operace navýší skóre 4905 → 5105 po čtyřech přírůstcích po 50; návrh přepisu proto používá **čtyři vejce**. Zásadní je, aby šlo hromadu opravdu fyzicky použít ke stoupání, nikoli po čtvrtém vejci jen libovolně odemknout nesouvisející dveře.

Horní pravá kost je kolem (264,16), pod ní je miska/pružná plocha kolem (264,80), odkud je potřeba dosáhnout vysoko. Žebříky kolem lebky a malé můstky dávají přístup do jednotlivých komor. Dole je malá lávová mezera; výstup zvládnou děti přeskočením a vystoupáním po vejcích. Hrozí také létající lebka.

## 6. Vodní varhany — doplněno z videa

V chybějící scéně **není nutné znát nebo zadávat hudební melodii**. Uprostřed je kostěný varhanní mechanismus se třemi barevnými klávesami. Kapky a klávesy souvisejí se střídáním modrých, bílých a červených krátkých podpěr nad spodní vodou. Je potřeba časovat skoky a sestup po těchto podpěrách.

Přímo ve videu:

- 473–483 s: první dítě se dostane přes levé barevné podpěry na střední plošinu a čeká u horního konce žebříku, přibližně (128,104).
- 484–499 s: druhé dítě projde levou částí a přes střed se vydá na pravé podesty.
- 500–510 s: první příchozí na pravé straně sestoupí k bezpečnému dolnímu pravému výstupku.
- 511–526 s: poslední dítě opustí střední stanoviště, přejde pravou část a připojí se k němu. Přibližně u (304,152) potom oba odejdou.

Pro přepis dává smysl společný barevný řadič čtyř pater levých krátkých podpěr a bezpečná střední plošina u žebříku. **Přesné fáze, perioda a přímá souvislost jednotlivé kapky s příslušnou podpěrou nebyly z RAM vyčtené.** JSON je zde popisovaná aproximace pozorovaného průchodu. Zavřená/otevřená mříž pod varhanami není místem, kterým ve videu děti opouštějí scénu; není podložený požadavek zadávat noty nebo odemykat melodickou sekvenci.

## 7. Chobotnice

Zavěšená kost nahoře uvolní klec do spodního proudu. Druhé dítě si na klec stoupne nebo se na ní sveze, čímž dosáhne uzamykací tyče pod dvojicí modrých ploutví. Zavěšením tyč odjistí. První dítě může pustit uvolňovací kost, dostat se na pravou ploutev a opakovaně na ní poskakovat, zatímco druhé dál drží tyč. Mechanismus snižuje vodu u chobotnice, která klesne a přestane blokovat cestu.

Uvolnění klece a úspěšné vypuštění je vhodné zachovat jako trvalý stav; samotná tyč vyžaduje držení. K dosažení horních stanovišť slouží žebříky, závěsná zábradlí a odraz ploutví. Po poklesu hladiny odejdou oba na pravý výstupek kolem (304,116). Přesný počet odrazů není odvozený; navržená hodnota tři je označená jako implementační parametr.

## 8. Pirátská loď

Spolupracují dítě a Sloth. Dítě nejprve sestoupí do spodní/střední kabiny a přestaví páku, aby otevřelo Slothovi průchod. Sloth projde dalšími dveřmi do horní levé kajuty, kde obslouží druhou páku. Pak se dostane k pravému hornímu pokladu a posune truhlu doprava. Vypadlé mince odlákají Matku Fratelliovou a ta zmizí z paluby.

Dítě se postaví na ráhno vyčnívající ze stěžně, přibližně x=176–200, y=76. Sloth se vrátí k první spodní páce a znovu ji přepne. Ráhno s dítětem stoupne přibližně na y=58. Dítě z jeho konce doskočí na horní pravou palubu k pokladu. Sloth se tam po průchozích podlažích a žebřících také připojí; nestačí, že truhlu získá pouze jeden.

Závěrečné snímky 712–716 s přímo potvrzují dítě čekající na pravé horní palubě a Slotha, který za ním šplhá a doskakuje. Přesná kolizní geometrie dveří a všechny vazby poloh pák nebyly vyčtené z původního programu, proto JSON označuje jejich propojení jako aproximaci. Nosná posloupnost **dvě páky → Slothova truhla/mince → dítě na ráhno → Sloth první páka → společný poklad** je podložená řešením a videem.

## Doporučení pro ověření hratelnosti

Při ladění projít celý průchod každé scény s oběma postavami, včetně cesty zpět od drženého mechanismu k výstupu. Největší rizika jsou příliš velké mezery při skoku, nedosažitelná zavěšená kost, pomocník uvězněný za vlastní zavřenou bránou a smazání jeho drženého stavu při přepnutí. Zde uvedená čísla sama o sobě nejsou důkazem, že navržené kolize již umožňují kompletní průchod.
