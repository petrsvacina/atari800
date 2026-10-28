import {readFixture} from './boulder-fixture.mjs';
import assert from 'node:assert/strict';import path from 'node:path';import{fileURLToPath}from'node:url';
import fs from'node:fs';import vm from'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),s=vm.createContext({});for(const p of ['assets/original.js','assets/timing.js','engine.js','timing.js'])vm.runInContext(fs.readFileSync(root+'/boulder-dash/'+p,'utf8'),s);const cases=['boulder-cases','boulder-extra'].flatMap(n=>readFixture(n).cases);let delta={},miss=new Set(),examples={};
for(const test of cases){let seed=test.seed??37,i=0,random=[];for(let j=0;j<256;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;random.push(seed>>>24);}const g=new s.Boulder.Cave({randomByte:()=>random[i++&255]});Object.assign(g,JSON.parse(JSON.stringify(test.initial)));g.cells.set(Buffer.from(test.cells,'base64'));let cycles=s.BoulderTiming.scanStart(g,test.input)+s.BoulderTiming.scanEnd(g)-13+11;
 for(const w of g.scanCave(test.input)){cycles+=s.BoulderTiming.cell(w,miss);if(w.column===39)cycles+=s.BoulderTiming.row(g,w);}
 const diff=cycles-test.cycles;delta[diff]=(delta[diff]||0)+1;examples[diff]??=test.name;
}if(Object.keys(delta).some(k=>k!=='0'))console.log({delta,examples});assert.deepEqual([...miss],[]);assert.deepEqual(Object.keys(delta),['0']);console.log(`PASS ${cases.length} complete original CPU-work timings, with page crossings and decimal/scoring branches.`);
