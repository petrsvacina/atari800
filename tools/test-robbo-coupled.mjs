import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import '../robbo/assets/data.js';
import {decodeAssets} from '../robbo/raster.mjs';
import {createState,createServices} from '../robbo/engine.mjs';
const assets=decodeAssets();
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-coupled.json.gz',import.meta.url))));
assert.equal(fixture.sourceSha256,assets.sourceSha256);
assert.equal(fixture.metrics.scans,400);
assert.equal(fixture.metrics.planets,56);
let failed=0;const failures=[];
for(const item of fixture.cases)for(const deferred of [false,true]){
 const state=createState({...item.state,map:Uint8Array.from(item.map),score:Uint8Array.from(item.score),targetAddress:item.targetAddress});
 let reads=0;const sounds=[];
 const ctx=createServices(state,assets,{randomByte:()=>item.random[reads++%item.random.length],sound:id=>sounds.push(id),input:()=>item.input});
 // The original reference isolates CHNMON, so its native afterScan counterpart
 // is also isolated. MFAC and every object procedure remain coupled and real.
 ctx.afterScan=()=>{};
 if(deferred){for(const wait of ctx.objects.scanSteps({wait:true}))assert.ok(wait.frames>0&&wait.frames<=3);}
 else ctx.objects.tick();
 const result={state:Object.fromEntries(Object.keys(item.state).map(k=>[k,state[k]])),map:Array.from(state.map),score:Array.from(state.score),targetAddress:state.targetAddress,sounds,randomReads:reads};
 try{assert.deepEqual(result,item.expected,item.name);}catch(error){
  failed++;const fields=Object.keys(result).filter(k=>JSON.stringify(result[k])!==JSON.stringify(item.expected[k]));
  failures.push({name:item.name,fields});
  if(failed<=5){
   console.error(item.name,'differs:',fields);
   if(fields.includes('state'))console.error('state',result.state,'expected',item.expected.state);
   if(fields.includes('map'))console.error('map',result.map.flatMap((v,i)=>v===item.expected.map[i]?[]:[[i,v,item.expected.map[i]]]));
   if(fields.includes('sounds'))console.error('sounds',result.sounds,'expected',item.expected.sounds);
   if(fields.includes('randomReads'))console.error('RANDOM reads',reads,'expected',item.expected.randomReads);
   if(fields.includes('targetAddress'))console.error('target',state.targetAddress,'expected',item.expected.targetAddress);
  }
 }
}
assert.equal(failed,0,JSON.stringify(failures));
console.log(`PASS ${fixture.metrics.scans} actual-XEX coupled CHNGCV + MFAC scans across all ${fixture.metrics.planets} planets, atomic and HALT-yielding variants: ${fixture.metrics.playerCalls} player calls, ${fixture.metrics.randomReads} RANDOM reads and ${fixture.metrics.soundCalls} sound calls; complete map, shared state, BCD score and camera target`);
