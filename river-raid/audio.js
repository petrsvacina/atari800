/* Continuous native POKEY motor, mixed with original PCM effects. */
(function(root){'use strict';
class RiverAudio{
 constructor(options={}){this.assets=options.assets||root.RIVER_AUDIO;this.contextFactory=options.contextFactory||(()=>{const C=root.AudioContext||root.webkitAudioContext;return C?new C():null;});this.buffers=new Map();this.voices=new Set();this.channels=new Map();this.muted=false;this.engine=null;this.channelOne=null;this.unlocked=false;this.lifeVoice=null;this.shotBase=null;this.motorValues=[23,0];}
 unlock(){this.unlocked=true;if(this.context){this.context.resume?.().catch?.(()=>{});return;}this.context=this.contextFactory();if(!this.context)return;this.gain=this.context.createGain();this.gain.gain.value=.32;this.gain.connect(this.context.destination);
  for(const[name,e]of Object.entries(this.assets.effects)){const raw=root.atob(e.data),buffer=this.context.createBuffer(1,raw.length/2,this.assets.sampleRate),pcm=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++){let n=raw.charCodeAt(i*2)|raw.charCodeAt(i*2+1)<<8;if(n&32768)n-=65536;pcm[i]=n/32768;}this.buffers.set(name,buffer);}this.motorReady=this.initMotor();}
 async initMotor(){
  if(this.context.audioWorklet&&root.AudioWorkletNode){try{await this.context.audioWorklet.addModule('motor-worklet.js?v=20261029-continuous');this.motorNode=new root.AudioWorkletNode(this.context,'river-motor',{outputChannelCount:[1]});}catch(_){/* file:// and older browsers use the same continuous waveform below. */}}
  if(!this.motorNode){this.motorWave=new root.RiverMotor.Wave(this.context.sampleRate);this.motorNode=this.context.createScriptProcessor(1024,0,1);this.motorNode.onaudioprocess=e=>this.motorWave.process(e.outputBuffer.getChannelData(0));}
  this.motorNode.connect(this.gain);this.sendMotor(this.motorValues);
 }
 sendMotor(values){this.motorValues=values;if(this.motorWave)this.motorWave.set(values);else this.motorNode?.port.postMessage(values);}
 stopMotor(){if(this.motorValues[1])this.sendMotor([this.motorValues[0],0]);this.engine=null;this.engineName=null;}
 stop(v){if(!v)return;if(v===this.motorNode){this.stopMotor();return;}v.onended=null;try{v.stop();}catch(_){}v.disconnect?.();this.voices.delete(v);for(const[k,value]of this.channels)if(value===v)this.channels.delete(k);if(v===this.channelOne)this.channelOne=null;if(v===this.engine)this.engine=null;if(v===this.lifeVoice)this.lifeVoice=null;}
 stopAll(){for(const v of [...this.voices])this.stop(v);this.stopMotor();this.enemyBase=null;this.gunnerVoice=null;this.lifeVoice=null;this.shotBase=null;}
 play(name,loop=false,offset=0,ended){if(!this.context||!this.unlocked||this.muted||!this.buffers.has(name))return null;const v=this.context.createBufferSource();v.buffer=this.buffers.get(name);v.loop=loop;if(loop){const e=this.assets.effects[name];v.loopStart=e.loopStart??0;v.loopEnd=e.loopEnd??v.buffer.duration;}v.connect(this.gain);this.voices.add(v);v.onended=()=>{this.voices.delete(v);if(this.channelOne===v)this.channelOne=null;for(const[k,value]of this.channels)if(value===v)this.channels.delete(k);v.disconnect?.();ended?.();};v.start(0,offset);return v;}
 resumeEnemy(){const e=this.enemyBase,now=this.context.currentTime||0;if(!e||now>=e.end)return;const v=this.play(e.name,false,Math.max(0,now-e.start));if(v)this.channels.set(1,v);}
 resumeShot(){const e=this.shotBase,now=this.context.currentTime||0;if(this.lifeVoice||!e||now>=e.end)return;const v=this.play('shot',false,Math.max(0,now-e.start));if(v)this.channels.set(2,v);}
 event(e){if(e.type==='reset'||e.type==='over'||e.type==='complete'){this.stopAll();return;}
  const name=e.type==='crash'?(e.sound==='fuel'?'fuelExplosion':'explosion'):e.type==='explosion'?(e.tank?'tankExplosion':'enemyExplosion'):e.type;
  if(!['shot','explosion','fuelExplosion','enemyExplosion','tankExplosion','refuel','full','life','tank','tankBeam'].includes(name)||!this.context||this.muted)return;
  const channel=['shot','life'].includes(name)?2:['tank','enemyExplosion','tankExplosion'].includes(name)?1:name==='tankBeam'?3:0;
  if(channel===2){
   const now=this.context.currentTime||0;
   if(name==='life'){
    this.stop(this.channels.get(2));const v=this.play(name,false,0,()=>{if(this.lifeVoice===v)this.lifeVoice=null;this.resumeShot();});this.lifeVoice=v;if(v)this.channels.set(2,v);
   }else{this.shotBase={start:now,end:now+this.assets.effects.shot.duration};if(!this.lifeVoice){this.stop(this.channels.get(2));this.resumeShot();}}
   return;
  }
  if(channel===1){
   const now=this.context.currentTime||0;
   if(name==='tank'){
    this.stop(this.channels.get(1));const v=this.play(name,false,0,()=>{this.gunnerVoice=null;this.resumeEnemy();});this.gunnerVoice=v;if(v){this.channels.set(1,v);v.stop(now+9/this.assets.frameHz);}return;
   }
   this.enemyBase={name,start:now,end:now+this.assets.effects[name].duration};
   if(!this.gunnerVoice){this.stop(this.channels.get(1));this.resumeEnemy();}return;
  }
  this.stop(this.channels.get(channel));const single=channel===0;if(single){this.stop(this.channelOne);this.stop(this.engine);this.stopMotor();}const v=this.play(name);if(single)this.channelOne=v;if(v)this.channels.set(channel,v);
 }
 sync(game,muted=this.muted){this.muted=muted;if(!this.context)return;if(muted||!game||game.paused||game.phase==='over'){this.stopAll();return;}
  if(game.phase!=='playing'){this.stop(this.engine);this.stopMotor();return;}if(this.channelOne)return;
  const name=game.fuel<16384?'warning':!(game.player.controls&1)?'fast':!(game.player.controls&2)?'slow':'engine';
  if(name==='warning'){if(this.engineName!==name||!this.engine){this.stop(this.engine);this.stopMotor();this.engine=this.play(name,true);this.engineName=name;}return;}
  if(this.engineName==='warning')this.stop(this.engine);
  const values=root.RiverMotor.registers(game.player);if(values.some((v,i)=>v!==this.motorValues[i]))this.sendMotor(values);
  this.engine=this.motorNode||null;this.engineName=name;
 }
}
root.RiverAudio=RiverAudio;})(globalThis);
