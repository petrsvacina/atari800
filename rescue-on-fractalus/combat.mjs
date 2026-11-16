// Native foreground targeting and enemy fire from the supplied disk.
import {byte, word} from './math.mjs';
import {createRescueState} from './rescue.mjs';
import {enqueueEvent} from './systems.mjs';
import {createObjectContext} from './objects.mjs';

export const COMBAT_FIELDS = {
  enemyEvent: [0x63d, 1], fireDelayMask: [0x624, 1],
  saucerReload: [0x621, 1], saucerCountdown: [0x622, 1], rangeRecovery: [0x61c, 1],
  pilotDistancePrevious: [0x283f, 1], lockCandidateCount: [0x2837, 1], lockCandidateKind: [0x2838, 1],
  targetKind: [0x2839, 1], targetReflect: [0x283a, 1], objectTint: [0x2840, 1],
  targetWindowX: [0x2847, 1], targetWindowY: [0x2845, 1], targetMetric: [0x2916, 1],
  targetDistance: [0x2914, 1], targetCost: [0x2915, 1], drawReflect: [0x290f, 1],
  seenTargetKind: [0x2910, 1], seenTargetReflect: [0x2911, 1],
  groundVisible: [0x28fb, 1], anyVisible: [0x28fc, 1], spanMaximum: [0x28ea, 1],
  spanSide: [0x28e7, 1], spanDepth: [0x28e8, 1], alienSearchCell: [0x281f, 1],
  fireTargetX: [0x28eb, 1], fireTargetY: [0x28ec, 1], fireQueued: [0x28ed, 1],
  fireFractionX: [0x28ef, 1], fireX: [0x28f0, 1], fireFractionY: [0x28f1, 1], fireY: [0x28f2, 1],
  fireFractionWidth: [0x28f3, 1], fireWidth: [0x28f4, 1],
  fireVerticalStep: [0x28f7, 1], fireRowDelta: [0x28f8, 1], fireWidthStep: [0x28f9, 1],
  fireLineRemaining: [0x28fa, 1], fireStepX: [0x5b, 2], fireMask: [0x58, 1]
};

export function createCombatState(values = {}) {
  return Object.assign(createRescueState(), Object.fromEntries(Object.keys(COMBAT_FIELDS).map(name => [name, 0])),
    {terrainScreenSpans: Array(32).fill(0)}, values);
}
function randomByte(random, site) {
  if (typeof random !== 'function') throw new TypeError('Original random-byte source required');
  return byte(random(site));
}
const signedByte = value => (value << 24) >> 24;
const marked = (state, event) => enqueueEvent(state, event | 128);

// $4E58 walks all cells in a fixed permutation; a currently visible pilot can
// never be converted into an alien by this pass.
function markUnseenAlien(state, objects, visibleCells) {
  let cell = 0;
  do {
    state.alienSearchCell = cell;
    if (objects[cell] === 1 && !visibleCells.includes(cell)) { objects[cell] = 128; return; }
    cell = byte(cell + 67);
  } while (cell);
}

function targetCandidate(state) {
  if (state.objectFrame || !state.controlMode) return;
  let kind;
  if (state.objectSlot & 128) {
    const near = value => value < 12 || value >= 245;
    if (!near(state.parallaxX) || !near(state.parallaxY)) { state.lockCandidateCount = 0; return; }
    kind = state.seenTargetKind;
  } else {
    if (state.objectXMid < 72 || state.objectXMid >= 152 || state.objectYMid < 36 || state.objectYMid >= 96) {
      state.lockCandidateCount = 0; return;
    }
    kind = 1;
  }
  state.lockCandidateCount = byte(state.lockCandidateCount + 1);
  if (state.lockCandidateCount < 2) return;
  state.lockCandidateKind = kind; state.lockCandidateCount = 0;
}

/** Original per-pass resets, retaining the object metadata which $A31E leaves
 * untouched. In particular the right half retains the left-half rescue span.
 */
export function createTerrainContext(state, {half = 0, random} = {}) {
  return createObjectContext({
    half, random, deathPhase: state.systemsOff, altitudeHigh: state.depth >>> 8,
    movingObjectMode: state.objectIndex, reflect: state.drawReflect || 0,
    groundVisible: 0, anyVisible: state.objectIndex & 128 ? 0 : 1,
    target: {cost: 128, distance: 128, dx: 128, dy: 128,
      kind: state.seenTargetKind, reflect: state.seenTargetReflect},
    span: {maximum: half ? state.spanMaximum : 128, range: half ? state.pilotDistance : 128,
      side: 128, depth: 128, cell: state.rescueCell, x: state.pilotX, y: state.pilotY},
    shot: {depth: 0, x: state.fireTargetX, y: state.fireTargetY}
  });
}

/** Publish the state tail of one ORIGINAL-rate terrain pass ($A433-$A612).
 * context is the same GroundObjectPainter context used for that pass. `half`
 * is the byte offset 0 or 48. Smooth presentation redraws must not call this.
 */
export function applyTerrainEffects(state, world, geometry, context, {random, half = context.half, skyline} = {}) {
  state.pilotColumnLimit = half + 92;
  state.cameraStepAltitude = state.pitch;
  state.groundVisible = byte(context.groundVisible); state.anyVisible = byte(context.anyVisible);
  const target = context.target, span = context.span, shot = context.shot;
  state.parallaxX = target.dx; state.parallaxY = target.dy;
  state.targetDistance = target.distance; state.targetCost = target.cost;
  state.drawReflect = context.reflect;
  state.seenTargetKind = target.kind; state.seenTargetReflect = target.reflect;
  state.spanSide = span.side; state.spanDepth = span.depth; state.spanMaximum = span.maximum;
  state.pilotDistance = span.range; state.rescueCell = span.cell; state.pilotX = span.x; state.pilotY = span.y;
  state.fireQueued = shot.depth; state.fireTargetX = shot.x; state.fireTargetY = shot.y;
  state.approachSentinelA = span.side; state.approachSentinelB = span.depth;
  if (span.range & 128) state.rescueStatus = 0;
  else {
    state.rescueStatus = Math.min(9, (span.range >>> 2) + 1);
    if (state.rescueStatus !== state.pilotDistancePrevious) {
      if (state.rescueStatus < state.pilotDistancePrevious && !state.landingPhase) marked(state, 20);
      state.pilotDistancePrevious = state.rescueStatus;
    }
  }
  state.targetWindowX = byte((signedByte(target.dx) >> 1) + 125);
  state.targetWindowY = byte(target.dy + 21); state.targetMetric = target.distance;
  state.targetKind = target.kind; state.targetReflect = target.reflect;
  if (state.scene) targetCandidate(state);
  state.objectTint = context.anyVisible ? 116 : 0;
  state.initialObjectX = state.mapScratchX; state.initialObjectZ = state.mapScratchZ;
  state.initialObjectAltitude = state.scaledDepth; state.initialStepX = state.directionX; state.initialStepZ = state.directionZ;
  state.initialStepAltitude = state.cameraStepAltitude;
  // CMP/ROR sign-extends the byte difference; ADC adds its discarded low bit.
  if (!state.terrainScreenSpans) state.terrainScreenSpans = Array(32).fill(0);
  for (let row = 31; row >= 0; row--) {
    const difference = byte(geometry.spans[16] - geometry.spans[row]);
    const rounded = (difference >>> 1 | difference & 128) + (difference & 1);
    state.terrainScreenSpans[row] = byte(rounded);
  }
  let increase;
  if (!context.groundVisible) increase = state.rangeRecovery + 1;
  else if (state.landingPhase) increase = 0;
  else {
    const roll = byte((state.delayedRoll << 3 >>> 8) - (state.roll << 3 >>> 8));
    const pitch = byte((signedByte(state.delayedPitch) >> 2) - (signedByte(state.pitchRate) >> 2));
    increase = byte((roll & 128 ? byte(-roll) : roll) + (pitch & 128 ? byte(-pitch) : pitch));
  }
  let range = byte(state.targetRange + increase);
  if (range & 128) range = 127;
  state.targetRange = Math.max(0, range - state.rangeRecovery);
  if (state.targetRange >= 32) { if (!(state.lockonState & 128)) state.lockonState = 128; }
  else if (state.lockonState === 128) state.lockonState = 0;
  if (state.gamePhase && state.level >= 6 && randomByte(random, 'combat.markAlien') <= state.level - 6)
    markUnseenAlien(state, world.objects, geometry.mapIndex);
  if (state.mapHitMarker) {
    state.mapHitMarker = 0;
    for (let cell = 0; cell < 256; cell++) if (world.objects[cell] > 249) {
      world.objects[cell] = byte(world.objects[cell] + 1); state.mapHitMarker = byte(state.mapHitMarker + 1);
    }
  }
  // The foreground's following rescue entry uses this final object index.
  let nextIndex = state.objectSlot;
  if (!(state.objectSlot & 128) || state.landingPhase || !state.saucerReload) return {nextIndex};
  state.saucerCountdown = byte(state.saucerCountdown - 1);
  if (state.saucerCountdown) return {nextIndex};
  state.saucerCountdown = state.saucerReload;
  const chance = randomByte(random, 'combat.spawnColumn');
  if (chance & 128) return {nextIndex};
  const column = chance + 64;
  const height = (randomByte(random, 'combat.spawnHeight') & 31) + 110;
  if (!skyline) throw new TypeError('Original terrain skyline required for saucer spawning');
  if (height <= skyline[column]) return {nextIndex: column};
  state.objectYMid = byte((128 - height) * 2 + 66);
  state.objectXMid = column - 16;
  state.objectXHigh = state.objectYHigh = state.objectPanXHi = state.objectPanYHi = 0;
  const sum = randomByte(random, 'combat.spawnDriftA') + randomByte(random, 'combat.spawnDriftB');
  state.objectPanXLo = byte(sum); state.objectPanXHi = state.objectXMid < 108 ? (sum >>> 8) ^ 255 : sum >>> 8;
  const vertical = randomByte(random, 'combat.spawnDriftY');
  state.objectPanYLo = byte(vertical - 128); state.objectPanYHi = vertical < 128 ? 255 : 0;
  state.objectIndex = state.objectSlot = state.targetWindowY = 127;
  state.indicatorPos = 1; state.objectAngle = state.depth >>> 8;
  return {nextIndex: column, spawned: true};
}

/** $AA95: the impact walk uses limits, rather than a substitute shake effect. */
export function jitterImpact(state, random) {
  let high = state.pitch >>> 8;
  if (high !== 244) { high = byte(high - 1); if (high !== 244) high = byte(high - 1); }
  state.pitch = high << 8 | state.pitch & 255;
  high = state.roll >>> 8;
  if (randomByte(random, 'combat.impactRoll') & 128) {
    if (high !== 251) { high = byte(high - 1); if (high !== 251) high = byte(high - 1); }
  } else if (high !== 5) { high = byte(high + 1); if (high !== 5) high = byte(high + 1); }
  state.roll = high << 8 | state.roll & 255;
  state.speed = Math.max(0, (state.speed >>> 8) - 8) << 8 | state.speed & 255;
}

function plotFire(raster, x, y) {
  if (x >= 44 && x < 212 && y >= 108 && y < 151) raster.plot(x, y, 3);
}
function widenFire(state) {
  const width = state.fireFractionWidth + state.fireWidthStep;
  state.fireFractionWidth = byte(width);
  if (width > 255) state.fireWidth = byte(state.fireWidth + 1);
}
function plotFireDown(state, raster) {
  state.fireStepX = word(state.fireStepX - 64);
  let y = state.fireY;
  while (y >= 108) {
    let x = state.fireX;
    state.fireLineRemaining = state.fireWidth;
    do {
      plotFire(raster, x, y); x = byte(x + 1);
      state.fireLineRemaining = byte(state.fireLineRemaining - 1);
    } while (state.fireLineRemaining);
    widenFire(state);
    const sum = state.fireFractionX + (state.fireStepX & 255);
    state.fireFractionX = byte(sum);
    state.fireX = byte(state.fireX + (state.fireStepX >>> 8) + (sum >>> 8));
    y--;
  }
}
function plotFireUp(state, raster) {
  let x = state.fireX, y = state.fireY;
  while (x >= 44 && x < 212 && y >= 108) {
    state.fireLineRemaining = state.fireWidth;
    do {
      plotFire(raster, x, y); y--;
      if (y < 108) break;
      state.fireLineRemaining = byte(state.fireLineRemaining - 1);
    } while (state.fireLineRemaining);
    widenFire(state);
    const sum = state.fireFractionY + state.fireVerticalStep;
    state.fireFractionY = byte(sum);
    state.fireY = byte(state.fireY + state.fireRowDelta + (sum >>> 8)); y = state.fireY;
    x += state.fireStepX & 32768 ? -1 : 1;
  }
}

/** Original $A99C bolt/countdown update, once at each original foreground pass.
 * Returned nextIndex is defined only on a branch which publishes a new index;
 * otherwise the caller retains the index from its preceding terrain pass.
 */
export function stepEnemyFire(state, raster, random) {
  state.impactTimer = byte(state.impactTimer - 1);
  if (state.impactTimer & 128) {
    state.impactTimer = state.fireDelayMask & randomByte(random, 'combat.fireDelay');
    if (!state.objectDither) state.objectDither = state.objectSlot = state.objectIndex = 255;
    if (!state.landingPhase) state.status = 180;
    state.gamePhase = state.fireQueued = 0;
    return {phase: 'reset'};
  }
  if (state.impactTimer || !state.fireQueued) return {phase: 'wait'};
  state.fireX = state.fireTargetX; state.fireY = state.fireTargetY; state.fireWidth = 1;
  state.fireFractionX = state.fireFractionY = state.fireFractionWidth = 128;
  state.fireMask = 255; state.fireRowDelta = 0;
  const lateral = randomByte(random, 'combat.fireLateral');
  let high = lateral & 128 ? 255 : 0;
  const delayed = state.delayedRoll >>> 8;
  if (delayed & 128) { if (delayed < 255) high = 0; }
  else if (delayed >= 2) high = 255;
  state.fireStepX = high << 8 | byte(lateral << 1);
  state.fireVerticalStep = byte(randomByte(random, 'combat.fireVertical') << 1);
  state.fireRowDelta = 255;
  if (state.lockonState !== 7) {
    state.fireWidthStep = ((state.targetRange ^ 255) >>> 3) + 12;
    if (randomByte(random, 'combat.fireDirection') & 128) plotFireUp(state, raster);
    else plotFireDown(state, raster);
    state.colorB = 190;
    if (!state.gamePhase) state.colorD = 40;
    state.gamePhase = byte(state.gamePhase + 1);
    marked(state, 7); marked(state, 2);
    return {phase: 'bolt', nextIndex: 2};
  }
  const difference = byte(103 - state.fireTargetX);
  state.fireStepX = (difference & 128 ? 65280 : 0) | byte(difference << 1);
  state.fireWidthStep = byte(107 - state.fireTargetY);
  plotFireDown(state, raster);
  state.objectPath = 16; state.gamePhase = byte(state.gamePhase + 1);
  state.colorB = 190; state.colorD = 188; state.colorC = 182; state.colorA = 184; state.status = 52;
  for (const event of [3, 4, 10, 11]) marked(state, event);
  jitterImpact(state, random);
  return {phase: 'impact', nextIndex: 11};
}

/** Exact priority of the foreground $3FCD dispatcher; lifecycle owns waits. */
export function enemyDispatch(state) {
  return state.enemyEvent ? 'cinematic' : state.alienInside ? 'alien' : null;
}
