import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { prepareTitle, TitleTypist, TitleLogo } from '../robbo/title.mjs';

const data = prepareTitle(JSON.parse(fs.readFileSync(new URL('../robbo/assets/title.json', import.meta.url))));
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-title.json.gz', import.meta.url))));
assert.equal(data.sourceSha256, '75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb');
assert.equal(data.sourceSha256, fixture.sourceSha256);
assert.equal(data.font.length, 1024); assert.equal(data.instructions.length, 1218); assert.equal(data.credits.length, 192);
let vbis = 0, writes = 0;
for (const scenario of fixture.cases) {
  const title = new TitleTypist(data, scenario.initial);
  title.screen.set(scenario.initial.screen);
  for (const [frame, expected] of scenario.frames.entries()) {
    title.step();
    const actual = { clock: title.clock, timer: title.timer, cursor: title.cursor, offset: title.offset,
      screen: [...title.screen], registers: [...title.registers], writes: title.writes,
      soundKind: title.soundKind, endCount: title.endCount, demoRequested: title.demoRequested };
    assert.deepEqual(actual, expected, `${scenario.name}, VBI ${frame}`);
    vbis++; writes += title.writes.length;
  }
}
assert.equal(vbis, fixture.metrics.typistVbis); assert.equal(writes, fixture.metrics.pokeyWrites);
assert(fixture.cases[0].frames.some(frame => frame.endCount > 0), 'Exercise the end marker');
assert(fixture.cases[0].frames.some(frame => frame.demoRequested), 'Exercise original automatic-demo timer');
let logoVbis = 0, randomReads = 0;
for (const scenario of fixture.logos) {
  let random = [], cursor = 0;
  const logo = new TitleLogo(data, { direction: scenario.direction, random() {
    assert(cursor < random.length, 'Original title RANDOM read count');
    return random[cursor++];
  } });
  for (const [frame, expected] of scenario.frames.entries()) {
    random = expected.random; cursor = 0;
    logo.step(expected.clock);
    assert.deepEqual([...logo.screen], expected.screen, `Logo VBI ${frame}: exact masked pixel writes`);
    assert.equal(logo.mask, expected.mask, `Logo VBI ${frame}: mask rotation`);
    assert.equal(logo.direction, expected.direction, `Logo VBI ${frame}: direction byte wrap`);
    assert.deepEqual([...logo.colors], expected.colors, `Logo VBI ${frame}: random color changes`);
    assert.equal(cursor, random.length); logoVbis++; randomReads += cursor;
  }
}
assert.equal(logoVbis, fixture.metrics.logoVbis);
console.log(`PASS original title typist: ${vbis} VBIs, ${writes} ordered POKEY writes, complete Polish instruction stream, cursor, line wraps, scroll, end pause and demo timer`);
console.log(`PASS original masked logo: ${logoVbis} VBIs, ${randomReads} RANDOM reads, pixels, cyclic mask and color writes`);
