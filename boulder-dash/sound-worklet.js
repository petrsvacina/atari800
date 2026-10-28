import './sound-core.js';
class BoulderAudioProcessor extends AudioWorkletProcessor{
 constructor(){super();this.wave=new globalThis.BoulderSound.Wave(sampleRate);this.queue=[];this.port.onmessage=e=>{if(e.data.reset){this.queue=[];this.wave.set(e.data.reset);}if(e.data.events)this.queue.push(...e.data.events);};}
 process(inputs,outputs){const out=outputs[0][0];let index=0;while(this.queue.length&&this.queue[0][0]<currentFrame+out.length){const [time,values]=this.queue.shift(),end=Math.max(index,Math.min(out.length,Math.round(time-currentFrame)));if(end>index)this.wave.process(out.subarray(index,end));index=end;this.wave.set(values);}if(index<out.length)this.wave.process(out.subarray(index));return true;}
}
registerProcessor('boulder-audio',BoulderAudioProcessor);
