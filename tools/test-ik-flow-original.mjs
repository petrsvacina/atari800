import fs from 'node:fs';import zlib from 'node:zlib';import vm from 'node:vm';import assert from 'node:assert/strict';
const c=vm.createContext({});
for(const f of ['assets/fighters.js','assets/animations.js','assets/routines.js','original.js','bonus.js','engine.js'])vm.runInContext(fs.readFileSync(new URL('../karate/'+f,import.meta.url),'utf8'),c,{filename:f});
const cases=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../research/international-karate/flow-oracle.json.gz',import.meta.url))));
const counts={};
for(const [index,t]of cases.entries()){
 const s=t.state,g=new c.KarateEngine.Game({mode:s.humans.every(Boolean)?'two':'solo',random:()=>.5});
 g.human=s.humans[0]?0:1;for(const key of ['stage','cycle','level','weaponDifficulty','points','roundScore','score','wins','tug','lastWinner','hitState','attackOwner'])g[key]=structuredClone(s[key]);
 g.time=s.time*50;g.round=s.stage;g.frameByte=0;g.poseClock=16;g.totalTicks=0;
 t.initial.forEach((p,i)=>Object.assign(g.players[i],p));let cursor=0;
 g.randomByte=()=>{assert(cursor<t.draws.length,`Unexpected RNG read case ${index}`);return t.draws[cursor++];};
 const contactCalls=new WeakMap();c.KarateBonus.weaponContact=b=>{
  if(!b.enabled)return 0;const n=(contactCalls.get(b)||0)+1;contactCalls.set(b,n);return t.hitAfter&&n>=t.hitAfter?4:0;
 };
 if(t.kind==='result')g.endRound(g.timeoutWinner());else g.startBonus(t.kind);
 const goTimes=new Map();
 while(t.kind==='result'?g.resultProgram:g.bonusProgram){
  assert(g.totalTicks<15000,`Flow did not finish: ${index}`);
  const inputs=[{x:0,y:0,fire:false},{x:0,y:0,fire:false}],b=g.bonus;
  if(t.kind==='tiles'&&b){
   if(b.prompt==='GO'&&!goTimes.has(b.player))goTimes.set(b.player,g.totalTicks);
   const start=goTimes.get(b.player);
   if(start!==undefined&&t.reaction!==null&&g.totalTicks+1-start>=t.reaction)inputs[b.player].y=1;
  }
  g.tick(inputs);
 }
 const actual={frames:g.totalTicks,score:[...g.score],stage:g.stage,cycle:g.cycle,level:g.level,scene:g.scene,humans:[+g.isHuman(0),+g.isHuman(1)],wins:[...g.wins],mode:g.phase==='gameover'?6:g.bonus?.kind==='tiles'?4:g.bonus?.kind==='dodge'?5:1};
 assert.deepEqual(actual,t.expected,`Original ${t.kind} flow ${index}: ${JSON.stringify(t.state)}`);
 assert.equal(cursor,t.draws.length,`RNG count flow ${index}`);
 counts[t.kind]=(counts[t.kind]||0)+1;
}
console.log('Original complete control flows passed:',counts);
