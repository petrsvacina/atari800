import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { Ending, EndingHold, prepareEnding } from '../robbo/ending.mjs';
import { Wave } from '../robbo/wave.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const raw = JSON.parse(fs.readFileSync(new URL('../robbo/assets/ending.json', import.meta.url)));
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-ending.json.gz', import.meta.url))));
const data = await prepareEnding(raw);
assert.equal(data.sourceSha256, '75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb');
assert.equal(fixture.sourceSha256, data.sourceSha256);
assert.equal(hash(data.atlas), fixture.atlasSha256);
assert.equal(data.intro.length, 745); assert.equal(data.hold.length, 512); assert.equal(data.closing.length, 117);
for (let index = 0; index < data.atlasImages; index++)
  assert.equal(hash(data.atlas.subarray(index * 76800, (index + 1) * 76800)), fixture.imageSha256[index]);

const hold = new EndingHold(data);
for (const [index, frame] of data.hold.entries()) {
  hold.advanceRandom(frame.random, frame);
  assert.equal(Buffer.from(hold.screen).toString('base64'), fixture.hold[index].screen,
    `Original hold VBI ${index}: all three RANDOM-indexed pages, including delayed stores`);
}
assert.equal(hold.page, 0); assert.equal(hold.pending, null);
assert.deepEqual([...hold.screen], [...data.holdData.message], 'All original message bytes eventually reveal');
assert.equal(hash(hold.render(512)), fixture.closing[0].pixelSha256, 'Native stationary message raster and rotating border');

const ending = new Ending(data);
const wave = new Wave(), pcmFrame = new Float32Array(Math.ceil(48000 / data.vbiHz));
let peak = 0, square = 0, samples = 0;
function measure() {
  wave.set(ending.registers); wave.process(pcmFrame);
  for (const value of pcmFrame) { assert(Number.isFinite(value)); peak = Math.max(peak, Math.abs(value)); square += value * value; samples++; }
}
for (let frame = 0; frame < 745; frame++) {
  ending.step({ fire: true }); measure();
  assert.equal(hash(ending.pixels), fixture.intro[frame].pixelSha256, `Original intro raster ${frame}`);
  assert.deepEqual([...ending.registers], fixture.intro[frame].registers, `Original intro POKEY ${frame}`);
}
assert.equal(ending.phase, 'hold', 'Original animation ignores fire until the hold');
for (let frame = 0; frame < 512; frame++) {
  ending.step(); measure();
  assert.equal(hash(ending.pixels), fixture.hold[frame].pixelSha256, `Original reveal raster ${frame}`);
  assert.deepEqual([...ending.registers], fixture.hold[frame].registers, `Original reveal POKEY ${frame}`);
}
for (let frame = 0; frame < 117; frame++) {
  ending.step({ fire: true }); measure();
  assert.equal(hash(ending.pixels), fixture.closing[frame].pixelSha256, `Original closing wipe raster ${frame}`);
  assert.deepEqual([...ending.registers], fixture.closing[frame].registers, `Original closing POKEY ${frame}`);
}
assert.equal(ending.done, true); assert.equal(ending.returnEffect, 13);
assert(peak > 0.001 && peak < 1 && Math.sqrt(square / samples) > 0.0001, 'Original ending POKEY stream produces audible PCM');

const early = new Ending(data);
for (let frame = 0; frame < 746; frame++) early.step();
const partial = [...early.hold.screen];
early.step({ fire: true });
assert.deepEqual([...early.hold.screen], partial, 'Early dismissal keeps the current partial message');
assert.notDeepEqual([...early.hold.screen], [...data.holdData.message]);
const endless = new Ending(data, { random: () => 42 });
for (let frame = 0; frame < 745 + 2048; frame++) {
  endless.step();
  if (frame >= 745 + 512)
    assert.deepEqual([...endless.registers], data.hold.at(-1).registers, 'Expired hold sound never repeats');
}
assert.equal(endless.phase, 'hold'); assert.equal(endless.done, false, 'Original congratulations hold has no timeout');
console.log(`PASS ending: 745 original intro frames, 512 exact native reveal states/rasters, 117 closing rasters, early dismissal, unlimited hold, TITLE return effect 13`);
console.log(`PASS native POKEY ending PCM: peak ${peak.toFixed(6)}, RMS ${Math.sqrt(square / samples).toFixed(6)}`);
