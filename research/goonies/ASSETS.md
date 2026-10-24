# The Goonies — original graphics extraction

The web game uses PNGs and JavaScript pixel arrays extracted from the supplied Atari disk. Atari800 is a development tool only; no emulator, operating-system ROM, complete RAM dump, original ATR or reference video is a browser dependency.

## Sources and reproduction

- `Goonies/Goonies.atr`, 92,176 bytes, SHA-256 `ccdea8ff8e56b9d09436de1ec64094e2130dee41f2d3d921f8c02f256f16bed7`.
- User-supplied `Goonies/The Goonies Playthrough (Atari XL⧸XE) [PZRqQE76Nc0].mkv`, 742.641 seconds, 672×480. This is a visual/color reference and is not published.
- `tools/goonies_extract_assets.py --capture` boots a private temporary disk copy in the Atari800 monitor, invokes the original loader for all ten room IDs, captures only the bitmap/sprite data needed below and then closes the emulator. The original disk remains unchanged.
- `python3 tools/goonies_extract_assets.py` regenerates outputs from `graphics-source.json` without an emulator.
- The packed source graphics and relevant metadata are in `graphics-source.json`; PNG hashes and basic display geometry are in `graphics-provenance.json`.

A second fresh boot reproduced all ten bitmap payloads and every exported sprite/initial-entity field from the first extraction. All 199 frame records were checked for header size, pixel-array size, two-bit values and packed-data length. The eight playfield PNG dimensions are 320×176. This validates extraction/reproducibility, not an instruction-by-instruction recreation of the game engine.

## Original display and pristine rooms

The full logical video frame is 336×240. The 320×176 playfield occupies `(8,32)`; its preceding 16 bitmap rows contain the original HUD. The web engine uses playfield coordinates `(0..319,0..175)` and places the playfield at `(8,32)` in the full canvas.

- Display list: `$6200`, ANTIC mode E, LMS `$2010` for 102 rows then LMS `$3000` for 90 rows.
- Front bitmap: `$2010..$3E0F`, 320×192, 40 packed bytes per row.
- Back bitmap: `$4010..$5E0F`.
- Exported playfield: `$2290..$3E0F`, exactly 7,040 bytes.
- Every packed byte contains four two-bit color pixels. Each color pixel is two physical horizontal pixels. The exporter preserves that geometry.

The loader receives the requested original room ID in `$112E`; `$1130` holds the loaded room ID. Forcing `$1130=$FF`, setting `$112E`, starting the original scene setup at `$074A` and breaking at `$0F69` captures a fresh bitmap immediately after `$69A6` has loaded it, before actors are drawn. Forcing the loaded-ID mismatch is necessary even when reloading the same room: otherwise the original keeps a cached bitmap with old actor pixels. Breaking next at `$0786` captures the original initialized actor and character-look-up tables.

The original room IDs are **not the video/native progression order**:

| Native scene | Original room | Background |
| --- | --- | --- |
| 0 | 0 | House |
| 1 | 2 | Buckets and pool |
| 2 | 1 | Valves and pipes |
| 3 | 3 | Bats and seesaw |
| 4 | 4 | Skull |
| 5 | 5 | Organ |
| 6 | 6 | Octopus |
| 7 | 7 | Ship |

Original rooms 8 and 9 provide `ending.png` and `title.png`. `logo.png` is a transparent crop `(30,110,150,37)` from the original title playfield, preserving the pixel wordmark and its colored edges. It is not retyped artwork.

The eight PNGs are pristine **room-load bitmaps**, free of the two children and initial software enemies. Some interactive props are initially baked into the original room bitmap, including the house chair. A native moving-prop implementation must restore/clear its original background patch before drawing the moved prop. Calling these maps actor-free does not imply every interactive object has been erased.

## Palette

The original hardware registers select black, PF0 `$32`, PF1 `$74`, PF2 `$0E`. The exported RGB colors are calibrated against eroded/interior pixels of matching source shapes in the supplied video (house around 20 seconds, buckets around 100 seconds, skull around 450 seconds):

| Pixel index | RGB | Interpretation |
| --- | --- | --- |
| 0 | `#000000` | Black background; transparent in software sprites |
| 1 | `#761200` | Dark rust |
| 2 | `#4e30e2` | Blue/purple |
| 3 | `#eeeeee` | White |

Solid interior regions agree across the reference scenes. Encoded video edges have scaling/compression artifacts, so these values are a reference-video calibration, not a universal analog Atari RGB standard. No geometry was inferred from video or redrawn to match it.

## Browser API

Load `assets/graphics.js` before `assets/sprites.js`.

`GOONIES_GRAPHICS` provides `width`, `height`, `palette`, `scenes`, `title`, `ending`, `logo` and `sprites`. Scene objects have `{id,sourceRoomId,name,src,packedBase64}`. The packed data is included for inspection/native pixel processing; rendering can use the PNG directly.

`GOONIES_GRAPHICS.sprites` contains:

- `characters[7]`: source models with nine frames and a `poses` map. The models are numbered by their original source base address, without guessing the children's film names.
- `sceneCharacters`: `[[0,2],[3,0],[3,1],[6,5],[4,0],[1,4],[5,6],[2,2]]`, in native scene order. These pairs come directly from the two 32-pointer character groups copied into `$6BAC` by the original room loader.
- `fratelli.frames[9]`: the common adult character graphics at `$7595..$777A`; `fratelli.alternateFrames[9]`: the second original adult set at `$1C7A..$1E89`.
- `bat.frames[4]`: the verified original bat type-6 graphics from room 3, `$A91B/$A927/$A933/$A93F`, 16×5. These are the four original LUT phase variants, not a claim of four independent time animation poses.
- `projectiles[4]`: common 8-pixel-wide records at `$757F..$7594`.
- `commonHazards[4]`: narrow white original records at `$777B..$780D`. These are not bat or human poses.
- `objects[17]`: the common source record stream `$1A1B..$1BE1`. Frames 8–11 are the four visibly verified chair variants. Other names are deliberately left to game-specific interpretation.
- `roomObjects[8]`: per-room direct draw references and actor LUT graphics, in native scene order. Each entry has `id`, `sourceRoomId`, `frames`. Frame counts are `[0,8,8,5,48,7,5,8]`. Frames carry stable `sourceObjectId`/`sourceAddress`; use these rather than an assumed index when choosing an individual prop. Proven direct draw call sites are listed in `callSites`; LUT-derived records have `actorFrames:[{logicalFrame,phase}]`. Bat and musical-note records have verified tags. The rest retain source identifiers rather than speculative names.
- `initialEntities[8]`: original initialized actor slots, described below.

Every bitmap frame has `{frameIndex,sourceAddress,width,height,bounds,packedBase64,pixels}`. `pixels` is a flat row-major array of indices 0–3 at full physical-pixel resolution. Index zero is transparent, matching the original software mask. Preserve `width/height` and left/right padding; `bounds` is the opaque rectangle `[left,top,rightExclusive,bottomExclusive]`. `packedBase64` contains the original bytes after the two-byte sprite header `[widthBytes,height]`; `width=widthBytes*8`.

Character pose conveniences are `walkRight:[0,2]`, `walkLeft:[1,3]`, `jumpRight:4`, `jumpLeft:5`, `idle:6`, `climb:[6,7]`, `special:8`. They are practical native renderer aliases over the original pixels. `special` is intentionally not asserted to be a particular death/hang action. The source animation chooser at `$0A86` selects poses 0/2 and 1/3 by horizontal direction and position, and also uses the front-facing pose while idle; the exact original action state machine is not exported by this graphics module.

## Original entity data and room resources

The original generic actor arrays have **11 slots**, not just two players. Actor counts after scene initialization, in native progression order, are `[3,2,3,3,2,11,3,3]`.

| Base address | Field |
| --- | --- |
| `$1F00` | Actor type, zero means unused |
| `$1F0B` | Horizontal velocity |
| `$1F16` | Vertical velocity |
| `$1F21` | Horizontal raw coordinate (two physical pixels/unit) |
| `$1F2C` | Vertical raw coordinate (includes 16 HUD bitmap rows) |
| `$1F37` | Original frame/status byte, including hidden flag |
| `$1F42` | Action state |
| `$1F4D` | Direction/state |

`initialEntities[].actors` contains `sourceObjectId` (slot), `sourceType`, `xRaw`, `yRaw`, convenient `x=xRaw*2`, `y=yRaw-16`, `status` and `direction`. The two children also have `tag:"character"` and their corresponding `characterId`; verified source types 5 and 6 are tagged `fratelli` and `bat`. Other types are preserved numerically.

These coordinates are the original actor's reference, not the bottom-center coordinate used by every possible native engine. The original draw routine `$0AE3` chooses one of four source pointers using `xRaw&3` and draws at byte column `xRaw>>2`, row `yRaw`. Thus a literal original draw canvas origin is `floor(xRaw/4)*8,yRaw-16`; phase-specific source padding accounts for some fine positioning. Use full sprite bounds when converting to a feet/body reference. The initial house player's drawn sprite was checked against an original running frame at physical bitmap canvas `(16,86)` for raw `(9,102)`.

The sprite pointer table starts at `$6BAC`. Each logical actor frame has four pointers. Child source graphics occupy `$780E..$84D9`; source bases of the seven models are `$780E,$7A0C,$7C0A,$7DD2,$7F9A,$8162,$832A`. The generic software blitter is `$67A7`; its `$697D` mask builder preserves destination pixels where source color is zero.

Per-room extra resources load at `$A400`; sector counts in `$6BA2` are `[0,18,16,13,34,13,19,16,8,0]`, at disk sector numbers `[313,313,331,347,360,394,407,426,442,313]` from `$6B8E`. These resources contain **code and graphics**, not a uniform tile/collision array. The extractor accepts proven immediate C5/C6 source-pointer setup followed by the original blitter call, plus verified per-room actor LUT ranges: room3 frame30, room4 frames31–42, room5 frames43–47, room6 frame48, room7 frame57. Unused global LUT entries can point into another room's former bank; interpreting all superficially valid headers would export code as fake artwork. Room0 has no extra bank and deliberately exports no stale `$A400` references.

This graphics extraction does not supply a recovered tile collision map, dynamic prop trajectories, every possible fragment copied by custom per-room code, or exact original gameplay timing. The independently researched native scene rules/platforms live in `scenes.json`/`RULES.md`. The original sources and extracted pixels are kept separate from those native gameplay approximations.
