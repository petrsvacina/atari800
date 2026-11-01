import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {pixels} from '../shift/screen.mjs';
const sandbox={};vm.runInNewContext(fs.readFileSync(new URL('../shift/assets/data.js',import.meta.url),'utf8'),sandbox);
const data=sandbox.SHIFT_DATA;
const reference=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../research/shift/raster-oracle.json.gz',import.meta.url))));
let count=0;
for(const entry of reference.frames){
  const expected=Buffer.from(entry.pixels,'base64'),actual=Buffer.from(pixels({...entry.state,fonts:entry.fonts},data));
  let wrong=0,first=null;
  for(let i=0;i<actual.length;i++)if(actual[i]!==expected[i]){wrong++;first??={x:i%320,y:Math.floor(i/320),actual:actual[i],expected:expected[i]};}
  assert.equal(wrong,0,JSON.stringify({level:entry.level+1,flipped:entry.flipped,wrong,first}));
  count+=actual.length;
}
console.log(`Shift: ${reference.frames.length} real Atari800 frames, ${count} pixels match native renderer.`);
