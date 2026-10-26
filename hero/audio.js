(function(root){'use strict';
class Audio{
 constructor(){this.muted=false;this.ready=false;this.values=[0,0,0,0];}
 async unlock(){if(this.context){await this.context.resume();return;}const C=root.AudioContext||root.webkitAudioContext;if(!C)return;this.context=new C();this.gain=this.context.createGain();this.gain.gain.value=.65;this.gain.connect(this.context.destination);
  if(this.context.audioWorklet){try{await this.context.audioWorklet.addModule('sound-worklet.js');this.node=new AudioWorkletNode(this.context,'hero-audio',{outputChannelCount:[1]});}catch(_){/* A local file can use the same waveform without a module fetch. */}}
  if(!this.node){this.wave=new root.HeroSound.Wave(this.context.sampleRate);this.node=this.context.createScriptProcessor(1024,0,1);this.node.onaudioprocess=e=>this.wave.process(e.outputBuffer.getChannelData(0));}
  this.node.connect(this.gain);this.ready=true;await this.context.resume();this.send(this.values);
 }
 send(values){this.values=values;if(!this.ready)return;if(this.wave)this.wave.set(values);else this.node.port.postMessage(values);}
 sync(game,fire=false){if(this.muted||!game||game.paused||game.phase==='over'){this.send([0,0,0,0]);return;}this.send(game.sound||root.HeroSound.registers(game.s,fire));}
 stop(){this.send([0,0,0,0]);}
}
root.HeroAudio=Audio;
})(globalThis);
