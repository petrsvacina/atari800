/* Original PCM, joined-pair preemption and continuous native POKEY noise. */
(function(root){'use strict';
class Audio{
 constructor(options={}){this.data=options.data||root.KARATEKA_AUDIO;this.songs=options.music||root.KARATEKA_MUSIC.music;this.contextFactory=options.contextFactory||(()=>{const C=root.AudioContext||root.webkitAudioContext;return C?new C():null;});this.movieActive=options.movieActive||(()=>false);this.stopMovie=options.stopMovie||(()=>{});this.buffers=new Map();this.voices=[null,null];this.context=null;this.muted=false;this.musicSource=null;this.noisePairs=[false,false];}
 async unlock(){
  if(!this.context){this.context=this.contextFactory();if(!this.context)return false;this.gain=this.context.createGain();this.gain.gain.value=this.muted?0:.8;this.gain.connect(this.context.destination);this.noiseReady=this.initNoise();}
  if(this.context.state==='suspended')await this.context.resume();return this.context.state==='running';
 }
 async initNoise(){
  if(root.location?.protocol!=='file:'&&this.context.audioWorklet&&root.AudioWorkletNode){try{await this.context.audioWorklet.addModule('noise-worklet.js');this.noiseNode=new root.AudioWorkletNode(this.context,'karateka-noise',{outputChannelCount:[1]});}catch(_){}}
  if(!this.noiseNode){this.wave=new root.KaratekaNoise.Wave(this.context.sampleRate);this.noiseNode=this.context.createScriptProcessor(1024,0,1);this.noiseNode.onaudioprocess=e=>this.wave.process(e.outputBuffer.getChannelData(0));}
  this.noiseNode.connect(this.gain);this.syncNoise();
 }
 syncNoise(){const count=this.noisePairs.filter(Boolean).length;if(this.wave)this.wave.set(count);else this.noiseNode?.port.postMessage(count);}
 buffer(sample){
  if(this.buffers.has(sample.sha256))return this.buffers.get(sample.sha256);const raw=atob(sample.data),view=new DataView(new ArrayBuffer(raw.length));for(let i=0;i<raw.length;i++)view.setUint8(i,raw.charCodeAt(i));
  const buffer=this.context.createBuffer(1,raw.length/2,sample.sampleRate),channel=buffer.getChannelData(0);for(let i=0;i<channel.length;i++)channel[i]=view.getInt16(i*2,true)/32768;this.buffers.set(sample.sha256,buffer);return buffer;
 }
 start(sample,pairs,offset=0,original=sample){
  const buffer=this.buffer(sample);if(offset>=buffer.duration)return;const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.gain);const voice={source,sample:original,pairs,started:this.context.currentTime-offset};for(const pair of pairs)this.voices[pair]=voice;
  source.onended=()=>{for(const pair of pairs)if(this.voices[pair]===voice)this.voices[pair]=null;source.disconnect?.();};source.start(0,offset);return voice;
 }
 stopPair(pair){
  this.noisePairs[pair]=false;const voice=this.voices[pair];if(!voice)return;const remaining=voice.pairs.filter(p=>p!==pair&&this.voices[p]===voice),offset=this.context.currentTime-voice.started;
  voice.source.onended=null;voice.source.stop();voice.source.disconnect?.();for(const p of voice.pairs)if(this.voices[p]===voice)this.voices[p]=null;
  // Full mixed PCM remains exact until a one-pair effect interrupts it. Only
  // then continue the unaffected joined pair from its original offline stem.
  for(const p of remaining)if(voice.sample.stems?.[p])this.start(voice.sample.stems[p],[p],offset);
 }
 effect(id){
  if(!this.context||this.context.state!=='running'||this.musicSource||this.movieActive())return;const sample=this.data.effects.find(e=>e.id===id);if(!sample)return;
  if(sample.record[0]===1)this.stopEffects();else this.stopPair(0);
  if(sample.holds){this.noisePairs=[true,true];this.syncNoise();return;}
  this.syncNoise();this.start(sample,sample.record[0]===1?[0,1]:[0]);
 }
 music(id){
  if(!this.context||this.context.state!=='running')return;const sample=this.songs.find(e=>e.id===id);if(!sample)return;this.stop();this.stopMovie();const source=this.context.createBufferSource();source.buffer=this.buffer(sample);source.connect(this.gain);source.start();this.musicSource=source;source.onended=()=>{if(this.musicSource===source)this.musicSource=null;source.disconnect?.();};
 }
 event(e){if(e.type==='music')this.music(e.id);else if(e.type==='effect')this.effect(e.id);else if(e.type==='gate'){this.stop();this.stopMovie();this.effect(e.id);}}
 mute(value){this.muted=!!value;if(this.gain)this.gain.gain.setValueAtTime(this.muted?0:.8,this.context.currentTime);}
 async pause(value){if(!this.context)return;if(value)await this.context.suspend();else if(this.context.state==='suspended')await this.context.resume();}
 stopEffects(){const unique=new Set(this.voices.filter(Boolean));this.voices=[null,null];for(const v of unique){v.source.onended=null;v.source.stop();v.source.disconnect?.();}this.noisePairs=[false,false];this.syncNoise();}
 stop(){this.stopEffects();if(this.musicSource){this.musicSource.onended=null;this.musicSource.stop();this.musicSource.disconnect?.();this.musicSource=null;}}
}
root.KaratekaAudio=Audio;
})(globalThis);
