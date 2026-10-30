import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scope=vm.createContext({atob:s=>Buffer.from(s,'base64').toString('binary')});
const files=[...fs.readFileSync(path.join(root,'karateka/index.html'),'utf8').matchAll(/src="([^"]+\.js)"/g)].map(m=>m[1]).filter(f=>f!=='app.js');
for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,'karateka',file),'utf8'),scope,{filename:file});
const fixtures=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'research/karateka/presentation-oracle.json.gz'))));
for(const c of fixtures){
 const bitmap=new scope.KaratekaBitmap();let seed=c.seed;
 for(let i=0;i<6120;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;for(let j=0;j<4;j++)bitmap.pixels[i*4+j]=(seed>>>24)>>(6-j*2)&3;}
 const p=new scope.KaratekaPresentation();
 if(c.kind==='impact'){
  const game={enemy:scope.KaratekaMotion.fighter(c.fighters[0]),hero:scope.KaratekaMotion.fighter(c.fighters[1]),hawk:{x:c.hawk[0],y:c.hawk[1]},results:[...c.results],flash:c.flash,endingState:c.ending,camera:{shift:c.shift},hitSound:0};
  game.renderEffects=p.effects(game);p.drawEffects(bitmap,game);assert.equal(game.flash,c.flashAfter);assert.equal(game.hitSound,c.sound);
 }else if(c.kind==='hawk'){
  const z=c.state,h=new scope.KaratekaHazards.Hawk();Object.assign(h,{delay:z[144],x:z[145],y:z[147],dx:z[148],frame:z[149]});h.animate({hero:{x:z[98]},distant:z[85]});p.hawk(bitmap,{hawk:h,camera:{scene:c.scene,shift:c.shift}});assert.equal(h.frame,c.frame);
 }else new scope.KaratekaScenery2().crushed(bitmap,{hero:{legs:19,x:33},camera:{shift:c.shift},gate:{y:c.y}});
 assert.equal(crypto.createHash('sha256').update(bitmap.packed()).digest('hex'),c.sha256,JSON.stringify(c));
}
console.log('PASS 1300 original impact, hawk-layer and crushed-character pixel comparisons');
for(const c of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'research/karateka/special-mask-oracle.json.gz'))))){
 const b=new scope.KaratekaBitmap();let seed=c.seed;for(let i=0;i<6120;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;for(let j=0;j<4;j++)b.pixels[i*4+j]=(seed>>>24)>>(6-j*2)&3;}
 new scope.KaratekaSpecialCharacter().lowerMask(b,{legs:c.pose,x:c.x},c.shift);assert.equal(crypto.createHash('sha256').update(b.packed()).digest('hex'),c.sha256,JSON.stringify(c));
}
console.log('PASS 500 original final-opponent floor-mask comparisons');
for(const c of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'research/karateka/palette-oracle.json.gz'))))){
 const z=c.state,p=new scope.KaratekaPalette();p.flags=[z[45206],z[45207]];p.selector=z[3853];const g={camera:{room:z[68],shift:z[80],offset:z[82]},hero:{x:z[98]},enemy:{x:z[114]},buffer:z[7]};p.select(g,{shift:z[174],offset:z[225]},z[84]);assert.equal(JSON.stringify([p.selector,...p.flags]),JSON.stringify(c.expected),JSON.stringify(c));
}
console.log('PASS 1000 original cliff DLI palette selections');
const initializers=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'research/karateka/initializer-oracle.json.gz'))));
for(const c of initializers){
 const campaign=new scope.KaratekaCampaign(c.old[72]);campaign.game.hero=scope.KaratekaMotion.fighter(c.fighters[0]);campaign.game.enemy=scope.KaratekaMotion.fighter(c.fighters[1]);Object.assign(campaign.game.camera,{offset:c.old[82],velocity:c.old[83]});campaign.game.restore=[c.old[91],c.old[92]];campaign.game.enemyWait=c.old[137];campaign.next(c.scene);const g=campaign.game;
 const out={48:g.progress,62:g.guardStyle,68:g.camera.room,69:g.rules.sound,70:g.rules.kick,71:g.rules.punch,72:g.rules.random,75:g.enemySide,76:g.playerSide,77:g.kind,80:g.camera.shift,81:g.camera.cloud,82:g.camera.offset,83:g.camera.velocity,91:g.restore[0],92:g.restore[1],93:g.alive[0],94:g.alive[1],130:g.marker,136:g.deathDelay,137:g.enemyWait,144:g.hawk.delay,145:g.hawk.x,146:g.hawk.nextDelay,148:g.hawk.dx,152:g.hawk.active,176:g.max[0],177:g.max[1],182:g.health[0],183:g.health[1],184:g.restoreDelay[0],185:g.restoreDelay[1],197:g.doorThreshold};
 for(const [field,value]of Object.entries(c.expected[2]))if(!(c.scene===2&&field==='197'))assert.equal(out[field],value,JSON.stringify({scene:c.scene,field}));
 assert.equal(JSON.stringify(scope.KaratekaMotion.bytes(g.hero)),JSON.stringify(c.expected[0]));assert.equal(JSON.stringify(scope.KaratekaMotion.bytes(g.enemy)),JSON.stringify(c.expected[1]));
}
console.log('PASS 600 original bank initializers and retained actor/state fields');
const arrivals=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'research/karateka/arrival-oracle.json.gz'))));let arrivalFrames=0;
for(const c of arrivals){
 const g=new scope['KaratekaStage'+c.scene](),r=new scope.KaratekaRenderer(),z=c.state;g.hero=scope.KaratekaMotion.fighter(c.hero);g.enemy=scope.KaratekaMotion.fighter(c.enemy);Object.assign(g.camera,{shift:z[80],cloud:z[81],offset:z[82],room:z[68]});Object.assign(g,{climb:0,mode:'playing',buffer:z[7],guardStyle:z[62],playerSide:z[76],enemySide:z[75],birdEnabled:z[87],approachDelay:z[133],enemyWait:z[137],farDelay:z[139]});g.rules.random=z[72];g.context();
 if(c.kind==='entrance')g.beginEntrance();else g.beginApproach();
 let drawn=[];const draw=r.characters.draw.bind(r.characters);r.characters.draw=(...args)=>{drawn.push(Array.from(scope.KaratekaMotion.bytes(args[1])));return draw(...args);};
 for(const frame of c.frames){
  assert.notEqual(g.mode,'playing','An original shot must not finish early');g.renderState=null;g.entranceTick();g.endFrame();const view=g.renderState;assert.ok(view?.arrivalShot);
  assert.equal(JSON.stringify(scope.KaratekaMotion.bytes(view.hero)),JSON.stringify(frame.hero));assert.equal(JSON.stringify(scope.KaratekaMotion.bytes(view.enemy)),JSON.stringify(frame.enemy),JSON.stringify({scene:c.scene,kind:c.kind,frame:arrivalFrames}));assert.equal(JSON.stringify([view.camera.shift,view.camera.cloud,view.camera.offset]),JSON.stringify(frame.camera));assert.equal(view.playerSide,frame.side);
  drawn=[];r.frame(g);assert.equal(JSON.stringify(drawn),JSON.stringify(frame.actors),'The tracking shot must draw the original guard only, including its final frame');arrivalFrames++;
 }
 assert.equal(g.mode,'playing');assert.equal(JSON.stringify(scope.KaratekaMotion.bytes(g.hero)),JSON.stringify(c.after.hero));assert.equal(JSON.stringify(scope.KaratekaMotion.bytes(g.enemy)),JSON.stringify(c.after.enemy));assert.equal(JSON.stringify([g.camera.shift,g.camera.cloud,g.camera.offset]),JSON.stringify(c.after.camera));assert.equal(g.playerSide,c.after.side);assert.equal(g.approachDelay,c.after.delay);
 if(c.frames.length){assert.ok(g.renderState?.arrivalShot,'Returning to world coordinates must preserve the last presented shot');g.tick({});assert.equal(g.renderState,null,'The next game step must return to the fight');drawn=[];r.frame(g);assert.ok(drawn.some(f=>f[12]===1),'The player must reappear when the fight resumes');}
}
console.log(`PASS ${arrivals.length} original guard arrival sequences, ${arrivalFrames} presented frames and return to gameplay`);
// Audio routing must preserve the second joined pair, block ordinary effects
// during music, and survive pauses without changing offsets or replaying tails.
class AudioContextFake{
 constructor(){this.state='running';this.sampleRate=48000;this.currentTime=0;this.destination={};this.sources=[];}
 createGain(){return {gain:{value:0,setValueAtTime(v){this.value=v;}},connect(){}};}
 createScriptProcessor(){return {connect(){}};}
 createBuffer(channels,length,rate){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}
 createBufferSource(){const s={connect(){},disconnect(){},start(t=0,offset=0){this.offset=offset;},stop(){this.stopped=true;}};this.sources.push(s);return s;}
 async resume(){this.state='running';}async suspend(){this.state='suspended';}
}
const ctx=new AudioContextFake();let movie=false,stops=0;const audio=new scope.KaratekaAudio({contextFactory:()=>ctx,movieActive:()=>movie,stopMovie:()=>{movie=false;stops++;}});await audio.unlock();
for(const sample of [...scope.KARATEKA_AUDIO.effects,...scope.KARATEKA_MUSIC.music]){
 const bytes=Buffer.from(sample.data,'base64');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sample.sha256);assert.equal(bytes.length%2,0);assert.ok(audio.buffer(sample).duration>0);
 for(const stem of sample.stems||[])assert.equal(crypto.createHash('sha256').update(Buffer.from(stem.data,'base64')).digest('hex'),stem.sha256);
}
audio.effect(1);const full=audio.voices[0];assert.equal(audio.voices[1],full);ctx.currentTime=.02;audio.effect(13);assert.ok(full.source.stopped);assert.notEqual(audio.voices[0],audio.voices[1]);assert.equal(audio.voices[1].source.offset,.02);
audio.effect(8);assert.equal(audio.noisePairs.filter(Boolean).length,2);audio.effect(13);assert.equal(audio.noisePairs.filter(Boolean).length,1);audio.music(16);assert.equal(audio.noisePairs.filter(Boolean).length,0);const music=audio.musicSource;audio.effect(1);assert.ok(audio.voices.every(v=>!v));assert.equal(audio.musicSource,music);audio.stop();movie=true;audio.effect(1);assert.ok(audio.voices.every(v=>!v));audio.event({type:'gate',id:7});assert.equal(movie,false);assert.ok(audio.voices[0]);assert.equal(stops,2);await audio.pause(true);assert.equal(ctx.state,'suspended');await audio.pause(false);assert.equal(ctx.state,'running');audio.mute(true);assert.equal(audio.gain.gain.value,0);audio.stop();
const a=new scope.KaratekaNoise.Wave(),b=new scope.KaratekaNoise.Wave();a.set(2);b.set(2);const continuous=new Float32Array(8192),split=new Float32Array(8192);a.process(continuous);for(let n=0;n<8192;n+=256)b.process(split.subarray(n,n+256));assert.deepEqual(split,continuous);assert.ok(continuous.some(x=>x!==0));
console.log('PASS original PCM hashes, joined-pair preemption, music priority, pause and noise block continuity');
// A continuous native-input run covers the first bank handover. It is a smoke
// test, not an oracle for all campaign logic or a completed full-game replay.
const c=new scope.KaratekaCampaign(7),renderer=new scope.KaratekaRenderer();let handover=false,frames=0;
for(let n=0;n<1800&&!handover;n++){
 const g=c.game,h=g.hero;g.continueMovie();g.context();const d=g.rules.distance;
 const key=!g.alive[1]?(g.deathDelay?undefined:(g.door&&h.x>=29?62:7)):g.mode==='approach'||g.mode==='entrance'?undefined:h.running?(d<18?33:7):d>9?7:n%100<60?46:62;
 const events=c.tick(key===undefined?{}:{key});renderer.frame(g);frames++;
 for(const e of events){if(e.type==='movie')g.continueMovie();if(e.type==='scene'){assert.equal(e.id,2);c.next(e.id);handover=true;}}
 assert.notEqual(g.phase,'lost');
}
assert.ok(handover,'The native input replay must reach the palace');assert.equal(c.number,2);assert.equal(renderer.frame(c.game).length,320*240*4);
// Later banks: rendering their original test states catches unsupported final
// opponent poses and missing graphic layers without giving the player cheats.
for(const number of [2,3,4]){
 const Type=scope['KaratekaStage'+number],g=new Type(7);g.continueMovie();for(let n=0;n<120;n++){g.tick({key:n===0?33:n%11===0?46:7});renderer.frame(g);}
}
console.log(`PASS ${frames}-step native cliff-to-palace replay, later-bank rendering and complete runtime asset loading`);
// Regression: browsers may keep AudioContext.resume pending. Starting or
// resuming the game must still respond, and skipping each movie must advance.
const html=fs.readFileSync(path.join(root,'karateka/index.html'),'utf8'),elements=new Map(),translations=[...html.matchAll(/data-t="([^"]+)"/g)].map(m=>({dataset:{t:m[1]}}));
const tempoOptions=[...html.match(/<select id="tempo">(.*?)<\/select>/s)[1].matchAll(/<option value="(\d+)"( selected)?/g)];assert.deepEqual(tempoOptions.map(m=>Number(m[1])),[8,12]);const defaultTempo=tempoOptions.find(m=>m[2])[1];assert.equal(defaultTempo,'12');
const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,value:id==='tempo'?defaultTempo:'',textContent:'',currentTime:0,ended:false,focus(){},pause(){},play(){return Promise.resolve();},addEventListener(){},getContext(){return {putImageData(){}};}});return elements.get(id);};
const events={};let raf;
class PendingAudio extends AudioContextFake{constructor(){super();this.state='suspended';}resume(){return new Promise(()=>{});}}
const browser=vm.createContext({atob:s=>Buffer.from(s,'base64').toString('binary'),console,URLSearchParams,location:{search:'?lang=en',protocol:'file:'},navigator:{getGamepads:()=>[]},performance:{now:()=>0},requestAnimationFrame:f=>{raf=f;},ImageData:class{},AudioContext:PendingAudio,document:{hidden:false,documentElement:{},querySelector:s=>s.startsWith('#')?element(s.slice(1)):translations.find(e=>e.dataset.t==='title'),querySelectorAll:s=>s==='[data-t]'?translations:[],addEventListener(){}}});browser.window=browser;browser.addEventListener=(name,f)=>{events[name]=f;};
for(const file of [...files,'app.js'])vm.runInContext(fs.readFileSync(path.join(root,'karateka',file),'utf8'),browser,{filename:file});
element('start').onclick();raf(100);assert.ok(browser.karatekaPreview.game.clock>0,'Audio permission must not block gameplay');element('pause').onclick();assert.ok(browser.karatekaPreview.paused);element('pause').onclick();assert.equal(browser.karatekaPreview.paused,false);
element('intro').onclick();assert.equal(browser.karatekaPreview.cinematic,'title');element('skip').onclick();assert.equal(browser.karatekaPreview.cinematic,'prologue');element('skip').onclick();assert.equal(browser.karatekaPreview.cinematic,null);assert.equal(browser.karatekaPreview.failed,false);
console.log('PASS browser-shell startup with pending audio permission, pause and cinematic skipping');

element('reset').onclick();element('tempo').value='8';element('tempo').onchange();raf(200);assert.equal(browser.karatekaPreview.game.clock,0,'8 steps/s must wait for a complete 125 ms step');raf(225);assert.equal(browser.karatekaPreview.game.clock,1);
console.log('PASS only 8/12 steps per second, default 12 and slower browser cadence');
// Regression: rapid keyboard/touch presses share one pending command, not a
// FIFO accumulated during the source's hit pauses. Test the actual app shell.
const press=(code,release=true)=>{events.keydown({code,target:{tagName:'CANVAS'},repeat:false,preventDefault(){}});if(release)events.keyup({code});};
let inputTime=225;const advanceInput=()=>raf(inputTime+=125);const campaignForInput=browser.karatekaPreview.campaign;let collected=[];
for(const rate of [8,12]){
 element('reset').onclick();element('tempo').value=String(rate);element('tempo').onchange();collected=[];campaignForInput.tick=input=>{collected.push(input);return [];};
 for(let n=0;n<60;n++)press(n%2?'KeyA':'KeyW');press('KeyX');for(let n=0;n<12;n++)advanceInput();assert.deepEqual(collected.filter(i=>i.key!==undefined).map(i=>i.key),[22],`${rate} steps/s: only the latest rapid press may remain pending`);
 // Keep one latest press during a genuine wait without replaying its history.
 let first=true;collected=[];campaignForInput.tick=input=>{collected.push(input);if(first){first=false;return [{type:'wait',id:30}];}return [];};advanceInput();for(let n=0;n<60;n++)press(n%2?'KeyQ':'KeyS');press('KeyZ');for(let n=0;n<12;n++)advanceInput();assert.deepEqual(collected.filter(i=>i.key!==undefined).map(i=>i.key),[23]);
}
// Defeat clears both the held attack and the original command latches. It
// leaves the current pose untouched and allows fresh kicks (e.g. doors).
element('reset').onclick();element('tempo').value='8';element('tempo').onchange();let defeated=false;collected=[];const defeatedGame=browser.karatekaPreview.game;Object.assign(defeatedGame.hero,{legs:2,torso:2,legFrame:2,armFrame:2,legStep:1,armStep:1,running:0});const pose=()=>JSON.stringify([defeatedGame.hero.legs,defeatedGame.hero.torso,defeatedGame.hero.legFrame,defeatedGame.hero.armFrame,defeatedGame.hero.legStep,defeatedGame.hero.armStep]),originalPose=pose();
campaignForInput.tick=input=>{collected.push(input);if(!defeated){defeated=true;defeatedGame.alive[1]=0;defeatedGame.rules.kick=defeatedGame.rules.punch=255;defeatedGame.input.key(63);return [{type:'wait',id:30}];}return [];};
for(let n=0;n<60;n++)press(n%2?'KeyA':'KeyW');press('KeyS',false);advanceInput();assert.equal(defeatedGame.rules.kick,0);assert.equal(defeatedGame.rules.punch,0);assert.equal(defeatedGame.input.pending,0);assert.equal(pose(),originalPose);
events.keydown({code:'KeyS',target:{tagName:'CANVAS'},repeat:true,preventDefault(){}});for(let n=0;n<12;n++)advanceInput();assert.deepEqual(collected.filter(i=>i.key!==undefined).map(i=>i.key),[62],'Old presses and held repeats must not outlive the fight');events.keyup({code:'KeyS'});press('KeyX');advanceInput();assert.equal(collected.at(-1).key,22,'A fresh post-fight kick must still work');
// A held gamepad button must be released before it can attack again. Releasing
// an old hold must not synthesize a punch after the opponent has fallen.
element('reset').onclick();const pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};pad.buttons[0].pressed=true;browser.navigator.getGamepads=()=>[pad];let padDefeated=false;const padGame=browser.karatekaPreview.game;campaignForInput.tick=()=>{if(!padDefeated){padDefeated=true;padGame.alive[1]=0;}return [];};advanceInput();for(let n=0;n<8;n++)advanceInput();assert.equal(padGame.rules.kick,0);assert.equal(padGame.rules.punch,0);pad.buttons[0].pressed=false;advanceInput();assert.equal(padGame.rules.punch,0);pad.buttons[0].pressed=true;advanceInput();pad.buttons[0].pressed=false;advanceInput();assert.equal(padGame.rules.punch,255);browser.navigator.getGamepads=()=>[];
console.log('PASS rapid presses at 8/12 steps/s, hit pauses, post-fight flush, fresh kicks and held gamepad release');
