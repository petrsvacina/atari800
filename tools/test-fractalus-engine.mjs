import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Fractalus,PAL_HZ,NTSC_HZ} from '../rescue-on-fractalus/engine.mjs';
import {prepareCockpit,renderCockpit} from '../rescue-on-fractalus/cockpit.mjs';
import * as spriteApi from '../rescue-on-fractalus/sprites.mjs';
const names=['bootstrap','trigonometry','geometry','raster','objects','sound','rescue','systems','lifecycle','cockpit','sprites','timing'];
const data=Object.fromEntries(names.map(name=>[name,JSON.parse(fs.readFileSync(new URL(`../rescue-on-fractalus/assets/${name}.json`,import.meta.url)))]));
prepareCockpit(data.cockpit);spriteApi.prepareSprites(data.sprites);
const snapshot=g=>({state:structuredClone(g.state),terrain:[...g.world.terrain],objects:[...g.world.objects],visible:[...g.world.visibleCells],ring:[...g.sound.ring],parameters:[...g.sound.parameters],registers:[...g.registers],randomPhase:g.randomSource.phase,randomReads:g.randomSource.reads,phase:g.phase,passes:g.logicalPasses,ticks:g.ticks});
let frames=0,draws=0;
for(const standard of ['pal','ntsc'])for(const level of [1,4,8,16]) {
 const original=new Fractalus(data,{level,seed:0x1471+level,standard,spriteApi});
 const smooth=new Fractalus(data,{level,seed:0x1471+level,standard,spriteApi});
 assert.equal(original.hz,standard==='pal'?PAL_HZ:NTSC_HZ);
 for(let tick=0;tick<1600&&!original.ended;tick++) {
  const input={port:tick%320<40?253:tick%320<80?247:tick%320<110?251:255,fire:tick%31<15};
  if(tick===200||tick===400){original.command(7);smooth.command(7);}
  original.tick(input);smooth.tick(input);frames++;
  const before=snapshot(smooth);
  for(let n=0;n<1+(tick%3);n++) {const terrain=smooth.terrain(true);const state=smooth.cockpitState();const pixels=renderCockpit(state,terrain);spriteApi.overlaySprites(pixels,state,smooth.pm,{terrain});draws++;}
  assert.deepEqual(snapshot(smooth),before,`${standard} level${level} smooth rendering changed gameplay at ${tick}`);
  if(!(tick%100))assert.deepEqual(snapshot(smooth),snapshot(original),`${standard} level${level} render mode changed simulation`);
 }
 assert.deepEqual(snapshot(smooth),snapshot(original));
}
// Real lifecycle wired through the game must finish a fatal event, rather than
// leave a permanently frozen cockpit after the tested standalone generator.
const fatal=new Fractalus(data,{spriteApi,seed:3});fatal.state.enemyEvent=1;
for(let i=0;i<800&&!fatal.ended;i++)fatal.tick({port:255,fire:false});
assert.equal(fatal.phase,'gameover');assert.ok(fatal.events.some(e=>e.type==='gameover'));
// A mission bonus runs under the station clock, so flight cannot move the ship
// or add survival score while the per-pilot bonus animation is running.
const mission=new Fractalus(data,{spriteApi,seed:4});
Object.assign(mission.state,{mode:2,depth:0x6000,ready:255,rescued:mission.state.quota,energy:220});
mission.afterRescue();const x=mission.state.worldX,z=mission.state.worldZ;
for(let i=0;i<1500&&mission.phase!=='standby';i++)mission.tick({port:255,fire:false});
assert.equal(mission.phase,'standby');assert.equal(mission.state.worldX,x);assert.equal(mission.state.worldZ,z);
assert.ok(mission.events.some(e=>e.type==='mission'&&e.completed));
const previousScore=mission.state.score;mission.launch(mission.nextLevel);assert.equal(mission.phase,'flight');assert.equal(mission.state.score,previousScore);
console.log(`PASS ${frames} coupled native PAL/NTSC flight ticks + ${draws} extra rendering calls with identical gameplay/RNG/audio; fatal and mission-return/next-launch integration.`);
