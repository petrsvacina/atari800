import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),s=vm.createContext({});
for(const f of ['assets/original.js','mechanics.js'])vm.runInContext(fs.readFileSync(path.join(root,'river-raid',f),'utf8'),s,{filename:f});
const a=s.RIVER_ASSETS.mechanics,M=s.RiverMechanics;
const oracle=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/river-combat-oracle.json')));
let updates=0;
for(const c of oracle.cases){
 const state={actors:structuredClone(c.initialActors),tank:{frame:5,rawX:112,rawY:100,follow:c.config.follow||0,bankCollision:c.config.bankCollision,phase:255},stage:c.config.stage,playing:c.config.playing!==false,flip:c.config.flip||0,nearest:c.config.nearest??11,first:0};
 for(const f of c.frames){state.tick=f.tick;state.bridgeDestroyed=f.bridgeDestroyed;if(f.tick===64)state.tank.frame=133;M.updateCombat(state,c.config.random??64,a);assert.deepEqual(JSON.parse(JSON.stringify(state.actors)),f.actors,`${JSON.stringify(c.config)} tick ${f.tick}`);assert.deepEqual({frame:state.tank.frame,rawX:state.tank.rawX,phase:state.tank.phase},f.tank);updates++;}
}
console.log(`PASS ${updates} original NPC/tank updates, all eleven slots`);
for(const [x,bonus] of [[91,false],[92,false],[93,true],[100,true],[131,true],[132,false]]){const t={rawX:x,frame:5,phase:255};assert.equal(M.tankBonus(t,100,2),bonus);assert.equal(t.frame&128,bonus?128:0);}
console.log('PASS original bridge/tank bonus interval');
let shotUpdates=0;
for(const c of oracle.shots){const t={...c.initial};for(const expected of c.frames){M.updateTankShot(t,c.playing,a);for(const[k,v]of Object.entries(expected))assert.equal(t[k],v,`shot ${shotUpdates} ${k}`);shotUpdates++;}}
console.log(`PASS ${shotUpdates} original tank beam/explosion updates`);
const sceneOracle=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/river-scene-oracle.json')));
let gunnerUpdates=0;
for(const c of sceneOracle.gunners){const t={rawX:0,rawY:0,dx:0};for(const [tick,f] of c.frames.entries()){t.bankCollision=tick===20;M.updateGunner(t,{frame:tick>=30?2:10,rawX:100,rawY:120,flags:c.flags},c.playing);for(const[k,v]of Object.entries(f))assert.equal(t[k],v,`gunner ${gunnerUpdates} ${k}`);gunnerUpdates++;}}
console.log(`PASS ${gunnerUpdates} original gunner missile updates`);
