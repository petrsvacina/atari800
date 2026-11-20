import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync}from'node:zlib';
import {createObjectEngine}from'../robbo/objects.mjs';import{createPlayer,addScore}from'../robbo/player.mjs';
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-player.json.gz',import.meta.url))));
for(let index=0;index<f.cases.length;index++) {
 const item=f.cases[index],state={...item.state,map:Uint8Array.from(item.map),score:Uint8Array.from(item.score),targetAddress:item.targetAddress};let reads=0;const sounds=[];
 const ctx={state,test:(x=state.x,y=state.y)=>state.map[y*16+x]??160,put:id=>{state.map[state.y*16+state.x]=id&255;},randomByte:()=>item.random[reads++%item.random.length],sound:id=>sounds.push(id),addScore:(low,mid)=>addScore(state,low,mid),input:()=>item.input};
 ctx.objects=createObjectEngine(ctx);const player=createPlayer(ctx);ctx.robbo=()=>player.tick();ctx.teleportExit=()=>player.stop();player.tick();
 const result={state:Object.fromEntries(Object.keys(item.state).map(k=>[k,state[k]])),map:Array.from(state.map),score:Array.from(state.score),targetAddress:state.targetAddress,sounds,randomReads:reads};
 try{assert.deepEqual(result,item.expected);}catch(error){console.error('Player case',index,item.state,item.input);throw error;}
}
console.log(`PASS ${f.cases.length} actual XEX player cases: movement, fire/cooldown, pushes, pickups, doors, teleports, magnets, BCD score and random-read order.`);
