import {readFixture} from './boulder-fixture.mjs';
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),s=vm.createContext({});
for(const p of ['assets/original.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'boulder-dash',p),'utf8'),s);
const ref={cases:['boulder-cases','boulder-extra'].flatMap(n=>readFixture(n).cases)};let failures=[];
for(const test of ref.cases){let seed=test.seed??37,i=0,random=[];for(let j=0;j<256;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;random.push(seed>>>24);}
 const g=new s.Boulder.Cave({randomByte:()=>random[i++&255]});Object.assign(g,JSON.parse(JSON.stringify(test.initial)));g.cells.set(Buffer.from(test.cells,'base64'));g.step(test.input);
 const wanted=Buffer.from(test.result,'base64'),cell=Array.from(g.cells).findIndex((v,j)=>v!==wanted[j]),keys=Object.keys(test.state),diff=keys.filter(k=>JSON.stringify(g[k])!==JSON.stringify(test.state[k]));
 if(cell>=0||diff.length||i!==test.randomReads)failures.push({name:test.name,cell,values:cell>=0?[g.cells[cell],wanted[cell]]:null,diff:Object.fromEntries(diff.map(k=>[k,[g[k],test.state[k]]])),random:[i,test.randomReads]});
}
if(failures.length){console.log(JSON.stringify(failures.slice(0,25),null,2));console.log('Failing families',Object.fromEntries(['gravity','enemy','amoeba','move','score','phase'].map(f=>[f,failures.filter(x=>x.name.startsWith(f)).length])));throw Error(`${failures.length}/${ref.cases.length} original cases differ`);}
console.log(`PASS ${ref.cases.length} targeted original gravity, magic, enemy, amoeba, movement, grab, scoring and animation cases.`);
