import assert from 'node:assert/strict';import fs from 'node:fs';import{gunzipSync}from'node:zlib';
import'../robbo/assets/data.js';import{decodeAssets}from'../robbo/raster.mjs';
import{initializeGame,Robbo}from'../robbo/engine.mjs';
const assets=decodeAssets(globalThis.ROBBO_ASSETS),fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/robbo-initializer.json.gz',import.meta.url))));
for(const original of fixture.cases) {
 const {state:s}=initializeGame(assets,{level:original.level});
 const view={...s,robotPhase:s.noga,shotCooldown:s.shotTimer,score:Array.from(s.score)};
 for(const [key,expected]of Object.entries(original.state))assert.deepEqual(view[key],expected,`Planet${original.level} ${key}`);
 assert.deepEqual(Array.from(s.map),original.map,`Planet${original.level} map`);
 assert.deepEqual(Array.from(s.font),original.font,`Planet${original.level} font`);
 const screen=new Uint8Array(2048);
 for(let y=0;y<32;y++)for(let x=0;x<16;x++) {
  const raw=s.displayMap[y*16+x],code=assets.look[raw===160?0:raw&127],at=y*64+x*2;
  screen[at]=code;screen[at+1]=(code+1)&255;screen[at+32]=(code+32)&255;screen[at+33]=(code+33)&255;
 }
 assert.deepEqual(Array.from(screen),original.screen,`Planet${original.level} character raster`);
}
for(const level of [0,4,20,55]) {
 const game=new Robbo(assets,{level,seed:17});let guard=0;
 while(game.phase==='reveal'){game.tick();assert.ok(++guard<200);}
 for(let i=0;i<1200;i++) {
  game.tick({stick:i%160<80?7:13,fire:i%30<20});
  assert.equal(game.state.map.length,512);assert.ok(game.state.level>=0&&game.state.level<56);
  if(game.phase==='gameover')break;
 }
}
// A life pickup survives as an explosion after death; score and cave checkpoint remain.
const game=new Robbo(assets,{seed:37});while(game.phase==='reveal')game.tick();
game.state.lastLifeLevel=0;game.state.score.set([0,0x12,0x34]);game.kill();let guard=0;
while(game.phase!=='reveal'&&game.phase!=='gameover'){game.tick();assert.ok(++guard<300);}
assert.equal(game.state.lives,7);assert.deepEqual(Array.from(game.state.score),[0,0x12,0x34]);
// Resume a legitimate late-planet state beside the first planet's real capsule.
// The original capsule must open after the screw quota reaches zero, then
// walking into it must wipe/reload the real next planet and award 1,000 points.
const next=new Robbo(assets);for(let i=0;i<100;i++)next.tick();const s=next.state;
for(let i=0;i<512;i++)if([42,27,109].includes(s.map[i]&127))s.map[i]=s.displayMap[i]=32;
s.x=s.fx=1;s.y=s.fy=28;s.screws=0;next.ctx.put(42);next.ctx.player.stop();
for(let i=0;i<120;i++)next.tick();assert.equal(s.map[28*16+2],21);assert.equal(s.scrolling,0);
guard=0;while(s.level===0){next.tick({stick:7,fire:false});assert.ok(++guard<150);}
assert.equal(next.phase,'reveal');assert.equal(s.level,1);assert.equal(s.lives,8);assert.deepEqual(Array.from(s.score),[0,0x10,0]);
assert.deepEqual(Array.from(s.map.subarray(0,496)),Array.from(initializeGame(assets,{level:1}).state.map.subarray(0,496)));
const final=new Robbo(assets,{level:55});final.state.lastLifeLevel=55;final.loadLevel(55);assert.equal(final.state.map[7*16+14],225,'An already taken life cannot respawn on the same planet');
const zero=new Robbo(assets,{level:19});while(zero.phase==='reveal')zero.tick();zero.state.lives=0;zero.kill();guard=0;
while(zero.phase!=='gameover'){zero.tick();assert.ok(++guard<300);}assert.equal(zero.checkpoint,16);
const demo=new Robbo(assets,{demo:true});guard=0;while(demo.state.level===0){demo.tick();assert.ok(++guard<1500);}assert.equal(demo.state.lives,8);
console.log('PASS 56 actual XEX initializers: complete map, fonts, character raster and shared state; native simulation, death/reload, real capsule/next-planet transition, score, life memory, zero-spare gameover/checkpoint and demo progression. Full VBI/CPU scan interleaving is a separate timing limit.');
