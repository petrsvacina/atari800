// Replay real keyboard inputs through app.js and the native campaign, including
// its first bank handover. Only browser/media APIs are doubles; no scene event
// is injected and no native game state is changed by the replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'karateka/index.html'),'utf8');
const files=[...html.matchAll(/src="([^"?]+\.js)(?:\?[^\"]*)?"/g)].map(m=>m[1]);
class AudioContextFake{
 constructor(){this.state='running';this.sampleRate=48000;this.currentTime=0;this.destination={};}
 createGain(){return {gain:{value:0,setValueAtTime(v){this.value=v;}},connect(){}};}
 createScriptProcessor(){return {connect(){}};}
 createBuffer(channels,length,rate){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}
 createBufferSource(){return {connect(){},disconnect(){},start(){},stop(){}};}
 async resume(){this.state='running';}async suspend(){this.state='suspended';}
}
const keyCodes={6:'ArrowLeft',7:'ArrowRight',33:'Space',46:'KeyW',62:'KeyS'};
for(const rate of [8,12]){
 const elements=new Map(),handlers={},clips=[];let raf,now=0,browser;
 const element=id=>{
  if(!elements.has(id))elements.set(id,{hidden:false,value:String(rate),textContent:'',focus(){},addEventListener(){},getContext(){return {putImageData(){}};}});
  return elements.get(id);
 };
 const video=element('movie');Object.assign(video,{currentTime:0,readyState:0,ended:false,paused:true,seeking:false,
  pause(){this.paused=true;},load(){this.currentTime=0;this.ended=false;this.readyState=0;},
  play(){this.readyState=4;this.paused=false;clips.push({id:browser.karatekaPreview.cinematic,started:now,firstClock:browser.karatekaPreview.game.clock,maximum:0});return Promise.resolve();}
 });
 browser=vm.createContext({atob:s=>Buffer.from(s,'base64').toString('binary'),console,URLSearchParams,location:{search:'',protocol:'file:'},navigator:{getGamepads:()=>[]},performance:{now:()=>now},requestAnimationFrame:f=>{raf=f;},ImageData:class{},AudioContext:AudioContextFake,
  document:{hidden:false,documentElement:{},querySelector:s=>element(s.startsWith('#')?s.slice(1):s),querySelectorAll:()=>[],addEventListener(){}}});
 browser.window=browser;browser.addEventListener=(name,f)=>{handlers[name]=f;};
 for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,'karateka',file),'utf8'),browser,{filename:file});
 const api=browser.karatekaPreview;element('start').onclick();
 let handover=false,frames=0;
 for(;frames<6000;frames++){
  const g=api.game,h=g.hero;g.context();const d=g.rules.distance,n=g.clock;
  if(api.campaign.number===1&&!api.cinematic){
   const key=!g.alive[1]?(g.deathDelay?undefined:(g.door&&h.x>=29?62:7)):g.mode==='approach'||g.mode==='entrance'?undefined:h.running?(d<18?33:7):d>9?7:n%100<60?46:62;
   if(key!==undefined){const code=keyCodes[key];assert.ok(code);handlers.keydown({code,target:{tagName:'CANVAS'},repeat:false,preventDefault(){}});handlers.keyup({code});}
  }
  const delta=1000/rate+.000001;now+=delta;
  if(!video.paused){
   const id=path.basename(video.src.split('?')[0],'.mp4'),data=browser.KARATEKA_MOVIES[id];video.currentTime=Math.min(data.soundEnd,video.currentTime+delta/1000);
   if(api.cinematic)clips.at(-1).maximum=Math.max(clips.at(-1).maximum,video.currentTime);
   if(video.currentTime>=data.soundEnd&&!video.ended){video.ended=true;video.onended();}
  }
  raf(now);await Promise.resolve();
  assert.equal(api.failed,false);assert.notEqual(api.game.phase,'lost',JSON.stringify({rate,frame:frames,scene:api.campaign.number,clock:api.game.clock}));
  if(api.campaign.number===2){
   if(api.cinematic==='palace-intro'){handover=true;assert.equal(api.game.clock,0,'The palace must wait while Mariko is on screen');}
   if(handover&&!api.cinematic&&api.game.clock>2)break;
  }
 }
 assert.ok(handover&&frames<6000,'Native keyboard replay must enter the palace and finish its cinematic');
 assert.equal(JSON.stringify(clips.map(c=>c.id)),JSON.stringify(['court','palace-intro']));
 const palace=clips.find(c=>c.id==='palace-intro');assert.equal(palace.firstClock,0);assert.ok(palace.maximum>=browser.KARATEKA_MOVIES['palace-intro'].pictureEnd);
 console.log('PASS real keyboard campaign entry at',rate,'steps/s:',frames,'browser frames;',JSON.stringify(clips));
}
