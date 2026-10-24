import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({});
for(const file of ['assets/levels.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'goonies-web',file),'utf8'),scope,{filename:file});
const {Game}=scope.GooniesEngine,levels=scope.GOONIES_LEVELS;
let passed=0;
function test(name,run){run();console.log('PASS '+name);passed++;}
function fresh(scene=0,options={}){const g=new Game({scene,...options});g.level=JSON.parse(JSON.stringify(g.level));g.level.enemies=[];g.level.hazards=[];return g;}
function at(g,id,x,y){const p=g.players[id];Object.assign(p,{x,y,vx:0,vy:0,attached:null,rail:null,grounded:true,climbing:false,oldUp:false,attachCooldown:0,invincible:99999});return p;}
function ticks(g,n,inputs=[]){for(let i=0;i<n;i++)g.step(inputs);}
test('all eight ordered rooms have bounded geometry, two spawns and cooperative exits',()=>{
  assert.equal(levels.length,8);assert.deepEqual(Array.from(levels,l=>l.sourceRoomId),[0,2,1,3,4,5,6,7]);
  for(const l of levels){assert.equal(l.spawns.length,2);assert(l.exit.bothChildren);for(const p of l.platforms){assert(p.x1>=0&&p.x2<=320&&p.x1<p.x2);assert(p.y>=0&&p.y<=176);}for(const p of l.spawns)assert(p.x>0&&p.x<320&&p.y>=0&&p.y<=176);}
});
test('horizontal input moves and clamps a character without moving the inactive partner',()=>{
  const g=fresh(),x=g.players[1].x;ticks(g,20,[{right:true},{}]);assert(g.players[0].x>52);assert.equal(g.players[1].x,x);
  at(g,0,314,143);ticks(g,20,[{right:true}]);assert.equal(g.players[0].x,315);
});
test('a jump needs a new up press and cannot restart in midair',()=>{
  const g=fresh();const p=at(g,0,120,104);g.step([{up:true}]);const velocity=p.vy;assert(velocity<0);g.step([{up:true}]);assert(p.vy>velocity);ticks(g,70,[{up:true}]);assert.equal(p.y,104);assert.equal(p.vy,0);
});
test('the house jump cannot bypass the chair by clearing the 36-pixel upper floor',()=>{
  const g=fresh(),p=at(g,0,160,68);let minimum=68;g.step([{up:true}]);for(let i=0;i<70;i++){g.step([{}]);minimum=Math.min(minimum,p.y);}assert(minimum>32);assert.equal(p.y,68);
});
test('attic ladder requires the pushed chair and the chair gives a real raised surface',()=>{
  const g=fresh(),p=at(g,0,216,68);g.step([{up:true}]);assert(!p.climbing);g.objects.chair.x=200;at(g,0,216,68);g.step([{up:true}]);assert(p.climbing);assert(g.platformList().some(f=>f.dynamic&&f.y===59));
});
test('climbing uses the original directional control and stops at the floor endpoint',()=>{
  const g=fresh(),p=at(g,0,248,104);ticks(g,50,[{up:true}]);assert.equal(p.y,68);assert.equal(p.x,248);g.step([{}]);assert(p.grounded);
});
test('switching preserves a held mechanism; deliberate movement releases it',()=>{
  const g=fresh(2);g.attach(g.players[0],'valve1');const x=g.players[0].x,y=g.players[0].y;g.switchActor();ticks(g,60);assert.equal(g.players[0].attached,'valve1');assert.equal(g.players[0].x,x);assert.equal(g.players[0].y,y);g.step([{left:true}]);assert.equal(g.players[0].attached,null);assert(g.players[0].x<x);
});
test('fireplace requires both water and a printer distraction; the distraction expires',()=>{
  const g=fresh();g.state.cooler=true;assert(!g.ready());at(g,0,g.objects.press.x,g.objects.press.y);g.puzzle([{},{}]);assert(g.ready());at(g,0,160,104);ticks(g,361);assert(!g.ready());
});
test('one escaped child waits for the other; both advance exactly one room',()=>{
  const g=fresh();g.state.cooler=true;g.state.distracted=999;at(g,0,g.level.exit.x,g.level.exit.y);g.exits();assert(g.players[0].escaped);assert.equal(g.phase,'playing');assert.equal(g.selected,1);at(g,1,g.level.exit.x,g.level.exit.y);g.exits();assert.equal(g.phase,'transition');ticks(g,105);assert.equal(g.scene,1);assert(g.players.every(p=>!p.escaped));
});
test('a keeper opens the chamber but a key cannot be collected without the chamber route',()=>{
  const g=fresh(1);at(g,0,g.objects.key.x,g.objects.key.y);g.puzzle([]);assert(!g.state.key);g.attach(g.players[1],'crank');at(g,0,g.objects.ball.x,g.objects.ball.y);g.puzzle([]);assert(g.state.chamberEntered);at(g,0,g.objects.key.x,g.objects.key.y);g.puzzle([]);assert(g.state.key);assert(g.ready());
});
test('the moving float carries a resting child rather than sliding away underneath',()=>{
  const g=fresh(1),p=at(g,0,g.objects.ball.x,g.objects.ball.y);p.support='ball';const x=p.x;ticks(g,20);assert(p.x>x);assert.equal(p.y,g.objects.ball.y);assert.equal(p.support,'ball');
});
test('overhead rails catch a jumping child, allow traversal and release downwards',()=>{
  const g=fresh(1),p=at(g,0,150,82);p.grounded=false;g.step([{up:true}]);assert.equal(p.rail,0);const x=p.x;ticks(g,20,[{right:true}]);assert(p.x>x);assert.equal(p.y,82);g.step([{down:true}]);assert.equal(p.rail,null);assert(p.y>82);
});
test('both separate valves must be held for pressure to build; the broken pipe stays open',()=>{
  const g=fresh(2);g.attach(g.players[0],'valve1');ticks(g,120);assert(!g.state.opened);g.attach(g.players[1],'valve2');ticks(g,89);assert(!g.state.opened);g.step();assert(g.state.opened);g.release(g.players[0]);g.release(g.players[1]);assert(g.ready());
});
test('two children cannot occupy the same hanging mechanism',()=>{
  const g=fresh(2);assert(g.attach(g.players[0],'valve1'));assert(!g.attach(g.players[1],'valve1'));assert.equal(g.players[1].attached,null);
});
test('three physically routed rocks break all boards while the lower trap is held',()=>{
  const g=fresh(3);g.attach(g.players[1],'seat');
  for(let i=0;i<4200&&g.state.boards;i++){
    const r=g.rocks[0];const chain=!r||r.y<60?'chain1':r.y<100||r.vx>0?'chain2':'chain3';g.attach(g.players[0],chain);g.step();
  }
  assert.equal(g.state.boards,0);assert(g.ready());assert.equal(g.lives,5);
});
test('rocks without the lower counterweight cannot remove exit boards',()=>{
  const g=fresh(3);g.rocks=[{x:g.objects.pipe.x,y:g.objects.pipe.y,vx:0,vy:0}];g.rollingRocks();assert.equal(g.state.boards,3);
});
test('four pushed eggs require the bone holder and build four actual steps',()=>{
  const g=fresh(4),target=g.objects.chute;g.eggs=[{x:target.x,y:target.y,vy:0}];g.fallingEggs();assert.equal(g.state.eggs,0);g.attach(g.players[1],'bone');
  for(let i=0;i<4;i++){g.eggs=[{x:target.x,y:target.y,vy:0}];g.fallingEggs();}
  assert.equal(g.state.eggs,4);assert.equal(g.score,200);assert(g.ready());assert.equal(g.platformList().filter(p=>p.dynamic&&p.y>=138&&p.y<170).length,4);
});
test('the right-hand spring provides enough height to reach the hanging bone',()=>{
  const g=fresh(4),p=at(g,0,264,80);for(let i=0;i<40&&!p.attached;i++)g.step([{up:true}]);assert.equal(p.attached,'bone');
});
test('organ support changes over time and has two solid colors at each phase',()=>{
  const g=fresh(5);for(const age of [0,90,180,270]){g.age=age;assert.equal(['blue','white','red'].filter(c=>g.platformVisible(c)).length,2);}g.age=0;assert(g.platformVisible('blue'));g.age=90;assert(!g.platformVisible('blue'));
});
test('the released cage stays down after its first holder leaves',()=>{
  const g=fresh(6);g.attach(g.players[0],'bone');g.puzzle([]);assert(g.state.cageDropped);g.release(g.players[0]);g.puzzle([]);assert(g.state.cageDropped);assert(g.platformList().some(p=>p.dynamic&&p.y===152));
});
test('flipper pumping drains water only while the other child holds the lock',()=>{
  const g=fresh(6),o=g.objects.flipper;at(g,0,o.x,o.y);g.puzzle([]);assert.equal(g.state.drained,0);g.attach(g.players[1],'lock');for(let i=0;i<3;i++){at(g,0,o.x,o.y);g.state.cooldowns.flipper=0;g.puzzle([]);}assert.equal(g.state.drained,3);assert(g.ready());
});
test('treasure needs both levers and Sloth rather than the small child',()=>{
  const g=fresh(7),c=g.objects.chest;g.state.leverA=g.state.leverB=true;at(g,0,c.x,c.y).vx=1;g.ship([]);assert(!g.state.treasure);at(g,0,100,124);at(g,1,c.x,c.y).vx=1;g.ship([]);assert(g.state.treasure);assert(!g.ready());
});
test('a second lower-lever use lifts the child on the boom before the treasure exit opens',()=>{
  const g=fresh(7);g.state.leverA=g.state.leverB=g.state.treasure=true;at(g,0,g.objects.boom.x,g.objects.boom.y);const p=at(g,1,g.objects.leverA.x,g.objects.leverA.y);p.vx=1;g.ship([]);assert(g.state.boomRaised);assert(g.state.lifted);assert.equal(g.players[0].y,g.objects.boom.raisedY);assert(g.ready());
});
test('deaths spend a shared life once, reset the room and eventually stop at game over',()=>{
  const g=fresh();g.hurt('hit');g.hurt('again');assert.equal(g.lives,4);ticks(g,90);assert.equal(g.phase,'playing');assert.equal(g.scene,0);g.lives=1;g.hurt('last');ticks(g,90);assert.equal(g.phase,'over');const t=g.tick;ticks(g,100);assert.equal(g.tick,t);
});
test('pause freezes actors, projectiles, puzzle timers and the simulation clock',()=>{
  const g=fresh();g.paused=true;const before=JSON.stringify(g);ticks(g,100,[{up:true,right:true}]);assert.equal(JSON.stringify(g),before);
});
test('the complete house puzzle is solvable with real directional and switch inputs and five lives',()=>{
  const replay=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/goonies-house-replay.json'),'utf8'));
  const g=new Game(replay.options);
  for(const step of replay.steps){if(g.selected!==step.actor)g.switchActor();const input=[{},{}];input[g.selected]=step.input;ticks(g,step.frames,input);}
  assert.equal(g.phase,'transition');assert(g.players.every(p=>p.escaped));assert(g.state.cooler);assert.equal(g.lives,5);
});
test('the octopus chamber has a firm landing at the top of its return ladder',()=>{
  const g=fresh(6),p=at(g,0,160,144);ticks(g,70,[{up:true}]);g.step([{}]);assert.equal(p.y,88);assert(p.grounded);g.step([{up:true,right:true}]);assert(p.vy<0);
});
test('both children can cross the complete timed organ room with directional inputs and five lives',()=>{
  const replay=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/goonies-organ-replay.json'),'utf8'));
  const g=new Game(replay.options);
  for(const step of replay.steps){if(g.selected!==step.actor)g.switchActor();const input=[{},{}];input[g.selected]=step.input;ticks(g,step.frames,input);}
  assert.equal(g.phase,'transition');assert(g.players.every(p=>p.escaped));assert.equal(g.lives,5);
});
test('practice ends after its room while campaign completes after the eighth room',()=>{
  const g=fresh(5,{practice:true});for(const p of g.players)at(g,p.id,g.level.exit.x,g.level.exit.y);g.exits();ticks(g,105);assert.equal(g.phase,'complete');assert.equal(g.scene,5);
  const last=fresh(7);Object.assign(last.state,{treasure:true,boomRaised:true,lifted:true});for(const p of last.players)at(last,p.id,last.level.exit.x,last.level.exit.y);last.exits();ticks(last,105);assert.equal(last.phase,'complete');
});
test('long deterministic simulations never create invalid coordinates or negative scores',()=>{
  let seed=8147;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let scene=0;scene<8;scene++){const g=fresh(scene);for(let i=0;i<1800;i++){g.step(g.players.map(()=>({left:random()<.2,right:random()<.2,up:random()<.12,down:random()<.08})));for(const p of g.players){assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(p.x>=0&&p.x<=320);}assert(g.score>=0);assert(g.lives>=0);}}
});
console.log(`${passed} Goonies gameplay checks passed.`);
