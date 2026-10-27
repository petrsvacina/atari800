import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({});
for(const name of ['assets/rules.js','assets/sprites.js','assets/mechanics.js','arena.js','board-ai.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'archon',name),'utf8'),scope,{filename:name});
const{Game}=scope.ArchonEngine,neutral=()=>({x:0,y:0,fire:false});let count=0,serial=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function seeded(seed=37){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function game(options={}){return new Game({mode:'two',random:seeded(),...options});}
function empty(options={}){const g=game(options);g.units=[];return g;}
function put(g,type,side,x,y,health=g.rules.units[type].hp){const unit={id:'test'+serial++,type,side,x,y,health,alive:true,imprisoned:false};g.units.push(unit);return unit;}
function mages(){const g=empty();put(g,1,'light',0,4);put(g,9,'dark',8,4);return g;}
function ticks(g,n,inputs=[neutral(),neutral()]){for(let i=0;i<n;i++)g.tick(inputs);}
function duel(light=2,dark=15,square={x:4,y:4},options={}){const g=empty(options);const a=put(g,light,'light',2,4),b=put(g,dark,'dark',square.x,square.y);g.startArena(a,b,{cells:Array(240).fill(0)});g.phase='arena';return g;}
test('original board has 36 distinct pieces, 20 species, all five points and exact terrain',()=>{
  const g=game();assert.equal(g.units.length,36);assert.equal(g.rules.units.length,20);assert.equal(g.rules.terrain.length,81);
  assert.equal(g.units.filter(u=>u.side==='light').length,18);assert.equal(new Set(g.units.map(u=>u.x+','+u.y)).size,36);
  assert.equal(g.at(0,4).type,1);assert.equal(g.at(8,4).type,9);assert.equal(g.at(0,5).type,6);assert.equal(g.at(8,5).type,13);
  assert.equal(g.powerControl.light,1);assert.equal(g.powerControl.dark,1);assert.equal(g.rules.powerPoints.length,5);
});
test('ground paths turn corners but cannot cross allies, enemies or diagonally cheat',()=>{
  const g=empty(),u=put(g,7,'light',2,2);put(g,15,'dark',3,2);put(g,7,'light',2,3);
  let moves=g.legalMoves(u);assert(moves.some(p=>p.x===3&&p.y===2));assert(!moves.some(p=>p.x===2&&p.y===3));
  assert(!moves.some(p=>p.x===4&&p.y===2));assert(!moves.some(p=>p.x===4&&p.y===4));assert(moves.some(p=>p.x===1&&p.y===3));
});
test('flyers and mage teleport cross pieces within their original ranges',()=>{
  const g=game(),wizard=g.at(0,4),phoenix=g.at(0,5);
  assert(g.legalMoves(wizard).some(p=>p.x===3&&p.y===4));assert(!g.legalMoves(wizard).some(p=>p.x===4&&p.y===4));
  assert(g.legalMoves(phoenix).some(p=>p.x===5&&p.y===5));assert(!g.legalMoves(phoenix).some(p=>p.x===6&&p.y===5));
  phoenix.imprisoned=true;assert.equal(g.legalMoves(phoenix).length,0);
});
test('each move consumes one turn; light changes only after the second side',()=>{
  const g=game(),old=g.luminosity;assert(g.move(g.at(1,4),3,4));assert.equal(g.turn,'dark');assert.equal(g.luminosity,old);
  assert(g.move(g.at(7,4),5,4));assert.equal(g.turn,'light');assert.equal(g.round,2);assert.equal(g.luminosity,1);
});
test('six original brightness phases and complementary bonuses repeat without holding endpoints',()=>{
  const g=game();g.cycleIndex=0;const levels=[];
  for(let i=0;i<11;i++){levels.push(g.lifeBonus('light',4,4));g.advanceLight();}
  assert.deepEqual(levels,[0,1,3,4,6,7,6,4,3,1,0]);
  for(let i=0;i<10;i++){assert.equal(g.lifeBonus('light',4,4)+g.lifeBonus('dark',4,4),7);g.advanceLight();}
});
test('a used spell weakens only its own home-point shield, including non-mage defenders',()=>{
  const g=game();for(const key of ['heal','revive','exchange'])g.usedSpells.light.add(key);
  assert.equal(g.lifeBonus('light',0,4),4);assert.equal(g.lifeBonus('dark',8,4),7);
  assert.equal(g.lifeBonus('light',1,0),7);assert.equal(g.lifeBonus('light',4,4),3);
  assert.equal(g.at(0,4).health,10);
});
test('power points heal each full round and the matching peak heals the army',()=>{
  const g=mages(),point=g.at(0,4),ordinary=put(g,7,'light',3,3,2);point.health=5;
  g.finishTurn();assert.equal(point.health,5);assert.equal(ordinary.health,2);
  g.finishTurn();assert.equal(point.health,6);assert.equal(ordinary.health,2);
  g.cycleIndex=4;g.turn='dark';g.finishTurn();assert.equal(g.luminosity,5);assert.equal(point.health,8);assert.equal(ordinary.health,3);
});
test('spell cancellation and invalid power-point targets do not spend a spell or a turn',()=>{
  const g=game();assert(g.beginSpell('teleport'));assert.equal(g.spellCell(0,4),false);assert.equal(g.turnNumber,1);assert(!g.usedSpells.light.has('teleport'));
  g.cancel();assert.equal(g.spell,null);assert.equal(g.turnNumber,1);
});
test('teleport accepts its own mage, rejects prisoners and protected destinations, and can start a remote duel',()=>{
  const g=mages(),mage=g.at(0,4),ally=put(g,7,'light',2,2),enemy=put(g,15,'dark',6,2);ally.imprisoned=true;
  g.beginSpell('teleport');assert(!g.spellCell(2,2));ally.imprisoned=false;assert(g.spellCell(2,2));assert(!g.spellCell(4,4));assert(g.spellCell(6,2));
  assert.equal(g.phase,'arena-intro');assert(g.usedSpells.light.has('teleport'));assert.equal(g.arena.defender,enemy);
  const self=mages();self.at(0,4).x=2;self.at(2,4).y=2;self.beginSpell('teleport');assert(self.spellCell(2,2));assert(self.spellCell(4,3));assert.equal(self.at(4,3).type,1);
  assert.equal(mage.health,10);
});
test('healing accepts only allies, including prisoners, outside magic points',()=>{
  const g=mages(),u=put(g,7,'light',2,2,1),enemy=put(g,15,'dark',6,2,1);u.imprisoned=true;g.beginSpell('heal');
  assert(!g.spellCell(6,2));assert.equal(enemy.health,1);assert(!g.usedSpells.light.has('heal'));
  assert(g.spellCell(2,2));assert.equal(u.health,5);assert(u.imprisoned);assert(g.usedSpells.light.has('heal'));
});
test('shift time reverses the source direction; endpoint wrap waits for the second turn',()=>{
  const g=mages();g.beginSpell('shiftTime');assert.equal(g.luminosity,2);assert.equal(g.cycleDirection,-1);g.finishTurn();assert.equal(g.luminosity,3);
  const peak=mages();peak.cycleIndex=5;peak.beginSpell('shiftTime');assert.equal(peak.luminosity,5);peak.finishTurn();assert.equal(peak.luminosity,0);
});

test('exchange swaps either faction but cannot move prisoners',()=>{
  const g=mages(),a=put(g,7,'light',2,2),b=put(g,15,'dark',6,6);b.imprisoned=true;g.beginSpell('exchange');assert(!g.spellCell(6,6));assert(g.spellCell(2,2));b.imprisoned=false;assert(g.spellCell(6,6));assert.equal(a.x,6);assert.equal(b.x,2);assert.equal(g.turn,'dark');
});
test('revive returns a captured ally to an empty neighboring square with full energy',()=>{
  const g=mages(),dead=put(g,7,'light',2,2,1);dead.alive=false;g.beginSpell('revive');assert(g.chooseRevive(dead.id));assert(!g.spellCell(3,3));assert(g.spellCell(1,3));assert(dead.alive);assert.equal(dead.health,5);assert.equal(dead.x,1);assert.equal(dead.y,3);
});
test('imprisonment expires at the prisoners own peak and is illegal at that peak',()=>{
  const g=mages(),enemy=put(g,15,'dark',6,2);g.beginSpell('imprison');assert(g.spellCell(6,2));assert(enemy.imprisoned);g.cycleIndex=9;g.cycleDirection=1;g.advanceLight();assert.equal(g.luminosity,0);assert(!enemy.imprisoned);
  const peak=mages();const e=put(peak,15,'dark',5,2);peak.cycleIndex=0;peak.beginSpell('imprison');assert(!peak.spellCell(e.x,e.y));assert(!peak.usedSpells.light.has('imprison'));
});
test('each of seven spells is single-use and a dead or imprisoned mage cannot cast',()=>{
  const g=game();for(const spell of Object.keys(scope.ArchonEngine.SPELLS)){g.usedSpells.light.add(spell);assert(g.spellStatus(spell));}
  g.usedSpells.light.clear();g.at(0,4).imprisoned=true;assert(g.spellStatus('heal'));g.at(0,4).alive=false;assert(g.spellStatus('heal'));
});
test('summoned elementals fight without terrain bonus then disappear even after winning',()=>{
  const g=mages(),enemy=put(g,15,'dark',5,2);g.beginSpell('summonElemental');assert(g.spellCell(5,2));assert(g.arena.summoned);
  const a=g.arena.fighters[0],b=g.arena.fighters[1];assert(a.type>=16&&a.type<=19);assert.equal(a.bonus,0);a.hp=2;b.hp=0;g.resolveArena();assert(!enemy.alive);assert.equal(g.at(5,2),null);assert(!g.units.some(u=>u.type>=16));
});
test('arena energy comes from the challenged square; its bonus absorbs damage before persistent HP',()=>{
  const g=duel(7,13);g.cycleIndex=1;g.startArena(g.units[0],g.units[1]);const dragon=g.arena.fighters[1];assert.equal(dragon.hp,23);dragon.hp=13;g.arena.fighters[0].hp=0;g.resolveArena();assert.equal(g.units[1].health,13);
  const shield=duel(7,13);shield.cycleIndex=1;shield.startArena(shield.units[0],shield.units[1]);shield.arena.fighters[1].hp=18;shield.arena.fighters[0].hp=0;shield.resolveArena();assert.equal(shield.units[1].health,17);
});
test('the shapeshifter copies form/weapon; its documented web recovery fallback remains 10',()=>{
  const g=duel(6,12),copy=g.arena.fighters[1];assert.equal(copy.type,6);assert.equal(copy.spec.special,'phoenix');assert.equal(copy.maxHP,12+copy.bonus);copy.hp=1;g.arena.fighters[0].hp=0;g.resolveArena();assert.equal(g.units[1].health,10);
});
test('movement uses source starting positions and heavy units skip their fourth eligible step',()=>{
  const normal=duel(7,15);ticks(normal,4,[{x:1,y:1,fire:false},neutral()]);assert.equal(normal.arena.fighters[0].x,34);assert.equal(normal.arena.fighters[0].y,116);
  const slow=duel(3,11);ticks(slow,4,[{x:1,y:0,fire:false},neutral()]);assert.equal(slow.arena.fighters[0].x,32);
  const x=normal.arena.fighters[0].x;ticks(normal,5,[{x:1,y:0,fire:true},neutral()]);assert.equal(normal.arena.fighters[0].x,x);
});

test('source fire needs a direction and the reload prevents repeating attacks',()=>{
  const g=duel(0,8),a=g.arena.fighters[0];g.tick([{x:0,y:0,fire:true},neutral()]);assert.equal(a.weapon.active,0);
  g.tick([{x:1,y:0,fire:true},neutral()]);assert.equal(a.weapon.active,128);assert.equal(a.cooldown,a.spec.reload-1);
  const origin=a.weapon.hx;g.tick([{x:1,y:0,fire:true},neutral()]);assert(a.weapon.hx>origin);assert.equal(a.cooldown,a.spec.reload-2);
});



test('the original field contains eighteen obstacles and color registers advance after 256 updates',()=>{
  const g=duel(7,15);g.startArena(g.units[0],g.units[1]);g.phase='arena';const n=g.arena.native;
  assert.equal([...n.cells].filter(v=>(v&63)>=1&&(v&63)<=3).length,18);
  assert.deepEqual([...n.colors],[0,4,12]);ticks(g,255);assert.deepEqual([...n.colors],[0,4,12]);g.tick();assert.deepEqual([...n.colors],[2,6,10]);
});

test('phoenix remains immune during its source explosion and banshee can move after releasing fire',()=>{
  const g=duel(6,14),p=g.arena.fighters[0],b=g.arena.fighters[1];g.startAttack(p);const hp=p.hp;
  b.weapon.contact=1;assert(!g.arena.native.hit(1));assert.equal(p.hp,hp);
  g.startAttack(b);const x=b.x;g.tick([neutral(),{x:-1,y:0,fire:false}]);assert(b.x<x);assert(b.areaTicks>0);
});

test('a dead shooters missile still damages the enemy before the original death countdown resolves',()=>{
  const g=duel(2,15),a=g.arena.fighters[0],b=g.arena.fighters[1];a.hp=0;a.hx=0;b.hp=4;
  Object.assign(a.weapon,{active:128,hx:b.hx,by:b.by,dx:4,dy:0,dir:17});
  g.tick();assert.equal(b.hp,0);assert.equal(g.phase,'arena');
  for(let i=0;i<100&&g.phase==='arena';i++)g.tick();assert.equal(g.phase,'arena-result');assert.equal(g.arena.winner,null);
  ticks(g,g.phaseTicks);assert.equal(g.phase,'over');assert.equal(g.winner,null);
});

test('an attacker victory moves onto the disputed square; a defender victory stays there',()=>{
  const g=duel(2,15),square={...g.arena.square};g.arena.fighters[1].hp=0;g.resolveArena();assert.equal(g.units[0].x,square.x);assert.equal(g.units[0].y,square.y);assert(!g.units[1].alive);
  const defend=duel(2,15);defend.arena.fighters[0].hp=0;defend.resolveArena();assert.equal(defend.units[1].x,4);assert.equal(defend.units[1].y,4);
});
test('all five points, no enemy pieces and the final prisoner are distinct victory conditions',()=>{
  const points=empty();for(const[x,y]of points.rules.powerPoints)put(points,7,'light',x,y);put(points,15,'dark',7,7);assert(points.checkVictory());assert.equal(points.winner,'light');
  const prison=mages();prison.at(8,4).imprisoned=true;assert(prison.checkVictory());assert.equal(prison.winner,'light');
  const gone=mages();gone.at(8,4).alive=false;assert(gone.checkVictory());assert.equal(gone.winner,'light');
});
test('the source small-army counter is armed by AI and checked before the next light change',()=>{
  const humans=mages();for(let i=0;i<28;i++)humans.finishTurn();assert.equal(humans.phase,'board');
  const g=mages();g.quietCounter=252;for(let i=0;i<25;i++)g.finishTurn();assert.equal(g.phase,'board');g.finishTurn();assert.equal(g.phase,'over');assert.equal(g.winner,null);
});

test('computer turns and sustained combat simulations preserve board and arena invariants',()=>{
  let ended=0;
  for(let trial=0;trial<16;trial++){
    const random=seeded(trial+7),g=duel(trial%8,8+trial%8,{x:4,y:4},{mode:'solo',humanSide:trial%2?'dark':'light',random});
    for(let t=0;t<2400&&g.phase==='arena';t++){
      const controls=[neutral(),neutral()];const human=g.humanSide==='light'?0:1;
      if(t%75<35)controls[human]={x:human?-1:1,y:Math.floor(t/150)%2?1:-1,fire:false};else controls[human]={x:human?-1:1,y:0,fire:true};
      g.tick(controls);
      assert(g.arena.shots.length<=2);
      for(const a of g.arena.fighters){assert(Number.isFinite(a.x));if(a.hp>0){assert(a.x>=24&&a.x<=296);assert(a.y>=43&&a.y<=212);}assert(a.hp>=0&&a.hp<=a.maxHP);}
    }
    if(g.phase!=='arena')ended++;
  }
  assert(ended>=10,`${ended} duels ended`);
  const board=game({mode:'solo',humanSide:'dark',random:seeded(4)});ticks(board,50);assert(board.turn!=='light'||board.phase!=='board');
});
console.log(`${count} Archon gameplay checks passed.`);
