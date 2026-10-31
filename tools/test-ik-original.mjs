import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
const root=new URL('../',import.meta.url),scope=vm.createContext({});
for(const name of ['assets/animations.js','assets/routines.js','original.js'])
  vm.runInContext(fs.readFileSync(new URL('karate/'+name,root),'utf8'),scope,{filename:name});
const core=scope.KarateOriginal,counts={};
const cases=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('research/international-karate/combat-oracle.json.gz',root))));
for(const [index,c]of cases.entries()){
  const p={...c.p},q={...c.q};let r=0,s=0;
  const random=()=>{assert(r<c.draws.length,`unexpected RNG read in case ${index}`);return c.draws[r++];};
  const scan=()=>{assert(s<c.lines.length,`unexpected raster read in case ${index}`);return c.lines[s++];};
  let actual;
  if(c.kind==='motion'){core.motion(p,c.command,c.human,random);actual=p;}
  if(c.kind==='controls')actual=core.controls(p,q,c.input);
  if(c.kind==='ai'){const command=core.decide(p,q,c.level,random,scan);if(command!==null)core.select(p,command,random);actual=p;}
  if(c.kind==='contact')actual=core.contact(p,q,scope.KARATE_HIT_DATA);
  if(c.kind==='arbitration')actual=core.arbitrate([p,q],c.priority,scope.KARATE_HIT_DATA);
  if(c.kind==='duel'){core.step([p,q],c.inputs,c.humans,c.level,c.priority,random,scan);actual=[p,q];}
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),c.expected,`original ${c.kind} case ${index}: ${JSON.stringify(c)}`);
  assert.equal(r,c.draws.length,`RNG read count, case ${index}`);
  assert.equal(s,c.lines.length,`raster read count, case ${index}`);
  counts[c.kind]=(counts[c.kind]||0)+1;
}
console.log('Original ATR differential cases passed:',counts);
