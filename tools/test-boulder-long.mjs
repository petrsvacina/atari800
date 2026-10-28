import {readFixture} from './boulder-fixture.mjs';
import assert from'node:assert/strict';import crypto from'node:crypto';import fs from'node:fs';import vm from'node:vm';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),s=vm.createContext({});for(const f of ['assets/original.js','engine.js','raster.js','sound-core.js','session.js'])vm.runInContext(fs.readFileSync(path.join(root,'boulder-dash',f),'utf8'),s);
const ref=readFixture('boulder-long'),bytes=n=>[n&255,n>>8&255];
for(const test of ref.vbi){let seed=37,index=0,random=[];for(let i=0;i<256;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;random.push(seed>>>24);}const g=new s.Boulder.Cave({randomByte:()=>random[index++&255]}),r=new s.BoulderRaster(g);g.stick=15;g.walkSound=64;Object.assign(g,test.changes);
 const checkpoints=new Map(test.steps.map(x=>[x.frame,x]));for(let frame=0;frame<1500;frame++){if(test.name==='frozen'&&frame===300)g.freeze=0;if(test.name==='scroll'&&frame===700){g.playerX=0;g.playerY=2;}r.frame();g.frame();r.endFrame();const want=checkpoints.get(frame);if(!want)continue;
 for(const key of Object.keys(want.state))assert.equal(JSON.stringify(g[key]),JSON.stringify(want.state[key]),`${test.name} ${frame} ${key}`);
 assert.equal(crypto.createHash('sha256').update(r.font).digest('hex'),want.fontSha256,`${test.name} ${frame} font`);assert.equal(index,want.randomReads,`${test.name} ${frame} RNG`);
 assert.equal(JSON.stringify([...bytes(r.cameraX),...bytes(r.vx),...bytes(r.cameraY),...bytes(r.vy),r.tap,r.blink,r.phase,g.clock,r.clock]),JSON.stringify(want.raster),`${test.name} ${frame} raster`);
 }}
const music=new s.BoulderSound.Music();for(const want of ref.music){music.frame();assert.equal(JSON.stringify(music.registers),JSON.stringify(want.registers));for(const key of ['cursor','envelope','loops'])assert.equal(music[key],want[key]);}
for(const [cave,level,next,nextLevel] of ref.advance){const game=new s.BoulderSession();game.g.cave=cave;game.g.level=level;game.advance();assert.equal(game.g.cave,next);assert.equal(game.g.level,nextLevel);}
for(const test of ref.death){if(test.banks[test.player][0]===0)continue;const game=new s.BoulderSession(),decode=b=>({lives:b[0],cave:b[1],level:b[2],score:b.slice(3,9)});game.players=test.two?2:1;game.banks=test.banks.map(decode);Object.assign(game.g,decode(test.banks[test.player]));game.g.player=test.player;game.fail();
 for(const k of ['lives','player','cave','level','gameOver','score']){if(test.state.gameOver&&['lives','player'].includes(k))continue;assert.equal(JSON.stringify(game.g[k]),JSON.stringify(test.state[k]),`death ${JSON.stringify(test)} ${k}`);}}
console.log('PASS 6000 original VBI frames (sparse full-state/font checkpoints), 1100 music ticks, 100 cave transitions and player death banks.');
