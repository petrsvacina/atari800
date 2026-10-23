import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scope=vm.createContext({});
for(const file of ['assets/animations.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'karate',file),'utf8'),scope,{filename:file});
const {Game,inputAction,MOVES}=scope.KarateEngine;
const neutral=()=>({x:0,y:0,fire:false});
const game=(options={})=>new Game({mode:'two',random:()=>.5,...options});
const ticks=(g,n,inputs=[neutral(),neutral()])=>{for(let i=0;i<n;i++)g.tick(inputs);};
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name);}
test('all 16 joystick movements mirror with the fighter',()=>{
  const vectors=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  vectors.forEach(([x,y],i)=>{for(const fire of [false,true]){const expected=i+1+(fire?8:0);assert.equal(inputAction({x,y,fire},1),expected);assert.equal(inputAction({x:-x,y,fire},-1),expected);}});
  assert.equal(inputAction(neutral(),1),0);
});
test('animation cadence and displacement use the original PAL sequence',()=>{
  const g=game(),p=g.players[0];g.startAction(p,3);assert.equal(p.x,98);assert.equal(p.frame,1);
  for(let i=0;i<4;i++)g.updatePlayer(p,{x:1,y:0,fire:false});assert.equal(p.frame,1);
  g.updatePlayer(p,{x:1,y:0,fire:false});assert.equal(p.frame,2);assert.equal(p.x,108);
  g.updatePlayer(p,neutral());assert.equal(p.action,0);assert.equal(p.x,108);
});
test('rear lunge flips once and compensates for the original sprite anchor',()=>{
  const g=game(),p=g.players[0];g.startAction(p,8);
  for(let i=0;i<5;i++)g.updatePlayer(p,{x:-1,y:-1,fire:false});
  assert.equal(p.facing,-1);assert.equal(p.x,80);
  for(let i=0;i<3;i++)g.updatePlayer(p,{x:-1,y:-1,fire:false});assert.equal(p.x,80);
});
test('early release cancels an attack; holding a strike never repeats it',()=>{
  const g=game(),p=g.players[0];g.startAction(p,2);g.updatePlayer(p,neutral());assert.equal(p.action,0);
  g.startAction(p,2);for(let i=0;i<200;i++)g.updatePlayer(p,{x:1,y:-1,fire:false});
  assert.equal(p.frame,20);assert.equal(p.action,2);assert(p.strikeTicks>=10);
  for(let i=0;i<20;i++)g.updatePlayer(p,neutral());assert.equal(p.action,0);
});
function configure(g,frame,x,defenderFrame=0,defenderX=150){
  const a=g.players[0],b=g.players[1];a.x=x;a.facing=1;a.frame=frame;a.action=Object.keys(MOVES).find(id=>scope.KARATE_ANIMATIONS[id]?.frames.includes(frame)&&MOVES[id].active)*1;
  a.connected=false;a.cancelled=false;a.strikeTicks=0;b.x=defenderX;b.facing=-1;b.frame=defenderFrame;b.guard=false;return [a,b];
}
test('original full/half contact thresholds and scores are respected',()=>{
  const g=game();let [a,b]=configure(g,20,124);let hit=g.attackResult(a,b);
  assert(hit);assert.equal(hit.units,2);assert.equal(hit.value,800);
  a.x=132;hit=g.attackResult(a,b);assert(hit);assert.equal(hit.units,1);assert.equal(hit.value,400);
  a.x=90;assert.equal(g.attackResult(a,b),null);
});
test('vulnerable regions distinguish crouch, jump, blocks and sweeps',()=>{
  const g=game();let[a,b]=configure(g,20,124,17);assert.equal(g.attackResult(a,b),null);
  b.frame=26;assert.equal(g.attackResult(a,b),null);
  b.frame=0;b.guard=true;assert(g.attackResult(a,b).blocked);
  [a,b]=configure(g,32,120,0);b.guard=true;const sweep=g.attackResult(a,b);assert(sweep&&!sweep.blocked);
});
test('table-based contacts agree with the raw original coordinate algorithm for every orientation',()=>{
  const g=game(),data=g.hitData;let checked=0;
  for(const frame of data.attackFrames)for(const defenderFrame of [0,6,17,23,26,32])for(const da of [1,-1])for(const dd of [1,-1])for(let distance=-80;distance<=80;distance+=2){
    const[a,b]=configure(g,frame,160,defenderFrame,160+distance);a.facing=da;b.facing=dd;
    const index=data.attackFrames.indexOf(frame);let cls=data.frameClasses[defenderFrame];if(frame===18&&defenderFrame===32)cls=26;
    let expected=null;
    if(cls!==255)for(let z=0;z<6;z++){
      const offset=data.bodyOffsets[cls][z];if(offset===128||!(data.zoneMasks[index]&data.zoneBits[z]))continue;
      const leftA=a.x/2-(da===1?12:24),leftB=b.x/2-(dd===1?12:24);
      const ax=leftA+(da===1?data.attackX[index]:36-data.attackX[index]);
      const tx=leftB+(dd===1?offset:36-offset);
      let delta=da===1?ax-tx:tx-ax;if(da===dd)delta+=data.halfRange[index];
      if(delta>=0&&delta<=data.halfRange[index]){expected=delta<data.fullRange[index]?2:1;break;}
    }
    assert.equal(g.attackResult(a,b)?.units??null,expected);checked++;
  }
  assert(checked>15000);
});
test('a scored hit awards once and two points finish the round',()=>{
  const g=game();g.phase='fight';g.points[0]=2;configure(g,20,124);g.resolveCombat();
  assert.equal(g.points[0],4);assert.equal(g.score[0],800);assert.equal(g.phase,'point');
  ticks(g,g.phaseTicks);assert.equal(g.wins[0],1);assert.equal(g.phase,'round');
  ticks(g,135);assert.equal(g.round,2);assert.equal(g.phase,'ready');assert.equal(g.points[0],0);
});
test('simultaneous strikes cancel without awarding either player',()=>{
  const g=game();const[a,b]=configure(g,20,124);b.frame=20;b.action=2;
  // Find a distance at which both original hit geometries overlap.
  let found=false;
  for(let x=120;x<=150;x++){a.x=x;if(g.attackResult(a,b)&&g.attackResult(b,a)){found=true;break;}}
  assert(found);g.resolveCombat();assert.equal(g.points[0]+g.points[1],0);assert.equal(g.message,'Současný zásah');
  assert.equal(g.referee.message,null);
});
test('the referee announces the scorer then the awarded point and clears before play resumes',()=>{
  const g=game({mode:'solo'});g.phase='fight';configure(g,20,124);g.resolveCombat();
  assert.equal(g.phaseTicks,150);assert.equal(g.referee.message,'BÍLÝ');
  ticks(g,49);assert.equal(g.referee.message,'BÍLÝ');g.tick();assert.equal(g.referee.message,'CELÝ BOD');
  ticks(g,80);assert.equal(g.referee.message,null);ticks(g,20);assert.equal(g.phase,'ready');assert.equal(g.referee.message,null);
  const half=game();half.phase='fight';const[a]=configure(half,20,132);half.resolveCombat();
  assert.equal(half.phaseTicks,100);ticks(half,50);assert.equal(half.referee.message,'PŮL BODU');
  assert.equal(a.action,0);
});
test('a bout-winning full point plays the original hand flourish for either fighter',()=>{
  for(const mode of ['solo','two'])for(const winner of [0,1]){
    const g=game({mode});g.phase='fight';const[a,b]=configure(g,20,124);g.points[winner]=2;
    if(winner===1){a.frame=0;a.action=0;b.frame=20;b.action=2;b.x=150;a.x=124;}
    g.resolveCombat();assert.equal(g.lastPoint.player,winner);assert.equal(g.phaseTicks,150);const scorer=g.players[winner];
    assert.equal(scorer.action,32);const x=scorer.x,facing=scorer.facing,seen=new Set([scorer.frame]);
    for(let i=0;i<84;i++){g.tick([{x:1,y:0,fire:true},{x:-1,y:0,fire:true}]);seen.add(scorer.frame);}
    for(const frame of [34,35,24])assert(seen.has(frame));assert.equal(scorer.x,x);assert.equal(scorer.facing,facing);
    assert.equal(g.points[winner],4);ticks(g,g.phaseTicks);assert.equal(g.phase,'round');assert.equal(g.wins[winner],1);
  }
});
test('a first full point and a half-point victory do not play the flourish; hit poses use seven PAL ticks',()=>{
  for(const[before,x]of [[0,124],[3,132]]){
    const g=game();g.phase='fight';g.points[0]=before;configure(g,20,x);g.resolveCombat();assert.equal(g.players[0].action,0);
    assert.equal(g.players[1].frame,40);ticks(g,6);assert.equal(g.players[1].frame,40);g.tick();assert.equal(g.players[1].frame,41);
  }
});
test('the timer settles wins and draws without corrupting the series',()=>{
  const g=game();g.phase='fight';g.time=1;g.points=[1,2];g.tick();assert.equal(g.roundWinner,1);
  const draw=game();draw.phase='fight';draw.time=1;draw.tick();ticks(draw,135);assert.equal(draw.round,1);assert.equal(draw.wins[0]+draw.wins[1],0);
});
test('solo loss ends the tournament and multiplayer ends after two wins',()=>{
  const solo=game({mode:'solo'});solo.endRound(1);ticks(solo,135);assert.equal(solo.phase,'gameover');
  const multi=game();multi.wins[0]=1;multi.endRound(0);ticks(multi,135);assert.equal(multi.phase,'gameover');
});
test('bonus timing rejects early presses and rewards a perfect break',()=>{
  const g=game({mode:'solo'});g.wins[0]=3;g.startBonus();ticks(g,125);const go=g.bonus.goAt;
  ticks(g,go-1);g.tick([{x:0,y:0,fire:true}]);assert.equal(g.bonus.broken,10);assert.equal(g.score[0],3000);
  const early=game({mode:'solo'});early.wins[0]=3;early.startBonus();ticks(early,125);early.tick([{x:0,y:0,fire:true}]);assert.equal(early.bonus.broken,0);assert.equal(early.score[0],0);
});
test('dodge bonus counts high crouches and low jumps, and finishes',()=>{
  const g=game({mode:'solo'});g.wins[0]=6;g.startBonus();ticks(g,125);g.bonus.count=8;g.bonus.objects=[{x:156,y:151,dir:1,high:true,checked:false}];
  g.tick([{x:0,y:1,fire:false}]);assert.equal(g.bonus.dodged,1);
  ticks(g,100,[{x:0,y:1,fire:false},neutral()]);assert.equal(g.phase,'bonus-result');assert.equal(g.score[0],2100);
});
test('score thresholds advance the belt',()=>{const g=game();g.score[0]=40000;g.belt=g.computeBelt();assert.equal(g.beltInfo[1],'Černý');});
test('fighters cannot push each other through a screen edge',()=>{
  const g=game();g.players[0].x=300;g.players[1].x=300;g.separatePlayers();
  assert.equal(g.players[1].x-g.players[0].x,25);assert.equal(g.players[1].x,300);
  g.players[0].x=20;g.players[1].x=21;g.separatePlayers();assert.equal(g.players[0].x,20);assert.equal(g.players[1].x,45);
  g.players[0].air=true;g.players[0].x=40;g.players[1].x=41;g.separatePlayers();assert.equal(g.players[0].x,40);
});
test('CPU can land real strikes and long deterministic simulations remain finite',()=>{
  let seed=25;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const g=game({mode:'solo',random});ticks(g,6000,[{x:1,y:0,fire:false},neutral()]);
  assert(g.score[1]>0,'CPU must be able to score on an advancing opponent');
  for(let trial=0;trial<20;trial++){
    const sim=game({mode:trial%2?'solo':'two',random});let inputs=[neutral(),neutral()];
    for(let t=0;t<6000;t++){
      if(t%25===0)inputs=[0,1].map(()=>({x:Math.floor(random()*3)-1,y:Math.floor(random()*3)-1,fire:random()<.5}));
      sim.tick(inputs);
      for(const p of sim.players){assert(Number.isFinite(p.x)&&p.x>=20&&p.x<=300);assert(p.frame>=0&&p.frame<56);}
      assert(sim.points.every(p=>p>=0&&p<=4));assert(sim.time>=0);
    }
  }
});
console.log(`${passed} International Karate gameplay tests passed.`);
