import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createVbi} from '../robbo/vbi.mjs';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-vbi.json.gz',import.meta.url))));
assert.equal(fixture.sourceSha256,'75b15bb3c5ee0c76f5d6119ee8dc20ad63494f7e098707887789c305a9a5dbbb');
function machine(input){
 const s={...input.state,score:[...input.state.score],infoFont:new Uint8Array(1024),hudCharacters:Uint8Array.from(input.hud)};
 s.infoFont.set(input.glyph,0x300);
 let calls=0;
 const ctx={state:s,soundStep:clock=>{
  assert.equal(clock,s.clock);calls++;
  assert.deepEqual([...s.infoFont.subarray(0x300,0x308)],beforeGlyph,'Sound runs before glyph rotation');
  assert.deepEqual([...s.hudCharacters],beforeHud,'Sound runs before HUD update');
 }};
 let beforeGlyph,beforeHud;
 const service=createVbi(ctx);
 function tick(expected,name){
  beforeGlyph=[...s.infoFont.subarray(0x300,0x308)];beforeHud=[...s.hudCharacters];const beforeCalls=calls;
  service.tick();
  const snapshot=Object.fromEntries(Object.keys(expected.state).map(k=>[k,s[k]]));
  assert.deepEqual(snapshot,expected.state,`${name}: original CVBL shared state`);
  assert.deepEqual([...s.infoFont.subarray(0x300,0x308)],expected.glyph,`${name}: original eight-byte glyph rotation`);
  assert.deepEqual([...s.hudCharacters],expected.hud,`${name}: all original HUD character bytes`);
  assert.equal(calls-beforeCalls,expected.soundCalls,`${name}: one sound service call`);
 }
 return {s,tick};
}
for(const c of fixture.cases)machine(c).tick(c.expected,c.name);
let frames=0;
for(const seq of fixture.sequences){
 const m=machine(seq.input);
 for(const [clock,expected] of seq.frames.entries()){
  m.s.clock=clock;m.tick(expected,`${seq.name} VBI ${clock}`);frames++;
 }
}
console.log(`PASS ${fixture.cases.length} supplied-XEX CVBL states and ${frames} scrolling frames: camera, scroll phases, glyph rotation, HUD, colors and sound order`);
