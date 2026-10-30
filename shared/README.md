# Mobilní joystick

Sedm joystickových her používá společný nativní ovladač:
Dynakillers, International Karate, Archon, The Goonies, River Raid,
H.E.R.O. a Boulder Dash. Karateka na výslovný pokyn uživatele zachovává
dosavadní klávesové/dotykové povely.

Levý palec ovládá digitální osmisměrný joystick, pravý samostatné FIRE.
Kruhová páčka nemění rychlost hry podle velikosti výchylky. Mrtvá zóna
má 22 % poloměru pohybu; překročení okraje udržuje zvolený směr.
Každý prst má vlastní pointer capture. Puštění, zrušení pointeru, ztráta
okna, změna viditelnosti, otočení a fullscreen uvolní odpovídající vstupy.
Start/pauza/nabídka používají také explicitní `clear()` v jednotlivých hrách.

FIRE přebírá původní význam hry: bomba v Dynakillers, kombinace pro údery
v International Karate, potvrzení/střelba v Archonu, přepnutí postavy
v Goonies, střelba v River Raidu/H.E.R.O. a sbírání se směrem v Boulder Dashi.
Ve dvoujoystickovém Boulder Dashi dotyk neposílá povely druhému ovladači.
Archon přiděluje dotyk lidské straně i při hraní za Stín.

`mount({host, action, enabled, onInteract, parent})` vrací `read()`, `clear()`,
`buttons(target, fireKey)` a `axes(target)`. Adapter přidává vstup před
stávajícím zpracováním fyzických gamepadů; nemění herní pravidla/AI/časování.
Původní tlačítka v DOM zůstávají jako fallback pro nenahraný společný modul.
Ovladač má vlastní CZ/EN popisky podle URL a klávesové ovládání při fokusu.

Panel je pod obrazem hry. Zobrazuje se při hrubém ukazateli nebo šířce
nejvýše 900 px; na výšku zabírá 196 px, v nízkém landscape 146 px.
International Karate a Archon používají vyhrazené místo ve svém herním
kontejneru, ostatní hry mají panel uvnitř `.arcade`, také pro fullscreen.
Sestavení kopíruje pouze JS/CSS do `/shared/` a přepisuje jejich relativní
odkazy ze samostatných her do zveřejněných adresářů.

Ověření:

```sh
python3 tools/build_portal.py
python3 tools/test-portal-build.py
node tools/test-touch-joystick.mjs
node tools/test-touch-game-inputs.mjs
node tools/test-game-i18n.mjs
```

Testy ověřují oddělené pointery, současný směr/FIRE, úhlopříčky, mrtvou zónu,
opuštění oblasti, zrušení kontaktu, klávesnici, pauzu/viditelnost/otočení,
popisky a 126 shod vstupů se skutečnými funkcemi sedmi her proti gamepadu.
Proběhly i regresní sady původních enginů. V Brave byl zobrazen skutečný
panel a spuštění River Raidu/Boulder Dashe v náhledu šířky 390 px.
Responzivní náhled nenahrazuje fyzický telefon: skutečný dvouprstý kontakt,
pohodlí úchopu a fullscreen na mobilním Safari zatím nejsou ručně potvrzené.
