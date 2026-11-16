// Native fixed-point ship motion from the supplied disk, $8E5B-$930D.
// Called on the simulation half of the VBI, not for each terrain redraw.
import {byte, word, signedWord, roundedProduct} from './math.mjs';

const signedByte = value => (value << 24) >> 24;

// $4430/$4457: notch 0 is fastest, 7 slowest, 8 is the landing/off setting.
const thrustTable = [214, 209, 203, 196, 188, 179, 169, 158, 146, 133, 119, 104, 87, 69, 50, 30];
export function thrustRate(level, notch) {
  if (!Number.isInteger(level) || level < 1 || level > 99 || !Number.isInteger(notch) || notch < 0 || notch > 8) throw new RangeError('Original level 1–99 and thrust notch 0–8 required');
  return notch === 8 ? 0 : thrustTable[Math.max(0, 8 - (level >>> 2)) + notch];
}

// Named scalar state; the original addresses are development-oracle metadata.
// No machine memory or original instructions are used by this module.
export const FLIGHT_FIELDS = {
  scene: [0x04, 1], clock: [0x14, 1], pitchView: [0x20, 1],
  rollRate: [0x21, 1], dial: [0x22, 1], rollShadow: [0x23, 2],
  roll: [0x25, 2], pitchRate: [0x27, 1], pitch: [0x28, 2],
  velocityX: [0x2b, 2], speed: [0x2d, 2], depth: [0x33, 2],
  objectFrame: [0x36, 1], objectScreenXLo: [0x284e, 1], objectScreenXHi: [0x38, 1],
  objectScreenYLo: [0x284f, 1], objectScreenYHi: [0x39, 1],
  landingPhase: [0x3d, 1], systemsOff: [0x3e, 1], controlMode: [0x4a, 1],
  groundProximity: [0x5d, 1], objectSlot: [0x63, 1], objectPanXHi: [0x68, 1],
  objectPanYHi: [0x69, 1], objectIndex: [0x6a, 1], level: [0x6d, 1],
  mode: [0x72, 1], eventHead: [0x73, 1], energy: [0x62f, 1],
  engineLatch: [0x66c, 1], engineLatch2: [0x66d, 1], timer: [0x676, 1],
  timerParamA: [0x678, 1], timerParamB: [0x679, 1], engineVoice: [0x677, 1],
  engineValue: [0x685, 1], engineFrequency: [0x686, 1], engineDelta: [0x687, 1],
  objectDither: [0x2826, 1], objectPanXLo: [0x2829, 1], objectPanYLo: [0x282c, 1],
  terrainSubIndex: [0x2836, 1], ready: [0x283b, 1], landingInhibit: [0x283c, 1],
  jitterPhase: [0x283d, 1], canopyRoll: [0x2871, 1], canopyPitch: [0x2873, 1],
  velocityZ: [0x2881, 2], velocityDepth: [0x2883, 2], heading: [0x2885, 2],
  worldX: [0x2887, 2], worldZ: [0x2889, 2], terrainIndex: [0x281c, 1],
  countdown: [0x2917, 1], delayedRoll: [0x2919, 2], delayedPitch: [0x291b, 1],
  delayedCanopyRoll: [0x291c, 1], delayedCanopyPitch: [0x291d, 1],
  historyIndex: [0x291e, 1], objectVelocityX: [0x2850, 2], objectVelocityY: [0x2852, 2],
  status: [0x3355, 1]
};

export function createFlightState(values = {}) {
  // Storage initializer only. Seed values from original initialization; zeroed
  // storage is not asserted to be an initialized game or a ready aircraft.
  const state = Object.fromEntries(Object.keys(FLIGHT_FIELDS).map(name => [name, 0]));
  state.history = Array.from({length: 5}, () => Array(7).fill(0));
  state.eventRing = Array(32).fill(0);
  Object.assign(state, values);
  return state;
}

function enqueue(state, id) {
  const head = Math.min(state.eventHead, 31);
  state.eventRing[head] = id;
  state.eventHead = (head + 31) & 31;
}

function refreshEngine(state) { enqueue(state, 13); enqueue(state, 14); }
function setTimer(state, value) {
  state.timer = state.timerParamA = state.timerParamB = value;
  enqueue(state, 11); refreshEngine(state);
}

// These are separate original subsystems, not substitute physics. Callers must
// provide the named service when its original branch is active. The differential
// fixture explicitly isolates the same callees with RTS in the offline original.
export const FLIGHT_HOOKS = {
  targetBlip: 0x9713, throttleBar: 0x4447, advanceAxes: 0x9473,
  loadObjectVelocity: 0x94bf, stepObject: 0x9552, targetBox: 0x93bd,
  jitterColumn: 0xa613, integrateObject: 0x930e
};

function invoke(hooks, name, state, value) {
  if (typeof hooks?.[name] !== 'function') throw new Error(`Original flight subsystem required: ${name}`);
  hooks[name](state, value);
}

function levelAngle(angle, shift) {
  const low = angle & 255, high = angle >>> 8;
  const subtract = ((angle << shift) >>> 8) & 255;
  if (angle & (1 << (16 - shift))) {
    const result = low - subtract;
    return word((byte(high + (result >= 0 ? 1 : 0)) << 8) | byte(result));
  }
  const result = low - subtract - 1;
  if (result >= 0) return (high << 8) | result;
  const nextHigh = byte(high - 1);
  return nextHigh & 128 ? 0 : (nextHigh << 8) | byte(result);
}

function limitAngle(angle, delta, minimum, maximum) {
  angle = word(angle + signedByte(delta));
  const high = angle >>> 8;
  if (high < 128 && high > maximum) return (maximum << 8) | 255;
  if (high >= 128 && high < minimum) return minimum << 8;
  return angle;
}

// $97A0 uses the 65-entry byte-scale quarter, distinct from the interpolated
// 16-bit projection vector. Entry $4EF9 is the original endpoint, 255.
export function flightVelocity(heading, speedHigh, quarter) {
  const angle = (heading >>> 6) & 255, quadrant = angle >>> 6;
  let xIndex = angle & 63, zIndex = xIndex;
  if (quadrant & 1) xIndex = 64 - xIndex; else zIndex = 64 - zIndex;
  const scale = index => index === 64 ? 255 : quarter[index];
  const x = roundedProduct(scale(xIndex), speedHigh);
  const z = roundedProduct(scale(zIndex), speedHigh);
  return {x: quadrant & 2 && x ? -x - 2 : x, z: ((quadrant ^ (quadrant >>> 1)) & 1) && z ? -z - 2 : z};
}

export function integrateFlight(state, input = {}, quarter, hooks) {
  const joy = input.port ?? 255;
  const random = () => byte(typeof input.random === 'function' ? input.random() : input.random ?? 0);
  if (state.controlMode === 2 && !state.systemsOff) {
    let rate = (state.dial >>> 2) + 32 + ((state.dial >>> 1) & 1);
    if (!(joy & 4)) rate ^= 255; else if (joy & 8) rate = 0;
    state.rollRate = rate;
    state.pitchRate = !state.groundProximity ? 208 : !(joy & 1) ? state.pitch === 0xf400 ? 255 : 208 :
      !(joy & 2) ? state.pitch === 0x0bff ? 1 : 48 : 0;
  }
  if (state.scene) invoke(hooks, 'targetBlip', state);
  if (state.mode === 2) {
    state.pitchRate = 48;
    state.rollRate = byte(-(state.roll >>> 6));
    state.dial = 240;
    invoke(hooks, 'throttleBar', state, 0);
  } else if (state.landingPhase) {
    if (!state.landingInhibit && state.engineLatch !== 1) {
      state.engineLatch = state.engineLatch2 = 1;
      enqueue(state, 1); enqueue(state, 2); state.status = 52;
    }
  } else if (!state.mode) invoke(hooks, 'advanceAxes', state);
  else {
    if (state.timer !== 1) {
      state.engineLatch = state.engineLatch2 = 0;
      enqueue(state, 1); enqueue(state, 2); setTimer(state, 1);
    }
    state.rollShadow = state.roll;
  }
  if (state.systemsOff) {
    if (state.engineLatch) {
      state.engineLatch = state.engineLatch2 = 0;
      enqueue(state, 1); enqueue(state, 2); state.status = 180;
    }
    return state;
  }
  if (!state.rollRate) state.roll = levelAngle(state.roll, 5);
  if (!state.landingPhase && !state.pitchRate) state.pitch = levelAngle(state.pitch, 2);
  const pitchHigh = state.pitch >>> 8;
  let clampShift = 3;
  if (state.dial) {
    clampShift = 1;
    const first = state.dial - pitchHigh;
    const base = byte(byte(first) - pitchHigh - (first < 0 ? 1 : 0));
    const kick = Math.min(255, ((state.dial >>> 1 | 7) & random()) + base + (state.dial & 1));
    state.speed = word(state.speed + kick);
  }
  if (state.groundProximity) {
    const scaled = ((state.speed + 512) << clampShift);
    const deduction = (scaled >>> 8) + ((scaled & 0x1000000) ? 0 : 1);
    const nextSpeed = state.speed - (deduction & 65535);
    state.speed = word(nextSpeed);
    if (nextSpeed < 0) { state.speed = 0; if (state.timer) setTimer(state, 0); }
  }
  state.roll = limitAngle(state.roll, state.rollRate, 251, 4);
  state.pitch = limitAngle(state.pitch, state.pitchRate, 244, 11);
  state.pitchView = (state.pitch << 3 >>> 8) & 255;
  const magnitude = state.pitch & 8192 ? byte(-state.pitchView) : state.pitchView;
  const vertical = roundedProduct(state.speed >>> 8, magnitude);
  state.velocityDepth = word((state.pitchView & 128 ? -vertical : vertical) * 8);
  state.heading = word(state.heading + (signedWord(state.roll) >> 4)) & 16383;
  const velocity = flightVelocity(state.heading, state.speed >>> 8, quarter);
  state.velocityX = word(velocity.x); state.velocityZ = word(velocity.z);
  state.worldX = word(state.worldX + state.velocityX);
  state.worldZ = word(state.worldZ + state.velocityZ);
  state.depth = word(state.depth + state.velocityDepth);
  let depthHigh = state.depth >>> 8;
  if (depthHigh === 255) depthHigh = 0;
  if (depthHigh >= 80) {
    if (state.mode === 2) { if (depthHigh >= 96) state.ready = 255; }
    else { state.depth = (state.depth & 0xff00) | 255; depthHigh = 79; }
  }
  state.depth = (depthHigh << 8) | (state.depth & 255);
  state.canopyPitch = byte((state.pitch >>> 8) + 12 + ((state.pitch >>> 7) & 1));
  state.canopyRoll = byte((state.rollShadow >>> 8) + 5 + ((state.rollShadow >>> 7) & 1));
  const sector = (58 - (state.jitterPhase ? state.clock : state.heading >>> 8)) & 63;
  state.terrainSubIndex = sector & 3; state.terrainIndex = sector >>> 2;
  state.engineFrequency = byte(~(state.speed >>> 7));
  state.engineDelta = byte(state.engineFrequency - 4);
  refreshEngine(state);
  let voice = 0, evaluateVoice = true;
  if (state.dial === 240) state.groundProximity = 240;
  else if (state.energy) { state.countdown = 255; state.groundProximity = 255; }
  else {
    state.groundProximity = 0;
    if (state.countdown) {
      const before = state.countdown--;
      if (before >= random()) state.groundProximity = 255;
      else evaluateVoice = false;
    } else evaluateVoice = false;
  }
  if (evaluateVoice && state.dial) voice = state.dial < 240 ? 4 : Math.max(4, (depthHigh >>> 3) ^ 15);
  state.engineVoice = voice;
  state.engineValue = Math.max(12, state.engineFrequency);
  enqueue(state, 12);
  state.objectVelocityX = word(signedWord(state.delayedRoll) >> 1);
  state.objectVelocityY = word(signedByte(state.delayedPitch) * 8);
  let value = ((state.objectPanXHi << 8) | state.objectPanXLo) + (signedByte(state.delayedRoll >>> 8) >> 1);
  state.objectPanXLo = value & 255; state.objectPanXHi = value >>> 8 & 255;
  value = ((state.objectPanYHi << 8) | state.objectPanYLo) + (signedByte(state.delayedPitch) >> 3);
  state.objectPanYLo = value & 255; state.objectPanYHi = value >>> 8 & 255;
  if (state.objectFrame) {
    if (!(state.objectFrame & 128)) invoke(hooks, state.objectFrame === 1 ? 'loadObjectVelocity' : 'stepObject', state);
    value = ((state.objectScreenXHi << 8) | state.objectScreenXLo) - state.objectVelocityX;
    state.objectScreenXLo = value & 255; state.objectScreenXHi = value >>> 8 & 255;
    value = ((state.objectScreenYHi << 8) | state.objectScreenYLo) + state.objectVelocityY;
    state.objectScreenYLo = value & 255; state.objectScreenYHi = value >>> 8 & 255;
  }
  if (!(state.objectSlot & 128)) {
    state.objectSlot = byte(state.objectSlot - 1);
    if (state.objectSlot & 128) {
      const dither = state.objectDither;
      state.objectSlot = state.objectIndex = state.objectDither = 255;
      if (dither) invoke(hooks, 'targetBox', state);
    } else {
      const slot = state.objectSlot;
      state.objectIndex = slot >>> 2;
      if (slot === 90 || state.level >= 31 && (slot === 60 || state.level >= 61 && slot === 40)) invoke(hooks, 'jitterColumn', state);
      invoke(hooks, 'integrateObject', state);
    }
  }
  state.historyIndex = state.historyIndex + 1 < 7 ? state.historyIndex + 1 : 0;
  const historyValues = [state.roll & 255, state.roll >>> 8, state.pitchRate, state.canopyRoll, state.canopyPitch];
  const delayed = state.history.map((ring, i) => { const old = ring[state.historyIndex]; ring[state.historyIndex] = historyValues[i]; return old; });
  state.delayedRoll = delayed[0] | delayed[1] << 8;
  [state.delayedPitch, state.delayedCanopyRoll, state.delayedCanopyPitch] = delayed.slice(2);
  return state;
}
