// Exercise the real browser shell with asynchronous media loading. The native
// campaign is a test double here: these checks cover playback, not ATR rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'karateka/app.js'),'utf8');
const metadata=fs.readFileSync(path.join(root,'karateka/assets/movies.js'),'utf8');
const manifest=vm.createContext({});vm.runInContext(metadata,manifest);
const provenance=JSON.parse(fs.readFileSync(path.join(root,'karateka/assets/movies/provenance.json'),'utf8'));
assert.equal(provenance.movies.length,6);
for(const entry of provenance.movies){
 const clip=manifest.KARATEKA_MOVIES[entry.name],file=path.join(root,'karateka',clip.file),bytes=fs.readFileSync(file);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.name+' capture hash');
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,duration:format=duration','-of','json',file]));
 const picture=Number(probe.streams.find(s=>s.codec_type==='video').duration);
 assert.ok(Math.abs(clip.pictureEnd-picture)<.001,entry.name+' picture must end on the MP4 clock');
 assert.ok(Math.abs(clip.soundEnd-Number(probe.format.duration))<.001,entry.name+' sound tail must end on the MP4 clock');
 assert.equal(entry.visualDuration,clip.pictureEnd);
}
console.log('PASS six captured MP4 hashes and actual video/audio durations');

function shell(){
 const elements=new Map(),events={},loads=[];let raf,audio,now=0;
 const element=id=>{
  if(!elements.has(id))elements.set(id,{hidden:false,value:'12',textContent:'',focus(){},addEventListener(){},getContext(){return {putImageData(){}};}});
  return elements.get(id);
 };
 const video=element('movie');let hidden=true;
 Object.assign(video,{currentTime:0,readyState:0,seeking:false,ended:false,paused:true,hiddenChanges:[],
  pause(){this.paused=true;},
  load(){this.readyState=0;this.ended=false;},
  play(){
   this.paused=false;
   // Deliberately retain the last clip's clock until data arrives, as well as
   // old queued ended/error callbacks. An immediate mock cannot catch this.
   return new Promise((resolve,reject)=>loads.push({file:this.src,resolve:()=>{
    this.currentTime=0;this.readyState=4;this.seeking=false;this.ended=false;resolve();
   },reject}));
  }
 });
 Object.defineProperty(video,'hidden',{get:()=>hidden,set:v=>{hidden=v;video.hiddenChanges.push(v);}});
 class Campaign{
  constructor(){this.reset();}
  reset(){this.number=1;this.pending=[];this.events=[];this.game={phase:'playing',clock:0,alive:[1,1],rules:{},input:{},continues:0,continueMovie(){this.continues++;}};}
  next(number){this.number=number;this.events=[{type:'movie',id:number===2?'palace-intro':'hawk-intro'}];}
  tick(){this.game.clock++;return this.pending.splice(0);}
 }
 class Audio{
  constructor(options){audio=this;this.options=options;this.muted=false;this.effects=0;}
  async unlock(){}async pause(){}stop(){}mute(value){this.muted=value;}
  event(e){if(e.type==='effect'&&!this.options.movieActive())this.effects++;}
 }
 const browser=vm.createContext({console,URLSearchParams,location:{search:''},performance:{now:()=>now},navigator:{getGamepads:()=>[]},requestAnimationFrame:f=>{raf=f;},ImageData:class{},KaratekaCampaign:Campaign,KaratekaRenderer:class{frame(){return new Uint8ClampedArray(320*240*4);}},KaratekaAudio:Audio,
  document:{hidden:false,documentElement:{},querySelector:s=>element(s),querySelectorAll:()=>[],addEventListener(){}}});
 // The real shell queries #ids; the test helpers use their unprefixed names.
 browser.document.querySelector=s=>element(s.startsWith('#')?s.slice(1):s);
 browser.window=browser;browser.addEventListener=(name,fn)=>{events[name]=fn;};
 vm.runInContext(metadata,browser);vm.runInContext(source,browser,{filename:'app.js'});
 return {video,loads,element,events,audio,api:browser.karatekaPreview,data:browser.KARATEKA_MOVIES,
  frame(){raf(now+=125);},async ready(){loads.at(-1).resolve();await Promise.resolve();},
  movie(id){this.api.campaign.pending.push({type:'movie',id});this.frame();},
  end(){video.currentTime=this.data[this.api.cinematic].soundEnd;video.ended=true;video.onended();}
 };
}

// Leave the title at its real end time while the prologue has no new frames.
// Neither the render loop nor a queued ended event may skip the new clip.
for(const naturalEnd of [false,true]){
 const s=shell();s.element('intro').onclick();await s.ready();
 s.video.hiddenChanges=[];
 if(naturalEnd)s.end();else{s.video.currentTime=s.data.title.pictureEnd;s.frame();}
 assert.equal(s.api.cinematic,'prologue');
 assert.ok(s.video.hiddenChanges.every(v=>!v),'Chained clips must keep the video layer over the game');
 for(let n=0;n<5;n++)s.frame();
 assert.equal(s.api.cinematic,'prologue','Previous clip time must not finish the loading prologue');
 s.video.onended();assert.equal(s.api.cinematic,'prologue','A queued ended callback must not skip the new clip');
 await s.ready();s.video.currentTime=s.data.prologue.pictureEnd-.05;s.frame();assert.equal(s.api.cinematic,'prologue');
 s.video.currentTime=s.data.prologue.pictureEnd;s.frame();assert.equal(s.api.cinematic,null);
 assert.equal(s.api.game.continues,1,'Only the prologue returns to gameplay');
 assert.equal(s.audio.options.movieActive(),true,'The title ended callback must preserve the prologue audio tail');
 s.api.campaign.pending.push({type:'effect',id:1});s.frame();assert.equal(s.audio.effects,0,'Original movie music must retain priority after the picture ends');
 s.video.currentTime=s.data.prologue.soundEnd;s.video.ended=true;s.video.onended();assert.equal(s.audio.options.movieActive(),false);
 s.api.campaign.pending.push({type:'effect',id:1});s.frame();assert.equal(s.audio.effects,1);
}
console.log('PASS title/prologue loading gap, stale clock and natural-ended event ordering');

// The last court movie is longer than the palace intro: reuse of its clock
// previously let the palace/Mariko clip return to combat before it loaded.
for(const tempo of ['8','12']){
 const s=shell();s.element('start').onclick();s.element('tempo').value=tempo;
 s.movie('court');await s.ready();s.video.currentTime=s.data.court.pictureEnd;s.frame();
 s.api.campaign.pending.push({type:'scene',id:2});s.frame();
 assert.equal(s.api.cinematic,'palace-intro');const before=s.api.game.clock,continues=s.api.game.continues;
 for(let n=0;n<8;n++)s.frame();
 assert.equal(s.api.cinematic,'palace-intro');assert.equal(s.api.game.clock,before);assert.equal(s.api.game.continues,continues);
 await s.ready();s.video.currentTime=s.data['palace-intro'].pictureEnd-.01;s.frame();assert.equal(s.api.cinematic,'palace-intro');
 s.video.currentTime=s.data['palace-intro'].pictureEnd;s.frame();assert.equal(s.api.cinematic,null);assert.equal(s.api.game.continues,continues+1);
 // The next Mariko/court scene must also wait for its own data and full length.
 s.video.currentTime=s.data['palace-intro'].soundEnd-.01;s.movie('court-palace');
 for(let n=0;n<3;n++)s.frame();assert.equal(s.api.cinematic,'court-palace');await s.ready();
 s.video.currentTime=s.data['court-palace'].pictureEnd-.01;s.frame();assert.equal(s.api.cinematic,'court-palace');
 s.video.currentTime=s.data['court-palace'].pictureEnd;s.frame();assert.equal(s.api.cinematic,null);
}
console.log('PASS palace/Mariko scenes wait for their own media clock and full original picture duration at 8/12 steps/s');

// An aborted old play request must not replace the current scene's status.
{
 const s=shell();s.element('intro').onclick();const old=s.loads[0];s.element('skip').onclick();await s.ready();
 const status=s.element('status').textContent;old.reject(new Error('Playback aborted by source change'));await Promise.resolve();await Promise.resolve();
 assert.equal(s.element('status').textContent,status);assert.equal(s.api.cinematic,'prologue');
 s.element('pause').onclick();assert.equal(s.video.paused,true);s.element('pause').onclick();await s.ready();assert.equal(s.api.paused,false);
 s.element('skip').onclick();assert.equal(s.api.cinematic,null);s.element('reset').onclick();assert.equal(s.api.failed,false);
}
console.log('PASS stale play rejection, pause/resume, skip and restart during media loading');

// Pausing before the first frame aborts the first play promise in browsers.
// Resuming must arm completion for the same clip; skipping while paused must
// not start the following introduction behind the pause overlay.
{
 const s=shell();s.element('intro').onclick();s.element('pause').onclick();
 s.loads[0].reject(Object.assign(new Error('Paused while loading'),{name:'AbortError'}));await Promise.resolve();await Promise.resolve();
 s.element('skip').onclick();assert.equal(s.api.cinematic,'prologue');assert.equal(s.loads.length,1);assert.equal(s.video.paused,true);
 s.element('pause').onclick();await s.ready();s.video.currentTime=s.data.prologue.pictureEnd;s.frame();assert.equal(s.api.cinematic,null);
 const p=shell();p.element('intro').onclick();p.element('pause').onclick();
 p.loads[0].reject(Object.assign(new Error('Paused while loading'),{name:'AbortError'}));await Promise.resolve();await Promise.resolve();
 p.element('pause').onclick();await p.ready();p.video.currentTime=p.data.title.pictureEnd;p.frame();assert.equal(p.api.cinematic,'prologue');
}
console.log('PASS paused loading, aborted play request, resumed completion and paused intro skipping');
