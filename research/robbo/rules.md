# Robbo: original rules and address map

The sole runtime authority is the supplied `Robbo.xex`, SHA256
`75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb`.

## Evidence and current verification status

The original Atari assembler sources were located in
[the archival Robbo source ZIP](http://sources.pigwa.net/files/gry/robbo.zip),
downloaded 2026-11-20. ZIP SHA256:
`320cad9f3ecc2c58a5053360a155e3da2d1f95c682a3333c1e688110f0d3383e`.
Archive filenames: `robbo/d1/R1.ASM`, `R2.ASM`, `R1.OBJ`, `TITLE.ASM`,
`TITLE.OBJ`; original maps and fonts are in `robbo/d2/`.
`R1.ASM` identifies Janusz Pelc and dates 1989-04-30 through 1989-08-08.
The source uses ATASCII `$9B` line separators. An asterisk immediately after
an assembler character constant sets its high bit: `#' '*` encodes `$A0`,
not ordinary space `$20`. This matters for walls and update suppression.

Every decoded source instruction mnemonic and instruction length agrees with
archival `R1.OBJ`, including its 128-byte table reservation. That object contains
`$1C00-$2C70` and `$2CF1-$32E9`.
The supplied executable has a different memory layout and rewritten map/raster
helpers. Its semantic object routines were identified in the actual 64 KiB
`native-unpacked.bin` captured by Atari800 from this XEX, then tested directly.
Its downward laser gun uses ID `$27`, whereas the archive uses `$22`; LOOK,
WHAT, PROC and 24 map cells consistently reflect that change. **The supplied
XEX values are used by the native port.**

The current oracle passes **6,900 isolated object cases and 400 complete grid
scans against the supplied XEX routines**, comparing complete maps, shared
state, score, sound IDs and hardware-random read counts. Full scans stub the
separately translated player routine, sound implementation, VBL wait and font
copy. No original CPU is included in the web runtime.

[GNU Robbo](https://gnurobbo.sourceforge.net/) was consulted only to locate
references. It is a separate implementation with declared gameplay changes and
additional objects. Its engine and rules were not copied into this port.

## Main update and ordering

`PCLO` clears `FAC`, calls `CHNGCV`, then uses `FAC` and `TELE` to choose death,
continuation or next cave. `CHNGCV` waits for OS timer `$021C` to reach zero,
sets it to 7, increments the one-byte `CNTR`, and scans **row first**:
`Y1 = 0..30`, `X1 = 0..15`. `X/Y` are working coordinates; `X1/Y1` always retain
the object currently dispatched. Rendering can change those working coordinates.

Raw `$A0` is the immutable wall. Other objects with bit 7 set are redrawn with
that bit cleared and receive no procedure that scan. Ordinary IDs below `$61`
select a word in `PROC`; a zero high byte means no procedure. IDs `$61..$7A`
advance through `NEXT`; larger IDs are unchanged. On the `m -> *` step,
`TELE=0` and `FAC=1`. There is no separate entity list or simultaneous grid
update: writes made earlier in a scan affect later objects immediately.

`RT_` and `DW_` set bit 7 on the moved object, while `LT_` and `UP_` preserve
its raw ID. This prevents a right/down move from updating the same object again
later in the same scan. Any translated movement that simply strips bit 7 changes
speeds and collisions. Movement succeeds only when the raw target byte is `$20`.

The archived `TST_` clips `X>=16` or `Y>=31`; the supplied XEX's rewritten
`TST_` directly computes `$0700 + (Y << 4) | X` with no boundary check. Legal
maps provide wall borders. `PUT_` permits row 31 for transitions and checks
`X<16,Y<32`. The native context supplies defensive wall reads at out-of-map
coordinates; undefined outside-map memory reads are not part of the proven
legal-state equivalence.
`T_EX` first maps raw `$A0` to ID zero; otherwise it masks bit 7. `WHAT[id]` bit 0
controls projectile destruction, and bit 1 controls bomb destruction. These
flags are distinct from movement blocking. Ordinary empty `$20` has flags 3.

## Map IDs and procedures

| IDs | Meaning / exact procedural distinction |
| --- | --- |
| `$00`, `$A0` | Wall representation / raw inverse wall |
| `$01,$04,$17,$18` | Blaster guns right, left, down, up |
| `$05` | Right end marker of moving horizontal barrier |
| `$06` | Stationary inertial box |
| `$07..$0A` | Inertial box travelling left, right, up, down; on contact becomes `$06` and fires a normal collision shot |
| `$0B,$0C` | Robot under left/right magnetic attraction |
| `$0D,$0E` | Horizontally moving guns, shooting up; move only on odd counter |
| `$0F,$11` | Moving barrier segment / left controller |
| `$12,$7C` | Two door forms, consumed by player's key handling |
| `$13` | Black transition tile |
| `$14` | Closed capsule; becomes `$15` once required screw count reaches zero |
| `$15,$16` | Open capsule, toggles every fourth counter |
| `$1B` | Waiting robot; VBL and scrolling gate before spawn animation |
| `$1C..$1F` | Normal guns up, down, left, right |
| `$20` | Empty space |
| `$21` | Ammo pickup (+9, BCD saturated at 99) |
| `$27,$3C,$3E,$5E` | Laser guns down, left, right, up (archive down gun was `$22`) |
| `$23,$3F,$40` | Pushable box, surprise box, bomb |
| `$24,$25,$26` | Screw, terrain, random/chasing creature |
| `$28,$29` | Left/right magnet |
| `$2A,$2B` | Robot, extra life |
| `$2C..$2F` | Rotating gun orientations right, down, left, up |
| `$30..$39` | Ten teleport labels, matched by raw ID |
| `$3A` | Surprise generator, after destruction animation |
| `$3D` | Key |
| `$41..$44` | Four orientations of left-hand wall follower |
| `$45..$48` | Four orientations of right-hand wall follower |
| `$49,$4A` | Horizontal bouncer left/right |
| `$4B,$4C` | Vertical bouncer up/down |
| `$4D,$4E` | Horizontal flying shooter left/right, fires downward |
| `$4F..$52` | Normal projectile left, right, up, down |
| `$53..$56` | Laser leading edge left, right, up, down |
| `$57..$5A` | Blaster leading edge left, right, up, down |
| `$5B,$5D` | Stationary vertical/horizontal laser segments |
| `$60` | Bomb blast dispatch |
| `$61..$7A` | Shared animation state alphabet in `NEXT` |

Normal/laser/blaster guns use the hardware random byte at `$D20A`. Ordinary
fixed guns proceed only when a fresh random byte is below 18. Rotating guns
first consider rotation on counters divisible by four, with a `random & 3`
gate, then rotate left/right from the next random bit; that path returns without
shooting. Other ticks fire if a separate `random & 7` test is zero. Rotating
orientation must not be recomputed from a continuous angle.

Each wall follower tests robot adjacency, attempts its side direction, then its
forward direction, and otherwise changes orientation without moving. It tests
adjacency again after successful movement. Horizontal/vertical bouncers reverse
when blocked. Flying shooters use the same adjacency rule, reverse when blocked,
and use `random & 7 == 0` to fire down. The chasing creature makes separate
random-bit decisions for axis preference, occasional random movement, and random
direction; consuming only one random value changes its behavior.

Bombs inspect a 3x3 region **from bottom-right to top-left**. Raw `$A0` is immune;
other non-center cells require `WHAT & 2`. Bomb neighbors become `$E0` (chain
reaction marker); other affected cells get the exact `ababcbaba` explosion
pattern. These are direct map writes: their visual redraw occurs during the
normal scanner. Surprise destruction yields animation `n..u` before generator
ID `$3A`; its 32-entry table has repeated slots and two global-power slots.
Global power converts magnets to `$A0`, doors/chasers/wall followers/bouncers to
`$E1`, leaves a life pickup at the original surprise position, and adds 500.

Teleportation preserves the entering direction, tries it first, then traverses
the original 16-byte fallback table backwards from that direction's group.
The destination remains animated until the robot moves out. `TELE=1` suppresses
an immediate return. Successful teleport movement passes through `MFEX`, including
its camera-target update and right-magnet check.

## Input and accounting

`KEJO` decodes POKEY keyboard codes `$0E,$0F,$06,$07` as up/down/left/right when
keyboard status permits; its result is ANDed with **both** joystick shadow bytes
`$0278` and `$0279`. Active-low direction priority is up, down, left, right.
`TETR` ANDs the relevant keyboard status bit with both trigger shadow bytes
`$0284/$0285`. Fire plus a direction emits a normal projectile instead of moving.
`STRC` starts at 5 after a shot and decrements at each robot dispatch. Idle fire
can change facing; ammo exhaustion still changes the robot animation phase.
Demo movement uses its own random reads and is not equivalent to recorded input.

Keys, lives, screws, ammo and score are packed BCD. Pickup/door points in original
`ASCO` units: key 75, door 100, required screw 100, extra screw 250, capsule 1000,
ammo 50, life 200. One life pickup per cave is retained in `LSTE` after death.
ESC kills the current robot; Shift+Ctrl+ESC advances according to the original
keyboard-code branch (`$DC`). Cave index is zero-based and completion compares
against 55, giving 56 caves in this executable family.

## Address maps

Actual supplied XEX (see `symbols.json` for identified routines):

| Address | Original symbol |
| --- | --- |
| `$266D` | `CHNGCV` |
| `$266C` | `CNTR` |
| `$32D6` | `GET_` |
| `$32E3` | `PUT_` |
| `$333D` | `TST_` |
| `$32CF` | `HALT` |
| `$275F` | `CHNMON` |
| `$B800` | `SOUND_` |
| `$3507` | `LOOK` |
| `$3587` | `NEXT` |
| `$35A1` | `PROC` |
| `$3663` | `WHAT` |
| `$0700` | `CAVE` |
| `$28B6` | `MFAC` |
| `$2C12` | `NIES` |
| `$2CDD` | `BOMB` |
| `$2400` | `PIPA` |
| `$2505` | `PCLO` |
| `$27E1` | `RT_` |
| `$27FA` | `LT_` |
| `$2811` | `DW_` |
| `$282A` | `UP_` |
| `$2942` | `KEJO` |
| `$29D1` | `MFX1` |
| `$29D5` | `MFEX` |

Archival original source (different layout; use actual XEX addresses for oracles):

| Address | Original symbol |
| --- | --- |
| `$1DFD` | `PCLO` |
| `$1D5E` | `PLA1` |
| `$1E3E` | `ZYTY` |
| `$1E5F` | `NXCV` |
| `$1F4B` | `CHNGCV` |
| `$1FCF` | `ENTCV` |
| `$2042` | `CHNMON` |
| `$20C4` | `RT_` |
| `$20DD` | `LT_` |
| `$20F4` | `DW_` |
| `$210D` | `UP_` |
| `$2124` | `FD_` |
| `$2168` | `T_EX` |
| `$2182` | `WFAC` |
| `$2199` | `MFAC` |
| `$2225` | `KEJO` |
| `$22B4` | `MFX1` |
| `$22B8` | `MFEX` |
| `$231F` | `PHAJ` |
| `$2355` | `TTPO` |
| `$237D` | `TELP` |
| `$23DD` | `TKEY` |
| `$2407` | `TDOR` |
| `$242D` | `TSKA` |
| `$2460` | `TWYJ` |
| `$2486` | `TNAB` |
| `$24A6` | `TEXL` |
| `$24CA` | `TBEZ` |
| `$24F4` | `NIES` |
| `$254C` | `NSPS` |
| `$256C` | `ASCO` |
| `$257F` | `BEZL` |
| `$258A` | `BEZR` |
| `$2595` | `BEZU` |
| `$25A0` | `BEZD` |
| `$25B5` | `RNDR` |
| `$25BF` | `BOMB` |
| `$262A` | `MGNL` |
| `$264E` | `MGFL` |
| `$2666` | `MGFR` |
| `$2670` | `DZ1L` |
| `$272B` | `DZ2L` |
| `$27E2` | `DZ3L` |
| `$28B6` | `DZRU` |
| `$2903` | `MODL` |
| `$2916` | `MODR` |
| `$2929` | `ZAPO` |
| `$2971` | `STWA` |
| `$29E5` | `STWE` |
| `$2A59` | `STWI` |
| `$2A79` | `STWK` |
| `$2A99` | `TOPL` |
| `$2AC4` | `LEDZ` |
| `$2B0B` | `TFAC` |
| `$2B4C` | `WYZA` |
| `$2B71` | `WYOT` |
| `$2B8E` | `ITSTTAB` |
| `$2BD0` | `GET_` |
| `$2C0B` | `PUT_` |
| `$2C51` | `TST_` |
| `$2D49` | `CVBL` |
| `$2E9E` | `LOOK` |
| `$2F1E` | `NEXT` |
| `$2F38` | `PROC` |
| `$2FFA` | `WHAT` |
| `$307A` | `SOUND_` |
| `$30BF` | `SOUNDV` |
| `$310A` | `TABS` |

Zero-page fields: `X=$92,Y=$93,X1=$94,Y1=$95,FX=$96,FY=$97,LM=$98,VSF=$99,
VSC=$9A,TELE=$9B,FAC=$9C,CNUM=$9D,KEYS=$9E,LIVS=$9F,ZEBR=$A0,LSTE=$A1,
NABO=$A2,DEMO=$A3,SCOR=$A4..$A6,RUCH=$A8`. `CNTR=$266C`, `STRC=$2941` in the supplied XEX (archive `$1F4A/$2224`).

## Native module interface and remaining validation

`robbo/objects.mjs` exports the named-function translation `createObjectEngine`.
Its `tick()` performs one synchronous `CHNGCV` scan; scheduling, 7-frame timer,
main lifecycle, player procedure and VBL rendering are owned by the wrapper.
The context supplies map mutation/rendering (`put`), raw reads (`test`), a random
byte, sound dispatch, player dispatch and BCD score addition. It exposes movement,
classification, projectile generation and adjacency helpers to the wrapper.

`tools/robbo_object_oracle.py --ram <native-unpacked.bin>` regenerates the
semantic fixture. `deno run --allow-read tools/test-robbo-objects.mjs` checks
6,900 procedure cases and 400 complete scans.

The oracle compares all 512 map bytes, working/scan/player coordinates,
shared accounting state, score bytes, sound IDs and random-read count. It does not
prove hardware RNG phase, PAL/NTSC cycle timing, scroll/VBL interleaving, original
sprite rendering, every legal level traversal, or a complete 1:1 game conversion.
These limits must remain explicit until the remaining integration and end-to-end original-XEX checks pass.


## Supplied-XEX VBI and camera service

`CVBL=$33B2` starts by calling sound service `$B803`, then rotates exactly the
eight bytes at `IFNT+$300` (`$2300..$2307`) one byte to the right. It updates
all HUD BCD digits in `INFO=$3707` without changing any accounting variable.
The displayed cave number is the original binary-to-BCD conversion of
`(CNUM+1)&255`, including decimal wrap above 99. It restores all four floor
player colors from shadow color `$02C8`, clears DLI phase `$335A` and ATRAC
`$004D`, then updates scrolling before jumping to OS VBI exit `$E462`.

Actual state locations: display-list start address `DLSA=$36E7..$36E8`, tracked
robot target `FADR=$86..$87`, scroll flags `VSF=$99`, scroll counter `VSC=$9A`,
hardware fine scroll `$D405`. The character-screen base is `$1000`. The rendered
vertical offset is `(DLSA-$1000)/32*8 + D405`, preserving the original two-pixel
VBI steps and character-row address changes.

When idle, camera+128 >= target initiates up scrolling if camera >= `$1001`.
Otherwise, camera+512 < target initiates down scrolling if camera < `$1540`.
Up scrolling starts with flags `$82` and counter 14; down starts `$42` and
counter 2. The low-nibble termination test uses the flag byte **before** its
decrement, so each ordinary episode consists of three 16-pixel phases, totaling
48 pixels. Fine scroll is derived from the counter before its two-step update;
reversing that order shifts the picture by two pixels. Upward counter zero is
a separate settling VBI that clears hardware fine scroll and rearms counter 14.

`robbo/vbi.mjs` implements this service directly. `createVbi(ctx).tick()` calls
`ctx.soundStep(state.clock)` first, updates the original glyph bytes and HUD
when `ctx.infoFont`/`ctx.hudTemplate` are supplied, and maintains `infoPhase`,
`cameraAddress`, `targetAddress`, `scrolling`, `scrollCounter`, `vscroll` and
`cameraY`. The scheduler owns incrementing `clock` and decrementing OS timers.
`infoPhase` is bookkeeping for rendering only; the actual supplied eight-byte
font rotation is retained when font data is present.

`tools/robbo_vbi_oracle.py --ram <native-unpacked.bin>` captures the actual
supplied-XEX `CVBL`, stubbing only sound dispatch and the final OS exit.
`deno run --allow-read tools/test-robbo-vbi.mjs` passes 2,574 independent states
and four 80-frame scrolling episodes (320 frames). Cases include all 256 cave
number inputs, up/down settling phases, address carries, camera thresholds,
odd counters and flag values. Comparisons cover camera/scroll state, all 80 HUD
bytes, the eight rotated font bytes, colors, DLI/attract reset, and sound-call
ordering. This verifies the VBI service logic; external OS timing and actual
scheduled game-loop cadence remain the wrapper's responsibility.


## Measured original main-loop cadence

`timing.json` contains 160 headless Atari800 PAL measurements: 80 consecutive
cycles each on cave indices 0 and 55, using the original XEX and saved native
state. Development snapshots remain in `/private/tmp/robbo-research/`; none is
loaded by the browser. Entry snapshots are `game-entry.a8s/.bin` (cave 0) and
`game-entry-55.a8s/.bin` (cave 55). Source/emulator/snapshot hashes and every
measured RTCLOK value, scanline, timer value and interval are in the JSON.

Four measurement points distinguish the timer wait from the scan itself:
`PCLO=$2505`, timer-write completion `$2677` (TMR now 7), final scanner jump
`$26EE` (before CHNMON), and the following `PCLO`. **Successive scan starts were
exactly 7 VBI apart in both scenes: 79 of 79 intervals per scene.** This supports
7-VBI scheduling of semantic updates in the first native local port.

The main-loop return itself has variable timing. Cave 0's first return took
4 VBI with initial timer zero; its following 79 returns were exactly 7 VBI apart.
Each scan took 3 VBI, CHNMON's final HALT added 1, and the next front wait took 3.
Cave 55's first return took 5 VBI; later return intervals were 5 (1 case), 6
(16), 7 (46), 8 (14), or 9 (2) VBI. Its scan body took 3 (7 cases), 4 (45), or 5
(28) VBI; the CHNMON tail added 1 VBI in every case. The remaining front wait
was 1, 2 or 3 VBI. All measurements retained eight lives, so death/reload paths
are not responsible for those differences.

A synchronous native scan scheduled every seven VBI preserves the measured
scan-start interval but **does not reproduce the original 3–5-VBI interleaving
of object updates, sound, scrolling, font changes and hardware random reads**.
That interleaving remains an explicit limitation of the first local port; the
per-object and VBI fixtures do not establish complete cycle timing equivalence.


## Pure PIPA initializer cases

`tools/robbo_initializer_oracle.py --ram <native-unpacked.bin>` captures all
56 original initializers from `PIPA=$2400` through the first `PCLO=$2505`.
The fixture `tools/fixtures/robbo-initializer.json.gz` stores all 512 map bytes,
1,024 final font bytes, 2,048 character-screen bytes, colors and shared player /
accounting state for each cave. Only HALT, SOUND and OS SETV are isolated; the
real CHNMON and optimized PUT code run. Every case retains raw `$A0` boundary
bytes, has `LSTE=99`, counter 8, robot phase 0, `FAC=0`, `TELE=1`, zero keys and
ammo, and working coordinates X=255,Y=31. Each performs 55 HALT calls.

This is intentionally a pure state oracle. In particular it does not advance
VBI during column rendering: pure cave-55 camera is `$1000`, whereas the actual
headless entry snapshot already has camera scrolling in progress. Use the
separate measured cadence and VBI fixtures for timing; do not infer initializer
wipe duration or whole-game timing from the stubbed HALT count.

The headless timing capture is reproducible with
`tools/robbo_capture_timing.py --state <native-title-entry.a8s> --output <folder>`
(optionally `--emulator <atari800>`). It records 80 cycles each on caves 0 and 55
by default and writes the native entry/end snapshots plus `cadence.json`.


## Coupled object and player verification

`tools/robbo_coupled_oracle.py --ram <native-unpacked.bin>` executes the actual
`CHNGCV=$266D` with its actual `MFAC=$28B6` player routine enabled. Only HALT,
CHNMON and SOUND are isolated; fixed byte streams replace hardware RANDOM,
and keyboard/joystick/trigger registers carry deterministic input. The maps
come from the 56 original PIPA initializer cases. Cases retain original level
objects and vary robot positions, input, fire/cooldown, BCD inventory, demo mode,
scroll state and scan counter; targeted placements exercise neighboring original
pickups, doors, teleports, pushable objects and enemies.

`deno run --allow-read tools/test-robbo-coupled.mjs` passes 400 coupled scans
across all 56 planets, including 388 actual player dispatches, 1,585 RANDOM
reads and 259 sound calls. Each compares all 512 map bytes, the complete selected
shared player/object fields, all score bytes, tracked camera target address,
ordered sound commands and random-read count. The native side uses
`createServices(...).objects.tick()` with only its after-scan CHNMON callback
isolated to match the reference. No engine, player or object implementation
changes were needed for this coupled test.

These are atomic scan comparisons with stable input; the separately documented
3–5-VBI original scan interleaving remains outside this oracle's proof.
