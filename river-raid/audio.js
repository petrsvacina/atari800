/* Pre-rendered original POKEY voices, mixed with native Web Audio. */
(function(root){'use strict';
class RiverAudio{
 constructor(options={}){this.assets=options.assets||root.RIVER_AUDIO;this.contextFactory=options.contextFactory||(()=>{const C=root.AudioContext||root.webkitAudioContext;return C?new C():null;});this.buffers=new Map();this.voices=new Set();this.channels=new Map();this.muted=false;this.engine=null;this.channelOne=null;this.unlocked=false;}
 unlock(){this.unlocked=true;if(this.context){this.context.resume?.().catch?.(()=>{});return;}this.context=this.contextFactory();if(!this.context)return;this.gain=this.context.createGain();this.gain.gain.value=.32;this.gain.connect(this.context.destination);
  for(const[name,e]of Object.entries(this.assets.effects)){const raw=root.atob(e.data),buffer=this.context.createBuffer(1,raw.length/2,this.assets.sampleRate),pcm=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++){let n=raw.charCodeAt(i*2)|raw.charCodeAt(i*2+1)<<8;if(n&32768)n-=65536;pcm[i]=n/32768;}this.buffers.set(name,buffer);}}
 stop(v){if(!v)return;v.onended=null;try{v.stop();}catch(_){}v.disconnect?.();this.voices.delete(v);for(const[k,value]of this.channels)if(value===v)this.channels.delete(k);if(v===this.channelOne)this.channelOne=null;if(v===this.engine)this.engine=null;}
 stopAll(){for(const v of [...this.voices])this.stop(v);this.engineName=null;}
 play(name,loop=false){if(!this.context||!this.unlocked||this.muted||!this.buffers.has(name))return null;const v=this.context.createBufferSource();v.buffer=this.buffers.get(name);v.loop=loop;v.connect(this.gain);this.voices.add(v);v.onended=()=>{this.voices.delete(v);if(this.channelOne===v)this.channelOne=null;for(const[k,value]of this.channels)if(value===v)this.channels.delete(k);v.disconnect?.();};v.start();return v;}
 event(e){if(e.type==='reset'||e.type==='over'||e.type==='complete'){this.stopAll();return;}if(['shot','explosion','refuel','full','life','tank'].includes(e.type)){
  const channel=['shot','life'].includes(e.type)?2:e.type==='tank'?1:0;this.stop(this.channels.get(channel));const single=channel===0;if(single){this.stop(this.channelOne);this.stop(this.engine);}const v=this.play(e.type);if(single)this.channelOne=v;if(v)this.channels.set(channel,v);
 }}
 sync(game,muted=this.muted){this.muted=muted;if(!this.context)return;if(muted||!game||game.paused||game.phase!=='playing'){this.stopAll();return;}if(this.channelOne)return;
  const name=game.fuel<16384?'warning':!(game.player.controls&1)?'fast':!(game.player.controls&2)?'slow':'engine';
  if(this.engineName!==name||!this.engine){this.stop(this.engine);this.engine=this.play(name,true);this.engineName=name;}
  if(this.engine&&name!=='warning'){const base=name==='fast'?17:name==='slow'?28:24;const rate=base/(32-(game.player.speed>>4));if(this.engine.playbackRate)this.engine.playbackRate.value=rate;}
 }
}
root.RiverAudio=RiverAudio;})(globalThis);
