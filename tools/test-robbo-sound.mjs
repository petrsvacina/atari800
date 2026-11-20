import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Sound, prepareSound, EFFECT_NAMES, footstepPCM } from '../robbo/sound.mjs';
import { Wave } from '../robbo/wave.mjs';

const sourceSha256 = '75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb';
const assets = JSON.parse(fs.readFileSync(new URL('../robbo/assets/sound.json', import.meta.url)));
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-sound.json.gz', import.meta.url))));
assert.equal(assets.sourceSha256, sourceSha256);
assert.equal(fixture.sourceSha256, sourceSha256);
assert.equal(assets.titleMusic, false, 'Original title contains typing sounds, not a musical score');
assert.deepEqual(assets.effects.map(effect => effect.name), EFFECT_NAMES);

const prepared = prepareSound(assets);
assert.equal(prepareSound(prepared), prepared, 'Preparing semantic sound data is idempotent');
function snapshot(sound) {
  return { parameters: Array.from(sound.parameters), registers: Array.from(sound.registers) };
}

let vbis = 0, writes = 0;
for (const scenario of fixture.cases) {
  const sound = new Sound(prepared);
  sound.parameters.set(scenario.inputParameters);
  sound.registers.set(scenario.inputRegisters);
  sound.writes = [];
  sound.reset();
  assert.deepEqual(snapshot(sound), scenario.initial, `${scenario.name}: original reset state and aliases`);
  assert.deepEqual(sound.writes, scenario.resetWrites, `${scenario.name}: ordered reset POKEY writes`);
  for (const [frame, expected] of scenario.frames.entries()) {
    sound.writes = [];
    for (const command of expected.commands) sound.trigger(command);
    assert.deepEqual(sound.writes, expected.operationWrites, `${scenario.name}, VBI ${frame}: commands`);
    sound.step(expected.clock);
    assert.deepEqual(snapshot(sound), expected.state, `${scenario.name}, VBI ${frame}: complete original driver state`);
    assert.deepEqual(sound.writes, expected.writes, `${scenario.name}, VBI ${frame}: ordered POKEY writes`);
    vbis++; writes += expected.writes.length + expected.operationWrites.length;
  }
}
assert.equal(vbis, fixture.metrics.vbis);
assert.equal(writes, fixture.metrics.registerWrites);
for (const scenario of fixture.title) {
  const sound = new Sound(prepared);
  sound.titleTick(scenario.kind);
  assert.deepEqual(Array.from(sound.registers), scenario.registers, `Original title ${scenario.kind}: registers`);
  assert.deepEqual(sound.writes, scenario.writes, `Original title ${scenario.kind}: writes`);
}
console.log(`PASS ${fixture.cases.length} original sound scenarios, ${vbis} VBIs, ${writes} ordered POKEY writes; all 15 effects, four timer phases, shared-channel replacement, retrigger, clock wrap and reset aliases`);
console.log('PASS original title typing/line sounds; no invented title music');

function energy(samples) {
  let sum = 0, peak = 0;
  for (const sample of samples) {
    assert(Number.isFinite(sample), 'Finite PCM samples');
    peak = Math.max(peak, Math.abs(sample)); sum += sample * sample;
  }
  return { peak, rms: Math.sqrt(sum / samples.length) };
}

const pcm = [];
for (let effect = 0; effect < 15; effect++) {
  const sound = new Sound(prepared), wave = new Wave();
  sound.trigger(effect);
  const samples = new Float32Array(48000 * 2);
  let at = 0;
  for (let frame = 0; at < samples.length; frame++) {
    sound.step(frame);
    wave.set(sound.registers);
    const end = Math.min(samples.length, Math.round((frame + 1) * 48000 / assets.vbiHz));
    wave.process(samples.subarray(at, end)); at = end;
  }
  const signal = energy(samples);
  assert(signal.peak > 0.001 && signal.rms > 0.0001, `${EFFECT_NAMES[effect]}: audible synthesized effect`);
  assert(signal.peak <= 1, `${EFFECT_NAMES[effect]}: unclipped synthesized effect`);
  pcm.push({ effect, name: EFFECT_NAMES[effect], ...signal });
}
for (const kind of ['character', 'line', 'newline']) {
  const sound = new Sound(prepared), wave = new Wave();
  sound.titleTick(kind); wave.set(sound.registers);
  const signal = energy((() => { const samples = new Float32Array(2048); wave.process(samples); return samples; })());
  assert(signal.peak > 0.001 && signal.rms > 0.0001, `Title ${kind}: audible PCM`);
  pcm.push({ title: kind, ...signal });
}
for (const rate of [44100, 48000, 96000]) {
  const wave = new Wave(rate), samples = new Float32Array(rate);
  wave.process(samples);
  assert.deepEqual(energy(samples), { peak: 0, rms: 0 }, 'Muted POKEY remains silent');
  wave.set([34, 0x88, 0, 0, 0, 0, 0, 0, 0]);
  wave.process(samples);
  assert(energy(samples).rms > 0.001, `${rate} Hz waveform produces audible noise`);
}
console.log(`PASS PCM peak/RMS for every effect and title chirp, with silent reset and 44.1/48/96 kHz output`);
console.log(JSON.stringify(pcm));
assert.deepEqual(assets.footstep.bits, fixture.consoleWrites.map(write => write[1]));
assert.deepEqual(fixture.consoleWrites.map(write => write[0]), Array.from({ length: 81 }, (_, index) => index * 13));
assert(assets.footstep.bits.every(bit => bit === 0 || bit === 8), 'Only speaker bit exported, no executable bytes');
const consoleSound = new Sound(prepared), originalRegisters = [...consoleSound.registers];
assert.equal(consoleSound.footstep(), assets.footstep);
assert.equal(consoleSound.footsteps.length, 1);
assert.deepEqual([...consoleSound.registers], originalRegisters, 'CONSOL uses a separate audio path');
for (const rate of [44100, 48000, 96000]) {
  const signal = energy(footstepPCM(assets, { rate }));
  assert(signal.peak > 0.01 && signal.rms > 0.001, `Original CONSOL footsteps audible at ${rate} Hz`);
  assert(signal.peak < 1);
}
console.log('PASS original 81-write CONSOL footstep pattern, 13 CPU cycles/write, independent queue and audible PCM at 44.1/48/96 kHz');
