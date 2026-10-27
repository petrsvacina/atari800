import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({});
for(const file of ['assets/rules.js','assets/sprites.js','assets/mechanics.js','arena.js','board-ai.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(root,'archon',file),'utf8'),scope,{filename:file});
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/archon-mechanics.json'))),{Game}=scope.ArchonEngine,{field}=scope.ArchonArena;
function rng(seed){let index=0,values=[];for(let i=0;i<256;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;values.push(seed>>>24);}return{next(){return values[index++&255];},get count(){return index&255;},reset(){index=0;}};}
let assertions=0;const failures=[];
for(const ref of fixtures.generators){const r=rng(ref.seed),cells=field(()=>r.next());assert.deepEqual([...cells],ref.cells,'Original obstacle generator seed '+ref.seed);assert.equal(r.count,ref.randomReads);assertions+=2;}
for(const ref of fixtures.cases){
 const random=rng(ref.seed),g=new Game({mode:ref.kind.startsWith('computer')?'solo':'two',humanSide:ref.kind==='computer-dark'?'light':'dark',randomByte:()=>random.next()});
 g.units=ref.types.map((type,i)=>({id:'oracle'+i,type,side:i?'dark':'light',x:i?4:2,y:4,health:g.rules.units[type].hp,alive:true,imprisoned:false}));
 g.startArena(...g.units,{cells:fixtures.generators[ref.cells].cells});const n=g.arena.native;n.classes=ref.classes||[0,0,0];
 for(let i=0;i<2;i++)for(let k=0;k<fixtures.fields.length;k++){
  const parts=fixtures.fields[k].split('.');let owner=g.arena.fighters[i];if(parts.length===2)owner=owner[parts.shift()];owner[parts[0]]=ref.initial[i][k];
 }
 random.reset();const expected=Buffer.from(ref.expected,'base64'),stride=fixtures.fields.length*2+1;
 let failed=false;
 for(let step=0;step<ref.inputs.length;step++){
  const [x,y,fire,c0,c1,w0,w1,p0,p1]=ref.inputs[step],f=g.arena.fighters;
  f[0].terrainContact=c0;f[1].terrainContact=c1;f[0].weapon.terrain=w0;f[1].weapon.terrain=w1;f[0].weapon.contact=p0;f[1].weapon.contact=p1;
  n.actorStep(1,{x:0,y:0,fire:false});n.actorStep(0,{x,y,fire:!!fire});
  for(let i=0;i<2&&!failed;i++)for(let k=0;k<fixtures.fields.length;k++){
   const key=fixtures.fields[k],actual=key.split('.').reduce((a,k)=>a[k],f[i]),want=expected[step*stride+i*fixtures.fields.length+k];
   if((actual&255)!==want){failures.push(`${ref.name}, step ${step}, fighter ${i}, ${key}: ${actual} != original ${want}`);failed=true;break;}
   assertions++;
  }
  if(!failed&&random.count!==expected[step*stride+stride-1]){failures.push(`${ref.name}, step ${step}, RNG reads ${random.count} != original ${expected[step*stride+stride-1]}`);failed=true;}
  if(failed)break;
 }
}
if(failures.length){for(const message of failures.slice(0,40))console.log('FAIL '+message);throw Error(`${failures.length} original replay cases differ (${assertions} matching states before differences).`);}
console.log(`PASS ${fixtures.generators.length} original obstacle fields and ${fixtures.cases.length} arena replays; ${assertions} byte-state comparisons.`);

const boardFixtures=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/archon-board.json')));
const boardFailures=[];
for(const ref of boardFixtures.cases){
 const random=rng(ref.seed),g=new Game({mode:'two',randomByte:()=>random.next()});
 for(const u of g.units){u.alive=false;u.imprisoned=ref.prisoners.includes(u.originalIndex);const data=ref.units.find(v=>v.originalIndex===u.originalIndex);if(data)Object.assign(u,data,{alive:true});}
 g.turn=ref.side;g.firstSide=ref.firstSide;g.cycleIndex=g.rules.luminosity.hardwareLuma.indexOf(ref.luma);g.sourceLightDirection=ref.direction;
 g.originalAIState={...ref.state};
 for(let i=0;i<2;i++)g.usedSpells[i?'dark':'light']=new Set(ref.usedSpells[i].map(k=>scope.ArchonBoardAI.spells[k]));
 const selected=new scope.ArchonBoardAI.BoardAI(g).choose();let actual=null;
 if(selected?.spell){
  const key=scope.ArchonBoardAI.spells.indexOf(selected.spell);actual={spell:key};
  if(key===0){const u=g.unit(selected.target);Object.assign(actual,{x:u?.x,y:u?.y,destinationX:selected.x,destinationY:selected.y});}
  else if(key===5)Object.assign(actual,{x:selected.x,y:selected.y,revive:g.unit(selected.revive)?.originalIndex});
  else if(key!==2)Object.assign(actual,{x:selected.x,y:selected.y});
 }else if(selected){actual={unit:g.unit(selected.unit)?.originalIndex,x:selected.x,y:selected.y};}
 const expected={...ref.action};if(expected.spell===2){delete expected.x;delete expected.y;}
 try{assert.deepEqual(actual,expected);assert.equal(random.count,ref.randomReads,'RANDOM reads');assert.deepEqual(g.originalAIState,ref.afterState,'AI state');}
 catch(error){boardFailures.push({seed:ref.seed,actual,expected,random:[random.count,ref.randomReads],state:[g.originalAIState,ref.afterState]});}
}
if(boardFailures.length){for(const f of boardFailures.slice(0,20))console.log('FAIL board',JSON.stringify(f));throw Error(`${boardFailures.length}/${boardFixtures.cases.length} original board decisions differ.`);}
console.log(`PASS ${boardFixtures.cases.length} complete original board decisions, spell targets, RNG consumption and evaluation state.`);
const turns=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/archon-rules.json')));
for(const ref of turns.cases){
 const g=new Game({mode:'two',firstSide:ref.firstSide});
 const state=()=>({luma:g.rules.luminosity.hardwareLuma[g.luminosity],direction:g.rules.luminosity.cycle[(g.cycleIndex+g.cycleDirection+10)%10]>g.luminosity?1:-1,side:g.turn});
 assert.deepEqual(state(),ref.initial,'Original initialization '+ref.firstSide);
 for(const [id,hp] of [[8,3],[6,2],[27,4]])g.units.find(u=>u.originalIndex===id).health=hp;
 for(const id of [6,29])g.units.find(u=>u.originalIndex===id).imprisoned=true;
 for(const want of ref.steps){
  g.finishTurn();const actual=state();
  actual.health=Array.from(g.units).sort((a,b)=>a.originalIndex-b.originalIndex).map(u=>u.health);
  actual.prisoners=['light','dark'].map(side=>g.units.find(u=>u.side===side&&u.imprisoned)?.originalIndex??255);
  assert.deepEqual(actual,want,'Complete source turn, starting side '+ref.firstSide);
 }
}
console.log('PASS both original starting sides and 44 complete turns with source light direction, healing and prisoner release.');

const spells=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/archon-spells.json')));
let targets=0;
for(const ref of spells.cases){
 const g=new Game({mode:'two'});g.turn=ref.side;
 for(const u of g.units){
  const cell=ref.board.indexOf(u.originalIndex);u.alive=cell>=0;u.x=cell%9;u.y=Math.floor(cell/9);u.imprisoned=ref.prisoners.includes(u.originalIndex);
 }
 const first=g.units.find(u=>u.originalIndex===ref.selected);
 g.spell={key:ref.spell,stage:ref.stage,first:ref.stage?first.id:null};
 const valid=new Set(Array.from(g.spellTargets(),p=>p.y*9+p.x));
 for(let cell=0;cell<81;cell++){
  assert.equal(valid.has(cell),ref.valid[cell],`${ref.side} ${ref.spell}/${ref.stage} target (${cell%9},${Math.floor(cell/9)})`);targets++;
 }
}
console.log(`PASS ${targets} original spell target decisions for both sides, including prisoners, Revive and empty magic points.`);

const dispatch=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/archon-ai-spells.json')));
for(const want of dispatch.cases){
 const ref=boardFixtures.cases.find(r=>r.seed===want.seed),random=rng(ref.seed),g=new Game({mode:'two',randomByte:()=>random.next()});
 for(const u of g.units){u.alive=false;u.imprisoned=ref.prisoners.includes(u.originalIndex);const data=ref.units.find(v=>v.originalIndex===u.originalIndex);if(data)Object.assign(u,data,{alive:true});}
 g.turn=ref.side;g.firstSide=ref.firstSide;g.cycleIndex=g.rules.luminosity.hardwareLuma.indexOf(ref.luma);g.sourceLightDirection=ref.direction;g.originalAIState={...ref.state};
 for(let i=0;i<2;i++)g.usedSpells[i?'dark':'light']=new Set(ref.usedSpells[i].map(k=>scope.ArchonBoardAI.spells[k]));
 g.computerTurn();
 assert.equal(g.phase==='arena-intro',want.fight,'Source AI spell dispatch '+ref.seed);
 const spent=['light','dark'].flatMap(side=>scope.ArchonBoardAI.spells.map(key=>g.usedSpells[side].has(key)?254:253));
 assert.deepEqual(spent,want.spent,'Source spell consumption '+ref.seed);
 if(want.fight){
  assert.deepEqual([g.arena.attacker.originalIndex,g.arena.defender.originalIndex,g.arena.square.x,g.arena.square.y],
   [want.attacker,want.defender,want.x,want.y],'Source dispatched combatants '+ref.seed);
 }else if(ref.action.spell===0){
  const moved=g.units.find(u=>u.originalIndex===want.attacker);
  assert.deepEqual([moved.x,moved.y],[want.x,want.y],'Source teleport destination '+ref.seed);
 }
}
console.log(`PASS ${dispatch.cases.length} complete original AI Teleport/Summon dispatches, including the source human-validation bypass.`);
