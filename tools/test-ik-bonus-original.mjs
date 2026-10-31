import fs from 'node:fs';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const scope=vm.createContext({});
for(const name of ['assets/routines.js','bonus.js'])vm.runInContext(fs.readFileSync(new URL('../karate/'+name,import.meta.url),'utf8'),scope,{filename:name});
const core=scope.KarateBonus,counts={};
const cases=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../research/international-karate/bonus-oracle.json.gz',import.meta.url))));
for(const [index,c]of cases.entries()){
 let actual;
 if(c.kind==='weapon'){
  const b=structuredClone(c.state);let cursor=0;
  core.weaponFrame(b,c.frame,()=>{assert(cursor<c.draws.length,'Unexpected RNG read');return c.draws[cursor++];});
  assert.equal(cursor,c.draws.length);actual=b;
 }
 if(c.kind==='tiles')actual=core.tiles(c.broken,c.previous);
 if(c.kind==='reaction')actual=[core.tileCount(c.reaction),core.tileScore(core.tileCount(c.reaction))];
 if(c.kind==='advance'){const s={...c.state};actual=[s,core.advance(s)];}
 assert.deepEqual(JSON.parse(JSON.stringify(actual)),c.expected,`${c.kind} original case ${index}`);
 counts[c.kind]=(counts[c.kind]||0)+1;
}
console.log('Original bonus/tournament cases passed:',counts);
