import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';import{inflateSync}from'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),s=vm.createContext({});
for(const f of ['assets/original.js','mechanics.js','generator.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'river-raid',f),'utf8'),s,{filename:f});
const data=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/river-game-oracle.json'))),cases=JSON.parse(inflateSync(Buffer.from(data.cases,'base64')));let frames=0;
function terrain(g){const h=createHash('sha256');for(let y=0;y<160;y++)h.update(g.course.fullRow(g.generated-y)||new Uint8Array(48));return h.digest('hex');}
function check(g,state,label){
 for(const[k,v]of Object.entries(state.plane))assert.equal(g.player[k],v,`${label} player.${k}`);
 for(const[k,v]of Object.entries(state.fields))assert.equal(g.gen[k]&255,v,`${label} generator.${k}`);
 assert.equal(g.fuel,state.fuel,`${label} fuel`);assert.equal(g.life,state.life,`${label} life`);
 assert.equal(g.score,state.score,`${label} score`);assert.equal(g.bridge,state.bridge,`${label} bridge`);assert.equal(g.playerIndex,state.playerIndex,`${label} pilot`);
 for(const[k,v]of Object.entries(state.tank))assert.equal(g.tank[k],v,`${label} tank.${k}`);
 for(const[k,v]of Object.entries(state.gunner))assert.equal(g.gunner[k]&255,v,`${label} gunner.${k}`);
 assert.deepEqual([...g.gen.checkpoint.seed,g.gen.checkpoint.center],state.checkpoint,`${label} checkpoint`);
 assert.deepEqual([...g.gen.previousCheckpoint.seed,g.gen.previousCheckpoint.center],state.previousCheckpoint,`${label} previous checkpoint`);
 assert.deepEqual(Array.from(g.gen.seed),state.seed,`${label} live seed`);
 for(let i=0;i<11;i++)for(const[k,v]of Object.entries(state.actors[i]))assert.equal(g.gen.actors[i][k],v,`${label} actor ${i}.${k}`);
 assert.equal(terrain(g),state.terrainSha256,`${label} all 160 wide river rows`);
}
for(const c of cases){
 const g=new s.RiverRaid.Game({bridge:c.bridge,mode:c.mode}),initial=c.initial;
 // Align the externally timed start (hardware RNG and raster phase). Positions,
 // generator state, seed and terrain are generated natively and checked first.
 for(let i=0;i<11;i++){for(const k of ['rawY','rawX','type','size'])assert.equal(g.gen.actors[i][k],initial.actors[i][k]);g.gen.actors[i].frame=initial.actors[i].frame;g.gen.actors[i].flags=initial.actors[i].flags;}
 g.tick=initial.tick-1;check(g,initial,`bridge ${c.bridge} initial`);g.start();g.random=()=>c.randomByte;
 if(c.collisionFreePlayer){const sample=g.collisions.bind(g);g.collisions=()=>({...sample(),playerActor:-1,bulletActor:-1,blastActor:-1,playerBank:false,gunnerShot:false,tankShot:false,bulletBank:false});g.pending=g.collisions();}
 for(const [frame,f]of c.frames.entries()){if(f.injection==='bank')g.pending.playerBank=true;if(f.injection==='bridge')g.pending.bulletActor=f.slot;const input={fire:f.fire,left:!(f.controls&4),right:!(f.controls&8),up:!(f.controls&1),down:!(f.controls&2)};g.step(input);while(g.phase==='clearing')g.step(input);assert.equal((g.tick+1)&255,f.state.tick,`frame clock ${frame}`);check(g,f.state,`bridge ${c.bridge} ${c.mode} ${c.collisionFreePlayer?'immune':'natural'} frame ${frame}`);frames++;}
 console.log(`PASS bridge ${c.bridge}: ${c.frames.length} full original foreground/raster frames`);
}
console.log(`PASS ${frames} coupled game frames: native generation, all slots, AI, steering, fuel and full river raster`);
