# Fred native conversion

Authority: the supplied `Fred (CZ) (Font 1).xex`, 38,613 bytes,
SHA-256 `244238f9508a1bf061d263b448e660ceffaf8a3a01b77777e059575d9b100269`.
The supplied video is a visual reference, not the game specification.

The browser runs hand-written JavaScript rules in `fred/engine.mjs`, original
tile/sprite pixels in `fred/screen.mjs`, and a native four-voice sound driver.
There is no 6502 interpreter, opcode dispatcher, ROM or XEX in the web runtime.
Atari800 and py65 are development references only.

## Original program boundaries

- `$1300` game services; `$149A/$15B5/$1647` map, level art and player setup.
- `$1E00` controls, jumps, falling and climbing; `$2317` player/death graphics.
- `$2415` rolling 64×8 terrain window, with two new 16×8 chunks per advance.
- `$2758` frame entry; `$2874/$291A` character composition/animation.
- `$2990..$2CE8` original enemy and environmental handlers.
- `$16DD/$17DC/$18BF` projectiles, spray and pot contents.
- `$19BC/$1A82/$1AD3/$1B4F` protection, inventory, BCD score and HUD.
- `$0F00/$1032` four-channel effect allocation and envelopes.
- `$9200/$9203`, data `$8B00`, original CMC music initialization/VBI.

All 160 original map chunks and ten level configurations are exported. Native
transitions preserve inventory, original restart checkpoints, the 116-VBI LEVEL
sequence, and the supplied version's victory screen. Music and effects are
exclusive, matching OPTION in the original. Music is an offline recording of
the original CMC/POKEY player; its complete state repeats at frames 1,537 and
23,809 (period 22,272). The effect driver retains priorities, repeats, stops and
the source's out-of-table STOP side effect.

## Checks and their limits

- 9,585 complete original logical steps, 80 sequences across all ten levels:
  idle, both directions, diagonal jumps, climbing input, down and combat.
- 1,113 targeted original cases: every terrain class and all 256 tile-byte/flag
  combinations with and without a blast, all obtainable bonus types,
  inventory, BCD thresholds, protection expiration, spray, stones, rare enemy
  events, ladder alignment, and all nine transitions to the following level.
- 320 original effect-driver VBIs, including channel saturation and repeat/stop.
- Ten original 320×240 scanouts: scrolling, jumping, level art, overlapping
  enemies, stone/pot overlap, bottom-row player priority, half-character enemy
  animation and the LEVEL banner. Actual GTIA read-register latches agree.
  A two-pixel tolerance is explicit for the progress-line PF2 palette write:
  interrupt entry can move by a few CPU cycles. No playfield or sprite geometry
  tolerance is used.
- Original PAL execution measured 23 consecutive three-VBI logical intervals:
  approximately 16.62 logical steps per second, with a 49.86 Hz display clock.
- Isolated Edge checks cover keyboard movement/fire, audio loading and mode
  changes, pause, F/fullscreen, English shell, 320/390 px portrait and landscape,
  and genuine simultaneous two-touch joystick/FIRE input.

This is a playable native conversion, not a claim that the entire game has been
proven 1:1. A full uninterrupted human playthrough is still outstanding. POKEY
RANDOM's cycle-dependent phase and its correlation with raster collision timing
are not reproduced; native random draws retain the original branch thresholds.
Static original title/victory artwork is used instead of the original scrolling
menu, attract sequence and hidden cheat entry. Effect register sequences are
checked; the native waveform mixer is not a cycle-for-cycle analog POKEY model.
Safari/iOS has not been tested in this pass.

## Reproduce

Extraction/oracle scripts also need the development-only Python package `py65`.
With the supplied XEX and an Atari800 development executable supporting
`DUMPSCREEN`, `RECORD`, and `STOPRECORD`:

```sh
python3 tools/fred_capture.py --emulator /path/to/atari800 --output /private/tmp/fred-reference
python3 tools/fred_extract.py --memory /private/tmp/fred-reference/game.bin
python3 tools/fred_capture_rules.py --memory /private/tmp/fred-reference/game.bin --output /private/tmp/fred-rules.json
python3 tools/fred_capture_mechanics.py --memory /private/tmp/fred-reference/game.bin --output /private/tmp/fred-mechanics.json
python3 tools/fred_capture_raster.py --emulator /path/to/atari800 --reference /private/tmp/fred-reference --output /private/tmp/fred-raster --fixture tools/fixtures/fred-raster.json.gz
python3 tools/fred_capture_timing.py --emulator /path/to/atari800 --reference /private/tmp/fred-reference
python3 tools/fred_audio.py --emulator /path/to/atari800 --state /private/tmp/fred-reference/game.a8s --output /private/tmp/fred-audio
```

The checked-in compressed fixtures contain states, pixels and register values,
not original executable code. They can be checked without the original CPU:

```sh
node tools/test-fred-rules.mjs
node tools/test-fred-mechanics.mjs
node tools/test-fred-raster.mjs
node tools/test-fred-sound.mjs
```

Serve the project over HTTP and open `/fred/`. `?lang=en` selects the English
shell. Public portal registration and deployment are separate release work.
The generated classic `game.js` also supports direct file opening. Rebuild it
with `python3 tools/build_fred.py`; `--check` verifies it matches the modules.
