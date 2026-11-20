# Original Robbo graphics and planets

The authority for this port is the supplied `Robbo.xex`, 20,827 bytes,
SHA-256 `75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb`.
`tools/robbo_extract_assets.py` accepts an offline unpacked 64 KiB RAM image;
it validates the XEX hash and data signatures before exporting only maps,
character pixels, palette bytes and display tables. RAM and 6502 instructions
are development references and must never become browser runtime assets.

The original assembly archive is [robbo.zip at Pigwa sources](http://sources.pigwa.net/files/gry/robbo.zip),
retrieved 2026-11-20, SHA-256
`320cad9f3ecc2c58a5053360a155e3da2d1f95c682a3333c1e688110f0d3383e`.
Its `d1/R1.ASM`, `R2.ASM`, `TITLE.ASM` and `d2/*.FNT`, `C1.OBJ`, `C2.OBJ`,
`C3.OBJ` explain the data. The archive uses a different address layout from
the supplied XEX. All four complete font files match the unpacked XEX byte
for byte. The XEX renumbers the downward laser from tile `$22` to `$27`:
24 map bytes differ for this reason; all other map bytes and metadata match.
`LOOK` swaps precisely these two entries; its other 126 bytes and the whole
`NEXT` table match the archive. Runtime assets retain the XEX's tile values.

The [GNU Robbo project](https://gnurobbo.sourceforge.net/) identifies itself
as a reimplementation and documents rule modifications. Its engine, graphics
and converted levels are therefore not used as the port's authority.

## Original data layout

| Supplied XEX range | Archival range | Symbol | Contents |
| --- | --- | --- | --- |
| `$0700–$08FF` | `$0C00–$0DFF` | `CAVE` | Current 512-byte planet |
| `$0E00–$0FFF` | `$0E00–$0FFF` | `MFNT` | Sixteen 16-byte wall variants, in two 256-byte halves |
| `$1800–$1BFF` | `$1000–$13FF` | `SFNT` | Two 512-byte banks used by the font animation |
| `$1C00–$1FFF` | `$1400–$17FF` | `FONT` | Active 1,024-byte ANTIC4 character set |
| `$2000–$23FF` | `$1800–$1BFF` | `IFNT` | 1,024-byte information/title character set |
| `$3800–$A7FF` | `$4800–$B7FF` | `CAVS` | 56 planets, each exactly 512 bytes |
| `$1000–$17FF` | `$B800–$BFFF` | `SCRN` | Active 32-column, 64-character-row game screen |
| `$3507–$3586` | `$2E9E–$2F1D` | `LOOK` | Tile-to-character lookup |
| `$3587–$35A0` | `$2F1E–$2F37` | `NEXT` | Object animation transitions |
| `$3707–$3756` | `$1C2D–$1C7C` | `INFO` | Two information text rows |

Each planet contains 496 map bytes (16 columns × 31 rows), followed by a
16-byte metadata row. Metadata byte 1 is the required screw count in packed
BCD; bytes 2–6 are `COLPF0`, `COLPF1`, `COLPF2`, `COLPF3`, `COLBK`;
byte 7 becomes the colour behind the game tiles. Wall variant is selected by
`(planetNumber >> 2) & 15`, where the first planet is number zero.

`LOOK` is 128 bytes. Each tile selects the top-left character and `PUT_`
forms the other three characters with `|1`, `|$20`, `|$21`. The high bit of
a map byte is a logic scheduling flag; the renderer masks it before indexing
`LOOK`. There is one explicit exception in the supplied XEX's optimized
`PUT_`: raw `$A0` boundary bytes are preserved in `CAVE` and select `LOOK[0]`,
the wall. The native raster follows this branch. The archival `ENTCV`'s
negative-to-zero conversion must not be used to infer this XEX's logical
map after initialization. The high bit *in LOOK* has a separate graphical meaning: ANTIC4
pixel value 3 uses `COLPF3` instead of `COLPF2`.

## Raster details

The game is 256 pixels wide: sixteen 16 × 16-pixel tiles, each assembled
from four original 8 × 8 characters. Every ANTIC4 character row contains four
2-bit pixels, displayed two pixels wide. The display list has twenty
scrolling mode-4 rows and one non-scrolling terminator. The first row loses
`VSCROL` scanlines, while the terminating row contributes `VSCROL+1` lines:
the total is exactly 161 scanlines. The information display uses two 40-character mode-2 rows,
320 × 16 pixels. The field is at `(32,21)` and the information rows at
`(0,194)` on a 320 × 240 cropped raster. A native frozen PAL scanout verifies
these coordinates and every pixel of both regions, including DLI/PMG colours.

There is an important GTIA detail: the game fills four quadruple-width
players with `$FF`, places them at `$40`, `$60`, `$80`, `$A0`, and sets
`PRIOR=4`. They form a continuous background behind all four playfield
colours. The first DLI sets their colours to metadata byte 7. Consequently
an ANTIC4 pixel of value zero inside the game field shows that player
colour, rather than `COLBK`. The second DLI restores the players to
`COLBK`, sets `COLPF2=COLBK`, `COLPF1=$0A`, `CHBASE=IFNT`, and selects the
normal-width information rows. Its high-resolution foreground colour is
`(COLBK & $F0) | $0A`.

`CHNMON` copies original bytes from `SFNT` into `FONT`. Its shared object
animation bank depends on `CNTR & 2`; robot animation depends independently
on the low bit of the byte immediately preceding `CHNMON`. Robot direction
comes from the first active-low joystick bit in `LM`. `ENTCV` selects the
wall bytes. `CVBL` rotates the eight bytes at `IFNT+$300` once per frame.
The native raster implements these copies directly, preserving the pixels.

`INFO` is an 80-byte original template. The native HUD replaces its number
glyphs using the original packed-BCD nibble placement and top/bottom digit
characters. Browser fonts are not used for the game information display.

The supplied gameplay video is only a visual reference. Its 640 × 480
picture and compression cannot establish exact source pixel values or
replace map and character extraction. The first several minutes are the
cassette loading sequence.

## Verification status

Assets have been exported from `native-unpacked.bin`, a 65,536-byte RAM image
captured directly from Atari800 while running the supplied XEX, at title
entry PC `$AC28`. `assets.json` records that image's hash, each planet's hash,
the exported file hash and precise data ranges. The XEX has two loading
stages, including an additional RLE loader following its warm boot; a RAM
image captured after only the outer depacker is not the game image.
As an intermediate development check, 64 combinations of four wall variants,
both shared animation banks, both robot phases and four directions were
executed through archival `ENTCV`'s wall-copy prefix and `CHNMON` in offline
py65. Every resulting 1,024-byte font matched native `makeFont` exactly.
The same 64 cases also match when `makeFont` uses the confirmed XEX font
assets. A subsequent fixture executes the actual relocated XEX `ENTCV`
wall-copy prefix and complete `CHNMON`, with only the `HALT` VBL wait
bypassed. It covers all fourteen used wall variants, both shared animation
banks, both robot phases, four directions, and three moving/FAC combinations:
672 cases, each matching every one of the 1,024 font bytes. It also checks
that `CHNMON` chooses the robot bank before incrementing its phase byte.
The same generator runs the complete relocated `ENTCV` for all 56 planets
and decodes its resulting `SCRN` character storage and active font. The
native map raster matches all 126,976 Atari colour-index pixels of every
256 × 496 planet. This caught the XEX-specific `$A0` lookup exception.
The raster test additionally compares every numeric HUD glyph against all
2,574 actual `CVBL` fixture states, including packed-BCD values and the
8-bit planet-number wrap before decimal conversion.

Regenerate with `python3 tools/robbo_capture_raster.py --ram <native-RAM>`;
run `node tools/test-robbo-raster.mjs` (or `deno run --allow-read` with that
test path). The fixture contains pixels and state, not 6502 code.
`deno check robbo/raster.mjs` also passed.

## Native PAL scanout and RGB palette

`tools/robbo_capture_scanout.py` loads the Atari800 state captured at entry
to planet one, freezes only the main game thread with an offline idle loop,
and lets the original VBI/DLI run for two complete frames. `DUMPSCREEN`
captures the full 384 × 240 Atari raster; its central 320 columns are the
native renderer's output. The fixture contains only rendered pixels and
map/font/HUD state. All 76,800 cropped pixels match `renderFrame` exactly,
including all 256 × 161 field pixels and the information rows. Actual
hardware `VSCROL` is read from the ANTIC monitor output; reading `$D405`
from a generic RAM dump does not recover that write-only register's value.

The same capture's `DUMPPALETTE` exports `research/robbo/default.act`,
SHA-256 `4faa4d96229a01fdfa4706e98de89dd6d4bd441a10d9e27d216b661a2c5ccca0`.
This replaces an initially reused, brighter palette from another port.
`scanout.json` records the emulator binary/state/fixture hashes and the
effective PAL colour configuration: gamma 2.35, hue/saturation/contrast/
brightness zero, GTIA delay 23.2, no external palette or PAL artifact filter.
The supplied video's first-planet colours are consistent with this palette
within video compression: native floor `$B4` is `(10,85,0)` and blue wall
`$72` is `(6,20,112)`. The video remains a visual reference, not a replacement
for original colour-register extraction.

Regenerate the bounded hardware capture with:

```
python3 tools/robbo_capture_scanout.py --emulator <development-Atari800> --state <game-entry.a8s>
python3 tools/robbo_extract_assets.py --memory <native-unpacked.bin>
```

The complete live scanout comparison currently covers one frozen initial
planet-one scene. Scrolling transitions, other planets' DLI timing, changing
fonts during active scanout, and original title/ending scanouts have not been
established by this particular fixture. Whole-planet storage/pixels and all
fourteen used wall/animation banks are covered by the separate CPU fixtures
above. These bounded checks do not establish a complete 1:1 game conversion.

## Original title raster and preview assets

`robbo/title-raster.mjs` exports `renderTitle(assets, titleData, logo, typist)`
and returns a 320 × 240 Atari colour-index raster. It uses the extracted
title layout without replacement artwork: ANTIC A's eight 4-line bitmap
rows and their blank separators, six original credit text rows, two ANTIC C
horizontal rules, and eight original typewriter rows. The timed `WLIN`
colour-register writes remain part of the rendering: bright credits, darker
control descriptions, and the separate instruction-text shade.

Two complete native hardware captures match every output pixel: the initial
title and the title after 1,200 original main-loop passes. The capture freezes
only `BIGR` and the typewriter writer, retaining the original main loop's
`WLIN` timing and OS VBI. Freezing the whole main thread would lose those
within-frame palette changes. Reproduce with
`tools/robbo_capture_title_raster.py --emulator <development-Atari800> --state <native-title-entry.a8s>`;
run `node tools/test-robbo-title-raster.mjs` or its Deno equivalent.

`robbo/assets/title.png` is the unchanged 320 × 240 second capture, converted
with the captured PAL RGB palette. `robbo/assets/logo.png` crops its original
glyph pixels at `(48,21,224,39)` and makes only the black gaps transparent.
No logo glyph is redrawn. `title-raster.json` records source, emulator,
palette, fixture, and PNG hashes. The PNGs are static original-frame
previews; the native title module renders its ongoing original animation.

## Demonstration information row

`demoText` exports the original forty `INFO+80` bytes at `$3757–$377E`.
In demonstration mode the original `PLA1` changes the following two display
list bytes to `$82,$02`, enabling a third 40-character information row at
`(0,210,320,8)`. The DLI changes `COLPF1` to `RTCLOK >> 2`; its visible
high-resolution foreground luminance is `(clock >> 2) & $0E`. The native
`renderHud` therefore returns 24 rows while `state.demo` is active, and
`renderFrame` includes that original flashing interruption instruction.

`tools/robbo_capture_demo_raster.py` enters the actual auto-demo title branch
and lets the original `PIPA/PLA1` configure the display. It freezes the main
thread at `$0400` while keeping the original `CVBL` and DLI active. Three
complete 320 × 240 scanouts, at dark/middle/bright instruction luminance,
match the native raster pixel for pixel. The test is
`tools/test-robbo-demo-raster.mjs`; hashes and clock values are recorded in
`demo-raster.json`. This is a bounded display check, not a proof of complete
demonstration gameplay equivalence.
