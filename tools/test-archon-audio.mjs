import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({Promise});
for(const file of ['assets/audio.js','audio.js'])vm.runInContext(fs.readFileSync(path.join(root,'archon',file),'utf8'),scope,{filename:file});
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
function fixture({deferred=false,pcm=false}={}){
  const tracks=new Map(),buffers=[],sources=[];
  const context=pcm?{state:'running',currentTime:4,destination:{},createGain:()=>({gain:{value:1},connect(){}}),
    createBuffer(channels,length,rate){assert.equal(channels,1);const data=new Float32Array(length);const b={duration:length/rate,getChannelData:()=>data};buffers.push(b);return b;},
    createBufferSource(){const s={connect(){},disconnect(){},start(t=4,offset=0){this.startTime=t;this.offset=offset;},stop(t=4){this.stopTime=t;},onended:null};sources.push(s);return s;}
  }:null;
  const statuses=[];
  const audio=new scope.ArchonAudio({createContext:()=>context,decode:s=>Buffer.from(s,'base64').toString('latin1'),onStatus:s=>statuses.push(s),createAudio:src=>{
    const a={paused:true,muted:false,currentTime:0,plays:0,handlers:{},addEventListener(k,cb){this.handlers[k]=cb;},pause(){this.paused=true;},play(){this.plays++;if(deferred)return new Promise((resolve,reject)=>{this.resolve=()=>{this.paused=false;resolve();};this.reject=reject;});this.paused=false;return Promise.resolve();}};tracks.set(src,a);return a;
  }});
  return{audio,tracks,buffers,sources,statuses,context};
}
await test('loading cannot autoplay; explicit preview plays the original local title track',async()=>{
  const f=fixture();f.audio.sync(false,false);assert.equal(f.tracks.size,0);f.audio.togglePreview();f.audio.sync(false,false);await settle();assert(!f.tracks.get(scope.ARCHON_AUDIO.title).paused);
});
await test('starting play stops the title, and its natural end updates preview state',async()=>{
  const f=fixture();f.audio.togglePreview();f.audio.sync(false,false);await settle();const title=f.tracks.get(scope.ARCHON_AUDIO.title);f.audio.sync(true,false);assert(title.paused);title.handlers.ended();assert(!f.audio.preview);
});
await test('a late playback promise cannot restart title music after leaving the menu',async()=>{
  const f=fixture({deferred:true});f.audio.togglePreview();f.audio.sync(false,false);const a=f.tracks.get(scope.ARCHON_AUDIO.title);f.audio.sync(true,false);a.resolve();await settle();assert(a.paused);
});
await test('denied autoplay can recover after the next user gesture',async()=>{
  const f=fixture({deferred:true});f.audio.togglePreview();f.audio.sync(false,false);const a=f.tracks.get(scope.ARCHON_AUDIO.title);a.reject(Error('NotAllowedError'));await settle();assert(f.statuses.some(s=>s.includes('klikni')));f.audio.unlock();f.audio.sync(false,false);a.resolve();await settle();assert(!a.paused);
});
await test('original movement, area and projectile PCM streams decode without silence or unsupported sample rates',async()=>{
  const f=fixture({pcm:true});f.audio.unlock();assert.equal(f.buffers.length,17);
  for(const e of scope.ARCHON_AUDIO.effects){const raw=Buffer.from(e.data,'base64'),b=f.buffers[e.id],data=b.getChannelData(0);assert(Math.abs(b.duration-e.duration)<1/22050);assert(data.some(v=>Math.abs(v)>.001));for(const i of [0,Math.floor(data.length/2),data.length-1])assert(Math.abs(data[i]-raw.readInt16LE(i*2)/32768)<1e-6);}
});
await test('unit movement and battle sides select the original mapped effects',async()=>{
  const f=fixture({pcm:true});f.audio.unlock();for(let id=0;id<20;id++){f.audio.event({type:'select',unit:id});assert.equal(f.sources.at(-1).buffer,f.buffers[scope.ARCHON_AUDIO.unitMovementEffects[id]]);}
  f.audio.event({type:'charged',side:'dark'});assert.equal(f.sources.at(-1).buffer,f.buffers[7]);f.audio.event({type:'impact',side:'light'});assert.equal(f.sources.at(-1).buffer,f.buffers[8]);
});
await test('pause, mute and menu stop active effects; no effects run before unlock',async()=>{
  const f=fixture({pcm:true});f.audio.event({type:'charged',side:'light'});assert.equal(f.sources.length,0);f.audio.unlock();f.audio.sync(true,false);f.audio.play(6);f.audio.sync(true,true);assert.equal(f.audio.voices.size,0);assert(f.sources.at(-1).stopTime!==undefined);
  f.audio.sync(true,false,true);const count=f.sources.length;f.audio.play(6);assert.equal(f.sources.length,count);f.audio.sync(true,false,false);f.audio.play(6);f.audio.sync(false,false);assert.equal(f.audio.voices.size,0);
});
await test('effects have bounded polyphony and the original result motif stops on returning to menu',async()=>{
  const f=fixture({pcm:true});f.audio.unlock();f.audio.sync(true,false);for(let i=0;i<10;i++)f.audio.play(6);assert(f.audio.voices.size<=4);f.audio.event({type:'end'});await settle();const result=f.tracks.get(scope.ARCHON_AUDIO.result);assert(!result.paused);f.audio.sync(false,false);assert(result.paused);
});
await test('original movement loops resume and projectile sweeps stop with their weapon',async()=>{
  const f=fixture({pcm:true});f.audio.unlock();f.audio.sync(true,false);
  f.audio.event({type:'motion',side:'light',unit:7,active:true});const first=f.sources.at(-1);assert(first.loop);
  f.audio.event({type:'motion',side:'light',unit:7,active:true});assert.equal(f.sources.at(-1),first);
  f.context.currentTime+=.04;f.audio.event({type:'motion',side:'light',unit:7,active:false});assert.equal(f.audio.loops.size,0);
  f.audio.event({type:'motion',side:'light',unit:7,active:true});assert(Math.abs(f.sources.at(-1).offset-.04)<1e-9);
  f.audio.event({type:'weapon',side:'dark',special:'projectile',parameter:7,active:true,restart:true});assert.equal(f.sources.at(-1).buffer,f.buffers[scope.ARCHON_AUDIO.combatEffects.flight['7']]);assert(f.sources.at(-1).loop);
  f.audio.event({type:'weapon',side:'dark',active:false});assert(!f.audio.loops.has('weapon:dark'));
  f.audio.event({type:'weapon',side:'dark',special:'phoenix',active:true,restart:true});assert.equal(f.sources.at(-1).buffer,f.buffers[10]);assert.equal(f.sources.at(-1).loop,false);
  f.audio.event({type:'result'});assert.equal(f.audio.voices.size,0);assert.equal(f.audio.loops.size,0);
});
await test('audio is rendered at the selected original NTSC clock',async()=>{
  assert(Math.abs(scope.ARCHON_AUDIO.renderFrameHz-1789790/(114*262))<1e-9);
});
console.log(`${passed} Archon audio checks passed.`);
