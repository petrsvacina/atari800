import {Wave} from './sound.mjs';
export class FractalusAudio {
  constructor(){this.muted=false;this.paused=false;this.registers=new Uint8Array(9);this.clockHz=1773447;}
  async unlock() {
    if(!this.context) {
      this.context=new (globalThis.AudioContext||globalThis.webkitAudioContext)();
      this.gain=this.context.createGain();this.gain.gain.value=.65;this.gain.connect(this.context.destination);
      this.ready=(async()=>{
        if(this.context.audioWorklet&&location.protocol!=='file:') {
          try {
            await this.context.audioWorklet.addModule(new URL('./sound-worklet.mjs',import.meta.url));
            this.node=new AudioWorkletNode(this.context,'fractalus-sound',{processorOptions:{clockHz:this.clockHz},outputChannelCount:[1]});
          } catch { /* The same native waveform generator is available locally. */ }
        }
        if(!this.node) {
          const wave=new Wave(this.context.sampleRate,this.clockHz);
          this.fallbackWave=wave;
          this.node=this.context.createScriptProcessor(1024,0,1);
          this.node.onaudioprocess=event=>{const out=event.outputBuffer.getChannelData(0);if(this.muted||this.paused){out.fill(0);return;}wave.set(this.registers);wave.process(out);};
        }
        this.node.connect(this.gain);this.sync();
      })();
    }
    await this.context.resume();await this.ready;if(this.paused)await this.context.suspend();
  }
  write(registers){this.registers.set(registers);this.sync();}
  sync(){this.node?.port?.postMessage({registers:this.registers,clockHz:this.clockHz,active:!this.muted&&!this.paused});if(this.fallbackWave)this.fallbackWave.clockHz=this.clockHz;if(this.gain)this.gain.gain.value=this.muted?0:.65;}
  mute(){this.muted=!this.muted;this.sync();}
  pause(value){this.paused=value;this.sync();if(this.context)(value?this.context.suspend():this.context.resume()).catch(()=>{});}
}
