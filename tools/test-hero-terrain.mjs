import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),ctx=vm.createContext({Uint8Array});
for(const f of ['hero/assets/original.js','hero/terrain.js'])vm.runInContext(fs.readFileSync(new URL(f,root),'utf8'),ctx);
const oracle=JSON.parse(fs.readFileSync(new URL('tools/fixtures/hero-terrain.json',root),'utf8'));
let differences=0;
for(const c of oracle.cases){const s={...c.input,tiles:new Uint8Array(264)};ctx.HeroTerrain.build(s,ctx.HERO_ORIGINAL,()=>0);const actual=Array.from(s.tiles);if(actual.some((x,i)=>x!==c.tiles[i])){if(differences++<5)console.log(c.input,actual.flatMap((x,i)=>x===c.tiles[i]?[]:[{i,actual:x,expected:c.tiles[i]}]));}}
assert.equal(differences,0,`${differences} original room cases differ`);
console.log(`H.E.R.O.: ${oracle.cases.length} complete character maps agree with original.`);
