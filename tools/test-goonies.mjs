import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scope=vm.createContext({atob:s=>Buffer.from(s,'base64').toString('binary')});
for(const file of ['assets/levels.js','assets/graphics.js','assets/sprites.js','assets/physics.js','assets/mechanisms.js','movement.js','rooms.js','engine.js','raster.js'])vm.runInContext(fs.readFileSync(path.join(root,'goonies-web',file),'utf8'),scope,{filename:file});
const {Game}=scope.GooniesEngine, original=scope.GOONIES_ORIGINAL;
const fixture=name=>JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures',name),'utf8'));
let passed=0;
function test(name,run){run();console.log('PASS '+name);passed++;}
function updates(game,count,input=[]){for(let i=0;i<count*4;i++)game.step(input);}
function packedBitmap(game){const pixels=scope.GooniesRaster.compose(game),packed=Buffer.alloc(7040);for(let y=0;y<176;y++)for(let x=0;x<320;x+=2)packed[y*40+(x>>3)]|=pixels[y*320+x]<<(6-(x&7));return packed;}
function hashBitmap(game){return createHash('sha256').update(packedBitmap(game)).digest('hex');}
function initialRandomActors(game,actors){if(game.scene===5)game.rooms.actors=actors.slice(2).filter(a=>a.type).map(a=>({...a}));}
function arrange(game,actors){for(const[index,props]of Object.entries(actors||{})){const i=Number(index);let actor;if(i<2)actor=game.players[i].native;else if(game.scene===3)actor=game.rooms.stone;else if(game.scene===6)actor=game.rooms.cage;else if(game.scene===7)actor=game.rooms.mother;else if(game.scene===4){actor={...props};game.rooms.eggs.push(actor);}else throw new Error('Unknown arranged actor '+i);Object.assign(actor,props);}}
function compareFrame(game,frame,label){
  assert.equal(hashBitmap(game),frame.bitmapSha256,label+' bitmap');
  for(let i=0;i<2;i++)for(const key of ['x','y','vx','vy','frame'])assert.equal(game.players[i].native[key]&255,frame.actors[i][key],`${label} player ${i} ${key}`);
  assert.equal(game.rectangles.length,frame.rectangles.length,label+' rectangle count');
  for(let i=0;i<game.rectangles.length;i++)assert.deepEqual(Object.values(game.rectangles[i]),frame.rectangles[i],`${label} rectangle ${i}`);
}
test('all eight rooms use the original collision rectangles and original spawn bodies',()=>{
  assert.deepEqual(Array.from(original.scenes,s=>s.sourceRoomId),[0,2,1,3,4,5,6,7]);
  assert.deepEqual(Array.from(original.scenes,s=>s.rectangles.length),[24,30,33,22,32,38,37,53]);
  for(let i=0;i<8;i++){const game=new Game({scene:i});assert.equal(game.players.length,2);for(let p=0;p<2;p++)assert.equal(game.players[p].native.x,original.scenes[i].players[p].x);}
});
test('1,280 movement and animation steps match the original XEX routines exactly',()=>{
  const oracle=fixture('goonies-movement-oracle.json');let count=0;
  for(const run of oracle.runs){const scene=original.scenes.find(s=>s.sourceRoomId===run.room),actor={...scene.players[0]},contacts=Array(8).fill(0);
    for(const record of run.records){scope.GooniesMovement.step(actor,record.input,scene.rectangles,original.bodyWidths,original.bodyHeights,contacts);for(const[key,value]of Object.entries(record.actor))assert.equal(actor[key],value,`room ${run.room}, step ${count}, ${key}`);count++;}}
  assert.equal(count,1280);
});
const previews=fixture('goonies-room-preview-oracle.json');
for(const[scene,run]of previews.runs.entries())test(`room ${scene+1}: eight complete bitmaps match the original ATR pixel for pixel`,()=>{
  const game=new Game({scene,practice:true,randomByte:()=>previews.randomByte});game.randomByte=()=>previews.randomByte;initialRandomActors(game,run.initialActors);
  for(const[index,frame]of run.frames.entries()){updates(game,1);compareFrame(game,frame,`room ${scene+1}, frame ${index+1}`);}
});
const mechanisms=fixture('goonies-native-mechanism-oracle.json');
function scenarioCheck(scenario, randomByte, sounds = false) {
  const game=new Game({scene:scenario.scene,practice:true,randomByte:()=>randomByte});game.randomByte=()=>randomByte;
  if(!scenario.scene)game.state.fireFrame=scenario.initialFirePhase;
  initialRandomActors(game,scenario.initialActors);arrange(game,scenario.actors);game.selected=scenario.selected||0;
  if(scenario.roomState)Object.assign(game.rooms,scenario.roomState);
  game.drainEvents();
  for(const[index,frame]of scenario.frames.entries()){const input=[{},{}];input[game.selected]=scenario.input||{};updates(game,1,input);compareFrame(game,frame,`${scenario.name}, frame ${index+1}`);
    if(sounds)assert.deepEqual(Array.from(game.drainEvents()).filter(e=>e.type==='sound').map(e=>e.id),frame.sounds,`${scenario.name}, frame ${index+1} original sound requests`);
  }
  if(scenario.hurtAt){updates(game,1);assert.equal(game.phase,'hurt',scenario.name+' original collision time');}
}
for(const scenario of mechanisms.cases)test(scenario.name+' matches the original room routine',()=>scenarioCheck(scenario,mechanisms.randomByte));
const actorsOracle=fixture('goonies-native-actors-oracle.json');
for(const scenario of actorsOracle.cases)test(scenario.name+' matches the original longer simulation',()=>scenarioCheck(scenario,actorsOracle.randomByte));
const soundOracle=fixture('goonies-sound-oracle.json');
for(const scenario of soundOracle.cases)test(scenario.name+' matches original picture and sound requests',()=>scenarioCheck(scenario,soundOracle.randomByte,true));
for(const name of ['house','valves'])test(`complete ${name} puzzle finishes with directional and switch inputs and five lives`,()=>{
  const replay=fixture(`goonies-${name}-native-replay.json`),game=new Game(replay.options);
  for(const step of replay.steps){if(game.selected!==step.actor)game.switchActor();const input=[{},{}];input[step.actor]=step.input;updates(game,step.updates,input);assert.notEqual(game.phase,'hurt');}
  assert.equal(game.phase,replay.expected.phase);assert.equal(game.lives,replay.expected.lives);assert(game.players.every(p=>p.escaped));
});
test('pausing freezes the world, room state and random generator',()=>{
  const game=new Game({scene:5});game.paused=true;const before=hashBitmap(game),clock=game.tick,random=game.randomState;updates(game,100,[{right:true,up:true}]);assert.equal(hashBitmap(game),before);assert.equal(game.tick,clock);assert.equal(game.randomState,random);
});
test('shared lives, practice completion and campaign transitions remain bounded',()=>{
  const game=new Game({scene:2});game.hurt('hit');game.hurt('hit again');assert.equal(game.lives,4);updates(game,23);assert.equal(game.phase,'playing');
  game.lives=1;game.hurt('last');updates(game,23);assert.equal(game.phase,'over');
  for(const practice of [false,true]){const next=new Game({scene:6,practice});next.finishScene();updates(next,27);assert.equal(next.phase,practice?'complete':'playing');assert.equal(next.scene,practice?6:7);}
});
console.log(`${passed} native Goonies regression checks passed.`);
