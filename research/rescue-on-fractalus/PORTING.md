# Rescue on Fractalus! — native conversion in progress

The supplied disk is the authority: `rescue-on-fractalus.atr`, 92,176 bytes,
SHA-256 `e8ff23567b219f614a307a309e42929957facb9b9ff838cc8ff91789eace44ab`.
The working implementation is native JavaScript. The offline Python tools execute
original routines to produce independent reference data; no processor, instruction
decoder, original disk or executable is part of the browser runtime.

The user permits an optional smoother graphics mode alongside the original
presentation rate. This exception does not authorize faster physics or enemy,
rescue, score and sound updates. The game is not registered on the portal yet.

## Original loading and revision

This disk contains the computer version 4.1, with a custom asynchronous loader.
Its sector chains advance by 125 payload bytes, even when DOS byte-count fields
are inconsistent. FILE00 is loaded at $05FD, FILE02 at $0400, and the 31,500-byte
FILE01 at $3CDE. Main stream SHA-256:
`57553c97cc93f1fb65075b64ee3310fb33c9af33422a1e8494038761fce3f4f4`.
Both FILE00 and FILE01 were checked against loaded Atari800 RAM in full.
Original source files are unchanged; emulator work uses a private read-only copy.

The annotated map in [Vesuri's native Amiga research](https://github.com/Vesuri/rescueonfractalus/tree/406c39d824f77a541b7d7d0f39a606e054237f35)
is useful for finding routines, but is not an independent correctness oracle.
No implementation from that repository is imported. Some comments, aliases and
its shared arithmetic oracle are inaccurate; its XEGS 5.0 data and optional
rendering changes are not substituted for this disk. All comparison results
below execute the supplied original instructions instead.

## Implemented and independently checked

- `$9821` rounded byte multiplication: all 65,536 operand pairs. This differs
  from rounding a final ordinary product.
- `$9BA0` heading vectors: all 16,384 headings, both complete components;
  `$9C97` signed fixed-point multiplication: 4,864 cases.
- `$9E54/$A11F` geometry: 128 complete 45-cell view transforms, wrapped map
  traversal, near clipping, roll spans and 2,208 perspective projections.
- Native terrain subdivision, skyline and original 2bpp sky/body fill: 94
  complete terrain-only views, 706,880 pixels.
- Populated rendering: 144 complete coupled geometry/clear/object/terrain/fill
  passes, both halves, complete packed bitmaps and skyline, persistent state,
  map aging/spawning, interleaved targeting metadata and 301 ordered RANDOM
  reads. Nine dead pixel/scale working registers are excluded from the state
  contract; rescue initializes them before use. Smooth redraws consume no RNG.
  This comparison exposed and fixed the original `$AB7B` X-register side effect
  on changed-object marker drawing, including retained unprojected coordinates.
- Ground objects: 96 scaled bitmaps and 392 dispatch cases, all six shapes,
  reflection, clipping, original OR masks, occlusion, target/span/shot metadata;
  1,124,352 bitmap bytes and 55 ordered chance reads.
- Fresh world generation: 48 full pipelines across 16 levels and seven targeted
  placement cases; 40,188 ordered RANDOM reads and 52,736 map bytes match.
- Motion integration: 6,016 original states plus 891 thrust settings. This
  includes all exposed scalar state, attitude history and the event ring. Eight
  separate subsystems were isolated in the initial fixture; the service fixture
  additionally closes them through 1,024 coupled flight/ground updates without
  isolation, 4,096 height samples, 1,024 full ground states and 1,536 hook cases.
- Commands, decoded messages and lock indicator: 512 complete command states
  and 512 indicator states, with no isolated callees.
- Combat: 280 bolt/impact cases, 645,120 bitmap bytes; 384 full terrain-effect
  tails, including 61 saucer spawns, 192 aging passes, 46 alien conversions;
  20 dispatch-priority cases and 1,406 ordered RANDOM reads.
- Rescue and Jaggi: 2,208 original scalar/bitmap cases plus five human/ace/
  ignored/open-alien and three closed-airlock fatal/escape trajectories. Exact
  explicit waits, map/ring mutations and the fatal 22-frame direct tones match.
- Lifecycle: 3,072 original scalar/arithmetic cases, nine timed trajectories,
  quota/extra/replay bonuses, original completion jingle, fatal waits and launch
  reuse rules. `$3FFA` HUD drawing is isolated in these lifecycle trajectories.
- Audio: 9,824 effect VBIs, all 33 events, 5,989 ordered writes; 13,600 theme,
  1,036 jingle, 6,600 station and 600 logo VBIs with 42,424 exact music/scene
  POKEY writes. Native waveform continuity is checked at 44.1/48/96 kHz, with
  15 nonzero-PCM clips. These are digital-register/waveform tests, not a claim
  of exact analog chip characteristics or original hardware phase.
- Cockpit: 30,080 viewport, 25,600 mode4, 25,600 dynamic HUD/PMG and 2,560
  header pixels, 20 digit rasters and 115 native instrument-writer cases.
- P2/P3, scope and scanner: 1,536 original writer cases, all six adjacent
  bitmap banks, scalar state, hardware size and ordered RANDOM reads. The
  neighboring-bank write during the initial scanner clear is preserved.
- VBI integration: 640 original blink/fuel/indicator/scanner utility cases;
  96 flight/ground/mixer/score cases with graphics isolated, and another 96
  with complete P2/P3/AH/altimeter/scanner banks. Compass and danger glyph
  writers are isolated in that last comparison and tested separately above.
- Native game integration: 12,800 PAL/NTSC ticks and 25,592 additional graphics
  calls leave gameplay, RNG, map and audio state identical between display
  modes. Fatal-event completion, mission bonus and next launch are exercised.
  This is an integration invariant, not an original full-game timing oracle.
- The standalone file bundle is checked in a CZ/EN DOM/audio host harness:
  no fetch/import requirement, real native engine, rendering, control input,
  fallback audio initialization and pause/resume.
- Introduction: all 1,311 complete station and 1,494 launch PAL indexed frames
  match independent original-capture hashes, including their nine POKEY register
  states. Another 1,670 original numeric basis frames validate moving door
  glyphs; level captions 01–99 and quota replacement are checked. The CZ/EN
  host runs the entire sequence without advancing flight state, then verifies
  automatic handoff, skip, pause, restart and held-key suppression. Edge showed
  the local-file animation, fullscreen and skip to flight; continuous browser
  playback and audible comparison remain separate from host/hash checks.

## Introduction data and scope

`tools/fractalus_capture_intro.py` executes the supplied ATR offline using a
private Atari8007.2.1 development monitor. `DUMPCINEMA` exports the actual
384×240 indexed raster, the nine POKEY write-register states and six metadata
bytes. It does not export executable bytes to the browser. The 320×200 crop is
x32–351, y20–219. `tools/fractalus_encode_intro.py` generates lossless delta/run
packets and independent SHA-256 fixtures. Native Canvas decodes these packets;
the existing native waveform generator consumes their sound states.

The station starts at $1A05 and ends at the first $1DF5 animation-cycle boundary.
The asynchronous loader poll at $1A33 is suppressed only after its ship assets
are resident; re-polling a completed loader would enter its error path. The
launch runs from the standby input to immediately before first $3EBA flight
entry. Partial final frames are excluded. This is the ship/launch sequence,
not the preceding Lucasfilm logo, title/attract loop or return cinematic.

Door captions are rebuilt offline through the original $3C83/$672D/$67C3
routines. Ten digit bases and two solid masks preserve the moving glyphs for
the selected level. The caption leaves the viewport after frame166. Separate
saved-state restores can differ in POKEY RANDOM phase: HUD scanner cells and
later stars are retained from the untouched launch capture, rather than
mistaking those differences for numeric glyphs. The default LEVEL04 composite
matches every original full-frame pixel. Quota/score overlays use the existing
original glyph writers only when the source counter is visible.

The raster recording is PAL level4. Other levels reuse it with their numeric
caption and quota/score; continuous per-level/night and post-return launch
comparisons remain open. NTSC currently plays the same displayed frames at its
VBI rate; a separate continuous NTSC introduction has not been verified.
Audio states are sampled once per original displayed frame, so sub-frame
register transitions and analogue oscillator phase are not proved by these
checks. Flight remains frozen during playback; a full original-to-native
continuous world/RNG handoff is not established by matching cinematic pixels.

## Timing that must be preserved

The original flight VBI is at $4FF5. The actual parity counter is $0643:
`DEC $0643` at $50A3 and reload 2 at $5149. Motion integration and ground
sampling execute every second display frame, independently of terrain completion.
PAL motion is therefore approximately 24.93 Hz.

Foreground rendering alternates $3EBA and $3EF5. After each half-pass the original
runs enemy fire and event updates. The renderer itself has side effects, including
RANDOM reads, target selection and map mutations. Extra presentation frames must
operate on a snapshot and discard these changes.

Actual Atari800 PAL measurements, 80 completed half-passes per level:

| Level | VBI intervals per terrain half-pass | Mean | Completed views/s |
| --- | --- | --- | --- |
| 1 | 5–8 | 6.6625 | 7.484 |
| 4 | 6–9 | 7.9375 | 6.282 |

These are scene-dependent terrain completion rates, not a universal game FPS.
Use the low jiffy byte $14 modulo 256 within these flight captures. The flight
handler does not propagate its wrap into $13; rescue waits also rewrite $14.
A global monotonic clock is maintained separately in native code. On a wrap
while an event/systems-off flag is active, the actual flight code increments
`$12`, not `$13`; this was checked directly against the disk instructions.

## Open work and validation boundaries

The first local playable shell now connects the native modules, CZ/EN UI,
keyboard/gamepad/shared touch joystick, audio, fullscreen and the two rendering
modes. Edge was used to observe flight, input, active audio output and fullscreen
with F. Physical touch hardware and Safari have not been validated.

**Complete 1:1 fidelity is not established.** The current original-pace option
replays 80 observed PAL half-pass intervals for level1 and level4; level4 is a
temporary fallback at higher levels. A fitted work-count experiment had held-out
errors up to approximately 37,927 CPU cycles and was rejected as exact timing.
The runtime does not use invented per-pixel cycle coefficients. Exact CPU/DMA/
interrupt-dependent completion timing remains required for global fidelity,
because logical terrain passes also advance combat. NTSC foreground wall
timing is likewise unverified. Smooth mode uses the same logical pass schedule
as the original-pace option and does not multiply gameplay updates.

Original return cinematics, logo/title/attract screens, night windscreen raster
noise and initials screens are not implemented. Initial flight uses named
data from the first original flight entry. The composed return/next-launch
handoff still needs continuous-original comparison; its isolated scoring and
reuse routines passing is not proof of that complete transition. A full,
continuous playthrough and broader reachability/level coverage remain open.

Injected randomness proves consumption order and rules, not the cycle phase of
an original POKEY chip. The runtime uses the POKEY17 polynomial with a native
read-time step; alignment to original CPU RANDOM accesses is unverified.
The supplied 25-fps, 336×240 reference video is used for
presentation checks; it is not a replacement for missing game states.

## Reproduce current checks

```sh
python3 tools/build_fractalus.py
python3 tools/test_fractalus.py
# Selected fresh original captures require the validated 64KB flight snapshot:
python3 tools/fractalus_capture_render.py --reference /path/to/flight.bin
python3 tools/fractalus_capture_vbi.py --full-pmg
python3 tools/fractalus_capture_sprites.py
```

The development captures need py65. Browser code needs no Python, emulator or
original executable. Raw RAM, saved states and reference-source checkouts remain
outside the public package and Git. The last bounded-check report and runtime
hashes are recorded in [validation.json](validation.json).
