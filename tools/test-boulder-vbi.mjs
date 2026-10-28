import {readFixture} from './boulder-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({});
for(const file of ['assets/original.js','engine.js','raster.js'])vm.runInContext(fs.readFileSync(path.join(root,'boulder-dash',file),'utf8'),scope,{filename:file});
const ref=readFixture('boulder-vbi'),core=readFixture('boulder-original');
const state=g=>({...Object.fromEntries(Object.keys(core.fields).map(k=>[k,g[k]])),...Object.fromEntries(Object.keys(core.arrays).map(k=>[k,Array.from(g[k])]))});
const bytes=word=>[word&255,word>>8&255];
let frames=0;
for(const test of ref.cases){
 let seed=test.seed,index=0,stream=[];for(let i=0;i<256;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;stream.push(seed>>>24);}
 const g=new scope.Boulder.Cave({cave:test.cave,level:0,randomByte:()=>stream[index++&255]}),r=new scope.BoulderRaster(g);g.stick=15;g.walkSound=64;
 if(test.cave===6)g.magicState=1;if(test.cave===7){g.bonusFlash=128;g.flash=6;}
 for(let frame=0;frame<test.steps.length;frame++){
  if(frame===100)g.stick=7;if(frame===180){g.stick=11;g.facing=1;}if(frame===260)g.stick=15;
  r.frame();g.frame();r.endFrame();const want=test.steps[frame],actual=state(g);
  const diff=Object.keys(actual).filter(k=>JSON.stringify(actual[k])!==JSON.stringify(want.state[k]));
  const font=Buffer.from(want.font,'base64'),fontDiff=Array.from(r.font).findIndex((v,i)=>v!==font[i]);
  const raster=[...bytes(r.cameraX),...bytes(r.vx),...bytes(r.cameraY),...bytes(r.vy),r.tap,r.blink,r.phase,g.clock,r.clock];
  if(diff.length||fontDiff>=0||(index&255)!==want.randomReads||JSON.stringify(raster)!==JSON.stringify(want.raster)||r.background!==want.background){
   console.log(JSON.stringify({cave:test.cave,frame,diff:Object.fromEntries(diff.map(k=>[k,[actual[k],want.state[k]]])),fontDiff,font:fontDiff<0?null:[r.font[fontDiff],font[fontDiff]],rng:[index&255,want.randomReads],raster:[raster,want.raster],background:[r.background,want.background]}));
   throw Error('Original VBI differs');
  }
  frames++;
 }
}
console.log(`PASS ${frames} complete original VBI routines with timers, animation, glyph bytes, scrolling, magic wall and life flash.`);
