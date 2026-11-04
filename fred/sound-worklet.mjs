import {Effects,Wave} from './sound.mjs';
class FredProcessor extends AudioWorkletProcessor {
  constructor(options){super();this.effects=new Effects(options.processorOptions.data);this.wave=new Wave(sampleRate);this.until=0;this.active=false;
    this.port.onmessage=({data})=>{
      if(data.request!==undefined){this.effects.request(data.request);if(data.request&128){this.wave.set(this.effects.registers);this.until=0;}}
      if(data.active!==undefined)this.active=data.active;
    };}
  process(inputs,outputs) {
    const out=outputs[0][0];if(!this.active){out.fill(0);return true;}
    let at=0;while(at<out.length){if(this.until<=0){this.wave.set(this.effects.tick());this.until+=sampleRate/(1773447/(312*114));}
      const n=Math.min(out.length-at,Math.ceil(this.until));this.wave.process(out.subarray(at,at+n));at+=n;this.until-=n;}
    return true;
  }
}
registerProcessor('fred-sound',FredProcessor);
