import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scope=vm.createContext({Promise});
for(const file of ['assets/sfx.js','assets/animations.js','engine.js','audio.js'])vm.runInContext(fs.readFileSync(path.join(root,'karate',file),'utf8'),scope,{filename:file});
let passed=0;
async function test(name,body){await body();passed++;console.log('PASS '+name);}
function fixture({deferred=false,context=null}={}){
  const track={paused:true,muted:false,currentTime:0,plays:0,pauses:0,resolve:null,reject:null,
    addEventListener(){},play(){this.plays++;if(deferred)return new Promise((resolve,reject)=>{this.resolve=()=>{this.paused=false;resolve();};this.reject=reject;});this.paused=false;return Promise.resolve();},pause(){this.pauses++;this.paused=true;}};
  const statuses=[];const audio=new scope.KarateAudio({createAudio:()=>track,createContext:()=>context,decode:s=>Buffer.from(s,'base64').toString('latin1'),onStatus:s=>statuses.push(s)});
  return{audio,track,statuses};
}
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
await test('no music starts before a user gesture',async()=>{const{audio,track}=fixture();audio.sync(true,false);assert.equal(track.plays,0);audio.unlock();audio.sync(true,false);await settle();assert.equal(track.plays,1);});
await test('pausing resumes the same position without restarting the score',async()=>{const{audio,track}=fixture();audio.unlock();audio.sync(true,false);await settle();track.currentTime=87;audio.sync(true,true);assert(track.paused);audio.sync(true,false);await settle();assert.equal(track.currentTime,87);assert(!track.paused);});
await test('preview and game transitions preserve playback, effects-only stops it',async()=>{const{audio,track}=fixture();audio.togglePreview();audio.sync(false,false);await settle();assert(!track.paused);track.currentTime=23;audio.sync(true,false);assert.equal(track.currentTime,23);audio.sync(true,false,'effects');assert(track.paused);audio.sync(true,false,'music');await settle();assert(!track.paused);});
await test('mute is reflected in the player and an unavailable Web Audio context is harmless',async()=>{const{audio,track}=fixture();audio.unlock();audio.sync(true,false,'both',true);await settle();assert(track.muted);audio.effect('hit');audio.sync(true,false,'both',false);assert(!track.muted);});
await test('late play completion cannot restart music after pause',async()=>{const{audio,track}=fixture({deferred:true});audio.unlock();audio.sync(true,false);const complete=track.resolve;audio.sync(true,true);complete();await settle();assert(track.paused);});
await test('a denied play request is recoverable on the next user gesture',async()=>{const{audio,track,statuses}=fixture({deferred:true});audio.unlock();audio.sync(true,false);track.reject(new Error('NotAllowedError'));await settle();assert(statuses.some(s=>s.includes('klikni')));audio.unlock();audio.sync(true,false);track.resolve();await settle();assert(!track.paused);assert.equal(statuses.at(-1),'');});
function sampleFixture(){
  const buffers=[],sources=[];
  const context={currentTime:7,state:'running',destination:{},
    createGain:()=>({gain:{value:1},connect(){}}),createBiquadFilter:()=>({frequency:{value:0},connect(){}}),
    createBuffer(channels,length,rate){assert.equal(channels,1);assert(rate>=8000);const data=new Float32Array(length);const buffer={sampleRate:rate,duration:length/rate,getChannelData:()=>data};buffers.push(buffer);return buffer;},
    createBufferSource(){const source={buffer:null,playbackRate:{value:1},connect(){},start(t){this.startsAt=t;},stop(t){this.stopsAt=t??context.currentTime;},onended:null};sources.push(source);return source;}
  };
  const f=fixture({context});f.audio.unlock();return{...f,context,buffers,sources};
}
await test('all six original four-bit samples decode at their original durations without unsupported low buffer rates',async()=>{
  const{audio,buffers}=sampleFixture();assert.equal(buffers.length,6);
  scope.KARATE_SFX.samples.forEach((sample,id)=>{
    const raw=Buffer.from(sample.data,'base64'),buffer=buffers[id],data=buffer.getChannelData(0);
    assert(Math.abs(buffer.duration-sample.duration)<1/44100);
    assert(raw.every(v=>v%17===0));
    for(const i of [0,Math.floor(data.length/2),data.length-1])assert(Math.abs(data[i]-(raw[Math.min(raw.length-1,Math.floor(i*scope.KARATE_SFX.sourceSampleRate/44100))]/127.5-1))<1e-6);
    assert.equal(audio.buffers.get(id),buffer);
  });
});
await test('windup/impact selection follows original frames and never double plays a miss plus a hit',async()=>{
  const{audio,buffers,sources}=sampleFixture();
  audio.effects([{type:'pose',tick:1,player:0,frame:6,flags:64}]);assert.equal(sources.at(-1).buffer,buffers[1]);
  const previous=sources.length;
  audio.effects([{type:'pose',tick:2,player:0,frame:20,flags:9},{type:'hit',tick:2,player:0,frame:20}]);
  assert.equal(sources.length,previous+1);assert.equal(sources.at(-1).buffer,buffers[0]);
  audio.effects([{type:'pose',tick:3,player:0,frame:20,flags:0}]);assert.equal(sources.length,previous+1);
});
await test('fall samples trigger on new poses only, including low knockdown and alternate fall',async()=>{
  const{audio,buffers,sources}=sampleFixture();
  for(const[frame,id]of [[47,5],[43,3],[39,4]]){audio.effects([{type:'pose',frame,falling:true,flags:0,player:0}]);assert.equal(sources.at(-1).buffer,buffers[id]);}
  const g=new scope.KarateEngine.Game({mode:'two'});g.startAction(g.players[0],18);
  for(let i=0;i<50;i++)g.updatePlayer(g.players[0],{x:0,y:0,fire:false});
  assert.equal(g.drainEvents().filter(e=>e.type==='pose'&&e.frame===43).length,1,'held fallen frame must not restart its sample');
});
await test('low/flying contacts repeat at the original 80/100 ms and player zero keeps original priority',async()=>{
  const{audio,buffers,sources,context}=sampleFixture();
  audio.effects([{type:'hit',frame:21,player:0,tick:1}]);assert.equal(sources.length,2);
  assert.equal(sources[0].buffer,buffers[2]);assert(Math.abs(sources[1].startsAt-sources[0].startsAt-.08)<1e-9);
  assert.equal(sources[0].stopsAt,sources[1].startsAt);
  audio.effects([{type:'hit',frame:22,player:1,tick:2}]);assert.equal(sources.at(-1).buffer,buffers[0]);assert(Math.abs(sources.at(-1).startsAt-context.currentTime-.1)<1e-9);
  audio.effects([{type:'pose',frame:20,flags:9,player:0,tick:3},{type:'pose',frame:6,flags:64,player:1,tick:3}]);assert.equal(sources.at(-1).buffer,buffers[2]);
});
await test('sample playback is monophonic, silences music without pausing it and restores it on completion',async()=>{
  const{audio,sources,track,context}=sampleFixture();audio.sync(true,false);await settle();track.currentTime=42;
  audio.sample(0);assert.equal(track.volume,0);assert(!track.paused);assert.equal(track.currentTime,42);
  assert(Math.abs(sources[0].playbackRate.value-3700/scope.KARATE_SFX.sourceSampleRate)<1e-9);
  audio.sample(1);assert.equal(sources[0].stopsAt,context.currentTime);assert.equal(audio.voices.size,1);
  sources[1].onended();assert.equal(track.volume,.42);assert.equal(audio.voices.size,0);
});
await test('pause, mute, menu and music-only mode stop both current and delayed samples',async()=>{
  for(const args of [[true,true,'both',false],[true,false,'both',true],[false,false,'both',false],[true,false,'music',false]]){
    const{audio,sources}=sampleFixture();audio.sync(true,false);await settle();audio.sample(2,.08);assert.equal(audio.voices.size,2);
    audio.sync(...args);assert.equal(audio.voices.size,0);assert(sources.every(s=>s.stopsAt!==undefined));const count=sources.length;audio.sample(0);
    if(args[0])assert.equal(sources.length,count);
  }
});
console.log(`${passed} International Karate audio tests passed.`);
