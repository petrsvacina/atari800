import {readFixture} from './boulder-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({});
for(const file of ['assets/original.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'boulder-dash',file),'utf8'),scope,{filename:file});
const ref=readFixture('boulder-original');
const state=g=>({...Object.fromEntries(Object.keys(ref.fields).map(k=>[k,g[k]])),...Object.fromEntries(Object.keys(ref.arrays).map(k=>[k,Array.from(g[k])]))});
let fields=0;
for(const cave of ref.caves){
 const g=new scope.Boulder.Cave({cave:cave.cave,level:cave.level});
 assert.deepEqual(Buffer.from(g.cells),Buffer.from(cave.cells,'base64'),'Source cave '+cave.cave+'/'+cave.level);
 assert.deepEqual(state(g),cave.state,'Source initial state '+cave.cave+'/'+cave.level);
}
console.log(`PASS ${ref.caves.length} complete original cave generations and initial game states.`);
let failures=[];
for(const trace of ref.traces){
 let seed=trace.seed,index=0;const random=[];for(let i=0;i<256;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;random.push(seed>>>24);}
 const g=new scope.Boulder.Cave({cave:trace.cave,level:trace.level,randomByte:()=>random[index++&255]});g.preSpawn=g.spawnSeconds=0;
 for(let step=0;step<trace.steps.length;step++){
  const want=trace.steps[step];g.step(want.input);
  const cells=Buffer.from(want.cells,'base64'),different=Array.from(g.cells).findIndex((v,i)=>v!==cells[i]);
  const actual=state(g),deltas=Object.keys(actual).filter(k=>JSON.stringify(actual[k])!==JSON.stringify(want.state[k]));
  if(different>=0||deltas.length||(index&255)!==want.randomReads){failures.push({cave:trace.cave,step,cell:different,cellValues:different<0?null:[g.cells[different],cells[different]],deltas:Object.fromEntries(deltas.map(k=>[k,[actual[k],want.state[k]]])),rng:[index&255,want.randomReads]});break;}
  fields+=880+Object.keys(actual).length;
 }
}
if(failures.length){for(const f of failures)console.log('DIFFERENCE '+JSON.stringify(f));throw Error(`${failures.length} original scan replays differ.`);}
console.log(`PASS ${ref.traces.length} complete original scan replays; ${fields} cell/state comparisons.`);
