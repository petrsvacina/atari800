import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import zlib from 'node:zlib';
const c=vm.createContext({});for(const f of ['assets/fighters.js','assets/animations.js','assets/routines.js','original.js','bonus.js','engine.js'])vm.runInContext(fs.readFileSync(new URL('../karate/'+f,import.meta.url),'utf8'),c,{filename:f});
const neutral=()=>({x:0,y:0,fire:false}),make=mode=>new c.KarateEngine.Game({mode:mode||'solo',random:()=>.5});
function until(g,predicate,inputs=()=>[neutral(),neutral()],limit=10000){let n=0;while(!predicate()){assert(n++<limit,'Transition did not finish');g.tick(inputs());}return n;}
function bonus(g,perfect=true){
 const pressed=new Set();
 return until(g,()=>!g.bonusProgram,()=>{
  const b=g.bonus,inputs=[neutral(),neutral()];
  if(b.kind==='tiles'&&perfect&&b.prompt==='GO'&&!pressed.has(b.player)){inputs[b.player].y=1;pressed.add(b.player);}
  // Isolate the completion handover; projectile movement/contact has independent CPU/GTIA tests.
  if(b.weapon?.enabled){b.weapon.remaining=0;b.weapon.active=0;b.weapon.positions=[0,0,0,0];}
  return inputs;
 });
}
let passed=0;function test(name,fn){fn();console.log('PASS '+name);passed++;}
test('all ten tiles award 2000, with original intermediate breaks and a scene change after the result',()=>{
 const g=make();g.stage=4;g.cycle=4;g.startBonus('tiles');until(g,()=>g.bonus.prompt==='GO');g.tick([{x:0,y:1,fire:false},neutral()]);
 assert.equal(g.bonus.target,10);const seen=new Set();while(g.bonusProgram){seen.add(g.bonus.broken);g.tick();}
 for(let i=1;i<=10;i++)assert(seen.has(i));assert.equal(g.score[0],2000);assert.equal(g.scene,1);assert.equal(g.stage,5);assert.equal(g.phase,'ready');
});
test('FIRE in neutral does not substitute a joystick movement; a missed GO gives no points',()=>{
 const g=make();g.stage=4;g.cycle=4;g.startBonus('tiles');until(g,()=>g.bonus.prompt==='GO');
 until(g,()=>!g.bonusProgram,()=>[{x:0,y:0,fire:true},neutral()]);assert.equal(g.score[0],0);assert.equal(g.scene,1);
});
test('continuous joystick changes cannot evade the original pre-GO calibration penalty',()=>{
 const g=make();g.stage=4;g.cycle=4;g.startBonus('tiles');let turn=0;
 until(g,()=>g.bonus.prompt==='GO',()=>[{x:++turn%2?1:-1,y:0,fire:false},neutral()]);assert.equal(g.bonus.df,25);
 g.tick([{x:++turn%2?1:-1,y:0,fire:false},neutral()]);assert.equal(g.bonus.target,4);
});
test('both players take their own trial; the environment changes once after player two',()=>{
 const g=make('two');g.stage=2;g.cycle=2;g.startBonus('tiles');bonus(g);
 assert.deepEqual([...g.score],[2000,2000]);assert.equal(g.scene,1);assert.equal(g.stage,3);assert.equal(g.mode,'two');
});
test('the original weapons hit an idle fighter and play the matching knockdown',()=>{
 const g=make();g.stage=9;g.cycle=0;g.weaponDifficulty=1;g.startBonus('dodge');
 until(g,()=>g.phase==='bonus-result');assert(g.bonus.weapon.failed);assert([17,18].includes(g.players[0].action));
 until(g,()=>!g.bonusProgram);assert.equal(g.score[0],0);assert.equal(g.scene,1);assert.equal(g.stage,10);
});
test('the original tournament alternates tile and weapon stages and wraps all seven scenes',()=>{
 const g=make(),scenes=[],stages=[];let bouts=0;
 while(scenes.length<7){
  assert(bouts++<40);g.endRound(0);until(g,()=>!g.resultProgram);
  if(g.bonusProgram){stages.push([g.stage,g.bonus.kind]);bonus(g,false);scenes.push(g.scene);}
 }
 assert.deepEqual(scenes,[1,2,3,4,5,6,0]);
 assert.deepEqual(stages,[[4,'tiles'],[9,'dodge'],[13,'tiles'],[18,'dodge'],[22,'tiles'],[27,'dodge'],[31,'tiles']]);
 assert(g.level<=5);assert.equal(g.weaponDifficulty,2);
});
test('multiplayer has bonus stages 2 and 4 before a third bout at stage 5',()=>{
 const g=make('two');
 for(const [winner,stage,kind]of [[0,2,'tiles'],[1,4,'dodge']]){
  g.tug=winner?54:66;g.endRound(winner);until(g,()=>!g.resultProgram);assert.equal(g.stage,stage);assert.equal(g.bonus.kind,kind);bonus(g);
 }
 assert.equal(g.stage,5);assert.equal(g.mode,'two');g.tug=66;g.endRound(0);until(g,()=>!g.resultProgram);assert.equal(g.mode,'solo');assert.equal(g.human,0);assert.equal(g.score[1],0);
});
test('isolated original GTIA contacts agree with native projectile pixels in all supplied cases',()=>{
 const cases=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../research/international-karate/weapon-pixel-oracle.json.gz',import.meta.url))));let hits=0;
 for(const t of cases){const b=c.KarateBonus.weaponState(0,1);Object.assign(b,{kind:t.kind,height:t.height,pos:t.pos,dir:t.dir});c.KarateBonus.drawWeapon(b,0);const actual=c.KarateBonus.weaponContact(b,t.fighter);assert.equal(Boolean(actual),Boolean(t.mask),JSON.stringify(t));if(t.mask)hits++;}
 assert(hits>0&&hits<cases.length);console.log(`${cases.length} GTIA pixel contacts (${hits} hits) verified`);
});
console.log(`${passed} bonus/campaign integration tests passed.`);
