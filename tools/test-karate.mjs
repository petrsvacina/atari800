import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope=vm.createContext({});
for(const file of ['assets/animations.js','assets/fighters.js','assets/routines.js','original.js','bonus.js','engine.js'])vm.runInContext(fs.readFileSync(new URL('../karate/'+file,import.meta.url),'utf8'),scope,{filename:file});
const {Game,inputAction}=scope.KarateEngine,core=scope.KarateOriginal;
const neutral=()=>({x:0,y:0,fire:false});
const make=options=>new Game({mode:'two',random:()=>.5,...options});
const ticks=(g,n,inputs=[neutral(),neutral()])=>{for(let i=0;i<n;i++)g.tick(inputs);};
const finishResult=g=>{for(let n=0;g.resultProgram;n++){assert(n<5000);g.tick();}};
const finishBonus=g=>{for(let n=0;g.bonusProgram;n++){assert(n<10000);g.tick();}};
let passed=0;
function test(name,body){body();passed++;console.log('PASS '+name);}
function contact(g,{frame=20,ax=124,bx=150,defenderFrame=0,winner=0}={}){
 const a=g.players[winner],b=g.players[winner^1];
 a.x=ax;a.facing=1;a.x=ax;a.frame=frame;a.action=2;a.strikeTicks=0;
 b.facing=-1;b.x=bx;b.frame=defenderFrame;b.action=0;b.strikeTicks=0;
 g.priority=winner;g.phase='fight';return [a,b];
}
test('the static move guide mirrors all sixteen directions',()=>{
 const vectors=[[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
 vectors.forEach(([x,y],i)=>{for(const fire of [false,true]){assert.equal(inputAction({x,y,fire},1),i+1+(fire?8:0));assert.equal(inputAction({x:-x,y,fire},-1),i+1+(fire?8:0));}});
});
test('the original bow animates for 70 PAL frames and suspends the clock',()=>{
 const g=make({mode:'solo'});assert.equal(g.players[0].frame,48);ticks(g,24);assert.equal(g.players[0].frame,48);
 g.tick();assert.equal(g.players[0].frame,49);ticks(g,45);assert.equal(g.phase,'fight');assert.equal(g.seconds,30);
 ticks(g,24);assert.equal(g.seconds,30);g.tick();assert.equal(g.seconds,29);ticks(g,49);assert.equal(g.seconds,29);g.tick();assert.equal(g.seconds,28);
});
test('movement is sampled at the original five-frame cadence',()=>{
 const g=make();ticks(g,70);const before=g.players[0].x;
 ticks(g,4,[{x:1,y:0,fire:false},neutral()]);assert.equal(g.players[0].x,before);
 g.tick([{x:1,y:0,fire:false},neutral()]);assert.equal(g.players[0].x,before+8);
});
test('releasing a punch rewinds its preparation instead of teleporting to neutral',()=>{
 const g=make(),p=g.players[0];core.select(p,2,()=>128);core.motion(p,2,true,()=>128);
 assert.equal(p.frame,15);const x=p.x;core.motion(p,0,true,()=>128);assert.equal(p.frame,0);assert.equal(p.x,x);
});
test('turning retains the original held-direction input until the action ends',()=>{
 const g=make(),p=g.players[0],q=g.players[1];core.select(p,8,()=>128);core.motion(p,8,true,()=>128);core.motion(p,8,true,()=>128);
 assert.equal(p.facing,-1);assert.equal(p.inputFlipped,1);assert.equal(core.controls(p,q,{x:-1,y:-1,fire:false}),8);
});
test('a held strike moves only on its first strike step and loses eligibility after two',()=>{
 const g=make(),p=g.players[0];core.select(p,2,()=>128);core.motion(p,2,true,()=>128);core.motion(p,2,true,()=>128);
 assert.equal(p.strikeTicks,1);const x=p.x;for(let i=0;i<30;i++)core.motion(p,2,true,()=>128);
 assert.equal(p.frame,20);assert.equal(p.x,x);assert.equal(p.strikeTicks,31);
});
test('solo scoring is announced immediately and awarded after 50 frames',()=>{
 const g=make({mode:'solo'});contact(g);g.resolveCombat();assert.equal(g.lastPoint.units,2);assert.equal(g.phaseTicks,150);
 assert.equal(g.points[0],0);assert.equal(g.score[0],0);assert.equal(g.referee.message,'BÍLÝ');ticks(g,49);assert.equal(g.score[0],0);
 g.tick();assert.equal(g.points[0],2);assert.equal(g.score[0],800);assert.equal(g.referee.message,'CELÝ BOD');ticks(g,80);assert.equal(g.referee.message,null);
 ticks(g,20);assert.equal(g.phase,'ready');assert.equal(g.players[0].action,28);
});
test('a second full solo point plays the original flourish and a matching fall',()=>{
 const g=make({mode:'solo'});g.points[0]=2;contact(g);g.resolveCombat();assert.equal(g.players[0].action,32);assert.equal(g.players[1].action,18);
 const seen=new Set();for(let t=0;t<84;t++){seen.add(g.players[0].frame);g.tick();}for(const f of [34,35,24])assert(seen.has(f));
 ticks(g,g.phaseTicks);assert.equal(g.phase,'round');assert.equal(g.points[0],4);assert.equal(g.soloWins,1);
});
test('simultaneous attacks follow the original alternating priority',()=>{
 for(const priority of [0,1]){
  const g=make();const[a,b]=contact(g);b.frame=20;b.action=2;
  let found=false;for(let x=120;x<=150;x+=2){a.x=x;if(g.attackResult(a,b)&&g.attackResult(b,a)){found=true;break;}}
  assert(found);g.priority=priority;g.resolveCombat();assert.equal(g.lastWinner,priority);assert.equal(g.tug,priority===0?61:59);
 }
});
test('multiplayer moves one of twelve marker steps per hit, with no solo point race',()=>{
 const g=make();assert.equal(g.seconds,60);g.time=59*50;
 for(let i=0;i<6;i++){
  contact(g);g.resolveCombat();assert.equal(g.tug,61+i);assert.equal(g.pendingRound,i===5);
  assert.equal(g.phaseTicks,i===5?150:100);ticks(g,g.phaseTicks);
  assert.equal(g.phase,i===5?'round':'fight');
 }
 assert.equal(g.wins[0],1);assert.equal(g.points[0],2);
});
test('ordinary multiplayer hits resume immediately, without repeating the bow',()=>{
 const g=make();ticks(g,70);g.time=59*50;contact(g);g.resolveCombat();ticks(g,100);assert.equal(g.phase,'fight');assert.notEqual(g.players[0].action,28);
});
test('a solo win converts remaining seconds to 100 points at four PAL frames each',()=>{
 const g=make({mode:'solo'});g.time=3*50;g.endRound(0);ticks(g,99);assert.equal(g.score[0],0);
 g.tick();assert.equal(g.score[0],100);ticks(g,8);assert.equal(g.score[0],300);assert.equal(g.seconds,0);finishResult(g);assert.equal(g.round,2);assert.equal(g.phase,'ready');assert.equal(g.level,0);
});
test('the first bonus follows three wins; the next fight advances the original stage',()=>{
 const g=make({mode:'solo'});
 for(let win=0;win<3;win++){g.endRound(0);finishResult(g);}
 assert.equal(g.phase,'bonus-ready');assert.equal(g.bonus.kind,'tiles');assert.equal(g.stage,4);
 finishBonus(g);assert.equal(g.stage,5);assert.equal(g.scene,1);assert.equal(g.phase,'ready');
});
test('the winner of the two-player series continues against the original CPU',()=>{
 const g=make();g.wins[1]=1;g.endRound(1);finishResult(g);assert.equal(g.mode,'solo');assert.equal(g.human,1);assert.equal(g.isHuman(0),false);assert.equal(g.isHuman(1),true);
});
test('both original AI sides can score and long input sequences remain valid',()=>{
 let seed=25;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 let cpuScored=false;
 for(let trial=0;trial<30;trial++){
  const g=make({mode:trial%2?'solo':'two',random});let inputs=[neutral(),neutral()];
  for(let t=0;t<10000;t++){
   if(t%17===0)inputs=[0,1].map(()=>({x:Math.floor(random()*3)-1,y:Math.floor(random()*3)-1,fire:random()<.5}));
   g.tick(inputs);
   for(const p of g.players){assert(Number.isFinite(p.x));assert(p.origin>=0&&p.origin<240);assert(p.frame>=0&&p.frame<54);}
   if(g.mode==='solo'&&g.score[1]>0)cpuScored=true;
   assert(g.time>=0);assert(g.points.every(n=>n>=0&&n<=5));
  }
 }
 assert(cpuScored);
});
console.log(`${passed} International Karate integration tests passed.`);
