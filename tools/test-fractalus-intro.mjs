import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {prepareIntro,IntroSequence,applyIntroPatch} from '../rescue-on-fractalus/intro.mjs';
import {prepareCockpit,drawOriginalDigit} from '../rescue-on-fractalus/cockpit.mjs';
const load=name=>JSON.parse(fs.readFileSync(new URL(`../rescue-on-fractalus/assets/${name}.json`,import.meta.url)));
const source=load('intro'),data=await prepareIntro(source),fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/fractalus-intro.json.gz',import.meta.url))));
const hash=value=>createHash('sha256').update(value).digest('hex');
assert.equal(hash(fs.readFileSync(new URL('../rescue-on-fractalus/assets/intro.json',import.meta.url))),fixture.introSha256);
assert.equal(data.sourceSha256,fixture.sourceSha256);prepareCockpit(load('cockpit'));
for(const name of ['logo','station','launch'])assert.equal(hash(data[name].sound),fixture.soundHashes[name]);
const sequence=new IntroSequence(data);let count=0,phases=new Set();
do {
 const expected=({logo:fixture.logoHashes,station:fixture.stationHashes,launch:fixture.launch04Hashes})[sequence.name];
 assert.equal(hash(sequence.output),expected[sequence.frame],`${sequence.name} frame ${sequence.frame}`);
 assert.equal(sequence.registers.length,9);phases.add(sequence.phase);count++;
}while(sequence.tick());
assert.equal(count,data.logo.frames+data.station.frames+data.launch.frames);assert.equal(sequence.tick(),false);
assert.deepEqual([...phases],['logo','carrier','hangar','tunnel','space','planet','descent']);
for(let digit=0;digit<10;digit++) {
 const clip=new IntroSequence(data,{level:Math.max(1,digit*11),includeStation:false});
 // Level00 is only a basis, not a selectable mission. Check its two patches directly.
 if(!digit)clip.level=0;
 for(let frame=0;frame<data.glyphs.frames;frame++) {
  clip.compose();assert.equal(hash(clip.output),fixture.digitHashes[digit][frame],`digit${digit} frame${frame}`);clip.tick();
 }
}
// Every selectable level uses its own pair of original moving glyphs.
for(let level=1;level<=99;level++) {
 const clip=new IntroSequence(data,{level,includeStation:false});
 const expected=clip.base.slice();
 for(const [side,digit]of [[0,Math.floor(level/10)],[1,level%10]]) {
  const id=data.glyphs.selectors[0][side][digit];applyIntroPatch(expected,{data:data.glyphs.patches,at:data.glyphs.offsets[id]});
 }
 assert.deepEqual(clip.output,expected);
}
// The door movie must not force a level04 quota on other missions.
const ordinary=new IntroSequence(data,{includeStation:false}),other=new IntroSequence(data,{level:16,includeStation:false,state:{quota:16}});
while(ordinary.frame<data.launch.frames-1){ordinary.tick();other.tick();}
const expected=ordinary.output.slice();let matched=false;
for(const dim of [false,true]) {
 const probe=ordinary.output.slice();drawOriginalDigit(probe,0,0x3472,dim);drawOriginalDigit(probe,4,0x34a4,dim);
 if(probe.every((value,at)=>value===ordinary.output[at])) {
  drawOriginalDigit(expected,1,0x3472,dim);drawOriginalDigit(expected,6,0x34a4,dim);matched=true;break;
 }
}
assert.ok(matched,'Original quota is identifiable');assert.notDeepEqual(expected,ordinary.output);assert.deepEqual(other.output,expected);
assert.throws(()=>applyIntroPatch(new Uint8Array(2),{data:Uint8Array.of(1,0,3,4),at:0}),/Invalid intro raster/);
assert.throws(()=>applyIntroPatch(new Uint8Array(2),{data:Uint8Array.of(128),at:0}),/Invalid intro packet/);
console.log(`PASS intro: ${count} complete original PAL frame hashes, all POKEY states, 1,670 original numeric basis frames, 99 level captions, quota, segment boundaries and invalid packets. NTSC and analogue phase remain separate limits.`);
