# Fred — nativní webová verze

Lokální hra: <http://127.0.0.1:8010/fred/>. Anglické rozhraní vybere `?lang=en`.
Z kořene projektu ji lze spustit pomocí `python3 -m http.server 8010`.
Funguje i přímé otevření `fred/index.html`, včetně zvuku.
Tato verze zatím není přidaná do veřejného portálu.

Převod vychází z dodaného `Fred (CZ) (Font 1).xex`. Obsahuje deset původních
úrovní ze 160 mapových bloků, původní bitmapy, animace, kameny a sprej,
obsah nádob, inventář, ochranné předměty, nepřátele, skóre, životy,
checkpointy, přechody LEVEL a závěrečný obraz. Prohlížeč spouští nativní
JavaScript; původní procesor a program se používají jen při vývoji.

## Ovládání

- Šipky nebo WASD: pohyb, skok a lezení.
- Nahoru + vlevo/vpravo: směrový skok.
- Dolů + vlevo: výběr kamenů; dolů + vpravo: výběr spreje.
- Mezerník / Ctrl / FIRE: hod kamenem nebo sprej. Kámen vyžaduje nové stisknutí.
- M: původní přepnutí hudba / efekty, odpovídá OPTION. Nehrají současně.
- P / Escape: pauza. Přepnutí karty nebo okna také hru pozastaví.
- R: nová výprava od původního checkpointu; F: celá obrazovka.
- Gamepad: levá páčka/kříž a první tlačítko.
- Mobil: levý palec ovládá osm směrů, pravý FIRE. Ve fullscreenu na šířku
  jsou ovladače po stranách obrazu.

Hudbu vyrenderoval vývojový Atari800 z původního CMC přehrávače. Efekty
řídí nativní čtyřkanálový přehrávač podle původních obálek POKEY.

## Ověření

Prochází 9 585 původních herních kroků v 80 sekvencích, 1 113 cílených
mechanických případů, deset obrazových referencí s hardwarovými kolizemi
a 320 VBI původního zvukového ovladače. V Edge je ověřené ovládání,
zvuk, pauza, F/fullscreen, angličtina, úzké mobilní rozložení a skutečný
současný dotyk joysticku a FIRE. Časování PAL bylo změřené v originálu.
Hudební MP3 se také dekóduje a kontroluje na skutečný zvukový signál;
prohlížečový test měří jeho výstup za hlavním zesílením.

**Celá hra zatím není ručně dohraná a úplná shoda 1:1 se netvrdí.** Zbývající
hranice zahrnují fázi hardwarového RANDOM, návaznost kolizí na přesnou fázi
rastru a analogový průběh zvuků. Na přechodu palety v ukazateli postupu
test dovoluje dva pixely odlišné podle okamžiku přerušení; geometrie se
porovnává přesně. Úvodní menu používá statický původní obrázek. Safari/iOS
a fyzický gamepad ještě nebyly ověřené.

```sh
node tools/test-fred-rules.mjs
node tools/test-fred-mechanics.mjs
node tools/test-fred-raster.mjs
node tools/test-fred-sound.mjs
python3 tools/test-fred-music.py
```

Rozbor originálu a reprodukce referencí: [vývojová dokumentace](../research/fred/README.md).
Souhrn výsledků: [validation.json](../research/fred/validation.json).

Po změně zdrojových modulů spusť `python3 tools/build_fred.py`; kontrola
`python3 tools/build_fred.py --check` odhalí zastaralý samostatný `game.js`.
