import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({});
for(const file of ['assets/rules.js','assets/sprites.js','assets/mechanics.js','arena.js','board-ai.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'archon',file),'utf8'),scope,{filename:file});
export function compareRaster(ref){
const failures=[];let checked=0;
for(const test of ref.cases){
 const g=new scope.ArchonEngine.Game({mode:'two'});g.units=test.types.map((type,i)=>({id:'raster'+i,type,side:i?'dark':'light',x:i?4:2,y:4,alive:true,health:g.rules.units[type].hp}));
 g.startArena(...g.units,{cells:test.cells});const n=g.arena.native;n.clock=test.clock;n.deathClock=test.sourceColor[8];
 for(let i=0;i<2;i++)for(let k=0;k<ref.fields.length;k++){
  const parts=ref.fields[k].split('.');let owner=n.fighters[i];if(parts.length===2)owner=owner[parts.shift()];owner[parts[0]]=test.initial[i][k];
 }
 n.lastDrawn=n.pictures();const expected=Buffer.from(test.expected,'base64'),stride=ref.fields.length*2+5;let failed=false;
 for(let step=0;step<test.inputs.length&&!failed;step++){
  n.step(test.inputs[step].map(([x,y,fire])=>({x,y,fire})));
  for(let i=0;i<2&&!failed;i++)for(let k=0;k<ref.fields.length;k++){
   const actual=ref.fields[k].split('.').reduce((a,k)=>a[k],n.fighters[i])&255,want=expected[step*stride+i*ref.fields.length+k];checked++;
   if(actual!==want){failures.push(`${test.types.join('/')}, frame ${step}, actor ${i}, ${ref.fields[k]}: ${actual} != ${want}`);failed=true;break;}
  }
  if(!failed){
   const actual=[n.deathClock,n.finished?128:0,...n.colors],want=[...expected.subarray(step*stride+ref.fields.length*2,step*stride+stride)];
   try{assert.deepEqual(actual,want);}catch(_){failures.push(`${test.types.join('/')}, frame ${step}, clock/colors ${actual} != ${want}`);failed=true;}
  }
 }
}
return{failures,checked};
}
const ref=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/archon-collisions.json'))),{failures,checked}=compareRaster(ref);
if(failures.length){for(const f of failures)console.log('FAIL raster '+f);throw Error(`${failures.length} complete original raster duels differ (${checked} states checked).`);}
console.log(`PASS ${ref.cases.length} complete original VBI kernels with stable GTIA scanout, real pixel collisions, color cycling and ${checked} state comparisons.`);
