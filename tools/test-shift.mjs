import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import vm from 'node:vm';
import {Shift} from '../shift/engine.mjs';

const sandbox = {}; vm.runInNewContext(fs.readFileSync(new URL('../shift/assets/data.js', import.meta.url), 'utf8'), sandbox);
const data = JSON.parse(JSON.stringify(sandbox.SHIFT_DATA));
const oracle = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../research/shift/oracle.json.gz', import.meta.url))));
let frames = 0;
for (const replay of oracle.cases) {
  const game = new Shift(data, replay.level);
  if (replay.preShift) { const shift = game.shift(); while (!shift.next().done) {} }
  if (replay.setup) { Object.assign(game, replay.setup); game.collisionHigh = game.xHigh; }
  for (let i = 0; i < replay.steps.length; i++) {
    if (i) game.tick(replay.steps[i].input);
    try { assert.deepEqual(game.state(), replay.steps[i].state); }
    catch (error) {
      const actual = game.state(), expected = replay.steps[i].state;
      for (const key of Object.keys(expected)) {
        if (JSON.stringify(actual[key]) !== JSON.stringify(expected[key])) {
          console.error('Mismatch', {level:replay.level+1, frame:i, key,
            actual: Array.isArray(actual[key]) ? actual[key].slice(0,32) : actual[key],
            expected: Array.isArray(expected[key]) ? expected[key].slice(0,32) : expected[key]});
        }
      }
      throw error;
    }
    frames++;
  }
}
console.log(`Shift: ${frames} original frame states across all 37 rooms match native JavaScript.`);
