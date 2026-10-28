(function(root){'use strict';
class Audio{
 constructor(){this.muted=false;this.ready=false;this.pending=[];this.values=Array(9).fill(0);this.base=null;}
 async unlock(){if(this.context){if(this.context.state!=='running'){await this.context.resume();this.base=null;}return;}const C=root.AudioContext||root.webkitAudioContext;if(!C)return;
  this.context=new C();this.gain=this.context.createGain();this.gain.gain.value=.7;this.gain.connect(this.context.destination);
  if(this.context.audioWorklet){try{await this.context.audioWorklet.addModule('sound-worklet.js');this.node=new AudioWorkletNode(this.context,'boulder-audio',{outputChannelCount:[1]});}catch(_){/* Local file URLs can use the identical generator below. */}}
  if(!this.node){this.wave=new root.BoulderSound.Wave(this.context.sampleRate);this.queue=[];this.node=this.context.createScriptProcessor(1024,0,1);this.node.onaudioprocess=e=>{const out=e.outputBuffer.getChannelData(0),start=e.playbackTime*this.context.sampleRate;let index=0;while(this.queue.length&&this.queue[0][0]<start+out.length){const [time,values]=this.queue.shift(),end=Math.max(index,Math.min(out.length,Math.round(time-start)));if(end>index)this.wave.process(out.subarray(index,end));index=end;this.wave.set(values);}if(index<out.length)this.wave.process(out.subarray(index));};}
  this.node.connect(this.gain);this.ready=true;await this.context.resume();
 }
 send(values,time){this.values=Array.from(values);if(!this.ready||this.muted)return;
  const now=this.context.currentTime;if(this.base===null||this.base+time<now-.1||this.base+time>now+.4)this.base=now+.05-time;
  this.pending.push([(this.base+time)*this.context.sampleRate,Array.from(values)]);
 }
 flush(){if(!this.pending.length||!this.ready)return;const events=this.pending;this.pending=[];if(this.wave)this.queue.push(...events);else this.node.port.postMessage({events});}
 stop(){this.pending=[];this.base=null;const reset=Array(9).fill(0);if(!this.ready)return;if(this.wave){this.queue=[];this.wave.set(reset);}else this.node.port.postMessage({reset});}
 toggle(){this.muted=!this.muted;this.stop();return this.muted;}
}
root.BoulderAudio=Audio;
})(globalThis);
