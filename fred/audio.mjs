import {Effects,Wave} from './sound.mjs';
export class FredAudio {
  constructor(data){this.data=data;this.mode=true;this.muted=false;this.paused=false;}
  async unlock() {
    if(!this.context){
      this.context=new (globalThis.AudioContext||globalThis.webkitAudioContext)();
      this.gain=this.context.createGain();this.gain.gain.value=.8;this.gain.connect(this.context.destination);
      this.ready=(async()=>{
        if(this.context.audioWorklet) {
          try {
            await this.context.audioWorklet.addModule('sound-worklet.mjs');
            this.node=new AudioWorkletNode(this.context,'fred-sound',{processorOptions:{data:{timing:this.data.timing,envelopes:this.data.envelopes}},outputChannelCount:[1]});
          } catch { /* Direct file:// opening can use the same native fallback. */ }
        }
        if(!this.node) {
          const effects=new Effects(this.data),wave=new Wave(this.context.sampleRate);let until=0;
          this.fallback=effects;this.fallbackWave=wave;this.node=this.context.createScriptProcessor(1024,0,1);
          this.node.onaudioprocess=event=>{const out=event.outputBuffer.getChannelData(0);if(this.mode||this.muted){out.fill(0);return;}
            let at=0;while(at<out.length){if(until<=0){wave.set(effects.tick());until+=this.context.sampleRate/(1773447/(312*114));}const n=Math.min(out.length-at,Math.ceil(until));wave.process(out.subarray(at,at+n));at+=n;until-=n;}};
        }
        this.node.connect(this.gain);
        const raw=Uint8Array.from(atob(this.data.music.data),c=>c.charCodeAt(0));
        this.buffer=await this.context.decodeAudioData(raw.buffer);
      })();
    }
    await this.context.resume();await this.ready;this.sync();if(this.paused)await this.context.suspend();
  }
  sync() {
    if(!this.context||!this.buffer)return;
    if(this.mode&&!this.muted) {
      if(!this.music){const s=this.context.createBufferSource();s.buffer=this.buffer;s.loop=true;s.loopStart=this.data.music.loopStart;s.loopEnd=this.data.music.loopEnd;s.connect(this.gain);s.start();this.music=s;}
    } else {this.music?.stop();this.music=null;}
    this.node?.port?.postMessage({active:!this.mode&&!this.muted});
  }
  request(id) {if(this.fallback){this.fallback.request(id);if(id&128)this.fallbackWave.set(this.fallback.registers);}else this.node?.port.postMessage({request:id});}
  setMode(music){if(this.mode!==music&&!music)this.request(128);this.mode=music;this.sync();}
  mute(){this.muted=!this.muted;this.sync();}
  pause(paused){this.paused=paused;if(this.context)(paused?this.context.suspend():this.context.resume()).catch(()=>{});}
}
