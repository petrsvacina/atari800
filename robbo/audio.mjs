import {footstepPCM} from './sound.mjs';
import {Wave} from './wave.mjs';

/** Audio device only; the native sequencer owns the original effect timing. */
export class RobboAudio {
  constructor(){this.muted=false;this.paused=false;this.registers=new Uint8Array(9);this.pulses=[];this.clockHz=1773447;}
  async unlock(){
    if(!this.context){
      const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
      this.context=new Audio();this.gain=this.context.createGain();this.gain.gain.value=.7;this.gain.connect(this.context.destination);
      this.ready=(async()=>{
        if(this.context.audioWorklet&&location.protocol!=='file:')try{
          await this.context.audioWorklet.addModule(new URL('./sound-worklet.mjs',import.meta.url));
          this.node=new AudioWorkletNode(this.context,'robbo-sound',{processorOptions:{clockHz:this.clockHz},outputChannelCount:[1]});
        }catch{/* The same native generator supports local file:// pages. */}
        if(!this.node){
          this.wave=new Wave(this.context.sampleRate,this.clockHz);this.node=this.context.createScriptProcessor(1024,0,1);
          this.node.onaudioprocess=event=>{
            const out=event.outputBuffer.getChannelData(0);if(this.muted||this.paused){out.fill(0);this.pulses=[];return;}
            this.wave.set(this.registers);this.wave.process(out);
            for(const pulse of this.pulses){const count=Math.min(out.length,pulse.samples.length-pulse.at);for(let i=0;i<count;i++)out[i]+=pulse.samples[pulse.at++];}
            this.pulses=this.pulses.filter(pulse=>pulse.at<pulse.samples.length);
          };
        }
        this.node.connect(this.gain);this.sync();
      })();
    }
    await this.context.resume();await this.ready;if(this.paused)await this.context.suspend();
  }
  write(registers,steps=[]){
    this.registers.set(registers);this.sync();
    if(this.muted||this.paused||!this.node)return;
    for(const pulse of steps){if(this.node.port)this.node.port.postMessage({footstep:pulse});else this.pulses.push({samples:footstepPCM(pulse,{rate:this.context.sampleRate,clockHz:this.clockHz}),at:0});}
  }
  sync(){this.node?.port?.postMessage({registers:this.registers,clockHz:this.clockHz,active:!this.muted&&!this.paused});if(this.gain)this.gain.gain.value=this.muted?0:.7;}
  mute(){this.muted=!this.muted;this.pulses=[];this.sync();}
  pause(value){this.paused=value;this.pulses=[];this.sync();if(this.context)(value?this.context.suspend():this.context.resume()).catch(()=>{});}
}
