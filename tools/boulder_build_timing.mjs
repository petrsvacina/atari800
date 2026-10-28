import {readFixture} from './boulder-fixture.mjs';
/* Match native semantic paths to offline original cycle measurements. */
import fs from'node:fs';import vm from'node:vm';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),s=vm.createContext({});for(const p of ['assets/original.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'boulder-dash',p),'utf8'),s);
const cases=['boulder-cases','boulder-extra'].flatMap(n=>readFixture(n).cases),timing=['boulder-timing','boulder-timing-extra'].flatMap(n=>readFixture(n).cases),paths={};let conflicts=[],handlers=0;
for(let t=0;t<cases.length;t++){
 const test=cases[t];let seed=test.seed??37,i=0,random=[];for(let j=0;j<256;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;random.push(seed>>>24);}
 const g=new s.Boulder.Cave({randomByte:()=>random[i++&255]});Object.assign(g,JSON.parse(JSON.stringify(test.initial)));g.cells.set(Buffer.from(test.cells,'base64'));const measured=new Map(timing[t].map(row=>[row[0],row]));
 for(const w of g.scanCave(test.input)){
  const m=measured.get(w.row*40+w.column);if(!m)continue;handlers++;
  const reads=[...m[3]];let extra=0;
  if([18,22].includes(w.code)&&String(w.path[0]).startsWith('b')){const branch=Number(w.path[0][1]);extra=branch===1?3:2;for(let z=0;z<extra;z++)reads.push(81);}
  const low=(0x4c50+w.row*40+w.column-41)&255;
  const value=[m[2]-(low+81>255?extra:0),reads];
  if(paths[w.key]&&JSON.stringify(paths[w.key])!==JSON.stringify(value))conflicts.push({key:w.key,old:paths[w.key],value,case:test.name});
  else paths[w.key]=value;
 }
}
console.log('Handler paths',Object.keys(paths).length,'measured handlers',handlers,'conflicts',conflicts.length);if(conflicts.length){console.log(JSON.stringify(conflicts.slice(-10),null,2));throw Error('Timing path is underspecified');}
fs.writeFileSync(path.join(root,'boulder-dash/assets/timing.js'),'// Measured native semantic-path cycles and cell-read offsets; no instructions.\nglobalThis.BOULDER_TIMING_PATHS='+JSON.stringify(paths)+';\n');
