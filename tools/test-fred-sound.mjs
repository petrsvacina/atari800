import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import '../fred/assets/audio.js';
import {Effects,Wave} from '../fred/sound.mjs';
const file=process.argv[2]||new URL('fixtures/fred-effects.json.gz',import.meta.url),raw=fs.readFileSync(file);
const records=JSON.parse(zlib.gunzipSync(raw));const effect=new Effects(FRED_AUDIO);
for(const [tick,frame] of records.entries()){
  for(const id of frame.commands)effect.request(id);
  assert.deepEqual(effect.tick(),frame.registers,`POKEY registers at VBI ${tick}`);
  for(const [key,prop] of [['values','value'],['remaining','remaining'],['periods','period']])
    assert.deepEqual(effect.voices.map(v=>v[prop]),frame[key],`${key} at VBI ${tick}`);
}
// Waveform clock continuity across Web Audio block boundaries matters for noise.
for(const rate of [44100,48000]){
  const a=new Wave(rate),b=new Wave(rate);a.set([23,195,31,131,10,165,40,5]);b.set([23,195,31,131,10,165,40,5]);
  const whole=new Float32Array(4096),split=new Float32Array(4096);a.process(whole);
  for(let start=0;start<4096;start+=128)b.process(split.subarray(start,start+128));
  assert.deepEqual(whole,split);assert.ok(whole.some(v=>v!==0));assert.ok(whole.every(Number.isFinite));
}
console.log(`PASS ${records.length} original POKEY driver frames and waveform continuity at 44.1/48 kHz.`);
