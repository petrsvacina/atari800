import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SoundDriver, ThemeDriver, JingleDriver, StationDriver, LogoDriver, Wave } from '../rescue-on-fractalus/sound.mjs';
import { FLIGHT_FIELDS } from '../rescue-on-fractalus/flight.mjs';
import { SERVICE_FIELDS } from '../rescue-on-fractalus/flight-services.mjs';
import { RESCUE_FIELDS } from '../rescue-on-fractalus/rescue.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../rescue-on-fractalus/assets/sound.json', import.meta.url)));
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/fractalus-sound.json.gz', import.meta.url))));
assert.equal(data.sourceSha256, 'e8ff23567b219f614a307a309e42929957facb9b9ff838cc8ff91789eace44ab');
assert.equal(fixture.sourceSha256, data.sourceSha256);

function snapshot(driver) {
  return {
    parameters: Array.from(driver.parameters), head: driver.head, tail: driver.tail,
    topPriority: driver.topPriority, topIndex: driver.topIndex,
    scanPriority: driver.scanPriority, nextIndex: driver.nextIndex, expired: driver.expired,
    ring: Array.from(driver.ring), registers: Array.from(driver.registers), special: { ...driver.special },
  };
}
let frames = 0, writes = 0, randomReads = 0;
for (const c of fixture.cases) {
  let random = [], cursor = 0;
  const driver = new SoundDriver(data, { random(site) {
    assert(cursor < random.length, `${c.name}: unexpected random read`);
    const [address, value] = random[cursor++];
    assert.equal(site, address === 0x555F ? 'sound.noiseTimer' : address === 0x556A ? 'sound.noisePitch' : 'unknown');
    return value;
  } });
  assert.deepEqual(snapshot(driver), c.initial, `${c.name}: original reset`);
  assert.deepEqual(driver.writes, c.resetWrites, `${c.name}: original reset writes`);
  if (c.special) Object.assign(driver.special, c.special);
  for (const [frame, expected] of c.frames.entries()) {
    for (const operation of expected.operations) {
      if (operation.event !== undefined) driver.queue(operation.event);
      else if (operation.load !== undefined) driver.load(operation.load);
      else if (operation.touch !== undefined) driver.touch(operation.touch);
      else if (operation.voice !== undefined)
        for (const [name, value] of Object.entries(operation.fields)) driver.voices[name][operation.voice] = value;
      else if (operation.register !== undefined) driver.write(operation.register, operation.value);
    }
    random = expected.random; cursor = 0;
    driver.step();
    assert.deepEqual(snapshot(driver), expected.state, `${c.name}, frame ${frame}: complete envelope/mixer state`);
    assert.deepEqual(driver.writes, expected.writes, `${c.name}, frame ${frame}: ordered POKEY writes`);
    assert.equal(cursor, random.length, `${c.name}, frame ${frame}: noise read order`);
    frames++; writes += expected.writes.length; randomReads += cursor;
  }
}
assert.equal(frames, fixture.metrics.frames);
assert.equal(writes, fixture.metrics.registerWrites);
assert.equal(randomReads, fixture.metrics.randomReads);
console.log(`PASS ${fixture.cases.length} original effect sequences / ${frames} VBIs: all 33 events, chains, priority stealing and shared engine-gauge cells`);
console.log(`PASS ${writes} ordered original POKEY writes and ${randomReads} noise-driver reads`);

const columns = ['distortion', 'volume', 'frequency', 'volumeDelta', 'volumeTarget', 'volumeStep',
  'volumePhase', 'frequencyDelta', 'frequencyTarget', 'frequencyStep', 'frequencyPhase', 'follow', 'channel'];
const sharedFields = Object.entries({ ...FLIGHT_FIELDS, ...SERVICE_FIELDS, ...RESCUE_FIELDS })
  .filter(([, [address, size]]) => size === 1 && address >= 0x65D && address < 0x714);
for (const c of fixture.cases.filter(c => ['flight engine gauges with effect preemption',
  'overlapping effects and priority preemption', 'chains and competing voice slots', 'full event ring original overwrite'].includes(c.name))) {
  const driver = new SoundDriver(data);
  const state = { eventRing: Array(32).fill(0), eventHead: 0, eventTail: 0 };
  for (const [name, [address]] of sharedFields) state[name] = c.initial.parameters[address - 0x65D];
  driver.bindFlight(state);
  for (const [frame, expected] of c.frames.entries()) {
    for (const operation of expected.operations) {
      if (operation.event !== undefined) driver.queue(operation.event);
      else if (operation.load !== undefined) driver.load(operation.load);
      else if (operation.touch !== undefined) driver.touch(operation.touch);
      else if (operation.voice !== undefined) for (const [column, value] of Object.entries(operation.fields)) {
        const address = 0x65D + columns.indexOf(column) * 14 + operation.voice;
        const field = sharedFields.find(([, [at]]) => at === address);
        if (field) state[field[0]] = value;
        else driver.voices[column][operation.voice] = value;
      }
    }
    driver.stepFlight(state);
    assert.deepEqual(snapshot(driver), expected.state, `${c.name}, frame ${frame}: flight bridge`);
    for (const [name, [address]] of sharedFields)
      assert.equal(state[name], expected.state.parameters[address - 0x65D], `shared flight field ${name}`);
    assert.equal(state.eventHead, expected.state.head); assert.equal(state.eventTail, expected.state.tail);
  }
}
console.log('PASS shared flight/service voice aliases and event ring: external queue/load operations survive the next VBI');

const specialBridge = { sfxBusy: 'mode', soundSpecialIndex: 'index', soundSpecialTimer: 'timer',
  soundSpecialVolume: 'volume', soundSpecialPitchA: 'pitchA', soundSpecialPitchB: 'pitchB',
  soundSpecialVolumeTimer: 'volumeTimer' };
for (const c of fixture.cases.filter(c => c.special)) {
  let random = [], cursor = 0;
  const driver = new SoundDriver(data, { random: () => random[cursor++][1] });
  const state = { eventRing: Array(32).fill(0), eventHead: 0, eventTail: 0 };
  for (const [name, [address]] of sharedFields) state[name] = c.initial.parameters[address - 0x65D];
  for (const [name, field] of Object.entries(specialBridge)) state[name] = c.special[field] || 0;
  driver.bindFlight(state);
  for (const [frame, expected] of c.frames.entries()) {
    for (const operation of expected.operations) {
      if (operation.event !== undefined) driver.queue(operation.event);
      else if (operation.register !== undefined) driver.write(operation.register, operation.value);
    }
    random = expected.random; cursor = 0;
    driver.stepFlight(state);
    assert.deepEqual(snapshot(driver), expected.state, `${c.name}, frame ${frame}: rescue audio bridge`);
    for (const [name, field] of Object.entries(specialBridge)) assert.equal(state[name], expected.state.special[field]);
    assert.equal(state.rescueVoiceBusy, expected.state.parameters[0x6FF - 0x65D]);
    assert.equal(cursor, random.length);
  }
}
console.log('PASS rescue special-envelope fields and boarding voice-busy alias against original driver states');

function themeState(driver) {
  return { counter: driver.counter, duration: driver.duration, emphasis: driver.emphasis, cursor: driver.cursor,
    registers: Array.from(driver.registers), writes: driver.writes };
}
function jingleState(driver) {
  return { levels: Array.from(driver.levels), deltas: Array.from(driver.deltas), frequencies: Array.from(driver.frequencies),
    attackRemaining: driver.attackRemaining, duration: driver.duration, active: driver.active, cursor: driver.cursor,
    registers: Array.from(driver.registers), writes: driver.writes };
}
let themeVbis = 0, jingleVbis = 0, musicWrites = 0;
for (const c of fixture.themes) {
  const driver = new ThemeDriver(data, { counter: c.initial.counter });
  assert.deepEqual(themeState(driver), c.initial, 'Original standby initialization');
  for (const [frame, expected] of c.frames.entries()) {
    driver.step();
    assert.deepEqual(themeState(driver), expected, `Standby counter ${c.initial.counter}, VBI ${frame}`);
    themeVbis++; musicWrites += expected.writes.length;
  }
  assert.equal(driver.loops, c.loops); assert(driver.loops >= 2, 'At least two complete original theme loops');
}
for (const c of fixture.jingles) {
  const driver = new JingleDriver(data, { song: c.song });
  assert.deepEqual(jingleState(driver), c.initial, `Jingle ${c.song}: original initialization`);
  for (const [frame, expected] of c.frames.entries()) {
    driver.step();
    assert.deepEqual(jingleState(driver), expected, `Jingle ${c.song}, VBI ${frame}`);
    jingleVbis++; musicWrites += expected.writes.length;
  }
  assert(!driver.active, 'Original jingle must finish and silence itself');
}
assert.equal(themeVbis, fixture.metrics.themeVbis); assert.equal(jingleVbis, fixture.metrics.jingleVbis);
console.log(`PASS ${themeVbis} original gated theme VBIs (two loops, four counter phases), ${jingleVbis} jingle VBIs and ${musicWrites} ordered music writes`);

function stationState(driver) {
  return { counter: driver.counter, decayIndex: driver.decayIndex, drift: Array.from(driver.drift),
    registers: Array.from(driver.registers), writes: driver.writes };
}
let stationVbis = 0, stationWrites = 0;
for (const c of fixture.stations) {
  const driver = new StationDriver(data, c.initial);
  assert.deepEqual(stationState(driver), c.initial, 'Original station initialization');
  for (const [frame, expected] of c.frames.entries()) {
    driver.step();
    assert.deepEqual(stationState(driver), expected, `Station decay ${c.initial.decayIndex}, VBI ${frame}`);
    stationVbis++; stationWrites += expected.writes.length;
  }
}
assert.equal(stationVbis, fixture.metrics.stationVbis);
console.log(`PASS ${stationVbis} original station VBIs and ${stationWrites} ordered writes, including all clock branches and accumulator carry boundaries`);

function logoState(driver) {
  return { counter: driver.counter, delay: driver.delay, envelope: driver.envelope,
    frequencies: Array.from(driver.frequencies), registers: Array.from(driver.registers), writes: driver.writes };
}
let logoVbis = 0, logoWrites = 0;
for (const c of fixture.logos) {
  const driver = new LogoDriver(data, { registers: c.inputRegisters });
  assert.deepEqual(logoState(driver), c.initial, 'Original Lucasfilm logo sound initialization');
  for (const [frame, expected] of c.frames.entries()) {
    driver.step();
    assert.deepEqual(logoState(driver), expected, `Lucasfilm logo, VBI ${frame}`);
    logoVbis++; logoWrites += expected.writes.length;
  }
  assert.equal(driver.counter, 255, 'Logo player must reach its original inactive phase');
}
assert.equal(logoVbis, fixture.metrics.logoVbis);
console.log(`PASS ${logoVbis} original Lucasfilm logo VBIs and ${logoWrites} ordered writes, including delay and fade`);

function energy(samples) {
  let square = 0, peak = 0;
  for (const value of samples) { assert(Number.isFinite(value)); square += value * value; peak = Math.max(peak, Math.abs(value)); }
  return { rms: Math.sqrt(square / samples.length), peak };
}
const audible = [];
for (const name of ['event 01', 'event 05', 'event 06', 'event 0E', 'event 14', 'event 16', 'event 1A', 'event 21',
                    'flight engine gauges with effect preemption', 'Jaggi initial sweep into random-noise tail']) {
  const c = fixture.cases.find(c => c.name === name), wave = new Wave();
  assert(c, `Missing original audible clip ${name}`);
  const samples = new Float32Array(48000);
  let at = 0;
  for (let frame = 0; at < samples.length; frame++) {
    wave.set(c.frames[frame].state.registers);
    const end = Math.min(samples.length, Math.round((frame + 1) * 48000 / (1773447 / (312 * 114))));
    wave.process(samples.subarray(at, end)); at = end;
  }
  const signal = energy(samples);
  assert(signal.rms > 0.0001 && signal.peak > 0.001, `${name}: silent synthesized output`);
  assert(signal.peak < 1.01, `${name}: clipped output`);
  audible.push({ name, ...signal });
}
for (const [name, frames] of [['standby theme', fixture.themes[0].frames],
                            ['game over jingle', fixture.jingles[0].frames],
                            ['completion jingle', fixture.jingles[1].frames],
                            ['launch station', fixture.stations[0].frames],
                            ['Lucasfilm logo', fixture.logos[0].frames]]) {
  const wave = new Wave(), samples = new Float32Array(48000 * 4);
  let at = 0;
  for (let frame = 0; at < samples.length; frame++) {
    wave.set(frames[Math.min(frame, frames.length - 1)].registers);
    const end = Math.min(samples.length, Math.round((frame + 1) * 48000 / (1773447 / (312 * 114))));
    wave.process(samples.subarray(at, end)); at = end;
  }
  const signal = energy(samples);
  assert(signal.rms > 0.0001 && signal.peak > 0.001, `${name}: original music/scene must be audible`);
  assert(signal.peak < 1.01, `${name}: clipped output`);
  audible.push({ name, ...signal });
}
for (const rate of [44100, 48000, 96000]) {
  const registers = [47, 163, 110, 132, 79, 66, 191, 143, 96];
  const whole = new Wave(rate), split = new Wave(rate);
  whole.set(registers); split.set(registers);
  const a = new Float32Array(8192), b = new Float32Array(8192);
  whole.process(a);
  let at = 0, chunk = 0;
  while (at < b.length) {
    split.set(registers);
    const end = Math.min(b.length, at + [128, 1024, 17, 511][chunk++ % 4]);
    split.process(b.subarray(at, end)); at = end;
  }
  assert.deepEqual(b, a, `Wave phase must survive callback boundaries at ${rate} Hz`);
}
// A pure-tone pitch is independently determined by the PAL clock and divider.
for (const [frequency, control, period] of [[47, 0, 48 * 28], [176, 64, 180]]) {
  const wave = new Wave(), samples = new Float32Array(48000);
  wave.set([frequency, 168, 0, 0, 0, 0, 0, 0, control]); wave.process(samples);
  let crossings = 0;
  for (let i = 4801; i < samples.length; i++) if (samples[i - 1] <= 0 && samples[i] > 0) crossings++;
  const expected = 0.9 * 1773447 / (2 * period);
  assert(Math.abs(crossings - expected) < 3, `PAL pure tone: ${crossings} versus ${expected}`);
}
console.log(`PASS ${audible.length} audible original-register clips, callback continuity at 44.1/48/96 kHz and PAL pitch checks`);
console.log(JSON.stringify(audible.map(c => ({ name: c.name, rms: +c.rms.toFixed(5), peak: +c.peak.toFixed(5) }))));

let Processor;
globalThis.sampleRate = 48000;
globalThis.AudioWorkletProcessor = class { constructor() { this.port = {}; } };
globalThis.registerProcessor = (name, value) => { assert.equal(name, 'fractalus-sound'); Processor = value; };
await import('../rescue-on-fractalus/sound-worklet.mjs');
const worklet = new Processor({ processorOptions: { clockHz: 1773447 } });
const out = new Float32Array(128);
worklet.port.onmessage({ data: { registers: [47, 168, 0, 0, 0, 0, 0, 0, 0], active: true } });
assert(worklet.process([], [[out]])); assert(energy(out).rms > 0.001);
const clock = worklet.wave.clock;
worklet.port.onmessage({ data: { active: false } }); worklet.process([], [[out]]);
assert(out.every(v => v === 0)); assert.equal(worklet.wave.clock, clock);
worklet.port.onmessage({ data: { active: true } }); worklet.process([], [[out]]);
assert(worklet.wave.clock > clock); assert(energy(out).rms > 0.001);
console.log('PASS AudioWorklet processor messages, audible output and pause/resume phase (host harness; browser integration separate)');
