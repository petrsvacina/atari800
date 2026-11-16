// Native ground sampling and ground-clearance state, from the supplied disk.
import {byte, word, signedWord, roundedProduct} from './math.mjs';
import {createFlightState} from './flight.mjs';
import {placeOccupants} from './world.mjs';

export const SERVICE_FIELDS = {
  terrainLerpRow: [0x61, 1], terrainHeight: [0x62, 1], clearance: [0x70, 1],
  mapScratchX: [0x2270, 2], mapScratchZ: [0x2272, 2],
  scaledDepth: [0x2274, 2], mapX: [0x27fd, 2], mapZ: [0x27ff, 2],
  mapOriginX: [0x2801, 2], mapOriginZ: [0x2803, 2],
  horizonDeltaX: [0x2805, 2], horizonDeltaZ: [0x2807, 2],
  directionX: [0x2809, 2], directionZ: [0x280b, 2],
  heightQuarter: [0x27f9, 1], spanTop: [0x281a, 1], spanBottom: [0x281b, 1],
  horizonPhase: [0x2834, 1], horizonSide: [0x2833, 1],
  horizonLeft: [0x282e, 1], horizonRight: [0x282f, 1],
  horizonLeftPrevious: [0x2841, 1], horizonRightPrevious: [0x2842, 1],
  horizonRangeLeft: [0x27f7, 1], horizonRangeRight: [0x27f8, 1],
  horizonDistance: [0x27f6, 1], surfaceFraction: [0x2877, 1],
  projectionPhase: [0x2879, 1], gamePhase: [0x41, 1],
  colorA: [0xda, 1], colorB: [0xdb, 1], colorC: [0xdc, 1], colorD: [0xdd, 1],
  engineStepA: [0x688, 1], engineStepB: [0x689, 1],
  engineRateA: [0x696, 1], engineRateB: [0x697, 1],
  engineGateA: [0x6a4, 1], engineGateB: [0x6a5, 1],
  sensorMaskA: [0x1027, 1], sensorMaskB: [0x1057, 1],
  parallaxX: [0x2912, 1], parallaxY: [0x2913, 1],
  objectXFraction: [0x2827, 1], objectXMid: [0x64, 1], objectXHigh: [0x65, 1],
  objectYFraction: [0x2828, 1], objectYMid: [0x66, 1], objectYHigh: [0x67, 1],
  objectAngle: [0x282d, 1], visibleObjectX: [0x2821, 1], visibleObjectY: [0x2824, 1],
  objectActualX: [0x2854, 3], objectActualZ: [0x2857, 3], objectAltitude: [0x285a, 2],
  objectStepX: [0x285c, 3], objectStepZ: [0x285f, 3], objectStepAltitude: [0x2862, 2],
  initialObjectX: [0x28fd, 2], initialObjectZ: [0x28ff, 2], initialObjectAltitude: [0x2901, 2],
  initialStepX: [0x2903, 2], initialStepZ: [0x2905, 2], initialStepAltitude: [0x2909, 2],
  mapCell: [0x2864, 1], mapHitMarker: [0x2843, 1],
  indicatorPos: [0x35, 1], indicatorValue: [0x673, 1], indicatorCharacter: [0x665, 1],
  indicatorPhase: [0x681, 1], objectPath: [0x3b, 1],
  lockonState: [0x7e, 1], introCounter: [0x2891, 1], introDelay: [0x2892, 1],
  impactTimer: [0x28ee, 1], scoreDeltaLow: [0x45, 1], scoreDeltaHigh: [0x46, 1],
  destroyedCount: [0x641, 1], messageTimer: [0x44, 1], respawnCounter: [0x620, 1],
  targetRange: [0x4d, 1], projectileStateA: [0x286a, 1],
  projectileStateB: [0x286b, 1], projectileStateC: [0x286c, 1],
  cameraStepAltitude: [0x2907, 2]
};

// Original static data, independently checked by the capture tool. These are
// object/HUD tables, not executable code.
export const SERVICE_TABLES = {
  objectAngles: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,254,254,254,254,254,254,254,254,254,254,254,253,253,253,253,253,253,253,253,253,252,252,252,252,252,252,252,251,251,251,251,251,251,250,250,250,250,250,249,249,249,249,248,248,248,247,247,247,246,246,246,245,245,244,244,244,243,243,242,242,241,241,240,240,239,239,238,238,237,236,236,235,235,234,233,233,232,231,231,230,229,229,228,227,226,226,225,224,223,222,222,221,220,219,218,217,217,216,215,214],
  hitRadius: [40,40,24,16,12,11,10,9,8,8,7,7,7,6,6,6,6,5,5,5,5,5,5,5,5,5,5,5,5,5]
};
export const THRUST_CELL_ADDRESSES = [0x3392,0x33c2,0x33c3,0x33f3,0x3423,0x3424,0x3454,0x3484,0x3485,0x34b5,0x34e5,0x34e6];

export function createServiceState(values = {}) {
  // Storage initialization only; the caller supplies the original initialized
  // values. directionX/Z are the cached original view vector, published by a
  // terrain pass; extra visual redraws must not republish logical view state.
  return Object.assign(createFlightState(), Object.fromEntries(Object.keys(SERVICE_FIELDS).map(name => [name, 0])),
    {horizonCells: Array(80).fill(0), thrustCells: Array(12).fill(0)}, values);
}

function enqueue(state, id) {
  const head = Math.min(state.eventHead, 31);
  state.eventRing[head] = id;
  state.eventHead = (head + 31) & 31;
}

// Each bit is rounded separately by the original $9A36 loops. A final floating
// bilinear interpolation would give different heights and different collisions.
function blend(low, high, fraction) {
  return byte(roundedProduct(low, fraction ^ 255) + roundedProduct(high, fraction));
}

export function sampleTerrainHeight(terrain, mapX, mapZ) {
  const column = mapX >>> 8 & 15, row = (mapZ >>> 8 & 15) << 4;
  const right = (column + 1) & 15, below = (row + 16) & 255;
  const upper = blend(terrain[row | column], terrain[row | right], mapX & 255);
  const lower = blend(terrain[below | column], terrain[below | right], mapX & 255);
  const value = blend(upper, lower, mapZ & 255), high = value >>> 4;
  return byte(value + high + (high >>> 1) + (high & 1));
}

function sample(state, terrain) {
  state.terrainHeight = sampleTerrainHeight(terrain, state.mapX, state.mapZ);
  state.terrainLerpRow = (((state.mapZ >>> 8) << 4) + 16) & 255;
}

const horizonGlyphs = [85, 213, 245, 253, 255, 127, 95, 87];
function drawHorizon(state, value, style, start) {
  const stop = start | (value >>> 2);
  let variant = (value & 3) | style, pen = (variant & 4) ^ 4;
  for (let column = start; column < start + 14; column++) {
    if (column >= stop) { pen = variant; variant &= 4; }
    const glyph = horizonGlyphs[pen];
    state.horizonCells[column] = state.horizonCells[column + 48] = glyph;
  }
}

function enterSurface(state) {
  state.surfaceFraction = (state.speed & 255) | 64;
  if (!state.energy) return;
  state.status = 52;
  if (state.engineLatch !== 10) {
    state.engineRateA = state.engineRateB = 10;
    state.engineStepA = state.engineStepB = state.engineGateA = state.engineGateB = 1;
    enqueue(state, 1); enqueue(state, 2);
  }
  if (state.speed >>> 8) state.speed = word(state.speed - 256);
  enqueue(state, 0x93);
}

function exitSurface(state) {
  if (!state.engineLatch || state.engineLatch < 2 && (!state.engineGateA || !state.engineRateA)) return;
  state.status = 180;
  state.surfaceFraction = state.engineRateA = state.engineRateB = 0;
  state.engineStepA = state.engineStepB = 255;
  state.engineGateA = state.engineGateB = 1;
  enqueue(state, 1); enqueue(state, 2);
}

export function updateTerrainHorizon(state, terrain) {
  const phase = state.horizonPhase;
  state.horizonPhase = phase >>> 1;
  if (!(phase & 1)) { state.horizonPhase++; return state; }
  state.horizonDeltaX = word(signedWord(state.directionX) >> 4);
  state.horizonDeltaZ = word(signedWord(state.directionZ) >> 4);
  const side = state.horizonSide & 1;
  state.horizonSide >>>= 1;
  if (!side) state.horizonSide++;
  state.mapX = word(state.mapOriginX + (side ? state.horizonDeltaZ : -state.horizonDeltaZ));
  state.mapZ = word(state.mapOriginZ + (side ? -state.horizonDeltaX : state.horizonDeltaX));
  sample(state, terrain);
  state.terrainHeight >>>= 1;
  if (side) state.horizonRangeRight = state.terrainHeight >>> 1;
  else state.horizonRangeLeft = state.terrainHeight >>> 1;
  let altitude = byte((state.scaledDepth >>> 9) + (side ? -(state.rollShadow >>> 8) : state.rollShadow >>> 8));
  altitude = byte(altitude + 15);
  state.horizonDistance = Math.max(0, altitude - state.terrainHeight);
  const horizon = Math.max(0, 56 - state.horizonDistance);
  if (side) {
    state.horizonRight = horizon;
    if (state.horizonRightPrevious !== horizon) {
      state.horizonRightPrevious = horizon;
      drawHorizon(state, byte(56 - horizon), 4, 16);
    }
  } else {
    state.horizonLeft = horizon;
    if (state.horizonLeftPrevious !== horizon) {
      state.horizonLeftPrevious = horizon;
      drawHorizon(state, horizon, 0, 0);
    }
  }
  return state;
}

export function updateGroundProjection(state, {terrain}) {
  state.mapX = state.mapOriginX = state.mapScratchX = state.worldX >>> 4;
  state.mapZ = state.mapOriginZ = state.mapScratchZ = state.worldZ >>> 4;
  state.scaledDepth = word(((Math.min(state.depth >>> 8, 63) << 8) | (state.depth & 255)) << 2);
  sample(state, terrain);
  state.heightQuarter = (state.terrainHeight + 3) >>> 2;
  state.spanTop = Math.max(0, 55 - state.heightQuarter);
  if ((state.scaledDepth >>> 8) >= state.terrainHeight) {
    state.clearance = (state.scaledDepth >>> 8) - state.terrainHeight;
    if (!state.landingInhibit) exitSurface(state);
  } else {
    if (state.mode) enterSurface(state);
    state.depth = word((state.depth & 0xff00) + 256);
    state.clearance = 0;
    if (state.pitch & 0x8000) state.pitch = byte((state.pitch >>> 8) + 1) << 8;
  }
  const depth = state.depth >>> 8;
  if (depth <= 55) state.spanBottom = 55 - depth;
  else { state.spanTop = Math.min(56, byte(state.spanTop + depth - 55)); state.spanBottom = 0; }
  updateTerrainHorizon(state, terrain);
  if (state.engineLatch >= 8) {
    state.projectionPhase = state.gamePhase = 1;
    state.colorA = 52; state.colorC = 56; state.colorD = 60;
  } else if (state.projectionPhase && state.engineLatch < 4) state.projectionPhase = state.gamePhase = 0;
  return state;
}

const signedByte = value => (value << 24) >> 24;
const wide = value => value & 0xffffff;

function randomByte(context) {
  if (typeof context.random !== 'function') throw new TypeError('Original random-byte source required');
  return byte(context.random());
}

function resetObjectFlags(state) { state.objectSlot = state.objectIndex = state.objectDither = 255; }

function advanceAxes(state) {
  state.rollShadow = state.rollShadow & 0x8000 ? word(state.rollShadow + 20) : Math.max(0, state.rollShadow - 20);
  if (state.clearance) state.depth = word(state.depth - 48);
  else if (!state.landingPhase && !state.timerParamA) {
    state.landingPhase++;
    if (!(state.objectSlot & 128)) resetObjectFlags(state);
  }
}

function targetBlip(state) {
  let horizontal = byte(state.horizonRangeLeft - state.horizonRangeRight);
  if ((byte(state.horizonRangeLeft + state.horizonRangeRight) >>> 1) < (state.depth >>> 8)) {
    const magnitude = horizontal & 128 ? byte(-horizontal) : horizontal;
    if (magnitude < 16) horizontal = 0;
  }
  state.rollRate = horizontal;
  if (!state.groundProximity) { state.pitchRate = 200; return; }
  const depth = state.depth >>> 8;
  let vertical = !(state.sensorMaskA & 170) && !(state.sensorMaskB & 170) && state.clearance >= 42 ? 0 : 56;
  if (depth >= 42 && !(state.pitch & 0x8000)) vertical = byte(vertical + 200);
  else {
    const difference = signedByte(byte(32 - depth - (depth < 42 ? 1 : 0))) >> 1;
    if (difference < 0) vertical = byte(vertical + difference);
  }
  state.pitchRate = vertical;
  if (state.parallaxX >= 48 && state.parallaxX < 209) return;
  state.rollRate = byte(state.rollRate + state.parallaxX * 2);
  if (state.parallaxY >= 32 && state.parallaxY < 225) return;
  state.pitchRate = byte(state.pitchRate + byte(state.parallaxY * 2 ^ 255));
}

function thrustBar(state, value) {
  const threshold = byte(value + 8);
  let at = 0;
  for (let column = 8; column <= 15; column++) {
    const lit = column < threshold, odd = column & 1;
    state.thrustCells[at++] = odd ? lit ? 183 : 55 : lit ? 180 : 52;
    if (odd) state.thrustCells[at++] = lit ? 184 : 56;
  }
}

function jitterColumn(state, context) {
  const sum = randomByte(context) + randomByte(context);
  state.objectPanXLo = sum & 255;
  state.objectPanXHi = state.objectXMid < 108 ? (sum >>> 8) ^ 255 : sum >>> 8;
  const random = randomByte(context);
  state.objectPanYLo = byte(random - 128);
  state.objectPanYHi = random < 128 ? 255 : 0;
}

function integrateObject(state) {
  const x = wide((state.objectXHigh << 16 | state.objectXMid << 8 | state.objectXFraction) -
    signedWord(state.objectVelocityX) - signedWord(state.objectPanXHi << 8 | state.objectPanXLo));
  const y = wide((state.objectYHigh << 16 | state.objectYMid << 8 | state.objectYFraction) +
    signedWord(state.objectVelocityY) + signedWord(state.objectPanYHi << 8 | state.objectPanYLo));
  state.objectXFraction = x & 255; state.objectXMid = x >>> 8 & 255; state.objectXHigh = x >>> 16;
  state.objectYFraction = y & 255; state.objectYMid = y >>> 8 & 255; state.objectYHigh = y >>> 16;
  if (state.objectXHigh || state.objectYHigh) { state.visibleObjectY = 0; return; }
  let offset = signedByte(SERVICE_TABLES.objectAngles[state.objectSlot]);
  if (state.objectAngle >= 48) offset = 0;
  if (state.objectAngle >= 32) offset >>= 1;
  state.visibleObjectX = byte(offset + state.objectYMid);
  state.visibleObjectY = state.objectXMid;
}

function loadObjectVelocity(state) {
  state.objectActualX = state.initialObjectX << 8;
  state.objectActualZ = state.initialObjectZ << 8;
  state.objectAltitude = (Math.min(255, (state.initialObjectAltitude >>> 8) + 8) << 8) | (state.initialObjectAltitude & 255);
  state.objectStepX = wide(signedWord(state.initialStepX) * 4);
  state.objectStepZ = wide(signedWord(state.initialStepZ) * 4);
  state.objectStepAltitude = word((signedWord(state.initialStepAltitude) >> 1) - 256);
  enqueue(state, 0x91);
}

function jitterAttitude(state, context) {
  let high = state.pitch >>> 8;
  if (high !== 244) { high = byte(high - 1); if (high !== 244) high = byte(high - 1); }
  state.pitch = high << 8 | state.pitch & 255;
  high = state.roll >>> 8;
  if (randomByte(context) & 128) {
    if (high !== 251) { high = byte(high - 1); if (high !== 251) high = byte(high - 1); }
  } else if (high !== 5) { high = byte(high + 1); if (high !== 5) high = byte(high + 1); }
  state.roll = high << 8 | state.roll & 255;
  state.speed = Math.max(0, (state.speed >>> 8) - 8) << 8 | state.speed & 255;
}

function resetIndicator(state) {
  state.indicatorPos = state.indicatorValue = 0;
  state.indicatorCharacter = 160;
  state.indicatorPhase = (state.clock & 5) + 2;
  enqueue(state, 8);
}

function targetBox(state, context) {
  if (state.objectXHigh || state.objectYHigh || state.objectXMid < 52 || state.objectXMid >= 172 || state.objectYMid < 26 || state.objectYMid >= 106) return;
  state.objectPath = 32;
  resetIndicator(state);
  jitterAttitude(state, context);
  state.introDelay = 0; state.status = 52; state.introCounter = 30;
}

function resetProjectile(state) { state.objectFrame = 128; enqueue(state, 0x8e); }

function explodeObject(state) {
  state.gamePhase = byte(state.gamePhase + 1);
  state.colorB = 126; state.colorD = 124; state.colorC = 118; state.colorA = 120;
  state.impactTimer = 2;
  enqueue(state, 0x8f);
}

function incrementDestroyed(state) {
  let low = (state.destroyedCount & 15) + 1;
  if (low > 9) low += 6;
  let high = (state.destroyedCount >>> 4) + (low > 15 ? 1 : 0);
  if (high > 9) high += 6;
  state.destroyedCount = (high << 4 | low & 15) & 255;
}

function scoreEmplacement(state) { state.scoreDeltaLow = 0; state.scoreDeltaHigh = 1; incrementDestroyed(state); }

function respawnPilot(state, context) {
  if (!state.respawnCounter) return;
  const visible = typeof context.visibleCells === 'function' ? context.visibleCells() : context.visibleCells;
  if (!visible || visible.length !== 45) throw new TypeError('Original 45-cell visible-world list required');
  placeOccupants(context.terrain, context.objects, {random: () => randomByte(context), value: state.respawnCounter === 1 ? 201 : 200, count: 1, visibleCells: visible});
  state.respawnCounter = byte(state.respawnCounter - 1);
}

function checkProjectileHit(state, context, carry) {
  const near = byte(state.objectIndex + 4 + carry);
  if (Math.abs(near - state.objectFrame) >= 4) return;
  if (state.objectFrame >= SERVICE_TABLES.hitRadius.length) throw new RangeError('Unverified original projectile frame beyond hit-radius data');
  const first = state.objectScreenXHi - 12;
  const delta = byte(first) - state.visibleObjectY - (first < 0 ? 1 : 0);
  const dy = delta < 0 ? byte(-byte(delta)) : byte(delta);
  const x = byte(state.objectScreenYHi + 66);
  const dx = Math.abs(x - state.visibleObjectX);
  if (((dx + dy) >>> 2) >= SERVICE_TABLES.hitRadius[state.objectFrame]) return;
  state.objectDither = 0;
  resetIndicator(state); resetProjectile(state); explodeObject(state);
  state.scoreDeltaLow = 0x50; state.scoreDeltaHigh = 2;
  incrementDestroyed(state);
  jitterColumn(state, context);
}

function stepObject(state, context) {
  state.objectActualX = (state.objectActualX + state.objectStepX) & 0xfffff;
  state.objectActualZ = (state.objectActualZ + state.objectStepZ) & 0xfffff;
  state.mapX = state.objectActualX >>> 8; state.mapZ = state.objectActualZ >>> 8;
  const altitude = state.objectAltitude + state.objectStepAltitude;
  const carry = altitude >>> 16;
  let high = altitude >>> 8 & 255;
  if (carry) { if (!(state.objectStepAltitude & 0x8000)) high = 255; }
  else if (state.objectStepAltitude & 0x8000) high = 0;
  state.objectAltitude = high << 8 | altitude & 255;
  if (!(state.objectSlot & 128)) checkProjectileHit(state, context, carry);
  const x = state.objectActualX >>> 8 & 255, z = state.objectActualZ >>> 8 & 255;
  state.mapCell = (((state.objectActualZ >>> 16) + (z >>> 7)) << 4 | ((state.objectActualX >>> 16) + (x >>> 7)) & 15) & 255;
  let occupant = context.objects[state.mapCell];
  const centreX = x >= 48 && x < 208, centreZ = z >= 48 && z < 208;
  const immediate = occupant && Math.min(255, context.terrain[state.mapCell] + 16) >= high && !centreX && !centreZ;
  if (!immediate) {
    sample(state, context.terrain);
    if (state.terrainHeight < high) return;
    if (centreX || centreZ) { resetProjectile(state); return; }
  }
  occupant = context.objects[state.mapCell];
  if (!occupant || occupant >= 248) { resetProjectile(state); return; }
  context.objects[state.mapCell] = state.mapHitMarker = 252;
  explodeObject(state);
  if (occupant >= 100) {
    if (occupant === 100) { scoreEmplacement(state); state.targetRange = 40; state.lockonState |= 128; }
    else if (occupant === 128) { scoreEmplacement(state); state.messageTimer = 64; }
    else { respawnPilot(state, context); state.messageTimer = 73; }
  }
  resetProjectile(state);
}

/** Attach the original surrounding physics services to integrateFlight().
 * `terrain` and `objects` are the shared 256-byte world grids. `visibleCells`
 * publishes the original 45-cell logical view; smooth-only draws must not change
 * it. `random` must be the SAME byte source used by the flight integrator.
 */
export function attachFlightServices(context) {
  if (!(context.terrain instanceof Uint8Array) || context.terrain.length !== 256 || !(context.objects instanceof Uint8Array) || context.objects.length !== 256) throw new TypeError('Original terrain and occupant grids of 256 bytes required');
  return {
    targetBlip,
    throttleBar: thrustBar,
    advanceAxes,
    loadObjectVelocity,
    stepObject: state => stepObject(state, context),
    targetBox: state => targetBox(state, context),
    jitterColumn: state => jitterColumn(state, context),
    integrateObject
  };
}
