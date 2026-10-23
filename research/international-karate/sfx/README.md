# Původní digitální zvukové efekty International Karate

Všech šest efektů je vytažených přímo z paměti po nabootování uživatelem dodaného `International Karate.atr`. Neobsahují hudbu ani ruchy vystřižené z videa. Původní ATR zůstal beze změny.

## Původ a dekódování

- Původní vstupní rutina `$3A89` přijímá ID v registru X, rozsah 0–5. Efekty povoluje `$55 != 0`; při `$619D != 0` se nespustí.
- Tabulka koncových stránek je `$3A71`, tabulka počátečních ukazatelů `$3A77` (dva byty na ID), příznaky horního/spodního nibblu `$3A83`.
- IRQ rutina `$3AED` před čtením inkrementuje ukazatel na `$3B27–$3B28`. První byte tabulkového rozsahu tedy úmyslně přeskočí. Na hranici koncové stránky skončí bez jejího přečtení.
- Hodnota je buď posunutá čtyřikrát doprava (`LSR`), nebo maskovaná `AND #$0F`. Následuje `ORA #$10`, tedy režim pouze hlasitosti. Původní `$3B2F/$3B32/$3B35` zapisují stejnou amplitudu do `AUDC1/AUDC2/AUDC3`.
- `AUDF1=$0F`, `AUDCTL=$00`, timer 1 IRQ: nominálně **448 PAL CPU cyklů na vzorek**, tj. `1773447 / 448 = 3958.5870535714284 Hz`. Skutečná obsluha přerušení může být opožděná DLI/krádeží DMA cyklů; tato drobná nepravidelnost ve webovém PCM není simulovaná.

| ID | Přečtený rozsah | Nibble | Vzorků | Nominální délka |
| --- | --- | --- | --- | --- |
| 0 | `$9F01–$A5FF` | horní | 1791 | 0,4524 s |
| 1 | `$A601–$ABFF` | horní | 1535 | 0,3878 s |
| 2 | `$AC01–$ADFF` | horní | 511 | 0,1291 s |
| 3 | `$9F01–$A4FF` | spodní | 1535 | 0,3878 s |
| 4 | `$A501–$AAFF` | spodní | 1535 | 0,3878 s |
| 5 | `$AB01–$AFFF` | spodní | 1279 | 0,3231 s |

Horní/spodní amplitudy sdílejí stejné paměťové byty; nejde o šest posloupností celých bajtů přehrávaných nezávisle. Nástroj prověřuje SHA-256 celého původního sample RAM `$9F00–$AFFF`, aby odmítl omylem upravený pracovní dump.

## Výstupy

`karate/assets/sfx.js` definuje `globalThis.KARATE_SFX`: `encoding: "u8"`, `sourceSampleRate` a pole šesti objektů `samples`. Každý objekt má původní `id`, `data` jako base64, `duration`, původní adresy a příznak nibblu. Každý exportovaný byte je **přesně původní čtyřbitová amplituda × 17**, bez ztrátové komprese. Hodnoty 0–255 tak zachovávají všech původních 16 úrovní.

Web Audio může přepočítat tyto vzorky do bufferu 44 100 Hz a přehrát je jako běžné PCM. Přímo nastavit bufferu frekvenci 3959 Hz není přenositelné mezi všemi implementacemi Web Audio. Doporučené je odstranit DC složku a při ztišení/pauze zastavit běžící efekty. Prohlížeč nepotřebuje emulátor ani původní binární hru.

`effect-0.u8` až `effect-5.u8` jsou stejné bezeztrátové PCM byty pro kontrolu. Výzkumné `effect-0.wav` až `effect-5.wav` jsou 44 100 Hz, mono, 16bit: nulový řád držení amplitudy, odstranění průměrné DC složky, gain 0,75 a 2ms náběh/doběh proti lupnutí. WAVy slouží jen k porovnání a nejsou přimíchané do hudby. Analogové nelinearity DAC a filtrace fyzického POKEY nejsou potvrzené tímto převodem.

## Události původní hry

Samostatný rozbor původních callsites `$39AE/$3A23` potvrzuje spouštění podle změny snímků animace: při pohybech/útocích se používají ID 1/2, při potvrzených zásazích ID 0/2, při pádech ID 3/4/5. Některé zásahy opakují ID 0 po 100 ms nebo ID 2 po 80 ms. ID 2 používá také přímý callsite `$3144` u bonusu s dlaždicemi. Přesný rozpis snímků je v poznámkách rozboru bojové logiky.

Během digitálního efektu **hudební čas pokračuje, ale hudba není slyšet**: `$3AE3 → $2765 → $27E3` nastaví `$CF=$FF`; hudební přehrávač na `$2082` kvůli této hodnotě přeskočí zápis POKEY registrů. Konec efektu `$3B16 → $2768 → $27E8` vrátí `$CF=0`. Pro webovou nahrávku to odpovídá dočasnému ztišení hudby bez pauzy její časové pozice.

## Opakování a ověření

```sh
# Samostatný nový boot pracovní kopie originálu:
python3 tools/karate_extract_sfx.py
# Nebo již načtený, neupravený výpis $0000–$BFFF:
python3 tools/karate_extract_sfx.py --memory /path/to/ram.bin
```

Čerstvý boot a dřívější nezávislý RAM dump daly všech šest bytově identických PCM proudů. Kontrolované byly rozsahy, 16 úrovní amplitudy, base64 dekódování a délky výzkumných WAVů. Monitor při vyvolání ID 0 potvrdil `AUDF1=0F`, `AUDCTL=00` a čtení `$9F01`, `$9F02`, `$9F03`... Hashe ATR, sample RAM, PCM a WAV jsou v `provenance.json`. Přirovnání efektů k hlasovým slovům či konkrétním zvukům zde není vydávané za poslechové ověření.

### Kalibrace rychlosti podle videa

Numerická korelace s uživatelovým videem podpořila identifikaci ID 2 přibližně na 347,008 s, ID 0 na 348,913 s a ID 3 na 349,475 s. Nejlepší shoda vyšla při efektivních frekvencích 3715 / 3675 / 3665 Hz, se stejnou obrácenou polaritou zvukové stopy. Pro web je použito **3700 Hz** jako společná empirická kalibrace, tedy poměr přehrávání `3700 / 3958.5870535714284 ≈ 0,93468`. Změna polarity nemění vnímaný zvuk samotného mono samplu.

To není tvrzení o přesné konstantní frekvenci fyzického originálu: původní IRQ mají nepravidelná zdržení od DLI a nahrávka obsahuje škálování/ztrátovou kompresi zvuku. Pokus o přímé měření délky přes RTC/VBI a pozici paprsku v monitorovém režimu Atari800 nedal srovnatelný konzistentní výsledek, takže se jako ověření přesné rychlosti nepoužívá. `sourceSampleRate` v datech zůstává správně nominální frekvence timeru; empirické zpomalení patří pouze do nastavení webového přehrávače.
